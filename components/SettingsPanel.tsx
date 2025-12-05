
import React, { useState } from "react";
import { Channel, ChannelDiscountProfile, GlobalSettings, Property, RoomType, Season, SettingsTab } from "../types";
import { Plus, Trash2, X, Copy, GripVertical, ArrowRightLeft, Check, AlertCircle, Lock, ToggleLeft, ToggleRight } from "lucide-react";

interface SettingsPanelProps {
  propertyName: string;
  onPropertyNameChange: (name: string) => void;
  propertyOid: string;
  onPropertyOidChange: (oid: string) => void;
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
  otherProperties: Property[];
  onDuplicateSeasons: (targetPropertyId: string) => void;
  isReadOnly?: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  propertyName,
  onPropertyNameChange,
  propertyOid,
  onPropertyOidChange,
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
  otherProperties,
  onDuplicateSeasons,
  isReadOnly = false,
}) => {
  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedListType, setDraggedListType] = useState<string | null>(null);

  // Duplicate Seasons Modal State
  const [showSeasonDupModal, setShowSeasonDupModal] = useState(false);
  const [targetPropertyId, setTargetPropertyId] = useState<string>("");

  // Generic Handlers for Arrays
  const deleteItem = <T extends { id: string }>(
    id: string,
    list: T[],
    setList: (l: T[]) => void
  ) => {
    if (isReadOnly) return;
    setList(list.filter((item) => item.id !== id));
  };

  const updateItem = <T extends { id: string }>(
    id: string,
    field: keyof T,
    value: any,
    list: T[],
    setList: (l: T[]) => void
  ) => {
    if (isReadOnly) return;
    setList(
      list.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const updateRoomSeasonalObp = (roomId: string, seasonId: string, isActive: boolean) => {
    if (isReadOnly) return;
    setRooms(rooms.map(r => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        seasonalObpActive: {
          ...r.seasonalObpActive,
          [seasonId]: isActive
        }
      };
    }));
  };

  const updateChannelDiscount = (
    channelId: string,
    seasonId: string,
    field: keyof ChannelDiscountProfile,
    value: number | boolean
  ) => {
    if (isReadOnly) return;
    setChannels(
      channels.map((channel) => {
        if (channel.id !== channelId) return channel;

        const currentProfile = channel.seasonDiscounts[seasonId] || { 
          mobile: 0, mobileEnabled: true, 
          genius: 0, geniusEnabled: true,
          seasonal: 0, seasonalEnabled: true,
          firstMinute: 0, firstMinuteEnabled: true,
          lastMinute: 0, lastMinuteEnabled: true,
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

  const handleDuplicateSeasonsSubmit = () => {
    if (isReadOnly) return;
    if (targetPropertyId) {
      onDuplicateSeasons(targetPropertyId);
      setShowSeasonDupModal(false);
      setTargetPropertyId("");
    }
  };

  // Sort Handlers
  const handleDragStart = (index: number, listType: string) => {
    if (isReadOnly) return;
    setDraggedIndex(index);
    setDraggedListType(listType);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = <T,>(
    index: number,
    list: T[],
    setList: (l: T[]) => void,
    listType: string
  ) => {
    if (isReadOnly || draggedIndex === null || draggedIndex === index || draggedListType !== listType) return;
    
    const newList = [...list];
    const [movedItem] = newList.splice(draggedIndex, 1);
    newList.splice(index, 0, movedItem);
    
    setList(newList);
    setDraggedIndex(null);
    setDraggedListType(null);
  };


  const addRoom = () => {
    if (isReadOnly) return;
    const newRoom: RoomType = {
      id: Date.now().toString(),
      name: "Nowy Pokój",
      maxOccupancy: 2,
      tid: "",
      basePricePeak: 200,
      minObpOccupancy: 1,
      obpPerPerson: 30
    };
    setRooms([...rooms, newRoom]);
  };

  const addSeason = () => {
    if (isReadOnly) return;
    const newId = Date.now().toString(),
    newSeason: Season = {
      id: newId,
      name: "Nowy Sezon",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      multiplier: 1.0,
      minNights: 2,
    };
    
    setSeasons([...seasons, newSeason]);
  };

  const addChannel = () => {
    if (isReadOnly) return;
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

  const inputClass = `block w-full rounded-md border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed`;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col relative">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Konfiguracja
            {isReadOnly && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1"><Lock size={10}/> Tylko do odczytu</span>}
          </h2>
          <p className="text-sm text-slate-500">Zarządzaj ofertą, cenami i kanałami sprzedaży.</p>
        </div>
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
                disabled={isReadOnly}
                onChange={(e) => onPropertyNameChange(e.target.value)}
                className={inputClass}
                placeholder="np. Apartament Centrum"
              />

              <label className="block text-sm font-medium text-slate-700 mb-1 mt-4">
                ID Obiektu (OID)
              </label>
              <input
                type="text"
                value={propertyOid}
                disabled={isReadOnly}
                onChange={(e) => onPropertyOidChange(e.target.value)}
                className={inputClass}
                placeholder="np. 12345"
              />

              <div className="mt-6 flex items-center gap-3 bg-white p-3 rounded border border-slate-200">
                 <button 
                  onClick={() => !isReadOnly && setSettings({...settings, obpEnabled: !settings.obpEnabled})}
                  disabled={isReadOnly}
                  className={`text-slate-600 transition-colors ${settings.obpEnabled ? 'text-blue-600' : 'text-slate-400'}`}
                 >
                   {settings.obpEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                 </button>
                 <div>
                    <h4 className="text-sm font-semibold text-slate-800">Cennik Zależny od Obłożenia (OBP) - Globalnie</h4>
                    <p className="text-xs text-slate-500">Włącz lub wyłącz logikę OBP dla całego obiektu. Możesz też wyłączyć ją dla konkretnych pokoi i sezonów w zakładce Pokoje.</p>
                 </div>
              </div>
            </div>

            {!isReadOnly && (
             <>
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
              </>
            )}
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <h3 className="text-lg font-medium">Typy Pokoi (Kwatery)</h3>
                 {!isReadOnly && <button onClick={addRoom} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"><Plus size={16}/> Dodaj Pokój</button>}
              </div>
              <div className="overflow-x-auto pb-4">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-center w-8"></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap min-w-[150px]">Nazwa</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Cena Bazowa</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Max. Os.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap" title="Min. osób do naliczania OBP">Min. OBP</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap" title="Kwota odliczana za osobę">Wartość OBP</th>
                      
                      {/* Dynamic Season Headers for OBP Toggles */}
                      {seasons.map(s => (
                        <th key={s.id} className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap min-w-[80px]">
                          {s.name} <br/><span className="text-[10px]">OBP</span>
                        </th>
                      ))}

                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">TID</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rooms.map((room, index) => (
                      <tr 
                        key={room.id}
                        draggable={!isReadOnly}
                        onDragStart={() => handleDragStart(index, 'rooms')}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index, rooms, setRooms, 'rooms')}
                        className={`bg-white ${draggedListType === 'rooms' && draggedIndex === index ? 'opacity-50' : ''}`}
                      >
                        <td className={`px-3 py-2 text-center text-slate-400 ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                          {!isReadOnly && <GripVertical size={16} />}
                        </td>
                        
                        <td className="px-3 py-2">
                           <input disabled={isReadOnly} type="text" value={room.name} onChange={(e) => updateItem<RoomType>(room.id, "name", e.target.value, rooms, setRooms)} className={`w-full ${inputClass}`} />
                        </td>
                        
                        <td className="px-3 py-2">
                           <input disabled={isReadOnly} type="number" value={room.basePricePeak} onChange={(e) => updateItem<RoomType>(room.id, "basePricePeak", Number(e.target.value), rooms, setRooms)} className={`w-24 ${inputClass}`} />
                        </td>
                        
                        <td className="px-3 py-2">
                           <input disabled={isReadOnly} type="number" value={room.maxOccupancy} onChange={(e) => updateItem<RoomType>(room.id, "maxOccupancy", Number(e.target.value), rooms, setRooms)} className={`w-16 ${inputClass}`} />
                        </td>
                        
                        <td className="px-3 py-2">
                          <input 
                            disabled={isReadOnly}
                            type="number" 
                            min={1} 
                            max={room.maxOccupancy}
                            value={room.minObpOccupancy ?? 1} 
                            onChange={(e) => updateItem<RoomType>(room.id, "minObpOccupancy", Math.min(Number(e.target.value), room.maxOccupancy), rooms, setRooms)} 
                            className={`w-16 ${inputClass}`} 
                          />
                        </td>

                        <td className="px-3 py-2">
                           <input 
                             disabled={isReadOnly || !settings.obpEnabled} 
                             type="number" 
                             value={room.obpPerPerson ?? 30} 
                             onChange={(e) => updateItem<RoomType>(room.id, "obpPerPerson", Number(e.target.value), rooms, setRooms)} 
                             className={`w-20 ${inputClass} ${!settings.obpEnabled ? 'bg-slate-100 text-slate-400' : ''}`} 
                             placeholder="30"
                           />
                        </td>

                        {/* Season OBP Toggles */}
                        {seasons.map(s => {
                           const isActive = room.seasonalObpActive?.[s.id] ?? true;
                           return (
                             <td key={s.id} className="px-3 py-2 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={isActive} 
                                  disabled={isReadOnly || !settings.obpEnabled}
                                  onChange={(e) => updateRoomSeasonalObp(room.id, s.id, e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
                                  title={`OBP ${isActive ? 'Włączone' : 'Wyłączone'} dla ${s.name}`}
                                />
                             </td>
                           )
                        })}
                        
                        <td className="px-3 py-2">
                           <input disabled={isReadOnly} type="text" value={room.tid || ""} onChange={(e) => updateItem<RoomType>(room.id, "tid", e.target.value, rooms, setRooms)} className={`w-20 ${inputClass}`} />
                        </td>
                        
                        <td className="px-3 py-2 text-right">
                          {!isReadOnly && <button onClick={() => deleteItem(room.id, rooms, setRooms)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>}
                        </td>
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
               {!isReadOnly && (
                <div className="flex gap-2">
                  <button onClick={() => setShowSeasonDupModal(true)} className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-100">
                    <ArrowRightLeft size={16}/> Duplikuj Sezony
                  </button>
                  <button onClick={addSeason} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                    <Plus size={16}/> Dodaj Sezon
                  </button>
                </div>
               )}
            </div>
            {seasons.map((season, index) => (
              <div 
                key={season.id} 
                draggable={!isReadOnly}
                onDragStart={() => handleDragStart(index, 'seasons')}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index, seasons, setSeasons, 'seasons')}
                className={`border border-slate-200 rounded-md p-4 bg-slate-50 relative group ${draggedListType === 'seasons' && draggedIndex === index ? 'opacity-50' : ''}`}
              >
                {!isReadOnly && (
                  <>
                    <div className="absolute top-2 left-2 cursor-grab active:cursor-grabbing text-slate-400"><GripVertical size={16}/></div>
                    <button onClick={() => deleteItem(season.id, seasons, setSeasons)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                  </>
                )}
                <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 ${!isReadOnly ? 'pl-6' : ''}`}>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500">Nazwa Sezonu</label>
                    <input disabled={isReadOnly} type="text" value={season.name} onChange={(e) => updateItem<Season>(season.id, "name", e.target.value, seasons, setSeasons)} className={inputClass} />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-slate-500">Mnożnik (np. 1.0)</label>
                    <input disabled={isReadOnly} type="number" step="0.05" value={season.multiplier} onChange={(e) => updateItem<Season>(season.id, "multiplier", Number(e.target.value), seasons, setSeasons)} className={inputClass} />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-slate-500">Min. Nocy</label>
                    <input disabled={isReadOnly} type="number" min="1" value={season.minNights ?? 2} onChange={(e) => updateItem<Season>(season.id, "minNights", Number(e.target.value), seasons, setSeasons)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Zakres Dat</label>
                    <div className="flex gap-2">
                      <input disabled={isReadOnly} type="date" value={season.startDate} onChange={(e) => updateItem<Season>(season.id, "startDate", e.target.value, seasons, setSeasons)} className={`${inputClass} text-xs px-1`} />
                      <input disabled={isReadOnly} type="date" value={season.endDate} onChange={(e) => updateItem<Season>(season.id, "endDate", e.target.value, seasons, setSeasons)} className={`${inputClass} text-xs px-1`} />
                    </div>
                  </div>
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
               {!isReadOnly && <button onClick={addChannel} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"><Plus size={16}/> Dodaj Kanał</button>}
            </div>
            <div className="space-y-6">
              {channels.map((channel, index) => (
                <div 
                  key={channel.id} 
                  draggable={!isReadOnly}
                  onDragStart={() => handleDragStart(index, 'channels')}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index, channels, setChannels, 'channels')}
                  className={`border border-slate-200 rounded-md p-4 bg-white shadow-sm ${draggedListType === 'channels' && draggedIndex === index ? 'opacity-50' : ''}`}
                >
                   {/* Channel Header */}
                   <div className={`flex justify-between items-start mb-4 pb-4 border-b border-slate-100 relative ${!isReadOnly ? 'pl-6' : ''}`}>
                      {!isReadOnly && <div className="absolute top-0 left-0 text-slate-400 cursor-grab active:cursor-grabbing"><GripVertical size={20}/></div>}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 mr-4">
                        <div>
                           <label className="block text-xs font-medium text-slate-500">Nazwa Kanału</label>
                           <input disabled={isReadOnly} type="text" value={channel.name} onChange={(e) => updateItem<Channel>(channel.id, "name", e.target.value, channels, setChannels)} className={`font-semibold text-lg w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-white text-slate-900 disabled:bg-transparent`} />
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-slate-500">Prowizja Podstawowa (%)</label>
                           <input disabled={isReadOnly} type="number" value={channel.commissionPct} onChange={(e) => updateItem<Channel>(channel.id, "commissionPct", Number(e.target.value), channels, setChannels)} className={inputClass} />
                        </div>
                      </div>
                      {!isReadOnly && <button onClick={() => deleteItem(channel.id, channels, setChannels)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>}
                   </div>
                   
                   {/* Seasonal Discounts Table */}
                   <div className="bg-slate-50 rounded-md p-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Konfiguracja Zniżek Sezonowych</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                           <thead>
                              <tr className="text-xs text-slate-500 text-left">
                                 <th className="py-2 pr-2 font-medium">Sezon</th>
                                 <th className="py-2 px-2 font-medium" title="Zniżka dla urz. mobilnych">Mobile %</th>
                                 <th className="py-2 px-2 font-medium" title="Zniżka Genius">Genius %</th>
                                 <th className="py-2 px-2 font-medium" title="Zniżka Sezonowa">Sezon %</th>
                                 <th className="py-2 px-2 font-medium" title="First Minute">First Min %</th>
                                 <th className="py-2 px-2 font-medium" title="Last Minute">Last Min %</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-200">
                              {seasons.map((season) => {
                                 const discounts = channel.seasonDiscounts[season.id] || { 
                                   mobile: 0, mobileEnabled: true,
                                   genius: 0, geniusEnabled: true,
                                   seasonal: 0, seasonalEnabled: true,
                                   firstMinute: 0, firstMinuteEnabled: true,
                                   lastMinute: 0, lastMinuteEnabled: true,
                                 };
                                 
                                 const renderDiscountCell = (field: keyof ChannelDiscountProfile, label: string) => {
                                    // Logic to determine enabled field key based on naming convention
                                    const enabledField = `${field}Enabled` as keyof ChannelDiscountProfile;
                                    const isEnabled = discounts[enabledField] as boolean ?? true;
                                    
                                    return (
                                       <div className="flex items-center gap-2">
                                          <input 
                                             type="checkbox"
                                             disabled={isReadOnly}
                                             checked={isEnabled}
                                             onChange={(e) => updateChannelDiscount(channel.id, season.id, enabledField, e.target.checked)}
                                             className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                                             title={`Włącz/Wyłącz ${label}`}
                                          />
                                          <input 
                                             type="number" 
                                             min="0" 
                                             max={100}
                                             className={`${inputClass} mt-0 py-1 text-center ${!isEnabled ? 'bg-slate-100 text-slate-400' : ''}`}
                                             value={discounts[field] as number}
                                             disabled={!isEnabled || isReadOnly}
                                             onChange={(e) => updateChannelDiscount(channel.id, season.id, field, Number(e.target.value))}
                                          />
                                       </div>
                                    );
                                 };

                                 return (
                                    <tr key={season.id}>
                                       <td className="py-2 pr-2 font-medium text-slate-700 w-32">{season.name}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('mobile', 'zniżkę mobilną')}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('genius', 'zniżkę Genius')}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('seasonal', 'zniżkę sezonową')}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('firstMinute', 'First Minute')}</td>
                                       <td className="py-2 px-2">{renderDiscountCell('lastMinute', 'Last Minute')}</td>
                                    </tr>
                                 );
                              })}
                              {seasons.length === 0 && (
                                 <tr><td colSpan={6} className="py-4 text-center text-slate-400 italic">Brak zdefiniowanych sezonów. Dodaj sezony w zakładce "Sezony".</td></tr>
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

       {/* Duplicate Season Modal */}
       {showSeasonDupModal && !isReadOnly && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] rounded-lg">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">Duplikuj Sezony</h3>
                <button onClick={() => setShowSeasonDupModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
             </div>
             <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                   Wybierz obiekt, do którego chcesz skopiować sezony z <strong>{propertyName}</strong>.
                   <br/><span className="text-xs text-red-500 font-medium">Uwaga: Sezony w obiekcie docelowym zostaną nadpisane.</span>
                </p>
                
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Obiekt Docelowy</label>
                <select 
                   className={inputClass} 
                   value={targetPropertyId}
                   onChange={(e) => setTargetPropertyId(e.target.value)}
                >
                   <option value="">-- Wybierz Obiekt --</option>
                   {otherProperties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                   ))}
                </select>
             </div>
             <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button onClick={() => setShowSeasonDupModal(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded">Anuluj</button>
                <button 
                  onClick={handleDuplicateSeasonsSubmit}
                  disabled={!targetPropertyId}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                   <Check size={16}/> Wykonaj
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsPanel;
