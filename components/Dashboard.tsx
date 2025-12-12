
import React, { useState, useMemo } from 'react';
import { RoomType, Season, Channel, GlobalSettings, PricingRow } from '../types';
import { generatePricingGrid } from '../utils/pricingEngine';
import { fetchHotresOccupancy } from '../utils/hotresApi';
import { 
  Users, RefreshCw, AlertCircle, Save, CheckCircle2, ChevronDown, ChevronRight, 
  Euro, Percent, TrendingUp, Info 
} from 'lucide-react';

interface DashboardProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  propertyOid: string;
  selectedRoomId: string | null;
  notes: string;
  onNotesChange: (n: string) => void;
  onRoomUpdate: (roomId: string, updates: Partial<RoomType>) => void;
  onOccupancyUpdate: (roomId: string, seasonId: string, rate: number) => void;
  onReorderRooms: (rooms: RoomType[]) => void;
  onSyncAllOccupancy: () => void;
  isReadOnly?: boolean;
}

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
  const [occupancyFilter, setOccupancyFilter] = useState<number | 'MAX'>('MAX');
  const [activeChannelId, setActiveChannelId] = useState<string>(channels[0]?.id || '');
  
  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    pif: false,
    commission: true,
    breakdown: false,
  });

  // Ensure active channel is valid
  if ((!activeChannelId || !channels.find(c => c.id === activeChannelId)) && channels.length > 0) {
     const firstChannel = channels[0];
     if (firstChannel) setActiveChannelId(firstChannel.id);
  }

  const currentChannel = channels.find(c => c.id === activeChannelId);
  const isCurrentChannelBooking = currentChannel ? (currentChannel.id.toLowerCase().includes('booking') || currentChannel.name.toLowerCase().includes('booking')) : false;

  // Filter rooms if selectedRoomId is present
  const displayRooms = selectedRoomId ? rooms.filter(r => r.id === selectedRoomId) : rooms;

  // Generate Data
  const pricingGrid = useMemo(() => {
    return generatePricingGrid(displayRooms, seasons, channels, settings, occupancyFilter);
  }, [displayRooms, seasons, channels, settings, occupancyFilter]);

  // Group by Room for better display
  const groupedData = useMemo(() => {
    const map = new Map<string, PricingRow[]>();
    pricingGrid.forEach(row => {
      if (!map.has(row.roomId)) map.set(row.roomId, []);
      map.get(row.roomId)!.push(row);
    });
    return map;
  }, [pricingGrid]);

  // Sync handler for individual cells
  const handleSyncOccupancy = async (roomId: string, seasonId: string, tid: string, start: string, end: string) => {
    if (isReadOnly) return;
    try {
       const rate = await fetchHotresOccupancy(propertyOid, tid, start, end);
       onOccupancyUpdate(roomId, seasonId, rate);
    } catch (e) {
       alert("Błąd pobierania obłożenia.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Controls Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="flex flex-col">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Obłożenie (Osoby)</label>
               <select 
                  value={occupancyFilter} 
                  onChange={(e) => setOccupancyFilter(e.target.value === 'MAX' ? 'MAX' : Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
               >
                 <option value="MAX">Max (Domyślne)</option>
                 {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                   <option key={n} value={n}>{n} os.</option>
                 ))}
               </select>
            </div>

            <div className="flex flex-col">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kanał Sprzedaży</label>
               <select 
                  value={activeChannelId} 
                  onChange={(e) => setActiveChannelId(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px]"
               >
                 {channels.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
            </div>
         </div>

         <div className="flex items-center gap-2">
            {isCurrentChannelBooking && (
               <button 
                  onClick={() => setColumnVisibility(prev => ({ ...prev, pif: !prev.pif }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${columnVisibility.pif ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}
               >
                  PIF (5%/10%)
               </button>
            )}
            <button 
               onClick={() => setColumnVisibility(prev => ({ ...prev, commission: !prev.commission }))}
               className={`px-3 py-1.5 text-xs font-medium rounded border ${columnVisibility.commission ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-white text-slate-500 border-slate-200'}`}
            >
               Prowizja
            </button>
            {!isReadOnly && (
               <button 
                  onClick={onSyncAllOccupancy}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
               >
                  <RefreshCw size={12} /> Sync Obłożenia
               </button>
            )}
         </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-auto">
         <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
               <tr>
                  <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider w-10"></th>
                  <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider">Sezon</th>
                  <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider text-right">Obłożenie</th>
                  <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider text-right w-24">Cena Direct</th>
                  
                  {/* Channel Columns */}
                  {currentChannel && (
                    <>
                       <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider text-right w-24" style={{ color: currentChannel.color }}>
                          {currentChannel.name}
                       </th>
                       {isCurrentChannelBooking && columnVisibility.pif && (
                          <>
                             <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider text-right w-20 text-blue-600 bg-blue-50/50">PIF 5%</th>
                             <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider text-right w-20 text-blue-600 bg-blue-50/50">PIF 10%</th>
                          </>
                       )}
                       {columnVisibility.commission && (
                          <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider text-right w-20 text-slate-400">Prowizja</th>
                       )}
                       <th className="px-3 py-3 border-b border-slate-200 font-semibold text-xs uppercase tracking-wider text-right w-24 text-green-700 bg-green-50/50">Est. Netto</th>
                    </>
                  )}
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {Array.from(groupedData.entries()).map(([roomId, rows]) => {
                  const room = rooms.find(r => r.id === roomId);
                  if (!room) return null;

                  return (
                     <React.Fragment key={roomId}>
                        {/* Room Header Row */}
                        <tr className="bg-slate-100 border-y border-slate-200">
                           <td colSpan={10} className="px-4 py-2">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2 font-bold text-slate-700">
                                    <Users size={16} className="text-slate-500" />
                                    {room.name}
                                    <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">Max: {room.maxOccupancy} os.</span>
                                    {room.tid && <span className="text-[10px] font-mono text-slate-400">TID: {room.tid}</span>}
                                 </div>
                              </div>
                           </td>
                        </tr>

                        {/* Season Rows */}
                        {rows.map(row => {
                           const channelData = activeChannelId ? row.channelCalculations[activeChannelId] : null;
                           const season = seasons.find(s => s.id === row.seasonId);

                           return (
                              <tr key={`${row.roomId}-${row.seasonId}`} className="hover:bg-slate-50 transition-colors group">
                                 <td className="px-3 py-3 text-center align-middle">
                                    {/* Placeholder for status icon or checkbox */}
                                 </td>
                                 <td className="px-3 py-3 align-middle">
                                    <div className="font-medium text-slate-700">{row.seasonName}</div>
                                    <div className="text-[10px] text-slate-400">{season?.startDate} - {season?.endDate}</div>
                                    {/* Occupancy Rate Display */}
                                    <div className="mt-1 flex items-center gap-1.5">
                                       <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden">
                                          <div 
                                             className={`h-full rounded-full ${row.occupancyRate && row.occupancyRate > 80 ? 'bg-red-500' : row.occupancyRate && row.occupancyRate > 50 ? 'bg-amber-400' : 'bg-green-500'}`} 
                                             style={{ width: `${row.occupancyRate || 0}%` }}
                                          ></div>
                                       </div>
                                       <span className="text-[10px] text-slate-500">{row.occupancyRate || 0}%</span>
                                       {!isReadOnly && room.tid && season && (
                                         <button 
                                           onClick={() => handleSyncOccupancy(row.roomId, row.seasonId, room.tid, season.startDate, season.endDate)}
                                           className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition-opacity"
                                           title="Odśwież obłożenie"
                                         >
                                            <RefreshCw size={10} />
                                         </button>
                                       )}
                                    </div>
                                 </td>
                                 <td className="px-3 py-3 align-middle text-right">
                                     <div className="text-sm font-medium text-slate-600">{row.occupancy} os.</div>
                                     <div className="text-[10px] text-slate-400">Min. {row.minNights} noce</div>
                                 </td>
                                 <td className="px-3 py-3 align-middle text-right">
                                     <div className="text-sm font-bold text-slate-800">{row.directPrice} zł</div>
                                     {row.basePrice !== row.directPrice && (
                                        <div className="text-[10px] text-slate-400 line-through">{row.basePrice * (season?.multiplier || 1)}</div>
                                     )}
                                 </td>

                                 {/* Channel Data */}
                                 {channelData && (
                                    <>
                                      <td className="px-3 py-3 align-middle text-right font-bold" style={{ color: currentChannel?.color }}>
                                          {channelData.listPrice} zł
                                      </td>

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

                                      {columnVisibility.commission && (
                                        <td className="px-3 py-3 align-middle text-right text-slate-500 text-xs">
                                            <div>-{channelData.commission}</div>
                                            {currentChannel && <div className="text-[10px] opacity-70">({currentChannel.commissionPct}%)</div>}
                                        </td>
                                      )}
                                      
                                      <td className="px-3 py-3 align-middle text-right border-l border-green-100 bg-green-50/30">
                                         <div className="flex flex-col items-end">
                                            <span className={`font-bold ${channelData.estimatedNet < row.directPrice ? 'text-red-600' : 'text-green-700'}`}>{channelData.estimatedNet} zł</span>
                                            {!channelData.isProfitable && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">STRATA</span>}
                                         </div>
                                      </td>
                                    </>
                                 )}
                              </tr>
                           );
                        })}
                     </React.Fragment>
                  );
               })}
            </tbody>
         </table>
      </div>

      {/* Footer Notes */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notatki dla obiektu</label>
         <textarea 
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            disabled={isReadOnly}
            className="w-full h-20 text-sm p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-slate-100"
            placeholder="Wpisz ważne informacje dot. cennika..."
         />
      </div>
    </div>
  );
};

export default Dashboard;
