
import React, { useState, useEffect, useRef, useMemo } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Menu, BedDouble, Calendar, Share2, Cog, ChevronDown, ChevronRight, Building, Plus, Trash2, Bed, CheckCircle2, Copy, Cloud, CloudOff, Loader2, RefreshCw, LogOut, Download, X, Lock, Users, Calculator, Eye, ShieldAlert, BarChart3, Layers } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Dashboard from "./components/Dashboard";
import ClientDashboard from "./components/ClientDashboard";
import SummaryDashboard from "./components/SummaryDashboard";
import LoginScreen from "./components/LoginScreen";
import UserManagementPanel from "./components/UserManagementPanel";
import CalculatorModal from "./components/CalculatorModal";
import {
  INITIAL_CHANNELS,
  INITIAL_ROOMS,
  INITIAL_SEASONS,
  INITIAL_SETTINGS,
} from "./constants";
import { Channel, Property, RoomType, SettingsTab, UserPermissions, UserRole, Variant, Season, GlobalSettings } from "./types";
import { supabase } from "./utils/supabaseClient";
import { fetchSeasonOccupancyMap, fetchHotresRooms } from "./utils/hotresApi";
import { DEFAULT_DENIED_PERMISSION } from "./utils/userConfig";

function deepClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.error("Deep clone error", e);
    return obj;
  }
}

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(DEFAULT_DENIED_PERMISSION);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "client-view" | "summary">("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("rooms");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [addPropertyMode, setAddPropertyMode] = useState<'manual' | 'import'>('manual');
  const [importOid, setImportOid] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error' | 'offline'>('idle');
  const [isLoading, setIsLoading] = useState(false); 
  const [loadError, setLoadError] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>("");
  
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [isOccupancyRefreshing, setIsOccupancyRefreshing] = useState(false);
  const [sidebarDragItem, setSidebarDragItem] = useState<{ type: 'property' | 'room' | 'variant', id: string, parentId?: string } | null>(null);

  const lastServerState = useRef<Record<string, string>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPermissionsFromDb = async (email: string): Promise<UserPermissions | null> => {
      try {
          const { data, error } = await supabase
            .from('user_roles')
            .select('*')
            .eq('email', email.toLowerCase().trim());
          if (error) return null;
          let userData = Array.isArray(data) && data.length > 0 ? data[0] : null;
          if (!userData) return null;

          const role = (userData.role || 'client') as UserRole;
          const allowedIds = userData.allowed_property_ids || [];

          return { role, allowedPropertyIds: allowedIds };
      } catch (err) { return null; }
  };

  const initUser = async (currentSession: any) => {
      if (!currentSession?.user?.email) {
          setAuthLoading(false);
          return;
      }
      if (properties.length === 0) setAuthLoading(true);
      setPermissionError(null);
      const perms = await fetchPermissionsFromDb(currentSession.user.email);
      if (!perms) {
          setUserPermissions(DEFAULT_DENIED_PERMISSION);
          setPermissionError("Twoje konto nie ma przypisanych uprawnień.");
          setAuthLoading(false);
          return;
      }
      setUserPermissions(perms);
      await fetchProperties(perms);
      setAuthLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) initUser(session);
        else setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        if (event === 'SIGNED_IN' && session) initUser(session);
        else if (event === 'SIGNED_OUT') {
            setProperties([]);
            setUserPermissions(DEFAULT_DENIED_PERMISSION);
            setAuthLoading(false);
        }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProperties = async (perms: UserPermissions) => {
    if (properties.length === 0) setIsLoading(true);
    try {
      const { data, error } = await supabase.from('properties').select('*');
      if (error) throw error;
      if (data) {
        let loadedProps: Property[] = data.map(row => {
           const content = row.content || {}; 
           const propId = String(row.id);
           
           // MIGRATION LOGIC: Convert old flat property to Variant system
           if (!content.variants) {
              const defaultVariant: Variant = {
                id: "v-" + Date.now(),
                name: "Standard",
                rooms: Array.isArray(content.rooms) ? content.rooms : INITIAL_ROOMS,
                seasons: Array.isArray(content.seasons) ? content.seasons : INITIAL_SEASONS,
                channels: Array.isArray(content.channels) ? content.channels : INITIAL_CHANNELS,
                settings: content.settings || INITIAL_SETTINGS,
                notes: content.notes || ""
              };
              content.variants = [defaultVariant];
              content.activeVariantId = defaultVariant.id;
           }

           return { ...content, id: propId };
        });

        if (perms.role === 'client') {
            const allowedSet = new Set(perms.allowedPropertyIds); 
            loadedProps = loadedProps.filter(p => allowedSet.has(String(p.id)));
        }

        loadedProps.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        loadedProps.forEach(p => {
          lastServerState.current[p.id] = JSON.stringify(p);
        });
        setProperties(loadedProps);
        if (loadedProps.length > 0 && !activePropertyId) {
            setActivePropertyId(loadedProps[0].id);
            setExpandedProperties(new Set([loadedProps[0].id]));
        }
      } 
    } catch (err: any) { setLoadError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (!session || authLoading) return;
    const channel = supabase.channel('schema-db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newContent = payload.new.content || {};
            const newId = String(payload.new.id);
            if (userPermissions.role === 'client' && !userPermissions.allowedPropertyIds?.includes(newId)) return;
            setProperties(prev => {
                const exists = prev.find(p => p.id === newId);
                const updated = exists ? prev.map(p => p.id === newId ? { ...newContent, id: newId } : p) : [...prev, { ...newContent, id: newId }];
                return updated.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            });
            lastServerState.current[newId] = JSON.stringify({ ...newContent, id: newId });
        } else if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id);
            delete lastServerState.current[deletedId];
            setProperties(prev => prev.filter(p => p.id !== deletedId));
        }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, userPermissions, authLoading]);

  useEffect(() => {
    if (isLoading || properties.length === 0 || !session || authLoading || userPermissions.role === 'client') return;
    const propToSave = properties.find(p => p.id === activePropertyId);
    if (!propToSave) return;
    const currentJson = JSON.stringify(propToSave);
    if (currentJson === lastServerState.current[propToSave.id]) return;
    setSyncStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from('properties').upsert({ id: propToSave.id, content: propToSave, updated_at: new Date().toISOString() });
        if (error) throw error;
        lastServerState.current[propToSave.id] = currentJson;
        setSyncStatus('synced');
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
      } catch (err) { setSyncStatus('error'); }
    }, 1000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [properties, activePropertyId, session, isLoading, userPermissions, authLoading]);

  const activeProperty = useMemo(() => properties.find(p => p.id === activePropertyId), [properties, activePropertyId]);
  const activeVariant = useMemo(() => activeProperty?.variants.find(v => v.id === activeProperty.activeVariantId) || activeProperty?.variants[0], [activeProperty]);

  const updateActiveProperty = (updates: Partial<Property>) => {
    if (userPermissions.role === 'client') return;
    setProperties(prev => prev.map(p => p.id === activePropertyId ? { ...p, ...updates } : p));
  };

  const updateActiveVariant = (updates: Partial<Variant>) => {
    if (!activeProperty || !activeVariant) return;
    const updatedVariants = activeProperty.variants.map(v => v.id === activeVariant.id ? { ...v, ...updates } : v);
    updateActiveProperty({ variants: updatedVariants });
  };

  const syncPropertyOccupancy = async () => {
    if (!activeProperty || !activeVariant || !activeProperty.oid) return;
    setIsOccupancyRefreshing(true);
    try {
      let updatedRooms = deepClone(activeVariant.rooms);
      for (const season of activeVariant.seasons) {
        const occupancyMap = await fetchSeasonOccupancyMap(activeProperty.oid, season.startDate, season.endDate);
        updatedRooms = updatedRooms.map(room => {
          if (room.tid && occupancyMap[room.tid] !== undefined) {
              return { ...room, seasonOccupancy: { ...(room.seasonOccupancy || {}), [season.id]: occupancyMap[room.tid] } };
          }
          return room;
        });
      }
      updateActiveVariant({ rooms: updatedRooms });
    } catch (e) { alert("Błąd synchronizacji."); } finally { setIsOccupancyRefreshing(false); }
  };

  const handleRoomUpdate = (roomId: string, updates: Partial<RoomType>) => {
    if (!activeVariant) return;
    updateActiveVariant({ rooms: activeVariant.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r) });
  };

  const handleOccupancyUpdate = (roomId: string, seasonId: string, rate: number) => {
    if (!activeVariant) return;
    const room = activeVariant.rooms.find(r => r.id === roomId);
    if (room) handleRoomUpdate(roomId, { seasonOccupancy: { ...(room.seasonOccupancy || {}), [seasonId]: rate } });
  };

  const handleReorderRooms = (reordered: RoomType[]) => updateActiveVariant({ rooms: reordered });

  const handleCreateProperty = async () => {
    const newId = Date.now().toString();
    const defaultVariant: Variant = { id: "v1", name: "Podstawowy", rooms: INITIAL_ROOMS, seasons: INITIAL_SEASONS, channels: INITIAL_CHANNELS, settings: INITIAL_SETTINGS };
    const newProperty: Property = { id: newId, name: "Nowy Obiekt", variants: [defaultVariant], activeVariantId: "v1", sortOrder: properties.length };
    setProperties([...properties, newProperty]);
    setActivePropertyId(newId);
    await supabase.from('properties').insert({ id: newId, content: newProperty });
    setShowAddPropertyModal(false);
  };

  const handleDeleteProperty = async (id: string) => {
    if (confirm("Usunąć obiekt?")) {
      setProperties(prev => prev.filter(p => p.id !== id));
      await supabase.from('properties').delete().eq('id', id);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:overflow-visible print:h-auto print:block">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col h-full print:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-700 flex flex-col gap-4 flex-shrink-0">
          <img src="https://twojepokoje.com.pl/wp-content/uploads/2024/02/Twoje_pokoje_logo_full.webp" alt="Logo" className="w-full h-auto object-contain" style={{ maxHeight: '60px' }} />
          <div className="text-center">
             <span className="text-sm font-bold text-slate-400 uppercase">Cennik Twoje Pokoje</span>
             <div className="text-[10px] uppercase font-bold mt-1 px-2 py-0.5 rounded inline-block bg-blue-600">{userPermissions.role}</div>
          </div>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto min-h-0">
          <button onClick={() => { setActiveTab("dashboard"); setSelectedRoomId(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "dashboard" && selectedRoomId === null ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}><LayoutDashboard size={20} /><span>Panel</span></button>
          <button onClick={() => { setActiveTab("summary"); setSelectedRoomId(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "summary" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}><BarChart3 size={20} /><span>Podsumowanie</span></button>
          
          <div className="w-full h-px bg-slate-800 my-2"></div>

          <div className="mt-2 flex-shrink-0">
             <div className="flex items-center justify-between mb-2 px-4">
                <span className="text-xs font-semibold text-slate-500 uppercase">Obiekty</span>
                {!userPermissions.role.includes('client') && <button onClick={() => setShowAddPropertyModal(true)} className="text-blue-400 p-1"><Plus size={16} /></button>}
             </div>
             <div className="space-y-1 px-2">
                {properties.map(p => (
                   <div key={p.id} className="mb-1">
                     <div className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${activePropertyId === p.id ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50"}`} onClick={() => { setActivePropertyId(p.id); setActiveTab("dashboard"); }}>
                        <div className="flex items-center gap-2 truncate">
                           <Building size={14} />
                           <span className="truncate">{p.name}</span>
                        </div>
                     </div>
                     {activePropertyId === p.id && (
                        <div className="ml-4 pl-2 border-l border-slate-700 mt-1 space-y-1">
                           {p.variants.map(v => (
                              <button key={v.id} onClick={() => updateActiveProperty({ activeVariantId: v.id })} className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-left ${p.activeVariantId === v.id ? "text-blue-400 font-bold" : "text-slate-500 hover:text-slate-300"}`}>
                                 <Layers size={12} />
                                 <span className="truncate">{v.name}</span>
                                 {p.activeVariantId === v.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-auto"></div>}
                              </button>
                           ))}
                        </div>
                     )}
                   </div>
                ))}
             </div>
          </div>
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-3 flex-shrink-0">
          <button onClick={() => setActiveTab("settings")} className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded"><SettingsIcon size={14} /> Konfiguracja</button>
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded"><LogOut size={14} /> Wyloguj się</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b p-4 flex justify-between items-center z-10 print:hidden">
          <span className="font-bold">{activeProperty?.name} - {activeVariant?.name}</span>
          <button onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
        </header>

        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {activeProperty && activeVariant ? (
            <>
              {activeTab === "dashboard" && <Dashboard rooms={activeVariant.rooms} seasons={activeVariant.seasons} channels={activeVariant.channels} settings={activeVariant.settings} propertyOid={activeProperty.oid || ""} selectedRoomId={selectedRoomId} notes={activeVariant.notes || ""} onNotesChange={(n) => updateActiveVariant({ notes: n })} onRoomUpdate={handleRoomUpdate} onOccupancyUpdate={handleOccupancyUpdate} onReorderRooms={handleReorderRooms} onSyncAllOccupancy={syncPropertyOccupancy} isReadOnly={userPermissions.role === 'client'} activeVariantName={activeVariant.name} />}
              {activeTab === "summary" && <SummaryDashboard property={activeProperty} />}
              {activeTab === "settings" && <SettingsPanel propertyName={activeProperty.name} onPropertyNameChange={(name) => updateActiveProperty({ name })} propertyOid={activeProperty.oid || ""} onPropertyOidChange={(oid) => updateActiveProperty({ oid })} settings={activeVariant.settings} setSettings={(s) => updateActiveVariant({ settings: s })} channels={activeVariant.channels} setChannels={(c) => updateActiveVariant({ channels: c })} rooms={activeVariant.rooms} setRooms={(r) => updateActiveVariant({ rooms: r })} seasons={activeVariant.seasons} setSeasons={(s) => updateActiveVariant({ seasons: s })} variants={activeProperty.variants} activeVariantId={activeProperty.activeVariantId} onVariantChange={(vid) => updateActiveProperty({ activeVariantId: vid })} onUpdateVariants={(vars) => updateActiveProperty({ variants: vars })} activeTab={activeSettingsTab} onTabChange={setActiveSettingsTab} onDeleteProperty={() => handleDeleteProperty(activePropertyId)} onDuplicateProperty={() => {}} otherProperties={[]} onDuplicateSeasons={() => {}} onDuplicateChannel={() => {}} onDuplicateAllChannels={() => {}} isReadOnly={userPermissions.role === 'client'} />}
            </>
          ) : <div className="flex items-center justify-center h-full text-slate-400">Wybierz obiekt</div>}
        </div>
      </main>
    </div>
  );
};

export default App;
