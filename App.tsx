
import React, { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Menu, BedDouble, Calendar, Share2, Cog, ChevronDown, ChevronRight, Building, Plus, Trash2, Bed, CheckCircle2, Copy, Cloud, CloudOff, Loader2, RefreshCw, LogOut, Download, X, Lock, Users } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Dashboard from "./components/Dashboard";
import ClientDashboard from "./components/ClientDashboard";
import LoginScreen from "./components/LoginScreen";
import UserManagementPanel from "./components/UserManagementPanel";
import {
  INITIAL_CHANNELS,
  INITIAL_ROOMS,
  INITIAL_SEASONS,
  INITIAL_SETTINGS,
} from "./constants";
import { Channel, Property, RoomType, SettingsTab, UserPermissions, DbUserRole } from "./types";
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

  // User Management Modal State
  const [showUserPanel, setShowUserPanel] = useState(false);

  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error' | 'offline'>('idle');
  const [isLoading, setIsLoading] = useState(false); 
  const [loadError, setLoadError] = useState<string | null>(null);

  // Property Data
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>("default");
  
  // Track expanded sidebar items
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set(["default"]));

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

  // Function to load dynamic permissions from DB
  const loadDynamicPermissions = async (email: string) => {
    // 1. PRIORITY: Check Static Config (Hardcoded Admins)
    const staticPerms = getUserPermissions(email);
    
    if (staticPerms.role === 'super_admin' || staticPerms.role === 'admin') {
        console.log(`Found static permissions for ${email}: ${staticPerms.role}. Skipping DB fetch.`);
        setUserPermissions(staticPerms);
        return staticPerms;
    }

    // 2. Check DB for dynamic roles
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', email)
        .single();
        
      if (data) {
        console.log(`Loaded DB permissions for ${email}:`, data.role);
        const dbPerms: UserPermissions = {
          role: data.role,
          allowedPropertyIds: data.allowed_property_ids || []
        };
        setUserPermissions(dbPerms);
        return dbPerms;
      }
    } catch (e) {
      console.warn("Could not fetch dynamic permissions from DB (network error or not found). Using default.", e);
    }
    
    // 3. Fallback
    setUserPermissions(staticPerms);
    return staticPerms;
  };

  // ---------------------------------------------------------------------------
  // AUTHENTICATION LOGIC
  // ---------------------------------------------------------------------------

  const loadUserData = async (currentSession: any) => {
    if (!currentSession?.user?.email) return;
    
    try {
      const perms = await loadDynamicPermissions(currentSession.user.email);
      await fetchProperties(currentSession.user.email, perms);
    } catch (e) {
      console.error("Error loading user data:", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log("Initializing Auth...");
        // 1. Get Session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (mounted) {
           if (initialSession) {
             console.log("Session found (init).");
             setSession(initialSession);
             
             // CRITICAL: Unlock the Auth Screen IMMEDIATELY.
             // Do NOT wait for data to load. The `isLoading` state will handle the data loading screen.
             setAuthLoading(false);
             
             // Now fetch data in background (or showing loading spinner via isLoading)
             await loadUserData(initialSession);
           } else {
             console.log("No session found (init).");
             setAuthLoading(false);
           }
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (mounted) setAuthLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      console.log(`Auth Event: ${event}`);

      setSession(currentSession);

      if (event === 'SIGNED_IN') {
        // Explicit sign in (e.g. from Login form)
        // Ensure auth loading is off
        setAuthLoading(false);
        // Load data if not already loaded
        loadUserData(currentSession);
      } else if (event === 'SIGNED_OUT') {
        setProperties([]);
        setUserPermissions({ role: 'client', allowedPropertyIds: [] });
        setAuthLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
         // Token refreshed, session updated automatically by setSession above
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  // Function to process loaded properties and update refs
  const processLoadedProperties = (props: Property[]) => {
    props.forEach(p => {
      lastServerState.current[p.id] = JSON.stringify(p);
    });
    setProperties(props);
  };

  const fetchProperties = async (currentUserEmail?: string, overridePerms?: UserPermissions) => {
    setIsLoading(true);
    setSyncStatus('idle');
    setLoadError(null);
    
    const perms = overridePerms || userPermissions;

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        let loadedProps = data.map(row => ({
           ...row.content,
           id: row.id
        }));

        // FILTER PROPERTIES BASED ON ROLE
        if (perms.role === 'client') {
           const allowedIds = perms.allowedPropertyIds || [];
           loadedProps = loadedProps.filter(p => allowedIds.includes(p.id));
        }

        // Apply Custom Sorting (sortOrder)
        loadedProps.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        // Apply Room Sorting within properties
        loadedProps.forEach(p => {
          if (p.rooms) {
            p.rooms.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          }
        });

        processLoadedProperties(loadedProps);
        
        // Safety check to ensure we have an active property ID
        if (loadedProps.length > 0) {
            const exists = loadedProps.find(p => p.id === activePropertyId);
            if (!exists || activePropertyId === "default") {
                setActivePropertyId(loadedProps[0].id);
            }
        }
      } else {
        // Only create default if Super Admin
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
             sortOrder: 0
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
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newContent = payload.new.content as Property;
            const newId = payload.new.id;
            
            // Client Filter Check
            if (userPermissions.role === 'client' && !userPermissions.allowedPropertyIds?.includes(newId)) {
               return; // Ignore update for property not allowed
            }

            // Ensure rooms are sorted when receiving update
            if (newContent.rooms) {
               newContent.rooms.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
              // Re-sort entire property list on update based on sortOrder
              return updatedList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
  }, [session, userPermissions]);

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
    if (userPermissions.role !== 'super_admin') {
       alert("Brak uprawnień do aktualizacji bazy danych.");
       return;
    }

    const prop = properties.find(p => p.id === propId);
    if (!prop || !prop.oid) return;

    console.log(`Syncing occupancy for property ${prop.name} (${prop.oid})`);
    setIsOccupancyRefreshing(true); // START LOADING
    
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
    } catch (error) {
        console.error("Manual occupancy sync failed:", error);
        alert("Błąd podczas synchronizacji dostępności.");
    } finally {
        setIsOccupancyRefreshing(false); // STOP LOADING
    }
  };

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
    
    setProperties(prev => prev.map(p => {
       if (p.id === targetPropertyId) {
          return {
             ...p,
             seasons: seasonsCopy,
          }
       }
       return p;
    }));
    alert("Sezony zostały skopiowane pomyślnie. (Uwaga: Ustawienia OBP pokoi nie są kopiowane między obiektami)");
  };

  const handleDuplicateChannelToProperty = async (sourceChannel: Channel, targetPropertyId: string) => {
    if (userPermissions.role !== 'super_admin') return;
    if (!activeProperty) return;
    
    const targetProp = properties.find(p => p.id === targetPropertyId);
    if (!targetProp) return;

    // Deep clone and generate new ID
    const newChannel = {
        ...deepClone(sourceChannel),
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        name: `${sourceChannel.name} (Kopia)`
    };

    const updatedTargetProp = {
        ...targetProp,
        channels: [...targetProp.channels, newChannel]
    };

    setProperties(prev => prev.map(p => 
        p.id === targetPropertyId ? updatedTargetProp : p
    ));

    // Hard save for target property immediately
    setSyncStatus('saving');
    lastServerState.current[targetPropertyId] = JSON.stringify(updatedTargetProp);
    await supabase.from('properties').upsert({
        id: targetPropertyId,
        content: updatedTargetProp,
        updated_at: new Date().toISOString()
    });
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);

    alert(`Kanał "${sourceChannel.name}" został skopiowany do wybranego obiektu.`);
  };

  const handleDuplicateAllChannelsToProperty = async (targetPropertyId: string) => {
    if (userPermissions.role !== 'super_admin') return;
    if (!activeProperty) return;
    
    const targetProp = properties.find(p => p.id === targetPropertyId);
    if (!targetProp) return;

    // Deep clone ALL channels from active property, regenerate IDs
    const clonedChannels = deepClone(activeProperty.channels).map(c => ({
        ...c,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5)
    }));

    const updatedTargetProp = {
        ...targetProp,
        channels: clonedChannels
    };

    setProperties(prev => prev.map(p => 
        p.id === targetPropertyId ? updatedTargetProp : p
    ));

    // Hard save
    setSyncStatus('saving');
    lastServerState.current[targetPropertyId] = JSON.stringify(updatedTargetProp);
    await supabase.from('properties').upsert({
        id: targetPropertyId,
        content: updatedTargetProp,
        updated_at: new Date().toISOString()
    });
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);

    alert(`Wszystkie kanały zostały skopiowane do "${targetProp.name}". Poprzednie kanały w tym obiekcie zostały usunięte.`);
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
          sortOrder: properties.length,
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
        sortOrder: properties.length,
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
    newProperty.sortOrder = properties.length;
    
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
      if (session?.user?.email) {
          fetchProperties(session.user.email);
      }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Drag & Drop Handlers for Sidebar
  const handleSidebarDragStart = (e: React.DragEvent, type: 'property' | 'room', id: string, parentId?: string) => {
    if (userPermissions.role !== 'super_admin') return;
    setSidebarDragItem({ type, id, parentId });
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleSidebarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSidebarDragEnd = (e: React.DragEvent) => {
    setSidebarDragItem(null); // Clear drag item to fix visual "greyed out" glitch
  };

  const handleSidebarDrop = async (e: React.DragEvent, targetType: 'property' | 'room', targetId: string, targetParentId?: string) => {
    e.preventDefault();
    if (!sidebarDragItem) return;
    
    // Logic for Property Reordering
    if (sidebarDragItem.type === 'property' && targetType === 'property') {
       if (sidebarDragItem.id === targetId) { setSidebarDragItem(null); return; }
       const sourceIndex = properties.findIndex(p => p.id === sidebarDragItem.id);
       const targetIndex = properties.findIndex(p => p.id === targetId);
       
       if (sourceIndex === -1 || targetIndex === -1) { setSidebarDragItem(null); return; }
       
       const newProperties = [...properties];
       const [moved] = newProperties.splice(sourceIndex, 1);
       newProperties.splice(targetIndex, 0, moved);
       
       // Re-assign Sort Order
       const sortedProperties = newProperties.map((p, idx) => ({ ...p, sortOrder: idx }));
       setProperties(sortedProperties);

       // Save to DB immediately & Update Last Server State to prevent useEffect loop
       setSyncStatus('saving');
       const updates = sortedProperties.map(p => {
         // Update reference to prevent auto-save triggering
         const content = { ...p, sortOrder: p.sortOrder };
         lastServerState.current[p.id] = JSON.stringify(content);
         return {
           id: p.id,
           content: content,
           updated_at: new Date().toISOString()
         };
       });
       
       await supabase.from('properties').upsert(updates);
       setSyncStatus('synced');
       setTimeout(() => setSyncStatus('idle'), 2000);
    } 
    
    // Logic for Room Reordering (Must be within same property)
    else if (sidebarDragItem.type === 'room' && targetType === 'room') {
       if (sidebarDragItem.id === targetId) { setSidebarDragItem(null); return; }
       if (sidebarDragItem.parentId !== targetParentId) { setSidebarDragItem(null); return; } // Prevent cross-property drag

       const propIndex = properties.findIndex(p => p.id === sidebarDragItem.parentId);
       if (propIndex === -1) { setSidebarDragItem(null); return; }

       const prop = properties[propIndex];
       const sourceIndex = prop.rooms.findIndex(r => r.id === sidebarDragItem.id);
       const targetIndex = prop.rooms.findIndex(r => r.id === targetId);

       if (sourceIndex === -1 || targetIndex === -1) { setSidebarDragItem(null); return; }

       const newRooms = [...prop.rooms];
       const [moved] = newRooms.splice(sourceIndex, 1);
       newRooms.splice(targetIndex, 0, moved);

       // Re-assign Sort Order for rooms
       newRooms.forEach((r, idx) => r.sortOrder = idx);

       const updatedProp = { ...prop, rooms: newRooms };
       
       // Update State
       setProperties(prev => prev.map(p => 
          p.id === prop.id ? updatedProp : p
       ));

       // Save to DB immediately & Update Ref
       setSyncStatus('saving');
       lastServerState.current[prop.id] = JSON.stringify(updatedProp);
       
       await supabase.from('properties').upsert({
         id: prop.id,
         content: updatedProp,
         updated_at: new Date().toISOString()
       });
       setSyncStatus('synced');
       setTimeout(() => setSyncStatus('idle'), 2000);
    }
    
    setSidebarDragItem(null);
  };

  const isClientRole = userPermissions.role === 'client';
  const isReadOnly = userPermissions.role !== 'super_admin';

  // --- Render Views ---

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white gap-2 flex-col">
        <div className="flex items-center gap-2 text-xl">
           <Loader2 className="animate-spin" /> Wczytywanie...
        </div>
        <p className="text-sm text-slate-500 mt-2">Pobieranie danych użytkownika</p>
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
             Nie udało się pobrać danych. Może to oznaczać, że tabela w Supabase nie istnieje lub brak uprawnień.
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

  if (isLoading && !activeProperty && properties.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> Pobieranie danych...
      </div>
    );
  }
  
  // Handling case where permissions allow 0 properties
  if (!activeProperty && properties.length === 0 && !authLoading) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 flex-col gap-4">
            <Building className="opacity-20" size={64}/>
            <p>Brak dostępnych obiektów. Skontaktuj się z administratorem.</p>
            <button onClick={handleLogout} className="text-blue-600 underline">Wyloguj</button>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:overflow-visible print:h-auto print:block">
      {/* Sidebar - Added flex-col and h-full for scrolling fix */}
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
                {userPermissions.role === 'super_admin' ? 'Super Admin' : userPermissions.role === 'admin' ? 'Admin (Podgląd)' : 'Klient'}
             </div>
          </div>
        </div>

        {isClientRole ? (
           <div className="flex-1 p-4 text-slate-400 text-sm overflow-y-auto">
              <p className="mb-4 text-center text-slate-500 text-xs">WYBIERZ OBIEKT</p>
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
          
          {/* User Management Button (Super Admin Only) */}
          {userPermissions.role === 'super_admin' && (
              <button
                onClick={() => setShowUserPanel(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors flex-shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white mt-2"
              >
                <Users size={20} />
                <span className="font-medium">Użytkownicy</span>
              </button>
          )}

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
           {/* Sync Status Indicator */}
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
            <p>Wersja 1.5.0</p>
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
             activeProperty ? (
               <ClientDashboard 
                 rooms={activeProperty.rooms}
                 seasons={activeProperty.seasons}
                 channels={activeProperty.channels}
                 settings={activeProperty.settings}
               />
             ) : <div className="p-4 text-center text-slate-500">Wybierz obiekt z menu.</div>
          ) : (
            <>
              {activeTab === "dashboard" ? (
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
