import React, { useState } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Menu, BedDouble, Calendar, Share2, Globe, ChevronDown, ChevronRight, Building, Plus, Trash2, Bed } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Dashboard from "./components/Dashboard";
import {
  INITIAL_CHANNELS,
  INITIAL_ROOMS,
  INITIAL_SEASONS,
  INITIAL_SETTINGS,
} from "./constants";
import { Property, SettingsTab } from "./types";

const App: React.FC = () => {
  // Application State
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("rooms"); // Default to rooms
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Property / Template Management
  const [properties, setProperties] = useState<Property[]>([{
    id: "default",
    name: "Główny Obiekt",
    settings: INITIAL_SETTINGS,
    channels: INITIAL_CHANNELS,
    rooms: INITIAL_ROOMS,
    seasons: INITIAL_SEASONS,
  }]);
  const [activePropertyId, setActivePropertyId] = useState<string>("default");
  
  // Track which properties are expanded in the sidebar
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set(["default"]));

  // Helper to get current active property data
  const activeProperty = properties.find(p => p.id === activePropertyId) || properties[0];

  // Helper to update active property
  const updateActiveProperty = (updates: Partial<Property>) => {
    setProperties(prev => prev.map(p => 
      p.id === activePropertyId ? { ...p, ...updates } : p
    ));
  };

  const handleAddProperty = () => {
    const newId = Date.now().toString();
    const newProperty: Property = {
      id: newId,
      name: "Nowy Obiekt",
      settings: INITIAL_SETTINGS,
      channels: INITIAL_CHANNELS,
      rooms: INITIAL_ROOMS,
      seasons: INITIAL_SEASONS,
    };
    setProperties([...properties, newProperty]);
    setActivePropertyId(newId);
    setExpandedProperties(prev => new Set(prev).add(newId)); // Auto expand new
    setActiveTab("settings");
    setActiveSettingsTab("global"); // Go to global to rename
    setSelectedRoomId(null);
  };

  const handleDeleteProperty = (id: string) => {
    if (properties.length <= 1) {
      alert("Musisz zachować przynajmniej jeden obiekt.");
      return;
    }
    if (confirm("Czy na pewno chcesz usunąć ten obiekt?")) {
      const newProps = properties.filter(p => p.id !== id);
      setProperties(newProps);
      if (id === activePropertyId) {
        setActivePropertyId(newProps[0].id);
        setSelectedRoomId(null);
      }
    }
  };

  const handleSettingsNav = (tab: SettingsTab) => {
    setActiveTab("settings");
    setActiveSettingsTab(tab);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-700 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white">R</div>
          <span className="text-xl font-bold tracking-tight">RevMax</span>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab("dashboard"); setSelectedRoomId(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "dashboard" && selectedRoomId === null
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Panel</span>
          </button>

          {/* Configuration Dropdown */}
          <div>
            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                activeTab === "settings"
                  ? "text-white" // Keep distinct from active selection
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
                <button
                  onClick={() => handleSettingsNav("rooms")}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === "settings" && activeSettingsTab === "rooms"
                      ? "bg-blue-600/50 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <BedDouble size={16} />
                  <span>Pokoje</span>
                </button>
                
                <button
                  onClick={() => handleSettingsNav("seasons")}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === "settings" && activeSettingsTab === "seasons"
                      ? "bg-blue-600/50 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <Calendar size={16} />
                  <span>Sezony</span>
                </button>

                <button
                  onClick={() => handleSettingsNav("channels")}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === "settings" && activeSettingsTab === "channels"
                      ? "bg-blue-600/50 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <Share2 size={16} />
                  <span>Kanały</span>
                </button>
                
                 <button
                  onClick={() => handleSettingsNav("global")}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === "settings" && activeSettingsTab === "global"
                      ? "bg-blue-600/50 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <Globe size={16} />
                  <span>Globalne</span>
                </button>
              </div>
            )}
          </div>

          {/* Properties / Templates Section */}
          <div className="mt-6">
             <div className="flex items-center justify-between mb-2 px-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Twoje Obiekty</span>
                <button onClick={handleAddProperty} className="text-blue-400 hover:text-blue-300 transition-colors p-1" title="Dodaj obiekt">
                   <Plus size={16} />
                </button>
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
                        {properties.length > 1 && (
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteProperty(p.id); }}
                             className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 transition-opacity"
                             title="Usuń obiekt"
                          >
                             <Trash2 size={12} />
                          </button>
                        )}
                     </div>
                     
                     {/* Nested Room List */}
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

        <div className="p-6 border-t border-slate-800">
          <div className="text-xs text-slate-500">
            <p>Wersja 0.2.1</p>
            <p className="mt-1">© 2024 Silnik Cenowy</p>
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
              rooms={activeProperty.rooms} 
              seasons={activeProperty.seasons} 
              channels={activeProperty.channels}
              settings={activeProperty.settings}
              selectedRoomId={selectedRoomId}
            />
          ) : (
            <SettingsPanel 
              propertyName={activeProperty.name}
              onPropertyNameChange={(name) => updateActiveProperty({ name })}
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
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;