
import React, { useMemo, useState } from "react";
import { Channel, GlobalSettings, RoomType, Season } from "../types";
import { generatePricingGrid, calculateDirectPrice, calculateChannelPrice } from "../utils/pricingEngine";
import { TrendingUp, Users, StickyNote, ChevronDown, ChevronRight, GripVertical, Columns, RefreshCw, Loader2, AlertCircle, CloudDownload, Lock, TableProperties, ChevronUp, Home, Filter, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchHotresOccupancy } from "../utils/hotresApi";

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
}

type ColumnVisibility = {
  mobile: boolean;
  genius: boolean;
  seasonal: boolean;
  firstMinute: boolean;
  lastMinute: boolean;
  commission: boolean;
  pif: boolean;
};

const Dashboard: React.FC<DashboardProps> = ({
  rooms,
  seasons,
  channels,
  settings,
  propertyOid,
  selectedRoomId,
  notes,
  onNotesChange,
  onRoomUpdate,
  onOccupancyUpdate,
  onReorderRooms,
  onSyncAllOccupancy,
  isReadOnly = false,
  activeVariantName = "Standard"
}) => {
  const [occupancyFilter, setOccupancyFilter] = useState<"MAX" | number>("MAX");
  const [activeView, setActiveView] = useState<"ALL" | "SUMMARY" | string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [capacityFilter, setCapacityFilter] = useState<string>("ALL");
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [collapsedRoomIds, setCollapsedRoomIds] = useState<Set<string>>(new Set());
  const [occupancyLoading, setOccupancyLoading] = useState<Set<string>>(new Set());
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    mobile: true,
    genius: true,
    seasonal: false,
    firstMinute: false,
    lastMinute: false,
    commission: true,
    pif: false,
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  const getRoomType = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes("domek")) return "Domek";
      if (lower.includes("apartament")) return "Apartament";
      if (lower.includes("studio")) return "Studio";
      if (lower.includes("pokój")) return "Pokój";
      return "Inne";
  };

  const pricingGrid = useMemo(() => {
    let activeRooms = selectedRoomId ? rooms.filter(r => r.id === selectedRoomId) : rooms;
    if (typeFilter !== "ALL") activeRooms = activeRooms.filter(r => getRoomType(r.name) === typeFilter);
    if (capacityFilter !== "ALL") activeRooms = activeRooms.filter(r => r.maxOccupancy === Number(capacityFilter));
    return generatePricingGrid(activeRooms, seasons, channels, settings, occupancyFilter, {});
  }, [rooms, seasons, channels, settings, occupancyFilter, selectedRoomId, typeFilter, capacityFilter]);

  const roomGroups = useMemo(() => {
     let activeRooms = selectedRoomId ? rooms.filter(r => r.id === selectedRoomId) : rooms;
     if (typeFilter !== "ALL") activeRooms = activeRooms.filter(r => getRoomType(r.name) === typeFilter);
     if (capacityFilter !== "ALL") activeRooms = activeRooms.filter(r => r.maxOccupancy === Number(capacityFilter));
     return activeRooms.map(room => ({ room, rows: pricingGrid.filter(r => r.roomId === room.id) }));
  }, [rooms, pricingGrid, selectedRoomId, typeFilter, capacityFilter]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Panel Cenowy
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 text-xs font-bold uppercase tracking-tight">
               <Layers size={12} />
               Strategia: {activeVariantName}
            </span>
          </h2>
          <p className="text-sm text-slate-500">Przeglądasz aktywny wariant cenowy dla tego obiektu.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={onSyncAllOccupancy} disabled={isGlobalSyncing || isReadOnly} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm font-medium">
             {isGlobalSyncing ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
             Synchronizuj
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto">
             <button onClick={() => setActiveView("ALL")} className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeView === "ALL" ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Ceny Direct</button>
             <button onClick={() => setActiveView("SUMMARY")} className={`px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeView === "SUMMARY" ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}><TableProperties size={14}/> Podsumowanie</button>
             {channels.map(c => (
                <button key={c.id} onClick={() => setActiveView(c.id)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeView === c.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}><span className="w-2 h-2 rounded-full" style={{backgroundColor: c.color}}></span>{c.name}</button>
             ))}
          </div>

          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-3 w-8"></th>
                  <th className="px-3 py-3 text-left text-slate-500 uppercase text-xs">Pokój</th>
                  <th className="px-3 py-3 text-left text-slate-500 uppercase text-xs">Sezon</th>
                  <th className="px-3 py-3 text-center text-slate-500 uppercase text-xs w-20">Os.</th>
                  <th className="px-3 py-3 text-right text-slate-500 uppercase text-xs bg-blue-50/50">Direct</th>
                  {activeView !== "ALL" && <th className="px-3 py-3 text-right text-slate-500 uppercase text-xs">OTA/Netto</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roomGroups.map(({ room, rows }) => (
                  <React.Fragment key={room.id}>
                    <tr className="bg-slate-50 font-bold"><td colSpan={10} className="px-4 py-2 text-slate-700">{room.name}</td></tr>
                    {rows.map(row => (
                      <tr key={row.seasonId} className="hover:bg-slate-50/50">
                        <td></td>
                        <td className="px-3 py-3 opacity-50">{room.name}</td>
                        <td className="px-3 py-3">{row.seasonName}</td>
                        <td className="px-3 py-3 text-center">{row.occupancy} os.</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-700">{row.directPrice} zł</td>
                        {activeView !== "ALL" && activeView !== "SUMMARY" && (
                          <td className="px-3 py-3 text-right font-medium">{row.channelCalculations[activeView]?.listPrice} / {row.channelCalculations[activeView]?.estimatedNet} zł</td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
