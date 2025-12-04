
import React from "react";
import { Channel, ChannelDiscountProfile, GlobalSettings, RoomType, Season, SettingsTab } from "../types";
import { Plus, Trash2, X, Copy } from "lucide-react";

interface SettingsPanelProps {
  propertyName: string;
  onPropertyNameChange: (name: string) => void;
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  channels: Channel[];
  setChannels: (c: Channel[]) => void;
  rooms: RoomType[];
  setRooms: (r: RoomType[]) => void;
  seasons: Season[];
  setSeasons: (s: Season[]) => void;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onDeleteProperty: () => void;
  onDuplicateProperty: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  propertyName,
  onPropertyNameChange,
  settings,
  setSettings,
  channels,
  setChannels,
  rooms,
  setRooms,
  seasons,
  setSeasons,
  activeTab,
  onTabChange,
  onDeleteProperty,
  onDuplicateProperty,
}) => {
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

  const updateChannelDiscount = (
    channelId: string,
    seasonId: string,
    field: keyof ChannelDiscountProfile,
    value: number | boolean
  ) => {
    setChannels(
      channels.map((channel) => {
        if (channel.id !== channelId) return channel;

        const currentProfile = channel.seasonDiscounts[seasonId] || { 
          mobile: 0, mobileEnabled: true, 
          seasonal: 0, seasonalEnabled: true,
          additional1: 0, additional1Enabled: true,
          additional2: 0, additional2Enabled: true
        };
        
        return {
          ...channel,
          seasonDiscounts: {
            ...channel.seasonDiscounts,
            [seasonId]: {
              ...currentProfile,
              [field]: value,
            },
          },
        };
      })
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
      color: "#64748b",
      seasonDiscounts: {},
    };
    setChannels([...channels, newChannel]);
  };

  const tabLabels: Record<SettingsTab, string> = {
    global: "Ogólne",
    rooms: "Pokoje",
    seasons: "Sezony",
    channels: "Kanały"
  };

  const inputClass = "block w-full rounded-md border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Konfiguracja</h2>
        <p className="text-sm text-slate-500">Zarządzaj ofertą, cenami i kanałami sprzedaży.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
        {(["global", "rooms", "seasons", "channels"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors whitespace-nowrap ${
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
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nazwa Obiektu
              </label>
              <input
                type="text"
                value={propertyName}
                onChange={(e) => onPropertyNameChange(e.target.value)}
                className={inputClass}
                placeholder="np. Apartament Centrum"
              />
            </div>

             <div className="bg-indigo-50 p-4 rounded-md border border-indigo-100 mt-6">
              <h3 className="font-semibold text-indigo-900 mb-2">Szablony i Kopiowanie</h3>
              <p className="text-sm text-indigo-700 mb-4">
                Możesz stworzyć duplikat tego obiektu (wraz z wszystkimi ustawieniami, pokojami i kanałami) i użyć go jako szablonu dla nowej lokalizacji.
              </p>
              <button
                onClick={onDuplicateProperty}
                className="flex items-center gap-2 bg-white border border-indigo-300 text-indigo-600 px-4 py-2 rounded shadow-sm hover:bg-indigo-50 transition-colors"
              >
                <Copy size={16} />
                Duplikuj ten obiekt
              </button>
            </div>

            <div className="bg-red-50 p-4 rounded-md border border-red-100 mt-6">
              <h3 className="font-semibold text-red-900 mb-2">Strefa Niebezpieczna</h3>
              <p className="text-sm text-red-700 mb-4">
                Usunięcie tego obiektu jest nieodwracalne. 
              </p>
              <button
                onClick={onDeleteProperty}
                className="flex items-center gap-2 bg-white border border-red-300 text-red-600 px-4 py-2 rounded shadow-sm hover:bg-red-100 transition-colors"
              >
                <Trash2 size={16} />
                Usuń ten obiekt
              </button>
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="space-y-6">
             {/* OBP moved here */}
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
                      {/* Base Price Column Removed */}
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rooms.map((room) => (
                      <tr key={room.id}>
                        <td className="px-3 py-2"><input type="text" value={room.name} onChange={(e) => updateItem<RoomType>(room.id, "name", e.target.value, rooms, setRooms)} className={`w-full ${inputClass}`} /></td>
                        <td className="px-3 py-2"><input type="number" value={room.maxOccupancy} onChange={(e) => updateItem<RoomType>(room.id, "maxOccupancy", Number(e.target.value), rooms, setRooms)} className={`w-20 ${inputClass}`} /></td>
                        <td className="px-3 py-2"><input type="number" value={room.quantity} onChange={(e) => updateItem<RoomType>(room.id, "quantity", Number(e.target.value), rooms, setRooms)} className={`w-20 ${inputClass}`} /></td>
                        {/* Base Price Input Removed */}
                        <td className="px-3 py-2 text-right"><button onClick={() => deleteItem(room.id, rooms, setRooms)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            <div className="space-y-6">
              {channels.map((channel) => (
                <div key={channel.id} className="border border-slate-200 rounded-md p-4 bg-white shadow-sm">
                   {/* Channel Header */}
                   <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-100">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 mr-4">
                        <div>
                           <label className="block text-xs font-medium text-slate-500">Nazwa Kanału</label>
                           <input type="text" value={channel.name} onChange={(e) => updateItem<Channel>(channel.id, "name", e.target.value, channels, setChannels)} className={`font-semibold text-lg w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-white text-slate-900`} />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-slate-500">Prowizja Podstawowa (%)</label>
                           <input type="number" value={channel.commissionPct} onChange={(e) => updateItem<Channel>(channel.id, "commissionPct", Number(e.target.value), channels, setChannels)} className={inputClass} />
                        </div>
                      </div>
                      <button onClick={() => deleteItem(channel.id, channels, setChannels)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                   </div>
                   
                   {/* Seasonal Discounts Table */}
                   <div className="bg-slate-50 rounded-md p-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Konfiguracja Zniżek Sezonowych</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                           <thead>
                              <tr className="text-xs text-slate-500 text-left">
                                 <th className="py-2 pr-2 font-medium">Sezon</th>
                                 <th className="py-2 px-2 font-medium">Mobilna %</th>
                                 <th className="py-2 px-2 font-medium">Sezonowa %</th>
                                 <th className="py-2 px-2 font-medium">Dodatkowa 1 %</th>
                                 <th className="py-2 pl-2 font-medium">Dodatkowa 2 %</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-200">
                              {seasons.map((season) => {
                                 const discounts = channel.seasonDiscounts[season.id] || { 
                                   mobile: 0, mobileEnabled: true,
                                   seasonal: 0, seasonalEnabled: true,
                                   additional1: 0, additional1Enabled: true,
                                   additional2: 0, additional2Enabled: true
                                 };
                                 
                                 const renderDiscountCell = (field: 'mobile' | 'seasonal' | 'additional1' | 'additional2') => {
                                    const enabledField = `${field}Enabled` as keyof ChannelDiscountProfile;
                                    const isEnabled = discounts[enabledField] as boolean ?? true;
                                    
                                    return (
                                       <div className="flex items-center gap-2">
                                          <input 
                                             type="checkbox"
                                             checked={isEnabled}
                                             onChange={(e) => updateChannelDiscount(channel.id, season.id, enabledField, e.target.checked)}
                                             className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <input 
                                             type="number" 
                                             min="0" max="100" 
                                             className={`${inputClass} mt-0 py-1 text-center ${!isEnabled ? 'bg-slate-100 text-slate-400' : ''}`}
                                             value={discounts[field] as number}
                                             disabled={!isEnabled}
                                             onChange={(e) => updateChannelDiscount(channel.id, season.id, field, Number(e.target.value))}
                                          />
                                       </div>
                                    );
                                 };

                                 return (
                                    <tr key={season.id}>
                                       <td className="py-2 pr-2 font-medium text-slate-700 w-32">{season.name}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('mobile')}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('seasonal')}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('additional1')}</td>
                                       <td className="py-2 pl-2">{renderDiscountCell('additional2')}</td>
                                    </tr>
                                 );
                              })}
                              {seasons.length === 0 && (
                                 <tr><td colSpan={5} className="py-4 text-center text-slate-400 italic">Brak zdefiniowanych sezonów. Dodaj sezony w zakładce "Sezony".</td></tr>
                              )}
                           </tbody>
                        </table>
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
