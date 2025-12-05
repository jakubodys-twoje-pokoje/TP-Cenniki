
import React, { useMemo, useState } from "react";
import { Channel, GlobalSettings, RoomType, Season } from "../types";
import { generatePricingGrid } from "../utils/pricingEngine";
import { TrendingUp, Users, StickyNote, ChevronDown, GripVertical, Columns } from "lucide-react";
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
    commission: true,
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

  // Group grid by Room for rendering (to allow Drag & Drop of entire room blocks)
  const roomGroups = useMemo(() => {
     // We map over 'rooms' to preserve the sort order
     const activeRooms = selectedRoomId 
      ? rooms.filter(r => r.id === selectedRoomId)
      : rooms;

     return activeRooms.map(room => ({
        room,
        rows: pricingGrid.filter(r => r.roomId === room.id)
     }));
  }, [rooms, pricingGrid, selectedRoomId]);

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
          {/* Column Visibility Toggle - Only visible when a channel is selected */}
          {activeView !== "ALL" && (
            <div className="relative">
              <button 
                  onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                  <Columns size={16} />
                  Widok
                  <ChevronDown size={14} />
              </button>
              
              {isColumnMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsColumnMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 z-20 p-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Pokaż kolumny</div>
                      {[
                        { k: 'mobile', label: 'Zniżka Mobile' },
                        { k: 'genius', label: 'Zniżka Genius' },
                        { k: 'seasonal', label: 'Zniżka Sezonowa' },
                        { k: 'firstMinute', label: 'First Minute' },
                        { k: 'lastMinute', label: 'Last Minute' },
                        { k: 'commission', label: 'Prowizja (Kwota)' },
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
          )}

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

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
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
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

          {/* List Table */}
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-2 py-3 w-8 bg-slate-50"></th>
                  <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Pokój</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Sezon</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-500 uppercase tracking-wider w-24">Baza (PLN)</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-500 uppercase tracking-wider w-20">Os.</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-blue-50/50 text-blue-700">Direct</th>
                  
                  {activeView !== "ALL" && (
                     <>
                        {columnVisibility.mobile && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-blue-600">Mobile</th>}
                        {columnVisibility.genius && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-purple-600">Genius</th>}
                        {columnVisibility.seasonal && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-green-600">Sezon</th>}
                        {columnVisibility.firstMinute && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-amber-600">1st Min</th>}
                        {columnVisibility.lastMinute && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-red-600">Last Min</th>}
                        
                        <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-orange-50/50 text-orange-700">W OTA</th>
                        
                        {columnVisibility.commission && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Prowizja</th>}
                        
                        <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-green-50/50 text-green-800">Netto</th>
                     </>
                  )}
                  {activeView === "ALL" && (
                     // Spacer for simple view
                     <th className="px-3 py-3 text-left font-normal text-slate-400"></th>
                  )}
                </tr>
              </thead>
              
              {/* Render Room Groups */}
              {roomGroups.length > 0 ? (
                roomGroups.map(({ room, rows }) => (
                  <tbody 
                     key={room.id}
                     draggable
                     onDragStart={(e) => handleDragStart(e, room.id)}
                     onDragOver={handleDragOver}
                     onDrop={(e) => handleDrop(e, room.id)}
                     className={`group/body border-b border-slate-200 hover:bg-slate-50/50 transition-colors ${draggedRoomId === room.id ? 'opacity-30' : ''}`}
                  >
                     {rows.map((row, index) => {
                        const channelData = activeView !== "ALL" ? row.channelCalculations[activeView] : null;
                        
                        return (
                           <tr key={row.seasonId} className="hover:bg-slate-100/50">
                              {/* Drag Handle - Only on first row of group */}
                              <td className="px-2 py-3 text-center align-middle">
                                 {index === 0 && (
                                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 flex justify-center">
                                       <GripVertical size={16} />
                                    </div>
                                 )}
                              </td>

                              {/* Room Name - Only on first row of group */}
                              <td className="px-3 py-3 align-middle">
                                 {index === 0 && (
                                    <div className="font-medium text-slate-900">{room.name}</div>
                                 )}
                              </td>

                              <td className="px-3 py-3 align-middle text-slate-600">
                                 <span className="text-xs font-semibold">{row.seasonName}</span>
                              </td>

                              <td className="px-3 py-3 align-middle text-center">
                                 <input 
                                    type="number" 
                                    value={row.basePrice} 
                                    onChange={(e) => handleBasePriceChange(room.id, row.seasonId, Number(e.target.value))}
                                    className="w-20 px-2 py-1 text-sm text-center border border-slate-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white shadow-sm"
                                 />
                              </td>

                              <td className="px-3 py-3 align-middle text-center">
                                 <div className="relative inline-block w-16 group/select">
                                    <div className="flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded text-sm text-slate-700 shadow-sm hover:border-blue-400 transition-colors cursor-pointer">
                                       <span>{row.occupancy}</span>
                                       <ChevronDown size={12} className="text-slate-300" />
                                    </div>
                                    <select
                                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                       value={row.occupancy}
                                       onChange={(e) => handleOverrideChange(room.id, row.seasonId, Number(e.target.value))}
                                    >
                                       {Array.from({ length: room.maxOccupancy }, (_, i) => i + 1).map((num) => (
                                          <option key={num} value={num}>{num} os.</option>
                                       ))}
                                    </select>
                                 </div>
                              </td>

                              <td className="px-3 py-3 align-middle text-right font-bold text-blue-700 bg-blue-50/30 border-l border-blue-100">
                                 {row.directPrice} zł
                              </td>

                              {/* Channel Columns */}
                              {activeView !== "ALL" && channelData && (
                                 <>
                                    {columnVisibility.mobile && (
                                       <td className="px-3 py-3 align-middle text-right text-blue-600 text-xs">
                                          {channelData.discountBreakdown.mobile > 0 ? `-${channelData.discountBreakdown.mobile}` : '-'}
                                       </td>
                                    )}
                                    {columnVisibility.genius && (
                                       <td className="px-3 py-3 align-middle text-right text-purple-600 text-xs">
                                          {channelData.discountBreakdown.genius > 0 ? `-${channelData.discountBreakdown.genius}` : '-'}
                                       </td>
                                    )}
                                    {columnVisibility.seasonal && (
                                       <td className="px-3 py-3 align-middle text-right text-green-600 text-xs">
                                          {channelData.discountBreakdown.seasonal > 0 ? `-${channelData.discountBreakdown.seasonal}` : '-'}
                                       </td>
                                    )}
                                    {columnVisibility.firstMinute && (
                                       <td className="px-3 py-3 align-middle text-right text-amber-600 text-xs">
                                          {channelData.discountBreakdown.firstMinute > 0 ? `-${channelData.discountBreakdown.firstMinute}` : '-'}
                                       </td>
                                    )}
                                    {columnVisibility.lastMinute && (
                                       <td className="px-3 py-3 align-middle text-right text-red-600 text-xs">
                                          {channelData.discountBreakdown.lastMinute > 0 ? `-${channelData.discountBreakdown.lastMinute}` : '-'}
                                       </td>
                                    )}

                                    <td className="px-3 py-3 align-middle text-right font-bold text-orange-700 bg-orange-50/30 border-l border-orange-100">
                                       {channelData.listPrice} zł
                                    </td>

                                    {columnVisibility.commission && (
                                       <td className="px-3 py-3 align-middle text-right text-slate-500 text-xs">
                                          -{channelData.commission}
                                       </td>
                                    )}

                                    <td className="px-3 py-3 align-middle text-right border-l border-green-100 bg-green-50/30">
                                       <div className="flex flex-col items-end">
                                          <span className={`font-bold ${channelData.estimatedNet < row.directPrice ? 'text-red-600' : 'text-green-700'}`}>
                                             {channelData.estimatedNet} zł
                                          </span>
                                          {!channelData.isProfitable && (
                                             <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">STRATA</span>
                                          )}
                                       </div>
                                    </td>
                                 </>
                              )}
                              
                              {/* Spacer for ALL view */}
                              {activeView === "ALL" && <td className="px-3 py-3"></td>}
                           </tr>
                        );
                     })}
                  </tbody>
                ))
              ) : (
                <tbody>
                  <tr>
                     <td colSpan={15} className="px-4 py-8 text-center text-slate-500">
                       Brak danych.
                     </td>
                  </tr>
                </tbody>
              )}
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
