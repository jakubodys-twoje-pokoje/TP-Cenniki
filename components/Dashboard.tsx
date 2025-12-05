
import React, { useMemo, useState } from "react";
import { Channel, GlobalSettings, RoomType, Season } from "../types";
import { generatePricingGrid } from "../utils/pricingEngine";
import { AlertCircle, CheckCircle, TrendingUp, Users, StickyNote, ChevronDown, GripVertical, Columns, EyeOff } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  selectedRoomId?: string | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onRoomUpdate: (roomId: string, updates: Partial<RoomType>) => void;
  onReorderRooms: (rooms: RoomType[]) => void;
}

type ColumnVisibility = {
  mobile: boolean;
  genius: boolean;
  seasonal: boolean;
  firstMinute: boolean;
  lastMinute: boolean;
  commission: boolean;
};

const Dashboard: React.FC<DashboardProps> = ({
  rooms,
  seasons,
  channels,
  settings,
  selectedRoomId,
  notes,
  onNotesChange,
  onRoomUpdate,
  onReorderRooms,
}) => {
  const [occupancyFilter, setOccupancyFilter] = useState<"MAX" | number>("MAX");
  const [occupancyOverrides, setOccupancyOverrides] = useState<Record<string, number>>({});
  const [activeView, setActiveView] = useState<"ALL" | string>("ALL"); // 'ALL' for Direct or Channel ID
  
  // Drag and drop state for sorting ROOMS
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    mobile: true,
    genius: true,
    seasonal: false,
    firstMinute: false,
    lastMinute: false,
    commission: false,
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  // Generate the flat grid first
  const pricingGrid = useMemo(() => {
    // Filter rooms based on selection
    const activeRooms = selectedRoomId 
      ? rooms.filter(r => r.id === selectedRoomId)
      : rooms;

    return generatePricingGrid(activeRooms, seasons, channels, settings, occupancyFilter, occupancyOverrides);
  }, [rooms, seasons, channels, settings, occupancyFilter, selectedRoomId, occupancyOverrides]);

  // Transform flat grid into a nested map: RoomID -> SeasonID -> RowData
  const matrixData = useMemo(() => {
    const map = new Map<string, Map<string, any>>();
    pricingGrid.forEach(row => {
      if (!map.has(row.roomId)) {
        map.set(row.roomId, new Map());
      }
      map.get(row.roomId)!.set(row.seasonId, row);
    });
    return map;
  }, [pricingGrid]);

  // Transform data for charts
  const chartData = useMemo(() => {
    return seasons.map(s => {
      const seasonRows = pricingGrid.filter(r => r.seasonName === s.name);
      const avgDirect = seasonRows.length > 0 
        ? seasonRows.reduce((acc, r) => acc + r.directPrice, 0) / seasonRows.length
        : 0;
      return {
        name: s.name,
        avgDirect: Math.round(avgDirect),
      };
    });
  }, [seasons, pricingGrid]);

  const handleGlobalFilterChange = (val: "MAX" | number) => {
    setOccupancyFilter(val);
    setOccupancyOverrides({}); // Reset specific overrides when global filter is used
  };

  const handleOverrideChange = (roomId: string, seasonId: string, val: number) => {
    const key = `${roomId}-${seasonId}`;
    setOccupancyOverrides(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleBasePriceChange = (roomId: string, seasonId: string, newValue: number) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const currentMap = room.seasonBasePrices || {};
    const updatedMap = { ...currentMap, [seasonId]: newValue };
    
    onRoomUpdate(roomId, { seasonBasePrices: updatedMap });
  };
  
  const handleDragStart = (e: React.DragEvent, roomId: string) => {
    setDraggedRoomId(roomId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, targetRoomId: string) => {
    e.preventDefault();
    if (!draggedRoomId || draggedRoomId === targetRoomId) return;

    const sourceIndex = rooms.findIndex(r => r.id === draggedRoomId);
    const targetIndex = rooms.findIndex(r => r.id === targetRoomId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newRooms = [...rooms];
    const [removed] = newRooms.splice(sourceIndex, 1);
    newRooms.splice(targetIndex, 0, removed);
    
    onReorderRooms(newRooms);
    setDraggedRoomId(null);
  };

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const occupancyOptions = [1, 2, 3, 4, 5, 6, 7];
  
  const selectedRoomName = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find(r => r.id === selectedRoomId)?.name;
  }, [rooms, selectedRoomId]);

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Panel Cenowy
            {selectedRoomName && (
               <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                 {selectedRoomName}
               </span>
            )}
          </h2>
          <p className="text-sm text-slate-500">Analiza cen bezpośrednich i narzutów kanałów OTA</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Column Visibility Toggle */}
          <div className="relative">
             <button 
                onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium"
             >
                <Columns size={16} />
                Widok
                <ChevronDown size={14} />
             </button>
             
             {isColumnMenuOpen && (
               <>
                 <div className="fixed inset-0 z-10" onClick={() => setIsColumnMenuOpen(false)}></div>
                 <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 z-20 p-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Widoczność Kolumn (OTA)</div>
                    {[
                      { k: 'mobile', label: 'Mobile' },
                      { k: 'genius', label: 'Genius' },
                      { k: 'seasonal', label: 'Sezonowa' },
                      { k: 'firstMinute', label: 'First Minute' },
                      { k: 'lastMinute', label: 'Last Minute' },
                      { k: 'commission', label: 'Prowizja (Wartość)' },
                    ].map((item) => (
                       <label key={item.k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={columnVisibility[item.k as keyof ColumnVisibility]}
                            onChange={() => toggleColumn(item.k as keyof ColumnVisibility)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{item.label}</span>
                       </label>
                    ))}
                 </div>
               </>
             )}
          </div>

          <div className="h-8 w-px bg-slate-200"></div>

          <div className="flex items-center gap-3 overflow-x-auto max-w-full pb-1">
             <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {occupancyOptions.map(num => (
                  <button 
                    key={num}
                    onClick={() => handleGlobalFilterChange(num)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${occupancyFilter === num && Object.keys(occupancyOverrides).length === 0 ? 'bg-white shadow text-blue-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {num} Os.
                  </button>
                ))}
                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                <button 
                  onClick={() => handleGlobalFilterChange("MAX")}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${occupancyFilter === "MAX" && Object.keys(occupancyOverrides).length === 0 ? 'bg-white shadow text-blue-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Maks.
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
        
        {/* The Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
          {/* Grid Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
             <button
                onClick={() => setActiveView("ALL")}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeView === "ALL" ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Ceny Bezpośrednie (Baza)
              </button>
              {channels.map(c => (
                 <button
                 key={c.id}
                 onClick={() => setActiveView(c.id)}
                 className={`px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeView === c.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                 <span className="w-2 h-2 rounded-full" style={{backgroundColor: c.color}}></span>
                 {c.name}
               </button>
              ))}
          </div>

          {/* Matrix Table */}
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-1 w-6 bg-slate-50 sticky left-0 z-20"></th> {/* Drag Handle */}
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-40 bg-slate-50 sticky left-6 z-20 shadow-r">
                    Typ Pokoju
                  </th>
                  {/* Generate Columns per Season */}
                  {seasons.map(season => (
                    <th key={season.id} className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[180px]">
                      <div className="flex flex-col gap-1 items-center">
                        <span>{season.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {season.startDate} - {season.endDate} (x{season.multiplier})
                        </span>
                        
                        {/* If in detailed channel view, show Sub-Headers for enabled columns */}
                        {activeView !== "ALL" && (
                           <div className="flex items-center justify-center gap-3 mt-1 pt-1 border-t border-slate-200 w-full text-[9px] text-slate-400">
                              <span>Direct</span>
                              {columnVisibility.mobile && <span className="text-blue-600">Mob</span>}
                              {columnVisibility.genius && <span className="text-purple-600">Gen</span>}
                              {columnVisibility.seasonal && <span className="text-green-600">Sez</span>}
                              {columnVisibility.firstMinute && <span className="text-amber-600">1st</span>}
                              {columnVisibility.lastMinute && <span className="text-red-600">Last</span>}
                              {columnVisibility.commission && <span className="text-slate-600">Comm</span>}
                              <span>OTA</span>
                           </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {rooms.length > 0 ? (
                  rooms.map((room) => {
                    const activeRoomsFilter = selectedRoomId ? selectedRoomId === room.id : true;
                    if (!activeRoomsFilter) return null;

                    return (
                      <tr 
                        key={room.id}
                        className={`hover:bg-slate-50 transition-colors group ${draggedRoomId === room.id ? 'opacity-40' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, room.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, room.id)}
                      >
                         <td className="px-1 text-center bg-white sticky left-0 z-10 group-hover:bg-slate-50">
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                               <GripVertical size={16} />
                            </div>
                         </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 bg-white sticky left-6 z-10 shadow-r group-hover:bg-slate-50">
                          <div className="truncate" title={room.name}>{room.name}</div>
                          <div className="text-xs text-slate-400 font-normal">Max: {room.maxOccupancy} os.</div>
                        </td>

                        {/* Iterate Seasons (Columns) */}
                        {seasons.map(season => {
                           const rowData = matrixData.get(room.id)?.get(season.id);
                           if (!rowData) return <td key={season.id}>-</td>;

                           const channelData = activeView !== "ALL" ? rowData.channelCalculations[activeView] : null;

                           return (
                             <td key={season.id} className="px-2 py-2 border-l border-slate-100 align-top">
                                <div className="flex flex-col gap-2">
                                   
                                   {/* Row 1: Controls (Base Price & Occupancy) */}
                                   <div className="flex items-center justify-between gap-1">
                                      <div title="Cena Bazowa">
                                        <input 
                                          type="number" 
                                          value={rowData.basePrice} 
                                          onChange={(e) => handleBasePriceChange(room.id, season.id, Number(e.target.value))}
                                          className="w-16 px-1 py-0.5 text-xs text-center border border-slate-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-600 bg-slate-50"
                                          placeholder="Baza"
                                        />
                                      </div>
                                      
                                      <div className="relative inline-block group z-0">
                                        <div className="flex items-center justify-between gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 shadow-sm border border-slate-200 hover:border-blue-400 transition-all cursor-pointer w-[4.5rem]">
                                          <span className="flex items-center gap-0.5">
                                            {rowData.occupancy}<Users size={10} className="text-slate-400"/>
                                          </span>
                                          <ChevronDown size={10} className="text-slate-300"/>
                                        </div>
                                        <select
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-slate-900"
                                          value={rowData.occupancy}
                                          onChange={(e) => handleOverrideChange(room.id, season.id, Number(e.target.value))}
                                        >
                                          {Array.from({ length: room.maxOccupancy }, (_, i) => i + 1).map((num) => (
                                            <option key={num} value={num}>
                                              {num} os.
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                   </div>

                                   {/* Row 2: Price Display */}
                                   <div className="bg-slate-50/50 rounded p-1.5 flex flex-col gap-1">
                                      
                                      {/* Standard View */}
                                      {activeView === "ALL" && (
                                         <>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400 uppercase text-[10px]">Direct</span>
                                                <span className="font-bold text-blue-700">{rowData.directPrice} zł</span>
                                            </div>
                                         </>
                                      )}

                                      {/* Detailed Channel View */}
                                      {activeView !== "ALL" && channelData && (
                                         <div className="space-y-1">
                                            {/* Header Row in Cell */}
                                            <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-1 mb-1">
                                                <span className="text-slate-400 text-[10px]">Start (Direct)</span>
                                                <span className="font-bold text-blue-700">{rowData.directPrice} zł</span>
                                            </div>
                                            
                                            {/* Discount Columns */}
                                            {columnVisibility.mobile && channelData.discountBreakdown.mobile > 0 && (
                                               <div className="flex justify-between items-center text-[10px] text-blue-600">
                                                  <span>Mobile</span>
                                                  <span>-{channelData.discountBreakdown.mobile} zł</span>
                                               </div>
                                            )}
                                            {columnVisibility.genius && channelData.discountBreakdown.genius > 0 && (
                                               <div className="flex justify-between items-center text-[10px] text-purple-600">
                                                  <span>Genius</span>
                                                  <span>-{channelData.discountBreakdown.genius} zł</span>
                                               </div>
                                            )}
                                            {columnVisibility.seasonal && channelData.discountBreakdown.seasonal > 0 && (
                                               <div className="flex justify-between items-center text-[10px] text-green-600">
                                                  <span>Sezon</span>
                                                  <span>-{channelData.discountBreakdown.seasonal} zł</span>
                                               </div>
                                            )}
                                            {columnVisibility.firstMinute && channelData.discountBreakdown.firstMinute > 0 && (
                                               <div className="flex justify-between items-center text-[10px] text-amber-600">
                                                  <span>1st Min</span>
                                                  <span>-{channelData.discountBreakdown.firstMinute} zł</span>
                                               </div>
                                            )}
                                            {columnVisibility.lastMinute && channelData.discountBreakdown.lastMinute > 0 && (
                                               <div className="flex justify-between items-center text-[10px] text-red-600">
                                                  <span>Last Min</span>
                                                  <span>-{channelData.discountBreakdown.lastMinute} zł</span>
                                               </div>
                                            )}
                                            
                                            {/* Final Calculation */}
                                            <div className="border-t border-slate-200 pt-1 mt-1">
                                                <div className="flex justify-between items-center text-xs">
                                                   <span className="text-slate-500 uppercase text-[10px] font-semibold">OTA (Lista)</span>
                                                   <span className="font-bold text-orange-700">{channelData.listPrice} zł</span>
                                                </div>
                                                
                                                {columnVisibility.commission && (
                                                   <div className="flex justify-between items-center text-[10px] text-slate-400">
                                                      <span>Prowizja</span>
                                                      <span>-{channelData.commission} zł</span>
                                                   </div>
                                                )}

                                                <div className="flex justify-between items-center text-xs mt-1">
                                                   <span className="text-slate-500 uppercase text-[10px] font-semibold">Netto</span>
                                                   <span className={`font-bold ${channelData.estimatedNet < rowData.directPrice ? 'text-red-600' : 'text-green-600'}`}>
                                                      {Math.round(channelData.estimatedNet)} zł
                                                   </span>
                                                </div>
                                            </div>

                                            {/* Profit Indicator */}
                                            {!channelData.isProfitable && (
                                               <div className="text-[10px] text-red-500 bg-red-50 text-center rounded py-0.5 font-medium mt-1">
                                                  Strata
                                               </div>
                                            )}
                                         </div>
                                      )}
                                   </div>
                                </div>
                             </td>
                           );
                        })}
                      </tr>
                    );
                  })
                ) : (
                   <tr>
                     <td colSpan={seasons.length + 2} className="px-4 py-8 text-center text-slate-500">
                       Brak danych do wyświetlenia. Dodaj pokoje lub sezony.
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts & Notes Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mini Summary Card */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600"/> 
              Średnie Stawki
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                  <YAxis tick={{fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    itemStyle={{color: '#1e293b', fontWeight: 600}}
                    cursor={{fill: '#f1f5f9'}}
                    labelFormatter={(label) => `Sezon: ${label}`}
                  />
                  <Bar dataKey="avgDirect" name="Śr. Cena Bezp." fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

           {/* Notes Section */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col">
             <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
               <StickyNote size={20} className="text-amber-500"/>
               Notatki
             </h3>
             <textarea
               className="flex-1 w-full min-h-[120px] p-3 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700 bg-amber-50/50 resize-none placeholder:text-slate-400"
               placeholder="Wpisz ważne informacje dla tego obiektu..."
               value={notes}
               onChange={(e) => onNotesChange(e.target.value)}
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;