
import React, { useState } from "react";
// Import ChannelDiscountProfile to fix type errors in discount updates
import { Channel, GlobalSettings, RoomType, Season, SettingsTab, ChannelDiscountProfile } from "../types";
import { Plus, Trash2, X, CloudUpload, Loader2, Link as LinkIcon, ToggleLeft, ToggleRight, AlertCircle } from "lucide-react";
import { updateHotresPrices } from "../utils/hotresApi";

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
  isReadOnly?: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  propertyName, onPropertyNameChange, propertyOid, onPropertyOidChange,
  settings, setSettings, channels, setChannels, rooms, setRooms, seasons, setSeasons,
  activeTab, onTabChange, isReadOnly = false,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportToHotres = async () => {
    if (isReadOnly || !propertyOid) return;
    if (!confirm(`⚠️ UWAGA ⚠️\nZamierzasz wysłać wszystkie ceny do Hotres.\nKontynuować?`)) return;
    setIsExporting(true);
    try {
      await updateHotresPrices(propertyOid, rooms, seasons, channels, settings);
      alert("Sukces! Cenniki wysłane.");
    } catch (e: any) { alert("Błąd: " + e.message); }
    finally { setIsExporting(false); }
  };

  const inputClass = "block w-full rounded-md border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 disabled:bg-slate-100";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col relative overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Ustawienia Obiektu</h2>
          <p className="text-sm text-slate-500">Zarządzasz: <span className="font-bold text-blue-600">{propertyName}</span></p>
        </div>
        {!isReadOnly && (
          <button onClick={handleExportToHotres} disabled={isExporting} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-orange-700 disabled:opacity-50">
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
            Wyślij do Hotres
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
        {(["global", "rooms", "seasons", "channels"] as const).map((tab) => (
          <button key={tab} onClick={() => onTabChange(tab)} className={`px-4 py-3 text-sm font-bold capitalize transition-colors whitespace-nowrap ${activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:bg-slate-50"}`}>
            {tab === "global" ? "Obiekt" : tab === "rooms" ? "Pokoje (OBP)" : tab === "seasons" ? "Sezony" : "Kanały (OTA)"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "global" && (
          <div className="space-y-6 max-w-lg">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nazwa Obiektu</label><input type="text" value={propertyName} onChange={e => onPropertyNameChange(e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hotres OID</label><input type="text" value={propertyOid} onChange={e => onPropertyOidChange(e.target.value)} className={inputClass} /></div>
             </div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                <button onClick={() => setSettings({...settings, obpEnabled: !settings.obpEnabled})} className={settings.obpEnabled ? 'text-blue-600' : 'text-slate-300'}>
                   {settings.obpEnabled ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                </button>
                <div>
                  <h4 className="text-sm font-bold">Cennik Zależny od Obłożenia (OBP)</h4>
                  <p className="text-xs text-slate-500">Włącz lub wyłącz logikę OBP globalnie.</p>
                </div>
             </div>
          </div>
        )}

        {activeTab === "rooms" && (
           <div className="space-y-4">
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left border-collapse">
                    <thead>
                       <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3">Pokój</th>
                          <th className="px-4 py-3">Baza Peak</th>
                          <th className="px-4 py-3">Max Os.</th>
                          <th className="px-4 py-3">Min OBP</th>
                          <th className="px-4 py-3">Wartość OBP</th>
                          {seasons.map(s => <th key={s.id} className="px-4 py-3 text-center">{s.name}</th>)}
                          <th className="px-4 py-3"></th>
                       </tr>
                    </thead>
                    <tbody>
                       {rooms.map(room => (
                          <tr key={room.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                             <td className="px-4 py-3"><input type="text" value={room.name} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, name: e.target.value} : r))} className={inputClass} /></td>
                             <td className="px-4 py-3"><input type="number" value={room.basePricePeak} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, basePricePeak: Number(e.target.value)} : r))} className={`${inputClass} w-24`} /></td>
                             <td className="px-4 py-3"><input type="number" value={room.maxOccupancy} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, maxOccupancy: Number(e.target.value)} : r))} className={`${inputClass} w-16`} /></td>
                             <td className="px-4 py-3"><input type="number" value={room.minObpOccupancy} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, minObpOccupancy: Number(e.target.value)} : r))} className={`${inputClass} w-16`} /></td>
                             <td className="px-4 py-3"><input type="number" value={room.obpPerPerson} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, obpPerPerson: Number(e.target.value)} : r))} className={`${inputClass} w-20`} /></td>
                             {seasons.map(s => (
                                <td key={s.id} className="px-4 py-3 text-center">
                                   <input type="checkbox" checked={room.seasonalObpActive?.[s.id] ?? true} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, seasonalObpActive: {...(r.seasonalObpActive || {}), [s.id]: e.target.checked}} : r))} className="rounded text-blue-600" />
                                </td>
                             ))}
                             <td className="px-4 py-3 text-right"><button onClick={() => setRooms(rooms.filter(r => r.id !== room.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button></td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              <button onClick={() => setRooms([...rooms, { id: "r" + Date.now(), name: "Nowy Pokój", basePricePeak: 200, maxOccupancy: 2, tid: "" }])} className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:underline"><Plus size={16}/> Dodaj Pokój</button>
           </div>
        )}

        {activeTab === "seasons" && (
          <div className="space-y-4">
             {seasons.map(s => (
                <div key={s.id} className="p-4 border rounded-xl bg-white shadow-sm flex flex-col md:flex-row gap-4 items-end">
                   <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                      <div className="md:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Nazwa Sezonu</label><input type="text" value={s.name} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, name: e.target.value} : si))} className={inputClass} /></div>
                      <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase">Zakres Dat</label><div className="flex gap-2"><input type="date" value={s.startDate} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, startDate: e.target.value} : si))} className={inputClass} /><input type="date" value={s.endDate} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, endDate: e.target.value} : si))} className={inputClass} /></div></div>
                      <div className="md:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Mnożnik</label><input type="number" step="0.05" value={s.multiplier} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, multiplier: Number(e.target.value)} : si))} className={inputClass} /></div>
                   </div>
                   <button onClick={() => setSeasons(seasons.filter(si => si.id !== s.id))} className="text-slate-300 hover:text-red-500 pb-2"><Trash2 size={20}/></button>
                </div>
             ))}
             <button onClick={() => setSeasons([...seasons, { id: "s" + Date.now(), name: "Nowy Sezon", startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], multiplier: 1.0 }])} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2"><Plus size={18}/> Dodaj Nowy Sezon</button>
          </div>
        )}

        {activeTab === "channels" && (
           <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                 <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2"><LinkIcon size={16}/> Mapowanie Kanałów & RID</h3>
                 <div className="space-y-8">
                    {channels.map(channel => (
                       <div key={channel.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                          <div className="flex justify-between items-center border-b pb-4">
                             <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full" style={{backgroundColor: channel.color}}></div>
                                <input type="text" value={channel.name} onChange={e => setChannels(channels.map(c => c.id === channel.id ? {...c, name: e.target.value} : c))} className="font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0" />
                             </div>
                             <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">RID:</label>
                                <input type="text" value={channel.rid || ""} onChange={e => setChannels(channels.map(c => c.id === channel.id ? {...c, rid: e.target.value} : c))} placeholder="RID" className="w-24 px-2 py-1 border rounded font-bold text-blue-600 text-xs" />
                                <button onClick={() => setChannels(channels.filter(c => c.id !== channel.id))} className="text-slate-300 hover:text-red-500 ml-4"><Trash2 size={16}/></button>
                             </div>
                          </div>
                          <div className="overflow-x-auto">
                             <table className="w-full text-xs">
                                <thead>
                                   <tr className="text-slate-400 font-bold text-left">
                                      <th className="py-2">Sezon</th>
                                      <th className="py-2">Mobile %</th>
                                      <th className="py-2">Genius %</th>
                                      <th className="py-2">Seasonal %</th>
                                      <th className="py-2">First Min %</th>
                                      <th className="py-2">Last Min %</th>
                                   </tr>
                                </thead>
                                <tbody>
                                   {seasons.map(s => {
                                      // Provide a full default object to fix ChannelDiscountProfile type mismatch
                                      const discounts: ChannelDiscountProfile = channel.seasonDiscounts[s.id] || { 
                                         mobile: 0, mobileEnabled: true, 
                                         genius: 0, geniusEnabled: true, 
                                         seasonal: 0, seasonalEnabled: true, 
                                         firstMinute: 0, firstMinuteEnabled: true, 
                                         lastMinute: 0, lastMinuteEnabled: true 
                                      };
                                      const updDisc = (field: string, val: number) => {
                                         // Use type assertion to bypass dynamic key mapping issues in TypeScript
                                         const updated = { ...discounts, [field]: val, [`${field}Enabled`]: true } as any;
                                         setChannels(channels.map(c => c.id === channel.id ? { ...c, seasonDiscounts: { ...c.seasonDiscounts, [s.id]: updated } } : c));
                                      };
                                      return (
                                         <tr key={s.id} className="border-t">
                                            <td className="py-2 font-medium">{s.name}</td>
                                            <td className="py-2"><input type="number" value={discounts.mobile} onChange={e => updDisc('mobile', Number(e.target.value))} className="w-12 p-1 border rounded" /></td>
                                            <td className="py-2"><input type="number" value={discounts.genius} onChange={e => updDisc('genius', Number(e.target.value))} className="w-12 p-1 border rounded" /></td>
                                            <td className="py-2"><input type="number" value={discounts.seasonal} onChange={e => updDisc('seasonal', Number(e.target.value))} className="w-12 p-1 border rounded" /></td>
                                            <td className="py-2"><input type="number" value={discounts.firstMinute} onChange={e => updDisc('firstMinute', Number(e.target.value))} className="w-12 p-1 border rounded" /></td>
                                            <td className="py-2"><input type="number" value={discounts.lastMinute} onChange={e => updDisc('lastMinute', Number(e.target.value))} className="w-12 p-1 border rounded" /></td>
                                         </tr>
                                      );
                                   })}
                                </tbody>
                             </table>
                          </div>
                       </div>
                    ))}
                 </div>
                 <button onClick={() => setChannels([...channels, { id: "c" + Date.now(), name: "Nowy Kanał", commissionPct: 15, color: "#64748b", seasonDiscounts: {} }])} className="mt-4 text-blue-600 font-bold text-sm flex items-center gap-1 hover:underline"><Plus size={16}/> Dodaj Kanał</button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
