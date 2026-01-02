
import React, { useState, useEffect, useRef, useMemo } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Menu, Building, Plus, Trash2, Loader2, RefreshCw, LogOut, Users, Calculator, BarChart3, ChevronDown, ChevronRight, X } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Dashboard from "./components/Dashboard";
import SummaryDashboard from "./components/SummaryDashboard";
import LoginScreen from "./components/LoginScreen";
import UserManagementPanel from "./components/UserManagementPanel";
import CalculatorModal from "./components/CalculatorModal";
import { INITIAL_CHANNELS, INITIAL_ROOMS, INITIAL_SEASONS, INITIAL_SETTINGS } from "./constants";
import { Channel, Property, RoomType, SettingsTab, UserPermissions, UserRole, Season, GlobalSettings } from "./types";
import { supabase } from "./utils/supabaseClient";
import { fetchSeasonOccupancyMap } from "./utils/hotresApi";
import { DEFAULT_DENIED_PERMISSION } from "./utils/userConfig";

function deepClone<T>(obj: T): T {
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
}

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(DEFAULT_DENIED_PERMISSION);
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "summary">("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("rooms");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false); 
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>("");
  const [isOccupancyRefreshing, setIsOccupancyRefreshing] = useState(false);

  const lastServerState = useRef<Record<string, string>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPermissionsFromDb = async (email: string): Promise<UserPermissions | null> => {
      try {
          const { data, error } = await supabase.from('user_roles').select('*').eq('email', email.toLowerCase().trim());
          if (error || !data?.[0]) return null;
          return { role: data[0].role as UserRole, allowedPropertyIds: data[0].allowed_property_ids || [] };
      } catch { return null; }
  };

  const initUser = async (currentSession: any) => {
      if (!currentSession?.user?.email) { setAuthLoading(false); return; }
      setAuthLoading(true);
      const perms = await fetchPermissionsFromDb(currentSession.user.email);
      if (!perms) {
          setUserPermissions(DEFAULT_DENIED_PERMISSION);
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
        else if (event === 'SIGNED_OUT') { setProperties([]); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProperties = async (perms: UserPermissions) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('properties').select('*');
      if (error) throw error;
      let loadedProps: Property[] = (data || []).map(row => {
          const content = row.content || {};
          // Reverse Migration: If data was converted to variant format during the error, flatten it back
          if (content.variants && Array.isArray(content.variants) && content.variants.length > 0) {
              const v = content.variants[0];
              return {
                  id: String(row.id),
                  name: content.name || "Obiekt",
                  oid: content.oid || "",
                  rooms: v.rooms || INITIAL_ROOMS,
                  seasons: v.seasons || INITIAL_SEASONS,
                  channels: v.channels || INITIAL_CHANNELS,
                  settings: v.settings || INITIAL_SETTINGS,
                  notes: v.notes || "",
                  sortOrder: content.sortOrder || 0
              };
          }
          return { ...content, id: String(row.id) };
      });

      if (perms.role === 'client') {
          const allowed = new Set(perms.allowedPropertyIds);
          loadedProps = loadedProps.filter(p => allowed.has(p.id));
      }
      loadedProps.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setProperties(loadedProps);
      if (loadedProps.length > 0 && !activePropertyId) setActivePropertyId(loadedProps[0].id);
    } catch (err: any) { console.error(err); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (isLoading || properties.length === 0 || userPermissions.role === 'client') return;
    const p = properties.find(x => x.id === activePropertyId);
    if (!p) return;
    const json = JSON.stringify(p);
    if (json === lastServerState.current[p.id]) return;
    setSyncStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase.from('properties').upsert({ id: p.id, content: p, updated_at: new Date().toISOString() });
      if (!error) { lastServerState.current[p.id] = json; setSyncStatus('synced'); setTimeout(() => setSyncStatus('idle'), 2000); }
      else setSyncStatus('error');
    }, 1500);
  }, [properties, activePropertyId, isLoading]);

  const activeProperty = useMemo(() => properties.find(p => p.id === activePropertyId), [properties, activePropertyId]);

  const updateActiveProperty = (updates: Partial<Property>) => {
    setProperties(prev => prev.map(p => p.id === activePropertyId ? { ...p, ...updates } : p));
  };

  const handleRoomUpdate = (roomId: string, updates: Partial<RoomType>) => {
    if (!activeProperty) return;
    updateActiveProperty({ rooms: activeProperty.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r) });
  };

  const handleOccupancyUpdate = (roomId: string, seasonId: string, rate: number) => {
    if (!activeProperty) return;
    updateActiveProperty({ rooms: activeProperty.rooms.map(r => r.id === roomId ? { ...r, seasonOccupancy: { ...(r.seasonOccupancy || {}), [seasonId]: rate } } : r) });
  };

  const syncPropertyOccupancy = async () => {
    if (!activeProperty || !activeProperty.oid) return;
    setIsOccupancyRefreshing(true);
    try {
      let updatedRooms = deepClone(activeProperty.rooms);
      for (const season of activeProperty.seasons) {
        const occupancyMap = await fetchSeasonOccupancyMap(activeProperty.oid, season.startDate, season.endDate);
        updatedRooms = updatedRooms.map(room => {
          if (room.tid && occupancyMap[room.tid] !== undefined) {
              return { ...room, seasonOccupancy: { ...(room.seasonOccupancy || {}), [season.id]: occupancyMap[room.tid] } };
          }
          return room;
        });
      }
      updateActiveProperty({ rooms: updatedRooms });
    } catch (e) { alert("Błąd synchronizacji."); } finally { setIsOccupancyRefreshing(false); }
  };

  const handleCreateProperty = async () => {
    const newId = Date.now().toString();
    const newProp: Property = { id: newId, name: "Nowy Obiekt", rooms: INITIAL_ROOMS, seasons: INITIAL_SEASONS, channels: INITIAL_CHANNELS, settings: INITIAL_SETTINGS, sortOrder: properties.length };
    setProperties([...properties, newProp]);
    setActivePropertyId(newId);
    await supabase.from('properties').insert({ id: newId, content: newProp });
    setShowAddPropertyModal(false);
  };

  if (!session) return <LoginScreen />;
  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2" /> Wczytywanie...</div>;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col h-full ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-700 flex flex-col gap-4">
          <img src="https://twojepokoje.com.pl/wp-content/uploads/2024/02/Twoje_pokoje_logo_full.webp" alt="Logo" className="w-full h-auto object-contain" style={{ maxHeight: '60px' }} />
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          <button onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "dashboard" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}><LayoutDashboard size={20} /><span>Panel Główny</span></button>
          <button onClick={() => { setActiveTab("summary"); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "summary" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}><BarChart3 size={20} /><span>Podsumowanie</span></button>
          <div className="w-full h-px bg-slate-800 my-2"></div>
          <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center"><span>Twoje Obiekty</span>{userPermissions.role !== 'client' && <button onClick={() => setShowAddPropertyModal(true)} className="text-blue-400"><Plus size={16} /></button>}</div>
          <div className="space-y-1">
            {properties.map(p => (
              <button key={p.id} onClick={() => { setActivePropertyId(p.id); setActiveTab("dashboard"); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${activePropertyId === p.id ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50"}`}>
                <Building size={14} /><span className="truncate flex-1 text-left">{p.name}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="p-6 border-t border-slate-800 space-y-3">
          {userPermissions.role !== 'client' && <button onClick={() => setShowUserPanel(true)} className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700"><Users size={14} /> Użytkownicy</button>}
          <button onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><SettingsIcon size={14} /> Konfiguracja</button>
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700"><LogOut size={14} /> Wyloguj</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b p-4 flex justify-between items-center font-bold text-slate-800"><span>{activeProperty?.name}</span><button onClick={() => setIsSidebarOpen(true)} className="text-slate-600"><Menu size={24} /></button></header>
        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {activeProperty ? (
            <>
              {activeTab === "dashboard" && <Dashboard rooms={activeProperty.rooms} seasons={activeProperty.seasons} channels={activeProperty.channels} settings={activeProperty.settings} propertyOid={activeProperty.oid || ""} notes={activeProperty.notes || ""} onNotesChange={(n) => updateActiveProperty({ notes: n })} onRoomUpdate={handleRoomUpdate} onOccupancyUpdate={handleOccupancyUpdate} onReorderRooms={(r) => updateActiveProperty({ rooms: r })} onSyncAllOccupancy={syncPropertyOccupancy} isReadOnly={userPermissions.role === 'client'} onOpenCalculator={() => setShowCalculator(true)} />}
              {activeTab === "summary" && <SummaryDashboard property={activeProperty} />}
              {activeTab === "settings" && <SettingsPanel propertyName={activeProperty.name} onPropertyNameChange={(n) => updateActiveProperty({ name: n })} propertyOid={activeProperty.oid || ""} onPropertyOidChange={(o) => updateActiveProperty({ oid: o })} settings={activeProperty.settings} setSettings={(s) => updateActiveProperty({ settings: s })} channels={activeProperty.channels} setChannels={(c) => updateActiveProperty({ channels: c })} rooms={activeProperty.rooms} setRooms={(r) => updateActiveProperty({ rooms: r })} seasons={activeProperty.seasons} setSeasons={(s) => updateActiveProperty({ seasons: s })} activeTab={activeSettingsTab} onTabChange={setActiveSettingsTab} onDeleteProperty={() => {}} isReadOnly={userPermissions.role === 'client'} />}
            </>
          ) : <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4"><Building size={48} className="opacity-20" /><p>Wybierz obiekt z menu po lewej.</p></div>}
        </div>
      </main>

      {showCalculator && activeProperty && <CalculatorModal rooms={activeProperty.rooms} seasons={activeProperty.seasons} channels={activeProperty.channels} settings={activeProperty.settings} onClose={() => setShowCalculator(false)} propertyOid={activeProperty.oid} />}
      {showUserPanel && <UserManagementPanel properties={properties} onClose={() => setShowUserPanel(false)} />}
      
      {showAddPropertyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="font-bold text-slate-800 mb-4">Dodaj Nowy Obiekt</h3>
              <button onClick={handleCreateProperty} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Utwórz Teraz</button>
              <button onClick={() => setShowAddPropertyModal(false)} className="w-full mt-2 text-slate-400 text-sm">Anuluj</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
