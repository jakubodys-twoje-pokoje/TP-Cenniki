
import React, { useMemo, useState } from "react";
import { Channel, GlobalSettings, RoomType, Season } from "../types";
import { generatePricingGrid, calculateDirectPrice, calculateChannelPrice } from "../utils/pricingEngine";
import { TrendingUp, Users, StickyNote, ChevronDown, ChevronRight, GripVertical, Columns, RefreshCw, Loader2, AlertCircle, CloudDownload, Lock, TableProperties, ChevronUp, Home, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
}

type ColumnVisibility = {
  mobile: boolean;
  genius: boolean;
  seasonal: boolean;
  firstMinute: boolean;
  lastMinute: boolean;
  commission: boolean;
  pif: boolean; // Pay In Full toggle
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
}) => {
  const [occupancyFilter, setOccupancyFilter] = useState<"MAX" | number>("MAX");
  const [activeView, setActiveView] = useState<"ALL" | "SUMMARY" | string>("ALL");
  
  // Dashboard Filters
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [capacityFilter, setCapacityFilter] = useState<string>("ALL");

  // Drag and drop state
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);

  // Expanded Rows State (Set of "roomId-seasonId") - for detail expansion within a row
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Collapsed Rooms State (Set of "roomId") - for hiding season rows of a room
  const [collapsedRoomIds, setCollapsedRoomIds] = useState<Set<string>>(new Set());

  // Loading state for occupancy fetching: "roomId-seasonId"
  const [occupancyLoading, setOccupancyLoading] = useState<Set<string>>(new Set());

  // Global sync loading
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    mobile: true,
    genius: true,
    seasonal: false,
    firstMinute: false,
    lastMinute: false,
    commission: true,
    pif: false, // Default hidden
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  // Determine Type helper
  const getRoomType = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes("domek")) return "Domek";
      if (lower.includes("apartament")) return "Apartament";
      if (lower.includes("studio")) return "Studio";
      if (lower.includes("pokój")) return "Pokój";
      return "Inne";
  };

  // Extract unique types and capacities for filters
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    rooms.forEach(r => types.add(getRoomType(r.name)));
    return Array.from(types).sort();
  }, [rooms]);

  const uniqueCapacities = useMemo(() => {
      const caps = new Set<number>();
      rooms.forEach(r => caps.add(r.maxOccupancy));
      return Array.from(caps).sort((a, b) => a - b);
  }, [rooms]);

  // Generate the flat grid based on GLOBAL filter AND Dashboard Filters
  const pricingGrid = useMemo(() => {
    let activeRooms = selectedRoomId 
      ? rooms.filter(r => r.id === selectedRoomId)
      : rooms;

    // Apply Dashboard Filters
    if (typeFilter !== "ALL") {
        activeRooms = activeRooms.filter(r => getRoomType(r.name) === typeFilter);
    }
    if (capacityFilter !== "ALL") {
        activeRooms = activeRooms.filter(r => r.maxOccupancy === Number(capacityFilter));
    }

    return generatePricingGrid(activeRooms, seasons, channels, settings, occupancyFilter, {});
  }, [rooms, seasons, channels, settings, occupancyFilter, selectedRoomId, typeFilter, capacityFilter]);

  // Group grid by Room
  const roomGroups = useMemo(() => {
     let activeRooms = selectedRoomId 
      ? rooms.filter(r => r.id === selectedRoomId)
      : rooms;

     // Apply same filtering to the groups
     if (typeFilter !== "ALL") {
        activeRooms = activeRooms.filter(r => getRoomType(r.name) === typeFilter);
     }
     if (capacityFilter !== "ALL") {
        activeRooms = activeRooms.filter(r => r.maxOccupancy === Number(capacityFilter));
     }

     return activeRooms.map(room => ({
        room,
        rows: pricingGrid.filter(r => r.roomId === room.id)
     }));
  }, [rooms, pricingGrid, selectedRoomId, typeFilter, capacityFilter]);

  // Charts data
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
  };

  const handleCommentChange = (roomId: string, seasonId: string, newValue: string) => {
    if (isReadOnly) return;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const currentComments = room.seasonComments || {};
    onRoomUpdate(roomId, { seasonComments: { ...currentComments, [seasonId]: newValue } });
  };
  
  const handleFetchOccupancy = async (roomId: string, seasonId: string) => {
    if (isReadOnly) return;
    const room = rooms.find(r => r.id === roomId);
    const season = seasons.find(s => s.id === seasonId);
    
    if (!room || !season || !propertyOid) {
       alert("Brak konfiguracji (OID lub TID) lub danych sezonu.");
       return;
    }

    if (!room.tid) {
      alert("Brak TID dla pokoju. Ustaw go w konfiguracji.");
      return;
    }

    const key = `${roomId}-${seasonId}`;
    setOccupancyLoading(prev => new Set(prev).add(key));

    try {
      const rate = await fetchHotresOccupancy(propertyOid, room.tid, season.startDate, season.endDate);
      onOccupancyUpdate(roomId, seasonId, rate);
    } catch (err: any) {
      alert(`Błąd pobierania obłożenia: ${err.message}`);
    } finally {
      setOccupancyLoading(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleGlobalSyncWrapper = async () => {
    if (isReadOnly) {
       alert("Tylko Super Admin może synchronizować dostępność dla całego obiektu (zapis do bazy).");
       return;
    }
    setIsGlobalSyncing(true);
    try {
      await onSyncAllOccupancy();
    } finally {
      setIsGlobalSyncing(false);
    }
  };

  const toggleRowExpansion = (roomId: string, seasonId: string) => {
    const key = `${roomId}-${seasonId}`;
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRoomCollapse = (roomId: string) => {
    setCollapsedRoomIds(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, roomId: string) => {
    if (isReadOnly) return;
    setDraggedRoomId(roomId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, targetRoomId: string) => {
    e.preventDefault();
    if (isReadOnly || !draggedRoomId || draggedRoomId === targetRoomId) return;
    const sourceIndex = rooms.findIndex(r => r.id === draggedRoomId);
    const targetIndex = rooms.findIndex(r => r.id === targetRoomId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const newRooms = [...rooms];
    const [removed] = newRooms.splice(sourceIndex, 1);
    newRooms.splice(targetIndex, 0, removed);
    onReorderRooms(newRooms);
    setDraggedRoomId(null);
  };

  const handleDragEnd = () => {
    setDraggedRoomId(null);
  };

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedRoomName = useMemo(() => rooms.find(r => r.id === selectedRoomId)?.name, [rooms, selectedRoomId]);

  // Color helper for occupancy
  const getOccupancyColor = (rate: number | undefined) => {
    if (rate === undefined) return 'text-slate-400';
    // Smooth transition from Red (0%) to Green (100%)
    const hue = (rate / 100) * 120; 
    return `hsl(${hue}, 80%, 40%)`;
  };

  // Get active channel info for dynamic labels
  const currentChannel = useMemo(() => {
    return channels.find(c => c.id === activeView);
  }, [channels, activeView]);

  const isCurrentChannelBooking = useMemo(() => {
    if (!currentChannel) return false;
    return currentChannel.id.toLowerCase().includes('booking') || currentChannel.name.toLowerCase().includes('booking');
  }, [currentChannel]);

  const channelLabels = currentChannel?.discountLabels || {
    mobile: "Mobile",
    genius: "Genius",
    seasonal: "Sezon",
    firstMinute: "First Min",
    lastMinute: "Last Min"
  };

  // Helper to render discount cells with percentage
  const renderDiscountCell = (amount: number, percentage: number, colorClass: string) => (
    <td className={`px-3 py-3 align-middle text-right text-xs`}>
        <div className={`flex flex-col items-end ${colorClass}`}>
            <span>{amount > 0 ? `-${amount}` : '-'}</span>
            {amount > 0 && <span className="text-[10px] opacity-70">({percentage}%)</span>}
        </div>
    </td>
  );

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
             {isReadOnly && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1"><Lock size={10}/> Tylko do odczytu</span>}
          </h2>
          <p className="text-sm text-slate-500">Standardowy cennik (Max os.)</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <button 
             onClick={handleGlobalSyncWrapper}
             disabled={isGlobalSyncing || isReadOnly}
             className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
             title={isReadOnly ? "Brak uprawnień" : "Pobierz dostępność"}
          >
             {isGlobalSyncing ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
             Synchronizuj Dostępność
          </button>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          {/* New Filters */}
          <div className="flex items-center gap-2">
             <div className="relative group">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm text-slate-600 hover:border-slate-400 cursor-pointer shadow-sm">
                   <Home size={14} className="text-slate-400" />
                   <select 
                      value={typeFilter} 
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="appearance-none bg-transparent outline-none cursor-pointer pr-6 font-medium text-slate-700"
                   >
                      <option value="ALL">Wszystkie typy</option>
                      {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <ChevronDown size={12} className="absolute right-2 pointer-events-none text-slate-400" />
                </div>
             </div>

             <div className="relative group">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm text-slate-600 hover:border-slate-400 cursor-pointer shadow-sm">
                   <Users size={14} className="text-slate-400" />
                   <select 
                      value={capacityFilter} 
                      onChange={(e) => setCapacityFilter(e.target.value)}
                      className="appearance-none bg-transparent outline-none cursor-pointer pr-6 font-medium text-slate-700"
                   >
                      <option value="ALL">Wszystkie pojemności</option>
                      {uniqueCapacities.map(c => <option key={c} value={c}>Max {c} os.</option>)}
                   </select>
                   <ChevronDown size={12} className="absolute right-2 pointer-events-none text-slate-400" />
                </div>
             </div>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          {activeView !== "ALL" && (
            <div className="relative">
              <button 
                  onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium transition-colors shadow-sm"
              >
                  <Columns size={16} /> Widok <ChevronDown size={14} />
              </button>
              {isColumnMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsColumnMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 z-20 p-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Pokaż kolumny</div>
                      
                      {activeView !== "SUMMARY" && (
                        <>
                          {[
                            { k: 'mobile', label: channelLabels.mobile },
                            { k: 'genius', label: channelLabels.genius },
                            { k: 'seasonal', label: channelLabels.seasonal },
                            { k: 'firstMinute', label: channelLabels.firstMinute },
                            { k: 'lastMinute', label: channelLabels.lastMinute },
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
                        </>
                      )}
                      
                      {/* Booking PIF Toggle (Visible in Summary and Booking detailed view) */}
                      <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer border-t border-slate-100 mt-1">
                          <input 
                            type="checkbox" 
                            checked={columnVisibility.pif}
                            onChange={() => toggleColumn('pif')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700 font-medium">PIF (Booking)</span>
                      </label>

                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto">
             <button onClick={() => setActiveView("ALL")} className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeView === "ALL" ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Ceny Bezpośrednie (Baza)</button>
             
             {/* Summary Tab */}
             <button onClick={() => setActiveView("SUMMARY")} className={`px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeView === "SUMMARY" ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                <TableProperties size={14}/> Podsumowanie
             </button>

             {channels.map(c => (
                <button key={c.id} onClick={() => setActiveView(c.id)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeView === c.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className="w-2 h-2 rounded-full" style={{backgroundColor: c.color}}></span>{c.name}
                </button>
             ))}
          </div>

          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-2 py-3 w-8 bg-slate-50"></th>
                  <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Pokój</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Sezon</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-500 uppercase tracking-wider w-20">Min. Nocy</th>
                  
                  {activeView !== "SUMMARY" && (
                    <>
                      <th className="px-3 py-3 text-center font-bold text-slate-500 uppercase tracking-wider w-28">OBŁOŻENIE</th>
                      <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider w-40">Komentarz</th>
                      <th className="px-3 py-3 text-center font-bold text-slate-500 uppercase tracking-wider w-24">Baza (PLN)</th>
                    </>
                  )}
                  <th className="px-3 py-3 text-center font-bold text-slate-500 uppercase tracking-wider w-20">Os.</th>
                  <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-blue-50/50 text-blue-700">Direct</th>
                  
                  {activeView === "SUMMARY" && (
                     channels.map(c => {
                       const isBooking = c.id.toLowerCase().includes('booking') || c.name.toLowerCase().includes('booking');
                       return (
                       <React.Fragment key={c.id}>
                         <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider border-l border-slate-200" style={{color: c.color}}>
                            {c.name}
                         </th>
                         {/* PIF Columns for Booking */}
                         {isBooking && columnVisibility.pif && (
                            <>
                              <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider border-l border-slate-100" style={{color: c.color}}>PIF 5%</th>
                              <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider border-l border-slate-100" style={{color: c.color}}>PIF 10%</th>
                            </>
                         )}
                       </React.Fragment>
                     )})
                  )}

                  {activeView !== "ALL" && activeView !== "SUMMARY" && (
                     <>
                        {columnVisibility.mobile && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-blue-600">{channelLabels.mobile}</th>}
                        {columnVisibility.genius && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-purple-600">{channelLabels.genius}</th>}
                        {columnVisibility.seasonal && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-green-600">{channelLabels.seasonal}</th>}
                        {columnVisibility.firstMinute && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-amber-600">{channelLabels.firstMinute}</th>}
                        {columnVisibility.lastMinute && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-red-600">{channelLabels.lastMinute}</th>}
                        
                        <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-orange-50/50 text-orange-700">W OTA</th>
                        
                        {/* Booking PIF columns for detailed view */}
                        {isCurrentChannelBooking && columnVisibility.pif && (
                           <>
                              <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-blue-50/30 text-blue-800">PIF 5%</th>
                              <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-blue-50/30 text-blue-800">PIF 10%</th>
                           </>
                        )}

                        {columnVisibility.commission && <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Prowizja</th>}
                        <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider bg-green-50/50 text-green-800">Netto</th>
                     </>
                  )}
                  {activeView === "ALL" && <th className="px-3 py-3"></th>}
                </tr>
              </thead>
              
              {roomGroups.length > 0 ? (
                roomGroups.map(({ room, rows }) => {
                  const isCollapsed = collapsedRoomIds.has(room.id);
                  const dragActive = draggedRoomId === room.id;

                  return (
                  <tbody 
                     key={room.id}
                     draggable={!isReadOnly}
                     onDragStart={(e) => handleDragStart(e, room.id)}
                     onDragOver={handleDragOver}
                     onDrop={(e) => handleDrop(e, room.id)}
                     onDragEnd={handleDragEnd}
                     className={`group/body border-b border-slate-200 hover:bg-slate-50/50 transition-colors ${dragActive ? 'opacity-30' : ''}`}
                  >
                     {/* Group Header Row */}
                     <tr className="bg-slate-100 hover:bg-slate-200/50 cursor-pointer" onClick={() => toggleRoomCollapse(room.id)}>
                        <td className="px-2 py-2 text-center align-middle">
                           <div className={`text-slate-400 flex justify-center ${!isReadOnly ? 'cursor-grab active:cursor-grabbing hover:text-slate-600' : ''}`} onClick={(e) => e.stopPropagation()}>
                              {!isReadOnly && <GripVertical size={16} />}
                           </div>
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-700 flex items-center gap-2" colSpan={2}>
                           {isCollapsed ? <ChevronRight size={16}/> : <ChevronDown size={16}/>}
                           {room.name}
                        </td>
                        {/* Dynamic colspan adjustment based on visible columns */}
                        <td colSpan={20} className="px-3 py-2 text-right text-xs text-slate-400 font-medium uppercase tracking-wider">
                           {isCollapsed ? `${rows.length} Sezonów (Rozwiń)` : ''}
                        </td>
                     </tr>

                     {!isCollapsed && rows.map((row, index) => {
                        const channelData = activeView !== "ALL" && activeView !== "SUMMARY" ? row.channelCalculations[activeView] : null;
                        const rowKey = `${row.roomId}-${row.seasonId}`;
                        const isExpanded = expandedRows.has(rowKey);
                        const isLoading = occupancyLoading.has(rowKey);
                        const occColor = getOccupancyColor(row.occupancyRate);

                        return (
                           <React.Fragment key={row.seasonId}>
                             <tr className={`hover:bg-slate-100/50 ${isExpanded ? 'bg-slate-50 border-b border-slate-100' : ''}`}>
                                <td className="px-2 py-3"></td>
                                <td className="px-3 py-3 align-middle opacity-50"></td>
                                <td className="px-3 py-3 align-middle text-slate-600">
                                   <span className="text-xs font-semibold">{row.seasonName}</span>
                                </td>
                                <td className="px-3 py-3 align-middle text-center text-slate-600 text-xs font-medium">
                                   {row.minNights}
                                </td>
                                
                                {activeView !== "SUMMARY" && (
                                  <>
                                    <td className="px-3 py-3 align-middle text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <span 
                                          className="text-xs font-bold transition-colors duration-300"
                                          style={{ color: occColor }}
                                        >
                                            {row.occupancyRate !== undefined ? `${row.occupancyRate}%` : '-'}
                                        </span>
                                        {!isReadOnly && (
                                          <button 
                                              onClick={() => handleFetchOccupancy(row.roomId, row.seasonId)}
                                              className="text-slate-400 hover:text-blue-500 transition-colors p-1"
                                              title="Odśwież obłożenie z Hotres"
                                              disabled={isLoading}
                                          >
                                              <RefreshCw size={14} className={isLoading ? "animate-spin text-blue-500" : ""} />
                                          </button>
                                        )}
                                      </div>
                                    </td>

                                    <td className="px-3 py-3 align-middle">
                                      <input
                                          type="text"
                                          value={row.comment || ""}
                                          disabled={isReadOnly}
                                          onChange={(e) => handleCommentChange(room.id, row.seasonId, e.target.value)}
                                          placeholder="Uwagi..."
                                          className="w-full px-2 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white bg-transparent rounded transition-all placeholder:text-slate-300 disabled:bg-transparent disabled:placeholder-slate-200"
                                      />
                                    </td>
                                    <td className="px-3 py-3 align-middle text-center text-slate-600 font-medium">
                                      {row.basePrice} zł
                                    </td>
                                  </>
                                )}

                                <td className="px-3 py-3 align-middle text-center">
                                   <div className="flex items-center justify-center gap-1">
                                      <span className="text-sm font-medium text-slate-700">{row.occupancy} os.</span>
                                      <button 
                                        onClick={() => toggleRowExpansion(room.id, row.seasonId)}
                                        className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${isExpanded ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                                      >
                                        {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                      </button>
                                   </div>
                                </td>
                                <td className="px-3 py-3 align-middle text-right font-bold text-blue-700 bg-blue-50/30 border-l border-blue-100">
                                   {row.directPrice} zł
                                </td>

                                {activeView === "SUMMARY" && (
                                   channels.map(c => {
                                      const cData = row.channelCalculations[c.id];
                                      const isBooking = c.id.toLowerCase().includes('booking') || c.name.toLowerCase().includes('booking');
                                      return (
                                        <React.Fragment key={c.id}>
                                            <td className="px-3 py-3 align-middle text-right font-bold text-slate-600 border-l border-slate-100">
                                            {cData ? `${cData.listPrice} zł` : '-'}
                                            </td>
                                            {isBooking && columnVisibility.pif && (
                                                <>
                                                    <td className="px-3 py-3 align-middle text-right font-medium text-slate-600 border-l border-slate-100 bg-slate-50/50">
                                                        <div className="font-bold">{cData?.pif5 ? `${cData.pif5} zł` : '-'}</div>
                                                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">D: {cData?.pif5Direct}</div>
                                                    </td>
                                                    <td className="px-3 py-3 align-middle text-right font-medium text-slate-600 border-l border-slate-100 bg-slate-50/50">
                                                        <div className="font-bold">{cData?.pif10 ? `${cData.pif10} zł` : '-'}</div>
                                                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">D: {cData?.pif10Direct}</div>
                                                    </td>
                                                </>
                                            )}
                                        </React.Fragment>
                                      )
                                   })
                                )}

                                {activeView !== "ALL" && activeView !== "SUMMARY" && channelData && (
                                   <>
                                      {columnVisibility.mobile && renderDiscountCell(channelData.discountBreakdown.mobile, channelData.discountPercentages.mobile, 'text-blue-600')}
                                      {columnVisibility.genius && renderDiscountCell(channelData.discountBreakdown.genius, channelData.discountPercentages.genius, 'text-purple-600')}
                                      {columnVisibility.seasonal && renderDiscountCell(channelData.discountBreakdown.seasonal, channelData.discountPercentages.seasonal, 'text-green-600')}
                                      {columnVisibility.firstMinute && renderDiscountCell(channelData.discountBreakdown.firstMinute, channelData.discountPercentages.firstMinute, 'text-amber-600')}
                                      {columnVisibility.lastMinute && renderDiscountCell(channelData.discountBreakdown.lastMinute, channelData.discountPercentages.lastMinute, 'text-red-600')}
                                      
                                      <td className="px-3 py-3 align-middle text-right font-bold text-orange-700 bg-orange-50/30 border-l border-orange-100">{channelData.listPrice} zł</td>
                                      
                                      {isCurrentChannelBooking && columnVisibility.pif && (
                                         <>
                                            <td className="px-3 py-3 align-middle text-right font-bold text-blue-800 bg-blue-50/30 border-l border-blue-100">
                                                <div>{channelData.pif5 ? `${channelData.pif5} zł` : '-'}</div>
                                                <div className="text-[10px] text-blue-500/70 font-normal mt-0.5">D: {channelData.pif5Direct}</div>
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right font-bold text-blue-800 bg-blue-50/30 border-l border-blue-100">
                                                <div>{channelData.pif10 ? `${channelData.pif10} zł` : '-'}</div>
                                                <div className="text-[10px] text-blue-500/70 font-normal mt-0.5">D: {channelData.pif10Direct}</div>
                                            </td>
                                         </>
                                      )}

                                      {columnVisibility.commission && <td className="px-3 py-3 align-middle text-right text-slate-500 text-xs">-{channelData.commission}</td>}
                                      
                                      <td className="px-3 py-3 align-middle text-right border-l border-green-100 bg-green-50/30">
                                         <div className="flex flex-col items-end">
                                            <span className={`font-bold ${channelData.estimatedNet < row.directPrice ? 'text-red-600' : 'text-green-700'}`}>{channelData.estimatedNet} zł</span>
                                            {!channelData.isProfitable && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">STRATA</span>}
                                         </div>
                                      </td>
                                   </>
                                )}
                                {activeView === "ALL" && <td className="px-3 py-3"></td>}
                             </tr>
                             
                             {/* EXPANDED DETAILS */}
                             {isExpanded && (
                               <tr>
                                 <td colSpan={activeView === "ALL" ? 10 : activeView === "SUMMARY" ? 20 : 20} className="bg-slate-50 p-3 shadow-inner">
                                   <div className="ml-12 border border-slate-200 rounded-md bg-white overflow-hidden max-w-4xl">
                                     <div className="px-3 py-2 bg-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                       Szczegóły obłożenia ({room.name} - {row.seasonName})
                                     </div>
                                     <table className="min-w-full text-xs">
                                       <thead>
                                         <tr className="bg-slate-50 text-slate-500">
                                           <th className="px-3 py-2 text-left">Obłożenie</th>
                                           <th className="px-3 py-2 text-right">Cena Direct</th>
                                           {activeView !== "ALL" && activeView !== "SUMMARY" && (
                                              <>
                                                <th className="px-3 py-2 text-right text-orange-600">Cena {channels.find(c=>c.id === activeView)?.name}</th>
                                                
                                                {isCurrentChannelBooking && columnVisibility.pif && (
                                                    <>
                                                        <th className="px-3 py-2 text-right text-blue-700">PIF 5%</th>
                                                        <th className="px-3 py-2 text-right text-blue-700">PIF 10%</th>
                                                    </>
                                                )}

                                                <th className="px-3 py-2 text-right text-green-700">Netto</th>
                                                <th className="px-3 py-2 text-right">Wynik</th>
                                              </>
                                           )}
                                           {activeView === "SUMMARY" && channels.map(c => {
                                              const isBooking = c.id.toLowerCase().includes('booking') || c.name.toLowerCase().includes('booking');
                                              return (
                                              <React.Fragment key={c.id}>
                                                <th className="px-3 py-2 text-right" style={{color: c.color}}>{c.name}</th>
                                                {isBooking && columnVisibility.pif && (
                                                    <>
                                                        <th className="px-3 py-2 text-right text-slate-400">P5%</th>
                                                        <th className="px-3 py-2 text-right text-slate-400">P10%</th>
                                                    </>
                                                )}
                                              </React.Fragment>
                                           )})}
                                         </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-100">
                                         {Array.from({length: room.maxOccupancy}, (_, i) => i + 1).map(occ => {
                                           // Calc on the fly for expanded rows
                                           const seasonObj = seasons.find(s => s.id === row.seasonId)!;
                                           const dPrice = calculateDirectPrice(room, seasonObj, occ, settings);
                                           
                                           let cCalc: any = null;
                                           if (activeView !== "ALL" && activeView !== "SUMMARY") {
                                              const chan = channels.find(c => c.id === activeView)!;
                                              cCalc = calculateChannelPrice(dPrice, chan, row.seasonId);
                                           }

                                           return (
                                             <tr key={occ} className={occ === row.occupancy ? "bg-blue-50 font-medium" : ""}>
                                               <td className="px-3 py-2 flex items-center gap-2">
                                                  <Users size={12} className="text-slate-400"/> {occ} os.
                                                  {occ === row.occupancy && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded ml-1">Widok</span>}
                                               </td>
                                               <td className="px-3 py-2 text-right font-medium text-blue-700">{dPrice} zł</td>
                                               
                                               {/* Single Channel View Details */}
                                               {cCalc && (
                                                  <>
                                                    <td className="px-3 py-2 text-right text-orange-600">{cCalc.listPrice} zł</td>
                                                    
                                                    {isCurrentChannelBooking && columnVisibility.pif && (
                                                        <>
                                                            <td className="px-3 py-2 text-right text-blue-700">
                                                                <div>{cCalc.pif5} zł</div>
                                                                <div className="text-[9px] text-slate-400">D:{cCalc.pif5Direct}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-blue-700">
                                                                <div>{cCalc.pif10} zł</div>
                                                                <div className="text-[9px] text-slate-400">D:{cCalc.pif10Direct}</div>
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className="px-3 py-2 text-right text-green-700">{cCalc.estimatedNet} zł</td>
                                                    <td className="px-3 py-2 text-right">
                                                      {cCalc.isProfitable ? (
                                                        <span className="text-green-500">OK</span>
                                                      ) : (
                                                        <span className="text-red-500 font-bold">STRATA</span>
                                                      )}
                                                    </td>
                                                  </>
                                               )}

                                               {/* Summary View Details */}
                                               {activeView === "SUMMARY" && channels.map(c => {
                                                  const calc = calculateChannelPrice(dPrice, c, row.seasonId);
                                                  const isBooking = c.id.toLowerCase().includes('booking') || c.name.toLowerCase().includes('booking');
                                                  return (
                                                    <React.Fragment key={c.id}>
                                                        <td className="px-3 py-2 text-right text-slate-600">{calc.listPrice} zł</td>
                                                        {isBooking && columnVisibility.pif && (
                                                            <>
                                                                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">
                                                                    <div>{calc.pif5}</div>
                                                                    <div className="opacity-50">D:{calc.pif5Direct}</div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">
                                                                    <div>{calc.pif10}</div>
                                                                    <div className="opacity-50">D:{calc.pif10Direct}</div>
                                                                </td>
                                                            </>
                                                        )}
                                                    </React.Fragment>
                                                  )
                                               })}
                                             </tr>
                                           );
                                         })}
                                       </tbody>
                                     </table>
                                   </div>
                                 </td>
                               </tr>
                             )}
                           </React.Fragment>
                        );
                     })}
                  </tbody>
                );
                })
              ) : (
                <tbody><tr><td colSpan={15} className="px-4 py-8 text-center text-slate-500">Brak danych spełniających kryteria.</td></tr></tbody>
              )}
            </table>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-blue-600"/> Średnie Stawki</h3>
            <div style={{ width: '100%', height: '250px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} cursor={{fill: '#f1f5f9'}} />
                    <Bar dataKey="avgDirect" name="Śr. Cena Bezp." fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Brak danych do wykresu</div>
              )}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col">
             <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><StickyNote size={20} className="text-amber-500"/> Notatki</h3>
             <textarea 
               disabled={isReadOnly}
               className="flex-1 w-full min-h-[120px] p-3 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700 bg-amber-50/50 resize-none placeholder:text-slate-400 disabled:opacity-70 disabled:cursor-not-allowed" 
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
