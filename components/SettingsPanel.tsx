
import React, { useState } from "react";
import { Channel, ChannelDiscountProfile, ChannelDiscountLabels, GlobalSettings, Property, RoomType, Season, SettingsTab, Variant } from "../types";
import { Plus, Trash2, X, Copy, GripVertical, ArrowRightLeft, Check, AlertCircle, Lock, ToggleLeft, ToggleRight, Layers, CloudUpload, Loader2, Link as LinkIcon, Edit3, Save } from "lucide-react";
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
  variants: Variant[];
  activeVariantId: string;
  onVariantChange: (id: string) => void;
  onUpdateVariants: (vars: Variant[]) => void;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onDeleteProperty: () => void;
  onDuplicateProperty: () => void;
  otherProperties: Property[];
  onDuplicateSeasons: (targetPropertyId: string) => void;
  onDuplicateChannel: (sourceChannel: Channel, targetPropertyId: string) => void;
  onDuplicateAllChannels: (targetPropertyId: string) => void;
  isReadOnly?: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  propertyName, onPropertyNameChange, propertyOid, onPropertyOidChange,
  settings, setSettings, channels, setChannels, rooms, setRooms, seasons, setSeasons,
  variants, activeVariantId, onVariantChange, onUpdateVariants,
  activeTab, onTabChange, onDeleteProperty, isReadOnly = false,
}) => {
  const [newVariantName, setNewVariantName] = useState("");

  const addVariant = () => {
    if (!newVariantName.trim()) return;
    const currentVariant = variants.find(v => v.id === activeVariantId);
    const newVariant: Variant = {
      ...deepClone(currentVariant!),
      id: "v-" + Date.now(),
      name: newVariantName,
    };
    onUpdateVariants([...variants, newVariant]);
    onVariantChange(newVariant.id);
    setNewVariantName("");
  };

  const deleteVariant = (id: string) => {
    if (variants.length <= 1) return;
    if (confirm("Usunąć ten wariant? Stracisz wszystkie jego ustawienia cenowe.")) {
      const next = variants.filter(v => v.id !== id);
      onUpdateVariants(next);
      if (id === activeVariantId) onVariantChange(next[0].id);
    }
  };

  function deepClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }

  const inputClass = `block w-full rounded-md border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 disabled:bg-slate-100`;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col relative">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Konfiguracja Obiektu</h2>
          <p className="text-sm text-slate-500">Zarządzasz: <span className="font-bold text-blue-600">{propertyName}</span></p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
        {(["global", "variants", "rooms", "seasons", "channels"] as const).map((tab) => (
          <button key={tab} onClick={() => onTabChange(tab)} className={`px-4 py-3 text-sm font-medium capitalize transition-colors whitespace-nowrap ${activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>
            {tab === "global" ? "Ogólne" : tab === "variants" ? "Strategie (Warianty)" : tab === "rooms" ? "Pokoje" : tab === "seasons" ? "Sezony" : "Kanały"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "global" && (
          <div className="space-y-4 max-w-md">
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nazwa Obiektu</label><input type="text" value={propertyName} onChange={e => onPropertyNameChange(e.target.value)} className={inputClass} /></div>
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Object ID (Hotres)</label><input type="text" value={propertyOid} onChange={e => onPropertyOidChange(e.target.value)} className={inputClass} /></div>
             <div className="pt-8"><button onClick={onDeleteProperty} className="text-red-500 text-sm flex items-center gap-1 hover:underline"><Trash2 size={14}/> Usuń cały obiekt</button></div>
          </div>
        )}

        {activeTab === "variants" && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-4 items-end">
               <div className="flex-1">
                  <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Dodaj nowy wariant (Kopię obecnego)</label>
                  <input type="text" value={newVariantName} onChange={e => setNewVariantName(e.target.value)} placeholder="np. Strategia Agresywna" className={inputClass} />
               </div>
               <button onClick={addVariant} className="bg-blue-600 text-white px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2"><Plus size={18}/> Dodaj</button>
            </div>

            <div className="space-y-2">
               <h3 className="text-xs font-bold text-slate-500 uppercase">Twoje Strategie</h3>
               {variants.map(v => (
                 <div key={v.id} className={`flex items-center justify-between p-4 rounded-xl border ${v.id === activeVariantId ? 'bg-white border-blue-300 shadow-md ring-1 ring-blue-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-lg ${v.id === activeVariantId ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}><Layers size={20}/></div>
                       <div>
                          <input type="text" value={v.name} onChange={e => onUpdateVariants(variants.map(varItem => varItem.id === v.id ? {...varItem, name: e.target.value} : varItem))} className={`bg-transparent font-bold text-slate-800 focus:outline-none ${v.id === activeVariantId ? 'text-blue-700' : ''}`} />
                          <p className="text-[10px] text-slate-400">Strategia aktywna w panelu</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onVariantChange(v.id)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${v.id === activeVariantId ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                          {v.id === activeVariantId ? 'Aktualna' : 'Przełącz'}
                       </button>
                       {variants.length > 1 && (
                         <button onClick={() => deleteVariant(v.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                       )}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {(activeTab === "rooms" || activeTab === "seasons" || activeTab === "channels") && (
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800 text-xs font-medium mb-6 flex items-center gap-2">
            <AlertCircle size={14}/> Edytujesz ustawienia dla wariantu: <strong>{variants.find(v => v.id === activeVariantId)?.name}</strong>
          </div>
        )}

        {activeTab === "rooms" && (
           <div className="space-y-4">
              {rooms.map(room => (
                 <div key={room.id} className="p-4 border rounded-lg bg-slate-50 grid grid-cols-4 gap-4">
                    <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-400 uppercase">Nazwa</label><input type="text" value={room.name} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, name: e.target.value} : r))} className={inputClass} /></div>
                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase">Cena Peak</label><input type="number" value={room.basePricePeak} onChange={e => setRooms(rooms.map(r => r.id === room.id ? {...r, basePricePeak: Number(e.target.value)} : r))} className={inputClass} /></div>
                    <div className="flex items-end"><button onClick={() => setRooms(rooms.filter(r => r.id !== room.id))} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button></div>
                 </div>
              ))}
              <button onClick={() => setRooms([...rooms, { id: "r" + Date.now(), name: "Nowy Pokój", basePricePeak: 200, maxOccupancy: 2, tid: "" }])} className="text-blue-600 text-sm font-bold flex items-center gap-1"><Plus size={16}/> Dodaj Pokój</button>
           </div>
        )}

        {activeTab === "seasons" && (
          <div className="space-y-4">
             {seasons.map(s => (
                <div key={s.id} className="p-4 border rounded-lg bg-white shadow-sm flex justify-between items-center">
                   <div className="flex-1 grid grid-cols-3 gap-4">
                      <input type="text" value={s.name} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, name: e.target.value} : si))} className={inputClass} />
                      <div className="flex gap-2"><input type="date" value={s.startDate} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, startDate: e.target.value} : si))} className={inputClass} /><input type="date" value={s.endDate} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, endDate: e.target.value} : si))} className={inputClass} /></div>
                      <input type="number" step="0.05" value={s.multiplier} onChange={e => setSeasons(seasons.map(si => si.id === s.id ? {...si, multiplier: Number(e.target.value)} : si))} className={inputClass} />
                   </div>
                   <button onClick={() => setSeasons(seasons.filter(si => si.id !== s.id))} className="ml-4 text-red-400"><Trash2 size={18}/></button>
                </div>
             ))}
             <button onClick={() => setSeasons([...seasons, { id: "s" + Date.now(), name: "Nowy Sezon", startDate: "2025-01-01", endDate: "2025-01-02", multiplier: 1.0 }])} className="text-blue-600 text-sm font-bold flex items-center gap-1"><Plus size={16}/> Dodaj Sezon</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
