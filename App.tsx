import React, { useState } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Menu } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import Dashboard from "./components/Dashboard";
import {
  INITIAL_CHANNELS,
  INITIAL_ROOMS,
  INITIAL_SEASONS,
  INITIAL_SETTINGS,
} from "./constants";
import { Channel, GlobalSettings, RoomType, Season } from "./types";

const App: React.FC = () => {
  // Application State
  // In a real app, this would be in a Context or Redux store
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data State
  const [settings, setSettings] = useState<GlobalSettings>(INITIAL_SETTINGS);
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [rooms, setRooms] = useState<RoomType[]>(INITIAL_ROOMS);
  const [seasons, setSeasons] = useState<Season[]>(INITIAL_SEASONS);

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

        <nav className="p-4 space-y-2">
          <button
            onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "dashboard"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Panel</span>
          </button>

          <button
            onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "settings"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <SettingsIcon size={20} />
            <span className="font-medium">Konfiguracja</span>
          </button>
        </nav>

        <div className="absolute bottom-0 w-full p-6 border-t border-slate-800">
          <div className="text-xs text-slate-500">
            <p>Wersja 0.1.0</p>
            <p className="mt-1">© 2024 Silnik Cenowy</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <span className="font-bold text-slate-800">RevMax</span>
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
            <Menu size={24} />
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {activeTab === "dashboard" ? (
            <Dashboard 
              rooms={rooms} 
              seasons={seasons} 
              channels={channels}
              settings={settings}
            />
          ) : (
            <SettingsPanel 
              settings={settings}
              setSettings={setSettings}
              channels={channels}
              setChannels={setChannels}
              rooms={rooms}
              setRooms={setRooms}
              seasons={seasons}
              setSeasons={setSeasons}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;