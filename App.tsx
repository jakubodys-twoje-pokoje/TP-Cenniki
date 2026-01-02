
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
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'saving' | 'error' | 'offline'>('idle');
  const [isLoading, setIsLoading] = useState(false); 
  const [loadError, setLoadError] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>("");
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());

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
          setPermissionError("Brak uprawnień.");
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
          if (!content.variants) {
              const v: Variant = { id: "v1", name: "Standard", rooms: content.rooms || INITIAL_ROOMS, seasons: content.seasons || INITIAL_SEASONS, channels: content.channels || INITIAL_CHANNELS, settings: content.settings || INITIAL_SETTINGS, notes: content.notes || "" };
              content.variants = [v];
              content.activeVariantId = v.id;
          }
          return { ...content, id: String(row.id) };
      });
      if (perms.role === 'client') {
          const allowed = new Set(perms.allowedPropertyIds);
          loadedProps = loadedProps.filter(p => allowed.has(p.id));
      }
      loadedProps.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setProperties(loadedProps);
      if (loadedProps.length > 0 && !activePropertyId) {
          setActivePropertyId(loadedProps[0].id);
          setExpandedProperties(new Set([loadedProps[0].id]));
      }
    } catch (err: any) { setLoadError(err.message); } finally { setIsLoading(false); }
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
  const activeVariant = useMemo(() => activeProperty?.variants.find(v => v.id === activeProperty.activeVariantId) || activeProperty?.variants[0], [activeProperty]);

  const updateActiveProperty = (updates: Partial<Property>) => {
    setProperties(prev => prev.map(p => p.id === activePropertyId ? { ...p, ...updates } : p));
  };

  const updateActiveVariant = (updates: Partial<Variant>) => {
    if (!activeProperty || !activeVariant) return;
    const updatedVariants = activeProperty.variants.map(v => v.id === activeVariant.id ? { ...v, ...updates } : v);
    updateActiveProperty({ variants: updatedVariants });
  };

  // Define handleRoomUpdate to fix reference error
  const handleRoomUpdate = (roomId: string, updates: Partial<RoomType>) => {
    if (!activeVariant) return;
    const updatedRooms = activeVariant.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r);
    updateActiveVariant({ rooms: updatedRooms });
  };

  // Define handleOccupancyUpdate to fix reference error
  const handleOccupancyUpdate = (roomId: string, seasonId: string, rate: number) => {
    if (!activeVariant) return;
    const updatedRooms = activeVariant.rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          seasonOccupancy: { ...(r.seasonOccupancy || {}), [seasonId]: rate }
        };
      }
      return r;
    });
    updateActiveVariant({ rooms: updatedRooms });
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
          <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center"><span>Obiekty & Strategie</span>{userPermissions.role !== 'client' && <button onClick={() => setShowAddPropertyModal(true)} className="text-blue-400"><Plus size={16} /></button>}</div>
          <div className="space-y-1">
            {properties.map(p => {
              const isExpanded = expandedProperties.has(p.id);
              return (
                <div key={p.id} className="mb-1">
                  <div onClick={() => { setActivePropertyId(p.id); setExpandedProperties(prev => { const n = new Set(prev); isExpanded ? n.delete(p.id) : n.add(p.id); return n; }); }} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${activePropertyId === p.id ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50"}`}>
                    <Building size={14} /><span className="truncate flex-1">{p.name}</span>{isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                  </div>
                  {isExpanded && (
                    <div className="ml-4 pl-3 border-l border-slate-700 mt-1 space-y-1">
                      {p.variants.map(v => (
                        <button key={v.id} onClick={() => { setActivePropertyId(p.id); updateActiveProperty({ activeVariantId: v.id }); setActiveTab("dashboard"); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${p.id === activePropertyId && p.activeVariantId === v.id ? "text-blue-400 font-bold bg-blue-500/5" : "text-slate-500 hover:text-slate-300"}`}>
                          <Layers size={12} /><span className="truncate">{v.name}</span>{p.id === activePropertyId && p.activeVariantId === v.id && <div className="w-1 h-1 rounded-full bg-blue-500 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
        <div className="p-6 border-t border-slate-800 space-y-3">
          {userPermissions.role !== 'client' && <button onClick={() => setShowUserPanel(true)} className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700"><Users size={14} /> Użytkownicy</button>}
          <button onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><SettingsIcon size={14} /> Konfiguracja</button>
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700"><LogOut size={14} /> Wyloguj</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b p-4 flex justify-between items-center"><div className="flex flex-col"><span className="font-bold text-slate-800">{activeProperty?.name}</span><span className="text-[10px] text-blue-600 font-bold uppercase">{activeVariant?.name}</span></div><button onClick={() => setIsSidebarOpen(true)} className="text-slate-600"><Menu size={24} /></button></header>
        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {activeProperty && activeVariant ? (
            <>
              {activeTab === "dashboard" && <Dashboard rooms={activeVariant.rooms} seasons={activeVariant.seasons} channels={activeVariant.channels} settings={activeVariant.settings} propertyOid={activeProperty.oid || ""} selectedRoomId={selectedRoomId} notes={activeVariant.notes || ""} onNotesChange={(n) => updateActiveVariant({ notes: n })} onRoomUpdate={handleRoomUpdate} onOccupancyUpdate={handleOccupancyUpdate} onReorderRooms={(r) => updateActiveVariant({ rooms: r })} onSyncAllOccupancy={async () => {}} isReadOnly={userPermissions.role === 'client'} activeVariantName={activeVariant.name} onOpenCalculator={() => setShowCalculator(true)} />}
              {activeTab === "summary" && <SummaryDashboard property={activeProperty} />}
              {activeTab === "settings" && <SettingsPanel propertyName={activeProperty.name} onPropertyNameChange={(name) => updateActiveProperty({ name })} propertyOid={activeProperty.oid || ""} onPropertyOidChange={(oid) => updateActiveProperty({ oid })} settings={activeVariant.settings} setSettings={(s) => updateActiveVariant({ settings: s })} channels={activeVariant.channels} setChannels={(c) => updateActiveVariant({ channels: c })} rooms={activeVariant.rooms} setRooms={(r) => updateActiveVariant({ rooms: r })} seasons={activeVariant.seasons} setSeasons={(s) => updateActiveVariant({ seasons: s })} variants={activeProperty.variants} activeVariantId={activeProperty.activeVariantId} onVariantChange={(vid) => updateActiveProperty({ activeVariantId: vid })} onUpdateVariants={(vars) => updateActiveProperty({ variants: vars })} activeTab={activeSettingsTab} onTabChange={setActiveSettingsTab} onDeleteProperty={() => {}} onDuplicateProperty={() => {}} otherProperties={[]} onDuplicateSeasons={() => {}} onDuplicateChannel={() => {}} onDuplicateAllChannels={() => {}} isReadOnly={userPermissions.role === 'client'} />}
            </>
          ) : <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4"><Building size={48} className="opacity-20" /><p>Wybierz Obiekt i Strategię z menu po lewej.</p></div>}
        </div>
      </main>

      {showCalculator && activeVariant && <CalculatorModal rooms={activeVariant.rooms} seasons={activeVariant.seasons} channels={activeVariant.channels} settings={activeVariant.settings} onClose={() => setShowCalculator(false)} propertyOid={activeProperty?.oid} />}
      {showUserPanel && <UserManagementPanel properties={properties} onClose={() => setShowUserPanel(false)} />}
    </div>
  );
};

export default App;
