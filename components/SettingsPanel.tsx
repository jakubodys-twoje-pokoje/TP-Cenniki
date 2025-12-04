import React, { useState } from "react";
import { Channel, GlobalSettings, RoomType, Season } from "../types";
import { Plus, Trash2, X } from "lucide-react";

interface SettingsPanelProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  channels: Channel[];
  setChannels: (c: Channel[]) => void;
  rooms: RoomType[];
  setRooms: (r: RoomType[]) => void;
  seasons: Season[];
  setSeasons: (s: Season[]) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  setSettings,
  channels,
  setChannels,
  rooms,
  setRooms,
  seasons,
  setSeasons,
}) => {
  const [activeTab, setActiveTab] = useState<"global" | "rooms" | "seasons" | "channels">("global");

  // Handlers for Global
  const handleObpChange = (val: string) => setSettings({ ...settings, defaultObp: Number(val) });

  // Generic Handlers for Arrays
  const deleteItem = <T extends { id: string }>(
    id: string,
    list: T[],
    setList: (l: T[]) => void
  ) => {
    setList(list.filter((item) => item.id !== id));
  };

  const updateItem = <T extends { id: string }>(
    id: string,
    field: keyof T,
    value: any,
    list: T[],
    setList: (l: T[]) => void
  ) => {
    setList(
      list.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addRoom = () => {
    const newRoom: RoomType = {
      id: Date.now().toString(),
      name: "Nowy Pokój",
      maxOccupancy: 2,
      quantity: 1,
      basePricePeak: 200,
    };
    setRooms([...rooms, newRoom]);
  };

  const addSeason = () => {
    const newSeason: Season = {
      id: Date.now().toString(),
      name: "Nowy Sezon",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      multiplier: 1.0,
      obpEnabled: true,
    };
    setSeasons([...seasons, newSeason]);
  };

  const addChannel = () => {
    const newChannel: Channel = {
      id: Date.now().toString(),
      name: "Nowy Kanał",
      commissionPct: 15,
      mobileDiscountPct: 0,
      seasonalDiscountPct: 0,
      additionalDiscountPct: 0,
      color: "#64748b",
    };
    setChannels([...channels, newChannel]);
  };

  const tabLabels = {
    global: "Globalne",
    rooms: "Pokoje",
    seasons: "Sezony",
    channels: "Kanały"
  };

  const inputClass = "mt-1 block w-full rounded-md border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Konfiguracja</h2>
        <p className="text-sm text-slate-500">Zarządzaj ofertą, cenami i kanałami sprzedaży.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {(["global", "rooms", "seasons", "channels"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-white text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Global Tab */}
        {activeTab === "global" && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-2">Polityka Cenowa OBP (Zależna od obłożenia)</h3>
              <p className="text-sm text-blue-700 mb-4">
                Globalna kwota zniżki za każde puste łóżko przy niepełnym obłożeniu pokoju.
              </p>
              <label className="block text-sm font-medium text-slate-700">
                Domyślna Zniżka (PLN)
              </label>
              <input
                type="number"
                value={settings.defaultObp}
                onChange={(e) => handleObpChange(e.target.value)}
                className={`max-w-xs ${inputClass}`}
              />
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-medium">Typy Pokoi (Kwatery)</h3>
               <button onClick={addRoom} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"><Plus size={16}/> Dodaj Pokój</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Nazwa</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Maks. Osób</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Ilość</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Cena Bazowa (Szczyt)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="px-3 py-2"><input type="text" value={room.name} onChange={(e) => updateItem<RoomType>(room.id, "name", e.target.value, rooms, setRooms)} className={`w-full ${inputClass}`} /></td>
                      <td className="px-3 py-2"><input type="number" value={room.maxOccupancy} onChange={(e) => updateItem<RoomType>(room.id, "maxOccupancy", Number(e.target.value), rooms, setRooms)} className={`w-20 ${inputClass}`} /></td>
                      <td className="px-3 py-2"><input type="number" value={room.quantity} onChange={(e) => updateItem<RoomType>(room.id, "quantity", Number(e.target.value), rooms, setRooms)} className={`w-20 ${inputClass}`} /></td>
                      <td className="px-3 py-2"><input type="number" value={room.basePricePeak} onChange={(e) => updateItem<RoomType>(room.id, "basePricePeak", Number(e.target.value), rooms, setRooms)} className={`w-32 ${inputClass}`} /></td>
                      <td className="px-3 py-2 text-right"><button onClick={() => deleteItem(room.id, rooms, setRooms)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Seasons Tab */}
        {activeTab === "seasons" && (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="text-lg font-medium">Reguły Sezonowe</h3>
               <button onClick={addSeason} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"><Plus size={16}/> Dodaj Sezon</button>
            </div>
            {seasons.map((season) => (
              <div key={season.id} className="border border-slate-200 rounded-md p-4 bg-slate-50 relative group">
                <button onClick={() => deleteItem(season.id, seasons, setSeasons)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Nazwa Sezonu</label>
                    <input type="text" value={season.name} onChange={(e) => updateItem<Season>(season.id, "name", e.target.value, seasons, setSeasons)} className={inputClass} />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-slate-500">Mnożnik Ceny (np. 1.0, 0.8)</label>
                    <input type="number" step="0.05" value={season.multiplier} onChange={(e) => updateItem<Season>(season.id, "multiplier", Number(e.target.value), seasons, setSeasons)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Data Początkowa</label>
                    <input type="date" value={season.startDate} onChange={(e) => updateItem<Season>(season.id, "startDate", e.target.value, seasons, setSeasons)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Data Końcowa</label>
                    <input type="date" value={season.endDate} onChange={(e) => updateItem<Season>(season.id, "endDate", e.target.value, seasons, setSeasons)} className={inputClass} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={season.obpEnabled} onChange={(e) => updateItem<Season>(season.id, "obpEnabled", e.target.checked, seasons, setSeasons)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white" />
                    Włącz OBP (Zniżka za mniejsze obłożenie)
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Channels Tab */}
        {activeTab === "channels" && (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="text-lg font-medium">Kanały Sprzedaży (OTA)</h3>
               <button onClick={addChannel} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"><Plus size={16}/> Dodaj Kanał</button>
            </div>
            <div className="space-y-4">
              {channels.map((channel) => (
                <div key={channel.id} className="border border-slate-200 rounded-md p-4 bg-white shadow-sm">
                   <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 mr-4">
                        <label className="block text-xs font-medium text-slate-500">Nazwa Kanału</label>
                        <input type="text" value={channel.name} onChange={(e) => updateItem<Channel>(channel.id, "name", e.target.value, channels, setChannels)} className={`font-semibold text-lg w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-white text-slate-900`} />
                      </div>
                      <button onClick={() => deleteItem(channel.id, channels, setChannels)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                   </div>
                   
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Prowizja %</label>
                        <input type="number" value={channel.commissionPct} onChange={(e) => updateItem<Channel>(channel.id, "commissionPct", Number(e.target.value), channels, setChannels)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Zniżka Mobilna %</label>
                        <input type="number" value={channel.mobileDiscountPct} onChange={(e) => updateItem<Channel>(channel.id, "mobileDiscountPct", Number(e.target.value), channels, setChannels)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Zniżka Sezonowa %</label>
                        <input type="number" value={channel.seasonalDiscountPct} onChange={(e) => updateItem<Channel>(channel.id, "seasonalDiscountPct", Number(e.target.value), channels, setChannels)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500">Dodatkowa Zniżka %</label>
                        <input type="number" value={channel.additionalDiscountPct} onChange={(e) => updateItem<Channel>(channel.id, "additionalDiscountPct", Number(e.target.value), channels, setChannels)} className={inputClass} />
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;