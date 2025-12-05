
import React, { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Menu, BedDouble, Calendar, Share2, Cog, ChevronDown, ChevronRight, Building, Plus, Trash2, Bed, CheckCircle2, Copy, Cloud, CloudOff, Loader2, RefreshCw, LogOut, Download, X, Lock } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Dashboard from "./components/Dashboard";
import LoginScreen from "./components/LoginScreen";
import {
  INITIAL_CHANNELS,
  INITIAL_ROOMS,
  INITIAL_SEASONS,
  INITIAL_SETTINGS,
} from "./constants";
import { Property, RoomType, SettingsTab, UserPermissions } from "./types";
import { supabase } from "./utils/supabaseClient";
import { fetchSeasonOccupancyMap, fetchHotresRooms } from "./utils/hotresApi";
import { getUserPermissions } from "./utils/userConfig";

// Utility for deep cloning
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({ role: 'client', allowedPropertyIds: [] });

  // Application State
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("rooms");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Add Property Modal State
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [addPropertyMode, setAddPropertyMode] = useState<'manual' | 'import'>('manual');
  const [importOid, setImportOid] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error' | 'offline'>('idle');
  const [isLoading, setIsLoading] = useState(false); // Changed default to false, controlled by auth
  const [loadError, setLoadError] = useState<string | null>(null);

  // Property Data
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>("default");
  
  // Track expanded sidebar items
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set(["default"]));

  // Occupancy Auto-Refresh State
  const [lastOccupancyFetch, setLastOccupancyFetch] = useState<number>(0);
  const [isOccupancyRefreshing, setIsOccupancyRefreshing] = useState(false);

  // Ref to track the last known server state to prevent loops
  const lastServerState = useRef<Record<string, string>>({});

  // Ref for debouncing save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref for clearing success message
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 0. Check Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserPermissions(getUserPermissions(session.user.email));
        fetchProperties();
      }
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
         setUserPermissions(getUserPermissions(session.user.email));
         fetchProperties();
      } else {
         setProperties([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Function to process loaded properties and update refs
  const processLoadedProperties = (props: Property[]) => {
    props.forEach(p => {
      lastServerState.current[p.id] = JSON.stringify(p);
    });
    setProperties(props);
  };

  const fetchProperties = async () => {
    setIsLoading(true);
    setSyncStatus('idle');
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('updated_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        let loadedProps = data.map(row => ({
           ...row.content,
           id: row.id
        }));

        // FILTER PROPERTIES BASED ON ROLE
        const perms = getUserPermissions(session?.user?.email);
        if (perms.role === 'client') {
           const allowedIds = perms.allowedPropertyIds || [];
           loadedProps = loadedProps.filter(p => allowedIds.includes(p.id));
        }

        processLoadedProperties(loadedProps);
        
        if (loadedProps.length > 0 && !loadedProps.find(p => p.id === activePropertyId)) {
            setActivePropertyId(loadedProps[0].id);
        }
      } else {
        // Only create default if Super Admin
        const perms = getUserPermissions(session?.user?.email);
        if (perms.role === 'super_admin') {
           const defaultProp: Property = {
             id: "default",
             name: "Główny Obiekt",
             oid: "",
             settings: deepClone(INITIAL_SETTINGS),
             channels: deepClone(INITIAL_CHANNELS),
             rooms: deepClone(INITIAL_ROOMS),
             seasons: deepClone(INITIAL_SEASONS),
             notes: "",
           };
           await supabase.from('properties').insert({ id: defaultProp.id, content: defaultProp });
           processLoadedProperties([defaultProp]);
           setActivePropertyId(defaultProp.id);
        } else {
           setProperties([]); // Empty state for read-only user if DB is empty
        }
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setSyncStatus('error');
      setLoadError(err.message || JSON.stringify(err));
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Realtime Subscription (Only if logged in)
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        (payload) => {
          // If read-only user (Admin/Client), just consume updates
          // Super Admin also consumes to stay synced
          const perms = getUserPermissions(session.user.email);
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newContent = payload.new.content as Property;
            const newId = payload.new.id;
            
            // Client Filter Check
            if (perms.role === 'client' && !perms.allowedPropertyIds?.includes(newId)) {
               return; // Ignore update for property not allowed
            }

            lastServerState.current[newId] = JSON.stringify(newContent);
            setProperties(prev => {
              const exists = prev.find(p => p.id === newId);
              if (exists) {
                return prev.map(p => p.id === newId ? { ...newContent, id: newId } : p);
              } else {
                return [...prev, { ...newContent, id: newId }];
              }
            });
          } else if (payload.eventType === 'DELETE') {
             const deletedId = payload.old.id;
             delete lastServerState.current[deletedId];
             setProperties(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // 2. Save Changes
  useEffect(() => {
    if (isLoading || properties.length === 0 || !session) return;
    
    // PERMISSION CHECK: Only Super Admin can save
    if (userPermissions.role !== 'super_admin') return;

    const propToSave = properties.find(p => p.id === activePropertyId);
    if (!propToSave) return;

    const currentJson = JSON.stringify(propToSave);
    const lastKnownJson = lastServerState.current[propToSave.id];

    if (currentJson === lastKnownJson) return;

    setSyncStatus('saving');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        lastServerState.current[propToSave.id] = currentJson;

        const { error } = await supabase
          .from('properties')
          .upsert({ 
            id: propToSave.id, 
            content: propToSave,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;

        setSyncStatus('synced');
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => {
            setSyncStatus('idle');
        }, 3000);

      } catch (err) {
        console.error("Error saving to DB:", err);
        lastServerState.current[propToSave.id] = lastKnownJson || ""; 
        setSyncStatus('error');
      }
    }, 1000); 

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [properties, activePropertyId, session, isLoading, userPermissions]);

  // Helper logic to sync occupancy for a property
  const syncPropertyOccupancy = async (propId: string) => {
    // Only Super Admin should trigger expensive syncs, but let's allow it for now if needed. 
    // Actually, prompt says Admin/Client are Read Only. 
    // However, refreshing occupancy is fetching data, not changing config. 
    // But it does change STATE. So effectively it's a write operation.
    // We will allow Super Admin only to trigger updates that save to DB.
    if (userPermissions.role !== 'super_admin') {
       alert("Brak uprawnień do aktualizacji bazy danych.");
       return;
    }

    const prop = properties.find(p => p.id === propId);
    if (!prop || !prop.oid) return;

    console.log(`Syncing occupancy for property ${prop.name} (${prop.oid})`);
    
    let updatedRooms = deepClone(prop.rooms);
    let hasUpdates = false;

    for (const season of prop.seasons) {
      const occupancyMap = await fetchSeasonOccupancyMap(prop.oid, season.startDate, season.endDate);
      
      updatedRooms = updatedRooms.map(room => {
        if (room.tid && occupancyMap[room.tid] !== undefined) {
            const newRate = occupancyMap[room.tid];
            const currentRates = room.seasonOccupancy || {};
            if (currentRates[season.id] !== newRate) {
              hasUpdates = true;
              return {
                ...room,
                seasonOccupancy: {
                  ...currentRates,
                  [season.id]: newRate
                }
              };
            }
        }
        return room;
      });
    }

    if (hasUpdates) {
       setProperties(prev => prev.map(p => 
        p.id === propId ? { ...p, rooms: updatedRooms } : p
      ));
    }
  };


  // 3. Auto-Refresh Occupancy (60 min interval)
  useEffect(() => {
    if (!session || isLoading || !activePropertyId) return;

    const checkAndFetchOccupancy = async () => {
      // Only Super Admin runs the background sync to avoid conflicts
      if (userPermissions.role !== 'super_admin') return;

      const now = Date.now();
      const sixtyMinutes = 60 * 60 * 1000;
      const prop = properties.find(p => p.id === activePropertyId);

      if (prop && prop.oid && (now - lastOccupancyFetch > sixtyMinutes) && !isOccupancyRefreshing) {
        setIsOccupancyRefreshing(true);
        try {
          await syncPropertyOccupancy(activePropertyId);
          setLastOccupancyFetch(now);
        } catch (e) {
          console.error("Auto-refresh occupancy failed", e);
        } finally {
          setIsOccupancyRefreshing(false);
        }
      }
    };

    checkAndFetchOccupancy();
    const intervalId = setInterval(checkAndFetchOccupancy, 60000); 
    return () => clearInterval(intervalId);
  }, [session, activePropertyId, properties, lastOccupancyFetch, isOccupancyRefreshing, isLoading, userPermissions]);


  const activeProperty = properties.find(p => p.id === activePropertyId) || properties[0];

  const updateActiveProperty = (updates: Partial<Property>) => {
    if (userPermissions.role !== 'super_admin') return; // Enforce Read-Only
    setProperties(prev => prev.map(p => 
      p.id === activePropertyId ? { ...p, ...updates } : p
    ));
  };

  const handleRoomUpdate = (roomId: string, updates: Partial<RoomType>) => {
    if (userPermissions.role !== 'super_admin') return;
    if (!activeProperty) return;
    const updatedRooms = activeProperty.rooms.map(r => 
      r.id === roomId ? { ...r, ...updates } : r
    );
    updateActiveProperty({ rooms: updatedRooms });
  };

  const handleOccupancyUpdate = (roomId: string, seasonId: string, rate: number) => {
    if (userPermissions.role !== 'super_admin') return;
    if (!activeProperty) return;
    const room = activeProperty.rooms.find(r => r.id === roomId);
    if (!room) return;

    const currentOccupancy = room.seasonOccupancy || {};
    const updatedOccupancy = { ...currentOccupancy, [seasonId]: rate };

    handleRoomUpdate(roomId, { seasonOccupancy: updatedOccupancy });
  };

  const handleReorderRooms = (reorderedRooms: RoomType[]) => {
    if (userPermissions.role !== 'super_admin') return;
    updateActiveProperty({ rooms: reorderedRooms });
  };

  const handleDuplicateSeasons = (targetPropertyId: string) => {
    if (userPermissions.role !== 'super_admin') return;
    if (!activeProperty) return;
    const targetProp = properties.find(p => p.id === targetPropertyId);
    if (!targetProp) return;

    const seasonsCopy = deepClone(activeProperty.seasons);
    const obpCopy = deepClone(activeProperty.settings.seasonalObp);

    setProperties(prev => prev.map(p => {
       if (p.id === targetPropertyId) {
          return {
             ...p,
             seasons: seasonsCopy,
             settings: {
                ...p.settings,
                seasonalObp: obpCopy
             }
          }
       }
       return p;
    }));
    alert("Sezony zostały skopiowane pomyślnie.");
  };

  const handleCreateProperty = async () => {
    if (userPermissions.role !== 'super_admin') return;

    const newId = Date.now().toString();
    let newProperty: Property;

    if (addPropertyMode === 'import') {
      if (!importOid) {
        alert("Wpisz numer OID.");
        return;
      }
      setIsImporting(true);
      try {
        const importedRooms = await fetchHotresRooms(importOid);
        
        newProperty = {
          id: newId,
          name: `Obiekt ${importOid}`,
          oid: importOid,
          settings: deepClone(INITIAL_SETTINGS),
          channels: deepClone(INITIAL_CHANNELS),
          rooms: importedRooms,
          seasons: deepClone(INITIAL_SEASONS),
          notes: `Zaimportowano z Hotres OID: ${importOid}`,
        };
      } catch (e: any) {
        alert("Błąd importu: " + e.message);
        setIsImporting(false);
        return;
      }
      setIsImporting(false);
    } else {
      newProperty = {
        id: newId,
        name: "Nowy Obiekt",
        oid: "",
        settings: deepClone(INITIAL_SETTINGS),
        channels: deepClone(INITIAL_CHANNELS),
        rooms: deepClone(INITIAL_ROOMS),
        seasons: deepClone(INITIAL_SEASONS),
        notes: "",
      };
    }

    setProperties([...properties, newProperty]);
    setActivePropertyId(newId);
    setExpandedProperties(prev => new Set(prev).add(newId));
    setActiveTab("settings");
    setActiveSettingsTab("global");
    
    lastServerState.current[newId] = JSON.stringify(newProperty);
    await supabase.from('properties').insert({ id: newId, content: newProperty });
    
    setShowAddPropertyModal(false);
    setImportOid("");
    setAddPropertyMode('manual');
  };

  const handleDuplicateProperty = async () => {
    if (userPermissions.role !== 'super_admin') return;
    if (!activeProperty) return;

    const newId = Date.now().toString();
    const newProperty: Property = deepClone(activeProperty);
    
    newProperty.id = newId;
    newProperty.name = `${newProperty.name} (Kopia)`;
    
    setProperties([...properties, newProperty]);
    setActivePropertyId(newId);
    setExpandedProperties(prev => new Set(prev).add(newId));

    lastServerState.current[newId] = JSON.stringify(newProperty);
    await supabase.from('properties').insert({ id: newId, content: newProperty });
    alert(`Zduplikowano obiekt jako "${newProperty.name}"`);
  };

  const handleDeleteProperty = async (id: string) => {
    if (userPermissions.role !== 'super_admin') return;

    if (properties.length <= 1) {
      alert("Musisz zachować przynajmniej jeden obiekt.");
      return;
    }
    if (confirm("Czy na pewno chcesz usunąć ten obiekt? Ta operacja usunie go również z bazy danych dla wszystkich użytkowników.")) {
      const newProps = properties.filter(p => p.id !== id);
      setProperties(newProps);
      delete lastServerState.current[id];

      if (id === activePropertyId) {
        setActivePropertyId(newProps[0].id);
        setSelectedRoomId(null);
      }
      await supabase.from('properties').delete().eq('id', id);
    }
  };

  const handleSettingsNav = (tab: SettingsTab) => {
    setActiveTab("settings");
    setActiveSettingsTab(tab);
    setIsSidebarOpen(false);
  };

  const togglePropertyExpansion = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedProperties(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRoomClick = (propertyId: string, roomId: string) => {
    setActivePropertyId(propertyId);
    setSelectedRoomId(roomId);
    setActiveTab("dashboard");
    setIsSidebarOpen(false);
  };
  
  const handleManualSync = () => {
      fetchProperties();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isReadOnly = userPermissions.role !== 'super_admin';

  // --- Render Views ---

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white gap-2">
        <Loader2 className="animate-spin" /> Inicjalizacja...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (loadError) {
    return (
       <div className="flex flex-col h-screen items-center justify-center bg-slate-50 text-slate-800 p-4">
        {/* Error UI kept same as previous */}
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full border border-red-200">
           <div className="flex items-center gap-2 text-red-600 font-bold mb-4">
             <CloudOff size={24} />
             <h2>Błąd połączenia z bazą danych</h2>
           </div>
           <p className="mb-4 text-sm text-slate-600">
             Nie udało się pobrać danych. Może to oznaczać, że tabela w Supabase nie istnieje.
           </p>
           <div className="bg-slate-100 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto mb-4">
             {loadError}
           </div>
           <div className="mt-6 border-t pt-4 text-center">
             <button onClick={() => window.location.reload()} className="text-blue-600 font-bold hover:underline">Spróbuj ponownie</button>
           </div>
        </div>
      </div>
    );
  }

  if (isLoading && !activeProperty) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> Pobieranie danych...
      </div>
    );
  }

  if (!activeProperty) return <div className="p-8 text-center text-slate-500">Brak dostępnych obiektów. Skontaktuj się z administratorem.</div>;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Added flex-col and h-full for scrolling fix */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        flex flex-col h-full
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-700 flex flex-col gap-4 flex-shrink-0">
          <img 
            src="https://twojepokoje.com.pl/wp-content/uploads/2024/02/Twoje_pokoje_logo_full.webp" 
            alt="Twoje Pokoje Logo" 
            className="w-full h-auto object-contain"
            style={{ maxHeight: '60px' }}
          />
          <div className="text-center">
             <span className="text-sm font-bold tracking-tight text-slate-400 uppercase">Cennik Twoje Pokoje</span>
             <div className="text-xs text-slate-600 mt-1 truncate px-2">{session.user.email}</div>
             <div className={`text-[10px] uppercase font-bold mt-1 px-2 py-0.5 rounded inline-block ${userPermissions.role === 'super_admin' ? 'bg-blue-600' : userPermissions.role === 'admin' ? 'bg-purple-600' : 'bg-slate-700'}`}>
                {userPermissions.role === 'super_admin' ? 'Super Admin' : userPermissions.role === 'admin' ? 'Admin (Podgląd)' : 'Klient'}
             </div>
          </div>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto min-h-0">
          <button
            onClick={() => { setActiveTab("dashboard"); setSelectedRoomId(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors flex-shrink-0 ${
              activeTab === "dashboard" && selectedRoomId === null
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Panel</span>
          </button>

          {/* Configuration Dropdown */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                activeTab === "settings"
                  ? "text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <SettingsIcon size={20} />
                <span className="font-medium">Konfiguracja</span>
              </div>
              {isConfigExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Sub-menu */}
            {isConfigExpanded && (
              <div className="mt-1 ml-4 pl-4 border-l border-slate-700 space-y-1">
                {(["rooms", "seasons", "channels", "global"] as SettingsTab[]).map(tab => (
                   <button
                    key={tab}
                    onClick={() => handleSettingsNav(tab)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                      activeTab === "settings" && activeSettingsTab === tab
                        ? "bg-blue-600/50 text-white font-medium"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                    }`}
                  >
                    {tab === 'rooms' && <BedDouble size={16} />}
                    {tab === 'seasons' && <Calendar size={16} />}
                    {tab === 'channels' && <Share2 size={16} />}
                    {tab === 'global' && <Cog size={16} />}
                    <span className="capitalize">
                        {tab === 'rooms' ? 'Pokoje' : tab === 'seasons' ? 'Sezony' : tab === 'channels' ? 'Kanały' : 'Ogólne'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Properties Section */}
          <div className="mt-6 flex-shrink-0">
             <div className="flex items-center justify-between mb-2 px-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Twoje Obiekty</span>
                <div className="flex gap-1">
                   {isOccupancyRefreshing && <Loader2 size={12} className="text-slate-500 animate-spin" title="Odświeżanie obłożenia..." />}
                   {!isReadOnly && (
                    <button onClick={() => setShowAddPropertyModal(true)} className="text-blue-400 hover:text-blue-300 transition-colors p-1" title="Dodaj obiekt">
                      <Plus size={16} />
                    </button>
                   )}
                </div>
             </div>
             <div className="space-y-1 px-2">
                {properties.map(p => {
                  const isExpanded = expandedProperties.has(p.id);
                  const isActive = activePropertyId === p.id;
                  
                  return (
                   <div key={p.id} className="mb-1">
                     <div 
                        className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                           isActive 
                             ? "bg-slate-800 text-white" 
                             : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                        }`}
                        onClick={() => { setActivePropertyId(p.id); setSelectedRoomId(null); setActiveTab("dashboard"); }}
                     >
                        <div className="flex items-center gap-2 truncate flex-1">
                           <button 
                            onClick={(e) => togglePropertyExpansion(e, p.id)}
                            className="p-0.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                           >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                           </button>
                           <Building size={14} className="flex-shrink-0" />
                           <span className="truncate">{p.name}</span>
                        </div>
                        {properties.length > 1 && !isReadOnly && (
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteProperty(p.id); }}
                             className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 transition-opacity"
                             title="Usuń obiekt"
                          >
                             <Trash2 size={12} />
                          </button>
                        )}
                        {isReadOnly && isActive && <Lock size={12} className="text-slate-500" />}
                     </div>
                     
                     {isExpanded && (
                       <div className="ml-2 pl-4 border-l border-slate-800 space-y-1 mt-1">
                          {p.rooms.map(room => (
                            <button
                              key={room.id}
                              onClick={() => handleRoomClick(p.id, room.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-left transition-colors ${
                                isActive && activeTab === 'dashboard' && selectedRoomId === room.id
                                ? "text-blue-300 font-medium bg-slate-800/50" 
                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                              }`}
                            >
                              <Bed size={12} />
                              <span className="truncate">{room.name}</span>
                            </button>
                          ))}
                          {p.rooms.length === 0 && (
                            <div className="px-2 py-1 text-xs text-slate-600 italic">Brak pokoi</div>
                          )}
                       </div>
                     )}
                   </div>
                  );
                })}
             </div>
          </div>
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-3 flex-shrink-0">
           {/* Sync Status Indicator */}
          <div className="flex items-center justify-between">
             <div className={`flex items-center gap-2 text-xs transition-colors h-4 ${
                syncStatus === 'synced' ? 'text-green-400' : 
                syncStatus === 'saving' ? 'text-yellow-400' : 
                syncStatus === 'error' ? 'text-red-400' : 'text-slate-500 opacity-0'
             }`}>
               {syncStatus === 'synced' && <><CheckCircle2 size={12} /> <span>Zapisano w chmurze</span></>}
               {syncStatus === 'saving' && <><Loader2 size={12} className="animate-spin" /> <span>Zapisywanie...</span></>}
               {syncStatus === 'error' && <><CloudOff size={12} /> <span>Błąd zapisu</span></>}
             </div>
             
             <button 
               onClick={handleManualSync}
               className="text-slate-500 hover:text-white transition-colors p-1"
               title="Wymuś synchronizację"
             >
               <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
             </button>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors"
          >
            <LogOut size={14} /> Wyloguj się
          </button>
          
          <div className="text-xs text-slate-500">
            <p>Wersja 1.4.5</p>
            <p className="mt-1">© 2025 Twoje Pokoje & Strony Jakubowe</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <span className="font-bold text-slate-800">{activeProperty.name}</span>
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
            <Menu size={24} />
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {activeTab === "dashboard" ? (
            <Dashboard 
              key={activeProperty.id} 
              rooms={activeProperty.rooms} 
              seasons={activeProperty.seasons} 
              channels={activeProperty.channels}
              settings={activeProperty.settings}
              propertyOid={activeProperty.oid || ""}
              selectedRoomId={selectedRoomId}
              notes={activeProperty.notes || ""}
              onNotesChange={(n) => updateActiveProperty({ notes: n })}
              onRoomUpdate={handleRoomUpdate}
              onOccupancyUpdate={handleOccupancyUpdate}
              onReorderRooms={handleReorderRooms}
              onSyncAllOccupancy={() => syncPropertyOccupancy(activePropertyId)}
              isReadOnly={isReadOnly}
            />
          ) : (
            <SettingsPanel 
              key={activeProperty.id}
              propertyName={activeProperty.name}
              onPropertyNameChange={(name) => updateActiveProperty({ name })}
              propertyOid={activeProperty.oid || ""}
              onPropertyOidChange={(oid) => updateActiveProperty({ oid })}
              settings={activeProperty.settings}
              setSettings={(s) => updateActiveProperty({ settings: s })}
              channels={activeProperty.channels}
              setChannels={(c) => updateActiveProperty({ channels: c })}
              rooms={activeProperty.rooms}
              setRooms={(r) => updateActiveProperty({ rooms: r })}
              seasons={activeProperty.seasons}
              setSeasons={(s) => updateActiveProperty({ seasons: s })}
              activeTab={activeSettingsTab}
              onTabChange={setActiveSettingsTab}
              onDeleteProperty={() => handleDeleteProperty(activePropertyId)}
              onDuplicateProperty={handleDuplicateProperty}
              otherProperties={properties.filter(p => p.id !== activePropertyId)}
              onDuplicateSeasons={handleDuplicateSeasons}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      </main>

      {/* Add Property Modal */}
      {showAddPropertyModal && !isReadOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           {/* Modal Content - Same as previous */}
           <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Dodaj Nowy Obiekt</h3>
              <button onClick={() => setShowAddPropertyModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6">
              <div className="flex gap-4 mb-6">
                <button onClick={() => setAddPropertyMode('manual')} className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-semibold transition-all ${addPropertyMode === 'manual' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
                  <div className="flex flex-col items-center gap-2"><Plus size={24} /><span>Ręcznie</span></div>
                </button>
                <button onClick={() => setAddPropertyMode('import')} className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-semibold transition-all ${addPropertyMode === 'import' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
                  <div className="flex flex-col items-center gap-2"><Download size={24} /><span>Import Hotres</span></div>
                </button>
              </div>
              {addPropertyMode === 'import' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Podaj numer OID z Hotres</label>
                    <input type="text" value={importOid} onChange={(e) => setImportOid(e.target.value)} placeholder="np. 4268" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    <p className="text-xs text-slate-500 mt-1">Pobierzemy listę pokoi, ich nazwy oraz automatycznie wyliczymy maksymalne obłożenie.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100">Utworzymy pusty obiekt z domyślnymi ustawieniami. Będziesz mógł dodać pokoje ręcznie w panelu konfiguracji.</p>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowAddPropertyModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors">Anuluj</button>
              <button onClick={handleCreateProperty} disabled={isImporting} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {isImporting ? <><Loader2 size={16} className="animate-spin"/> Importowanie...</> : <>Utwórz Obiekt</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;