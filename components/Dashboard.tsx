
import React, { useMemo, useState } from "react";
import { Channel, GlobalSettings, RoomType, Season } from "../types";
import { generatePricingGrid } from "../utils/pricingEngine";
import { TrendingUp, Users, StickyNote, ChevronDown, ChevronRight, GripVertical, Columns, RefreshCw, Loader2, AlertCircle, CloudDownload, Lock, TableProperties, ChevronUp, Home, Filter, Layers, Calculator, Eye, EyeOff } from "lucide-react";

interface DashboardProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  propertyOid: string;
  selectedRoomId?: string | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onRoomUpdate: (roomId: string, updates: Partial<RoomType>) => void;
  onOccupancyUpdate: (roomId: string, seasonId: string, rate: number) => void;
  onReorderRooms: (rooms: RoomType[]) => void;
  onSyncAllOccupancy: () => void;
  isReadOnly?: boolean;
  activeVariantName?: string;
  onOpenCalculator?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  rooms, seasons, channels, settings, propertyOid, selectedRoomId, notes, onNotesChange, 
  onRoomUpdate, onOccupancyUpdate, onReorderRooms, onSyncAllOccupancy, isReadOnly, activeVariantName, onOpenCalculator
}) => {
  const [occupancyFilter, setOccupancyFilter] = useState<"MAX" | number>("MAX");
  const [activeView, setActiveView] = useState<"ALL" | "SUMMARY" | string>("ALL");
  const [collapsedRoomIds, setCollapsedRoomIds] = useState<Set<string>>(new Set());
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({ mobile: true, genius: true, seasonal: true, other: true, commission: true });

  const pricingGrid = useMemo(() => generatePricingGrid(rooms, seasons, channels, settings, occupancyFilter), [rooms, seasons, channels, settings, occupancyFilter]);
  const roomGroups = useMemo(() => rooms.map(room => ({ room, rows: pricingGrid.filter(r => r.roomId === room.id) })), [rooms, pricingGrid]);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-2">
      {/* Header with Variant Badge and Tools */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Panel Cenowy</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="flex items-center gap-1.5 px-3 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-[10px] font-bold uppercase tracking-tight">
                  <Layers size={10} /> Strategia: {activeVariantName}
               </span>
               {isReadOnly && <span className="text-[10px] text-slate-400 italic">Podgląd klienta</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {!isReadOnly && (
             <>
               <button onClick={onOpenCalculator} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors">
                 <Calculator size={16} /> Kalkulator
               </button>
               <button onClick={onSyncAllOccupancy} className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50">
                 <RefreshCw size={16} /> Odśwież Obłożenie
               </button>
             </>
           )}
           <div className="relative">
             <button onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50">
               <Columns size={16} /> Kolumny
             </button>
             {isColumnMenuOpen && (
               <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-xl z-50 p-3 space-y-2">
                 {Object.entries(columnVisibility).map(([key, val]) => (
                   <label key={key} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                     <input type="checkbox" checked={val} onChange={() => setColumnVisibility(prev => ({ ...prev, [key]: !val }))} className="rounded text-blue-600" />
                     {key.toUpperCase()}
                   </label>
                 ))}
               </div>
             )}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="xl:col-span-3 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* View Toggles */}
          <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
             <button onClick={() => setActiveView("ALL")} className={`px-5 py-3 text-sm font-bold whitespace-nowrap transition-colors ${activeView === "ALL" ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-slate-500 hover:text-slate-800'}`}>Ceny Direct</button>
             {channels.map(c => (
                <button key={c.id} onClick={() => setActiveView(c.id)} className={`px-5 py-3 text-sm font-bold whitespace-nowrap flex items-center gap-2 transition-colors ${activeView === c.id ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-slate-500 hover:text-slate-800'}`}>
                   <span className="w-2 h-2 rounded-full" style={{backgroundColor: c.color}}></span>{c.name}
                </button>
             ))}
          </div>

          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Obiekt / Sezon</th>
                  <th className="px-4 py-3 text-center">Os.</th>
                  <th className="px-4 py-3 text-right bg-blue-50/50 text-blue-700">Direct</th>
                  {activeView !== "ALL" && (
                    <>
                      <th className="px-4 py-3 text-right text-orange-600 bg-orange-50/30">Cena OTA</th>
                      {columnVisibility.mobile && <th className="px-4 py-3 text-right text-blue-500">Mobile</th>}
                      {columnVisibility.genius && <th className="px-4 py-3 text-right text-purple-500">Genius</th>}
                      {columnVisibility.commission && <th className="px-4 py-3 text-right text-slate-400">Prow.</th>}
                      <th className="px-4 py-3 text-right text-emerald-600 font-black">Netto</th>
                    </>
                  )}
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {roomGroups.map(({ room, rows }) => {
                  const isCollapsed = collapsedRoomIds.has(room.id);
                  return (
                    <React.Fragment key={room.id}>
                      <tr className="bg-slate-100/50 group cursor-pointer" onClick={() => setCollapsedRoomIds(prev => { const n = new Set(prev); isCollapsed ? n.delete(room.id) : n.add(room.id); return n; })}>
                         <td colSpan={10} className="px-4 py-2 font-black text-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm"><Home size={16} className="text-slate-400" /> {room.name}</div>
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                         </td>
                      </tr>
                      {!isCollapsed && rows.map(row => (
                        <tr key={row.seasonId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                             <div className="font-medium text-slate-900">{row.seasonName}</div>
                             <div className="text-[10px] text-slate-400">Min. nocy: {row.minNights}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-500">{row.occupancy} os.</td>
                          <td className="px-4 py-3 text-right font-black text-blue-600 text-base bg-blue-50/20">{row.directPrice} zł</td>
                          {activeView !== "ALL" && (
                            <>
                               <td className="px-4 py-3 text-right font-black text-orange-600 text-base bg-orange-50/10">{row.channelCalculations[activeView]?.listPrice || '-'} zł</td>
                               {columnVisibility.mobile && <td className="px-4 py-3 text-right text-blue-500 text-xs">-{row.channelCalculations[activeView]?.discountBreakdown.mobile}</td>}
                               {columnVisibility.genius && <td className="px-4 py-3 text-right text-purple-500 text-xs">-{row.channelCalculations[activeView]?.discountBreakdown.genius}</td>}
                               {columnVisibility.commission && <td className="px-4 py-3 text-right text-slate-400 text-xs">-{row.channelCalculations[activeView]?.commission}</td>}
                               <td className="px-4 py-3 text-right font-black text-emerald-600 text-base bg-emerald-50/20">{row.channelCalculations[activeView]?.estimatedNet || '-'} zł</td>
                            </>
                          )}
                          <td className="px-4 py-3 text-center">
                             {row.occupancyRate !== undefined && (
                               <div className={`w-2 h-2 rounded-full mx-auto ${row.occupancyRate > 80 ? 'bg-red-500' : row.occupancyRate > 50 ? 'bg-orange-400' : 'bg-green-500'}`} title={`Obłożenie: ${row.occupancyRate}%`}></div>
                             )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes Sidebar */}
        <div className="xl:col-span-1 space-y-6">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><StickyNote size={18} className="text-amber-500" /> Notatki Strategii</h3>
              <textarea 
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                disabled={isReadOnly}
                placeholder="Wpisz uwagi do strategii cenowej..."
                className="flex-1 w-full p-4 text-sm bg-amber-50/30 border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-300 resize-none outline-none min-h-[300px]"
              />
              <p className="mt-3 text-[10px] text-slate-400 italic">Automatycznie zapisywane w ramach wariantu.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
