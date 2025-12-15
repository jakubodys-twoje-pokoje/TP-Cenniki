
import React, { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Menu, BedDouble, Calendar, Share2, Cog, ChevronDown, ChevronRight, Building, Plus, Trash2, Bed, CheckCircle2, Copy, Cloud, CloudOff, Loader2, RefreshCw, LogOut, Download, X, Lock, Users, Calculator, Eye, ShieldAlert } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Dashboard from "./components/Dashboard";
import ClientDashboard from "./components/ClientDashboard";
import LoginScreen from "./components/LoginScreen";
import UserManagementPanel from "./components/UserManagementPanel";
import CalculatorModal from "./components/CalculatorModal";
import {
  INITIAL_CHANNELS,
  INITIAL_ROOMS,
  INITIAL_SEASONS,
  INITIAL_SETTINGS,
} from "./constants";
import { Channel, Property, RoomType, SettingsTab, UserPermissions, UserRole } from "./types";
import { supabase } from "./utils/supabaseClient";
import { fetchSeasonOccupancyMap, fetchHotresRooms } from "./utils/hotresApi";
import { DEFAULT_DENIED_PERMISSION } from "./utils/userConfig";

// Utility for deep cloning
function deepClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.error("Deep clone error", e);
    return obj;
  }
}

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(DEFAULT_DENIED_PERMISSION);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Application State
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "client-view">("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("rooms");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Add Property Modal State
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [addPropertyMode, setAddPropertyMode] = useState<'manual' | 'import'>('manual');
  const [importOid, setImportOid] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // User Management Modal State
  const [showUserPanel, setShowUserPanel] = useState(false);
  
  // Calculator Modal State
  const [showCalculator, setShowCalculator] = useState(false);

  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error' | 'offline'>('idle');
  const [isLoading, setIsLoading] = useState(false); 
  const [loadError, setLoadError] = useState<string | null>(null);

  // Property Data
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>("");
  
  // Track expanded sidebar items
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());

  // Occupancy State
  const [isOccupancyRefreshing, setIsOccupancyRefreshing] = useState(false);

  // Drag and Drop State for Sidebar
  const [sidebarDragItem, setSidebarDragItem] = useState<{ type: 'property' | 'room', id: string, parentId?: string } | null>(null);

  // Ref to track the last known server state to prevent loops
  const lastServerState = useRef<Record<string, string>>({});
  // Ref for debouncing save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref for clearing success message
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // 1. STRICT AUTH & PERMISSION FLOW
  // ---------------------------------------------------------------------------
  
  const fetchPermissionsFromDb = async (email: string): Promise<UserPermissions | null> => {
      try {
          const { data, error } = await supabase
            .from('user_roles')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

          if (error) {
              if (error.code === 'PGRST116') {
                  console.warn("User not found in user_roles table.");
                  return null;
              }
              throw error;
          }

          // --- ADAPT TO DATABASE ---
          
          // 1. Role Normalization (Secure Default)
          let safeRole: UserRole = 'client';
          if (data.role) {
             const rawRole = String(data.role).toLowerCase().trim();
             if (rawRole === 'super_admin' || rawRole === 'super admin') {
                 safeRole = 'super_admin';
             } else if (rawRole === 'admin') {
                 safeRole = 'admin';
             }
          }

          // 2. ID Type Coercion (JSONB Fix)
          // Ensure we map everything to String to avoid number/string mismatch issues.
          const rawIds = data.allowed_property_ids;
          let safeIds: string[] = [];
          
          if (Array.isArray(rawIds)) {
              safeIds = rawIds.map((id: any) => String(id).trim());
          }

          console.log(`[Auth Debug] User: ${email}, DB Role: ${data.role} -> App Role: ${safeRole}, Allowed IDs:`, safeIds);

          return {
              role: safeRole,
              allowedPropertyIds: safeIds
          };
      } catch (err: any) {
          console.error("DB Permission Fetch Error:", err);
          return null;
      }
  };

  const initUser = async (currentSession: any) => {
      if (!currentSession?.user?.email) {
          setAuthLoading(false);
          return;
      }

      setAuthLoading(true);
      setPermissionError(null);

      const perms = await fetchPermissionsFromDb(currentSession.user.email);

      if (!perms) {
          setUserPermissions(DEFAULT_DENIED_PERMISSION);
          setPermissionError("Twoje konto nie ma przypisanych uprawnień. Skontaktuj się z administratorem.");
          setAuthLoading(false);
          return;
      }

      setUserPermissions(perms);

      // Only fetch properties if we have permissions
      await fetchProperties(perms);
      
      setAuthLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    // Initial Load
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted) {
            setSession(session);
            if (session) {
                initUser(session);
            } else {
                setAuthLoading(false);
            }
        }
    });

    // Auth Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (mounted) {
            setSession(session);
            if (event === 'SIGNED_IN' && session) {
                initUser(session);
            } else if (event === 'SIGNED_OUT') {
                setProperties([]);
                setUserPermissions(DEFAULT_DENIED_PERMISSION);
                setAuthLoading(false);
            }
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. DATA FETCHING (Dependent on Permissions)
  // ---------------------------------------------------------------------------

  const processLoadedProperties = (props: Property[]) => {
    // CRITICAL FIX: Robust mapping that handles undefined/null arrays to prevent crashes
    const migratedProps = props.map(p => ({
       ...p,
       // Fallback to empty arrays if data is malformed
       rooms: Array.isArray(p.rooms) ? p.rooms : [],
       channels: Array.isArray(p.channels) ? p.channels : [],
       settings: p.settings || INITIAL_SETTINGS,
       seasons: Array.isArray(p.seasons) ? p.seasons.map(s => ({
          ...s,
          channelRids: s.channelRids || (s.rid ? { 'direct': s.rid } : {})
       })) : [] // If seasons is missing, return empty array
    }));

    migratedProps.forEach(p => {
      lastServerState.current[p.id] = JSON.stringify(p);
    });
    setProperties(migratedProps);
  };

  const fetchProperties = async (perms: UserPermissions) => {
    setIsLoading(true);
    setSyncStatus('idle');
    setLoadError(null);

    try {
      let query = supabase.from('properties').select('*');
      
      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // Safe mapping with fallbacks right from the start
        let loadedProps: Property[] = data.map(row => {
           const content = row.content || {}; // Handle null content
           return {
             ...content,
             id: String(row.id), // Force DB ID as the string ID
             // Ensure required arrays exist even if content is partial
             rooms: Array.isArray(content.rooms) ? content.rooms : [],
             seasons: Array.isArray(content.seasons) ? content.seasons : [],
             channels: Array.isArray(content.channels) ? content.channels : [],
             settings: content.settings || INITIAL_SETTINGS
           };
        });

        // STRICT CLIENT FILTERING
        if (perms.role === 'client') {
            const allowedSet = new Set(perms.allowedPropertyIds); 
            
            loadedProps = loadedProps.filter(p => {
                return allowedSet.has(String(p.id));
            });
        }

        // Sorting
        loadedProps.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        loadedProps.forEach(p => {
          if (p.rooms) p.rooms.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        });

        processLoadedProperties(loadedProps);

        // Set Active Property Logic
        if (loadedProps.length > 0) {
            // Check if current active is still valid
            const isActiveValid = activePropertyId && loadedProps.some(p => p.id === activePropertyId);
            if (!isActiveValid) {
                setActivePropertyId(loadedProps[0].id);
                setExpandedProperties(new Set([loadedProps[0].id]));
            }
        } else {
            setActivePropertyId("");
        }
      } 
    } catch (err: any) {
      console.error("Fetch Properties Error:", err);
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. REALTIME SYNC
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!session || authLoading) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newContentRaw = payload.new.content || {};
            const newId = String(payload.new.id);
            
            // Safety normalize new content
            const newContent: Property = {
               ...newContentRaw,
               id: newId,
               rooms: Array.isArray(newContentRaw.rooms) ? newContentRaw.rooms : [],
               seasons: Array.isArray(newContentRaw.seasons) ? newContentRaw.seasons : [],
               channels: Array.isArray(newContentRaw.channels) ? newContentRaw.channels : [],
               settings: newContentRaw.settings || INITIAL_SETTINGS
            };

            // SECURITY CHECK
            if (userPermissions.role === 'client') {
               const allowed = new Set(userPermissions.allowedPropertyIds);
               if (!allowed.has(newId)) return;
            }

            // Migrations on the fly
            if (newContent.rooms) newContent.rooms.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            if (newContent.seasons) {
               newContent.seasons = newContent.seasons.map(s => ({
                   ...s,
                   channelRids: s.channelRids || (s.rid ? { 'direct': s.rid } : {})
               }));
            }

            lastServerState.current[newId] = JSON.stringify(newContent);
            
            setProperties(prev => {
              const exists = prev.find(p => p.id === newId);
              let updatedList;
              if (exists) {
                updatedList = prev.map(p => p.id === newId ? { ...newContent, id: newId } : p);
              } else {
                updatedList = [...prev, { ...newContent, id: newId }];
              }
              // Re-filter for client safety
              if (userPermissions.role === 'client') {
                  const allowed = new Set(userPermissions.allowedPropertyIds);
                  updatedList = updatedList.filter(p => allowed.has(String(p.id)));
              }
              return updatedList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            });
          } else if (payload.eventType === 'DELETE') {
             const deletedId = String(payload.old.id);
             delete lastServerState.current[deletedId];
             setProperties(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, userPermissions, authLoading]);

  // ---------------------------------------------------------------------------
  // 4. SAVE LOGIC (ADMIN ONLY)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isLoading || properties.length === 0 || !session || authLoading) return;
    
    // STRICT SECURITY: Clients cannot save.
    if (userPermissions.role === 'client') return;

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
  }, [properties, activePropertyId, session, isLoading, userPermissions, authLoading]);


  // ---------------------------------------------------------------------------
  // ACTION HANDLERS
  // ---------------------------------------------------------------------------

  const syncPropertyOccupancy = async (propId: string) => {
    if (userPermissions.role === 'client') {
       alert("Brak uprawnień.");
       return;
    }
    const prop = properties.find(p => p.id === propId);
    if (!prop || !prop.oid) return;
    setIsOccupancyRefreshing(true); 
    try {
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
                return { ...room, seasonOccupancy: { ...currentRates, [season.id]: newRate } };
              }
          }
          return room;
        });
      }
      if (hasUpdates) {
         setProperties(prev => prev.map(p => p.id === propId ? { ...p, rooms: updatedRooms } : p));
      }
    } catch (error) {
        alert("Błąd podczas synchronizacji dostępności.");
    } finally {
        setIsOccupancyRefreshing(false); 
    }
  };

  const activeProperty = properties.find(p => p.id === activePropertyId);

  const updateActiveProperty = (updates: Partial<Property>) => {
    if (userPermissions.role === 'client') return; 
    setProperties(prev => prev.map(p => p.id === activePropertyId ? { ...p, ...updates } : p));
  };

  const handleRoomUpdate = (roomId: string, updates: Partial<RoomType>) => {
    if (userPermissions.role === 'client') return;
    if (!activeProperty) return;
    const updatedRooms = activeProperty.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r);
    updateActiveProperty({ rooms: updatedRooms });
  };

  const handleOccupancyUpdate = (roomId: string, seasonId: string, rate: number) => {
    if (userPermissions.role === 'client') return;
    if (!activeProperty) return;
    const room = activeProperty.rooms.find(r => r.id === roomId);
    if (!room) return;
    handleRoomUpdate(roomId, { seasonOccupancy: { ...(room.seasonOccupancy || {}), [seasonId]: rate } });
  };

  const handleReorderRooms = (reorderedRooms: RoomType[]) => {
    if (userPermissions.role === 'client') return;
    updateActiveProperty({ rooms: reorderedRooms });
  };

  const handleDuplicateSeasons = (targetPropertyId: string) => {
    if (userPermissions.role === 'client') return;
    if (!activeProperty) return;
    const seasonsCopy = deepClone(activeProperty.seasons);
    setProperties(prev => prev.map(p => p.id === targetPropertyId ? { ...p, seasons: seasonsCopy } : p));
    alert("Sezony zostały skopiowane.");
  };

  const handleDuplicateChannelToProperty = async (sourceChannel: Channel, targetPropertyId: string) => {
    if (userPermissions.role === 'client') return;
    const targetProp = properties.find(p => p.id === targetPropertyId);
    if (!targetProp) return;
    const newChannel = { ...deepClone(sourceChannel), id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: `${sourceChannel.name} (Kopia)` };
    const updatedTargetProp = { ...targetProp, channels: [...targetProp.channels, newChannel] };
    setProperties(prev => prev.map(p => p.id === targetPropertyId ? updatedTargetProp : p));
    setSyncStatus('saving');
    lastServerState.current[targetPropertyId] = JSON.stringify(updatedTargetProp);
    await supabase.from('properties').upsert({ id: targetPropertyId, content: updatedTargetProp, updated_at: new Date().toISOString() });
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);
    alert("Kanał skopiowany.");
  };

  const handleDuplicateAllChannelsToProperty = async (targetPropertyId: string) => {
    if (userPermissions.role === 'client') return;
    if (!activeProperty) return;
    const targetProp = properties.find(p => p.id === targetPropertyId);
    if (!targetProp) return;
    const clonedChannels = deepClone(activeProperty.channels).map(c => ({ ...c, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) }));
    const updatedTargetProp = { ...targetProp, channels: clonedChannels };
    setProperties(prev => prev.map(p => p.id === targetPropertyId ? updatedTargetProp : p));
    setSyncStatus('saving');
    lastServerState.current[targetPropertyId] = JSON.stringify(updatedTargetProp);
    await supabase.from('properties').upsert({ id: targetPropertyId, content: updatedTargetProp, updated_at: new Date().toISOString() });
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);
    alert("Wszystkie kanały skopiowane.");
  };

  const handleCreateProperty = async () => {
    if (userPermissions.role === 'client') return;
    const newId = Date.now().toString();
    let newProperty: Property;
    if (addPropertyMode === 'import') {
      if (!importOid) { alert("Wpisz numer OID."); return; }
      setIsImporting(true);
      try {
        const importedRooms = await fetchHotresRooms(importOid);
        newProperty = {
          id: newId, name: `Obiekt ${importOid}`, oid: importOid, settings: deepClone(INITIAL_SETTINGS), channels: deepClone(INITIAL_CHANNELS), rooms: importedRooms, seasons: deepClone(INITIAL_SEASONS), notes: `Zaimportowano z Hotres OID: ${importOid}`, sortOrder: properties.length,
        };
      } catch (e: any) { alert("Błąd importu: " + e.message); setIsImporting(false); return; }
      setIsImporting(false);
    } else {
      newProperty = {
        id: newId, name: "Nowy Obiekt", oid: "", settings: deepClone(INITIAL_SETTINGS), channels: deepClone(INITIAL_CHANNELS), rooms: deepClone(INITIAL_ROOMS), seasons: deepClone(INITIAL_SEASONS), notes: "", sortOrder: properties.length,
      };
    }
    setProperties([...properties, newProperty]);
    setActivePropertyId(newId);
    setExpandedProperties(prev => new Set(prev).add(newId));
    lastServerState.current[newId] = JSON.stringify(newProperty);
    await supabase.from('properties').insert({ id: newId, content: newProperty });
    setShowAddPropertyModal(false);
    setImportOid("");
    setAddPropertyMode('manual');
  };

  const handleDuplicateProperty = async () => {
    if (userPermissions.role === 'client') return;
    if (!activeProperty) return;
    const newId = Date.now().toString();
    const newProperty: Property = deepClone(activeProperty);
    newProperty.id = newId;
    newProperty.name = `${newProperty.name} (Kopia)`;
    newProperty.sortOrder = properties.length;
    setProperties([...properties, newProperty]);
    setActivePropertyId(newId);
    setExpandedProperties(prev => new Set(prev).add(newId));
    lastServerState.current[newId] = JSON.stringify(newProperty);
    await supabase.from('properties').insert({ id: newId, content: newProperty });
    alert(`Zduplikowano obiekt.`);
  };

  const handleDeleteProperty = async (id: string) => {
    if (userPermissions.role === 'client') return;
    if (properties.length <= 1) { alert("Musisz zachować przynajmniej jeden obiekt."); return; }
    if (confirm("Czy na pewno usunąć ten obiekt?")) {
      const newProps = properties.filter(p => p.id !== id);
      setProperties(newProps);
      delete lastServerState.current[id];
      if (id === activePropertyId) { setActivePropertyId(newProps[0].id); setSelectedRoomId(null); }
      await supabase.from('properties').delete().eq('id', id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSettingsNav = (tab: SettingsTab) => {
     setActiveTab("settings");
     setActiveSettingsTab(tab);
     setIsSidebarOpen(false);
  };

  const togglePropertyExpansion = (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation();
    setExpandedProperties(prev => {
      const next = new Set(prev);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  };

  const handleRoomClick = (propId: string, roomId: string) => {
    setActivePropertyId(propId);
    setSelectedRoomId(roomId);
    if (userPermissions.role !== 'client') {
       setActiveTab("dashboard");
    }
    setIsSidebarOpen(false);
  };

  const handleManualSync = async () => {
    if (userPermissions.role === 'client') return;
    await fetchProperties(userPermissions);
  };

  // ---------------------------------------------------------------------------
  // SIDEBAR DRAG & DROP
  // ---------------------------------------------------------------------------
  const handleSidebarDragStart = (e: React.DragEvent, type: 'property' | 'room', id: string, parentId?: string) => {
    if (userPermissions.role === 'client') return;
    setSidebarDragItem({ type, id, parentId });
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };
  const handleSidebarDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleSidebarDragEnd = (e: React.DragEvent) => setSidebarDragItem(null);
  
  const handleSidebarDrop = async (e: React.DragEvent, targetType: 'property' | 'room', targetId: string, targetParentId?: string) => {
    e.preventDefault();
    if (!sidebarDragItem) return;
    if (userPermissions.role === 'client') return;

    if (sidebarDragItem.type === 'property' && targetType === 'property') {
       if (sidebarDragItem.id === targetId) return;
       const sourceIndex = properties.findIndex(p => p.id === sidebarDragItem.id);
       const targetIndex = properties.findIndex(p => p.id === targetId);
       if (sourceIndex === -1 || targetIndex === -1) return;
       const newProperties = [...properties];
       const [moved] = newProperties.splice(sourceIndex, 1);
       newProperties.splice(targetIndex, 0, moved);
       const sortedProperties = newProperties.map((p, idx) => ({ ...p, sortOrder: idx }));
       setProperties(sortedProperties);
       setSyncStatus('saving');
       const updates = sortedProperties.map(p => ({ id: p.id, content: { ...p, sortOrder: p.sortOrder }, updated_at: new Date().toISOString() }));
       await supabase.from('properties').upsert(updates);
       setSyncStatus('synced'); setTimeout(() => setSyncStatus('idle'), 2000);
    } 
    else if (sidebarDragItem.type === 'room' && targetType === 'room') {
       if (sidebarDragItem.id === targetId || sidebarDragItem.parentId !== targetParentId) return;
       const propIndex = properties.findIndex(p => p.id === sidebarDragItem.parentId);
       if (propIndex === -1) return;
       const prop = properties[propIndex];
       const sourceIndex = prop.rooms.findIndex(r => r.id === sidebarDragItem.id);
       const targetIndex = prop.rooms.findIndex(r => r.id === targetId);
       if (sourceIndex === -1 || targetIndex === -1) return;
       const newRooms = [...prop.rooms];
       const [moved] = newRooms.splice(sourceIndex, 1);
       newRooms.splice(targetIndex, 0, moved);
       newRooms.forEach((r, idx) => r.sortOrder = idx);
       const updatedProp = { ...prop, rooms: newRooms };
       setProperties(prev => prev.map(p => p.id === prop.id ? updatedProp : p));
       setSyncStatus('saving');
       lastServerState.current[prop.id] = JSON.stringify(updatedProp);
       await supabase.from('properties').upsert({ id: prop.id, content: updatedProp, updated_at: new Date().toISOString() });
       setSyncStatus('synced'); setTimeout(() => setSyncStatus('idle'), 2000);
    }
    setSidebarDragItem(null);
  };


  // ---------------------------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------------------------
  const isClientRole = userPermissions.role === 'client';
  const isReadOnly = isClientRole; 

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white gap-2 flex-col">
        <div className="flex items-center gap-2 text-xl">
           <Loader2 className="animate-spin" /> Wczytywanie...
        </div>
        <p className="text-sm text-slate-500 mt-2">Weryfikacja uprawnień...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (permissionError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-800 p-4">
            <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center">
                <ShieldAlert size={64} className="mx-auto text-red-500 mb-6" />
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Brak Dostępu</h2>
                <p className="text-slate-600 mb-6">{permissionError}</p>
                <div className="bg-slate-100 p-3 rounded text-sm text-slate-500 mb-6">
                    Zalogowano jako: <br/><span className="font-mono font-bold text-slate-700">{session.user.email}</span>
                </div>
                <button 
                    onClick={handleLogout}
                    className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors"
                >
                    Wyloguj się
                </button>
            </div>
        </div>
      );
  }

  if (loadError) {
    return (
       <div className="flex flex-col h-screen items-center justify-center bg-slate-50 text-slate-800 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full border border-red-200">
           <div className="flex items-center gap-2 text-red-600 font-bold mb-4">
             <CloudOff size={24} />
             <h2>Błąd połączenia z bazą danych</h2>
           </div>
           <p className="mb-4 text-sm text-slate-600">{loadError}</p>
           <button onClick={() => window.location.reload()} className="text-blue-600 font-bold hover:underline">Spróbuj ponownie</button>
        </div>
      </div>
    );
  }

  if (isLoading && !activeProperty && properties.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> Pobieranie danych obiektów...
      </div>
    );
  }
  
  if (!activeProperty && properties.length === 0) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 flex-col gap-4">
            <Building className="opacity-20" size={64}/>
            {isClientRole ? (
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700">Brak przypisanych obiektów</p>
                <p className="text-sm text-slate-500 mt-2">Administrator nie przypisał Ci jeszcze żadnych nieruchomości.</p>
              </div>
            ) : (
              <p>Brak dostępnych obiektów. Dodaj pierwszy obiekt.</p>
            )}
            
            {!isClientRole && (
               <button onClick={() => setShowAddPropertyModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors">
                  <Plus size={20}/> Utwórz Obiekt
               </button>
            )}

            <button onClick={handleLogout} className="text-slate-400 underline mt-4 hover:text-slate-600">Wyloguj</button>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:overflow-visible print:h-auto print:block">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        flex flex-col h-full print:hidden
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
                {userPermissions.role === 'super_admin' ? 'Super Admin' : userPermissions.role === 'admin' ? 'Admin' : 'Klient'}
             </div>
          </div>
        </div>

        {isClientRole ? (
           // CLIENT SIDEBAR: Strictly only Property List
           <div className="flex-1 p-4 text-slate-400 text-sm overflow-y-auto">
              <p className="mb-4 text-center text-slate-500 text-xs font-bold uppercase">TWOJE OBIEKTY</p>
              <div className="space-y-1">
                {properties.map(p => (
                   <button
                     key={p.id}
                     onClick={() => setActivePropertyId(p.id)}
                     className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                       activePropertyId === p.id 
                         ? "bg-blue-600 text-white shadow-md" 
                         : "text-slate-400 hover:bg-slate-800 hover:text-white"
                     }`}
                   >
                     <Building size={18} />
                     <span className="font-medium truncate">{p.name}</span>
                   </button>
                ))}
              </div>
           </div>
        ) : (
        // ADMIN SIDEBAR: Full Navigation
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
          
          <button
            onClick={() => { setActiveTab("client-view"); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors flex-shrink-0 ${
               activeTab === "client-view" 
               ? "bg-blue-600 text-white" 
               : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Eye size={20} />
            <span className="font-medium">Podgląd Klienta</span>
          </button>

          {userPermissions.role === 'super_admin' && (
              <button
                onClick={() => setShowUserPanel(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors flex-shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <Users size={20} />
                <span className="font-medium">Użytkownicy</span>
              </button>
          )}

          <button
            onClick={() => setShowCalculator(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors flex-shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Calculator size={20} />
            <span className="font-medium">Kalkulator</span>
          </button>
          
          <div className="w-full h-px bg-slate-800 my-2"></div>

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
          
          <div className="w-full h-px bg-slate-800 my-2"></div>

          {/* Properties Section */}
          <div className="mt-2 flex-shrink-0">
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
                  const isDraggingThis = sidebarDragItem?.type === 'property' && sidebarDragItem.id === p.id;
                  
                  return (
                   <div 
                      key={p.id} 
                      className={`mb-1 transition-opacity ${isDraggingThis ? 'opacity-40' : ''}`}
                      draggable={!isReadOnly}
                      onDragStart={(e) => handleSidebarDragStart(e, 'property', p.id)}
                      onDragEnd={handleSidebarDragEnd}
                      onDragOver={handleSidebarDragOver}
                      onDrop={(e) => handleSidebarDrop(e, 'property', p.id)}
                   >
                     <div 
                        className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                           isActive 
                             ? "bg-slate-800 text-white" 
                             : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                        }`}
                        onClick={() => { setActivePropertyId(p.id); setSelectedRoomId(null); if(!isClientRole) setActiveTab("dashboard"); }}
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
                          {p.rooms.map(room => {
                            const isDraggingRoom = sidebarDragItem?.type === 'room' && sidebarDragItem.id === room.id;
                            
                            return (
                            <button
                              key={room.id}
                              onClick={() => handleRoomClick(p.id, room.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-left transition-colors ${
                                isActive && activeTab === 'dashboard' && selectedRoomId === room.id
                                ? "text-blue-300 font-medium bg-slate-800/50" 
                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                              } ${isDraggingRoom ? 'opacity-40' : ''}`}
                              draggable={!isReadOnly}
                              onDragStart={(e) => handleSidebarDragStart(e, 'room', room.id, p.id)}
                              onDragEnd={handleSidebarDragEnd}
                              onDragOver={handleSidebarDragOver}
                              onDrop={(e) => handleSidebarDrop(e, 'room', room.id, p.id)}
                            >
                              <Bed size={12} />
                              <span className="truncate">{room.name}</span>
                            </button>
                            )
                          })}
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
        )}

        <div className="p-6 border-t border-slate-800 space-y-3 flex-shrink-0">
           {/* Sync Status Indicator - HIDDEN FOR CLIENTS */}
          {!isClientRole && (
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
          )}

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors"
          >
            <LogOut size={14} /> Wyloguj się
          </button>
          
          <div className="text-xs text-slate-500">
            <p>Wersja 1.9.1 (Crash Fixes)</p>
            <p className="mt-1">© 2025 Twoje Pokoje & Strony Jakubowe</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen print:h-auto print:block print:overflow-visible">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10 print:hidden">
          <span className="font-bold text-slate-800">{activeProperty?.name || "Panel"}</span>
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
            <Menu size={24} />
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-8 print:p-0 print:overflow-visible print:h-auto">
          {isClientRole ? (
             // CLIENT VIEW: STRICTLY Client Dashboard Only
             // Clients are filtered in fetchProperties, so activeProperty is safe.
             activeProperty ? (
               <ClientDashboard 
                 rooms={activeProperty.rooms}
                 seasons={activeProperty.seasons}
                 channels={activeProperty.channels}
                 settings={activeProperty.settings}
               />
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <LayoutDashboard size={48} className="mb-4 opacity-20"/>
                  <p className="text-lg font-medium">Wybierz obiekt z menu po lewej</p>
                  <p className="text-sm">Aby zobaczyć podgląd stawek i obłożenia.</p>
                </div>
             )
          ) : (
             // ADMIN VIEW: Conditional Rendering based on Tab
            <>
              {activeTab === "client-view" ? (
                 activeProperty ? (
                   <ClientDashboard 
                     rooms={activeProperty.rooms}
                     seasons={activeProperty.seasons}
                     channels={activeProperty.channels}
                     settings={activeProperty.settings}
                   />
                 ) : <div className="p-4 text-center text-slate-500">Wczytywanie...</div>
              ) : activeTab === "dashboard" ? (
                activeProperty ? (
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
                ) : <div className="p-4 text-center text-slate-500">Wczytywanie...</div>
              ) : (
                activeProperty && (
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
                  onDuplicateChannel={handleDuplicateChannelToProperty}
                  onDuplicateAllChannels={handleDuplicateAllChannelsToProperty}
                  isReadOnly={isReadOnly}
                />
                )
              )}
            </>
          )}
        </div>
      </main>

      {/* User Management Modal */}
      {showUserPanel && (
         <UserManagementPanel 
            properties={properties}
            onClose={() => setShowUserPanel(false)}
         />
      )}

      {/* Calculator Modal */}
      {showCalculator && activeProperty && (
        <CalculatorModal
           rooms={activeProperty.rooms}
           seasons={activeProperty.seasons}
           channels={activeProperty.channels}
           settings={activeProperty.settings}
           onClose={() => setShowCalculator(false)}
        />
      )}

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
