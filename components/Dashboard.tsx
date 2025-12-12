import React, { useState, useMemo } from 'react';
import { Channel, GlobalSettings, RoomType, Season } from '../types';
import { generatePricingGrid } from '../utils/pricingEngine';
import { RefreshCw } from 'lucide-react';

interface DashboardProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  propertyOid: string;
  selectedRoomId: string | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onRoomUpdate: (roomId: string, updates: Partial<RoomType>) => void;
  onOccupancyUpdate: (roomId: string, seasonId: string, rate: number) => void;
  onReorderRooms: (rooms: RoomType[]) => void;
  onSyncAllOccupancy: () => void;
  isReadOnly: boolean;
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
  isReadOnly
}) => {
  const [occupancyFilter, setOccupancyFilter] = useState<number | "MAX">("MAX");
  const [activeChannelId, setActiveChannelId] = useState<string>(channels.length > 0 ? channels[0].id : "");
  const [columnVisibility, setColumnVisibility] = useState({
    commission: true,
    pif: true
  });

  // Ensure active channel is valid
  const currentChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  const isCurrentChannelBooking = currentChannel && (currentChannel.id.toLowerCase().includes('booking') || currentChannel.name.toLowerCase().includes('booking'));

  // Update active channel if current one is deleted/invalid
  if (!currentChannel && channels.length > 0) {
      setActiveChannelId(channels[0].id);
  }

  const pricingGrid = useMemo(() => {
    return generatePricingGrid(rooms, seasons, channels, settings, occupancyFilter);
  }, [rooms, seasons, channels, settings, occupancyFilter]);

  const filteredRows = useMemo(() => {
    if (selectedRoomId) {
      return pricingGrid.filter(r => r.roomId === selectedRoomId);
    }
    return pricingGrid;
  }, [pricingGrid, selectedRoomId]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
         <div className="flex items-center gap-4 flex-wrap">
            <div>
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Obłożenie (Symulacja)</label>
               <select 
                 className="block w-32 rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-slate-50 border"
                 value={occupancyFilter}
                 onChange={(e) => setOccupancyFilter(e.target.value === "MAX" ? "MAX" : Number(e.target.value))}
               >
                 <option value="MAX">Max (Domyślne)</option>
                 {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} os.</option>)}
               </select>
            </div>
            
            <div>
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Kanał do analizy</label>
               <select 
                 className="block w-48 rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-slate-50 border"
                 value={activeChannelId}
                 onChange={(e) => setActiveChannelId(e.target.value)}
                 disabled={channels.length === 0}
               >
                 {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
            </div>

            {isCurrentChannelBooking && (
                <div className="flex items-center gap-2 mt-6">
                   <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={columnVisibility.pif} 
                        onChange={e => setColumnVisibility({...columnVisibility, pif: e.target.checked})}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      Pokaż PIF
                   </label>
                </div>
            )}
         </div>

         {!isReadOnly && (
           <div className="flex items-center gap-2">
             <button onClick={onSyncAllOccupancy} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100 transition-colors">
               <RefreshCw size={16} /> Synchronizuj Dostępność
             </button>
           </div>
         )}
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pokój / Sezon</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Parametry</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-blue-50/50">Cena Direct</th>
                
                {/* Channel Columns */}
                {currentChannel && (
                    <>
                       <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider border-l border-slate-200" style={{ color: currentChannel.color }}>
                          {currentChannel.name} (List)
                       </th>
                       {isCurrentChannelBooking && columnVisibility.pif && (
                         <>
                           <th className="px-3 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider bg-blue-50/30 border-l border-blue-100">PIF 5%</th>
                           <th className="px-3 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider bg-blue-50/30 border-l border-blue-100">PIF 10%</th>
                         </>
                       )}
                       {columnVisibility.commission && (
                         <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Prowizja</th>
                       )}
                       <th className="px-3 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider bg-green-50/30 border-l border-green-100">Netto (Est.)</th>
                    </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
               {filteredRows.map((row) => {
                  const channelData = currentChannel ? row.channelCalculations[currentChannel.id] : null;

                  return (
                    <tr key={`${row.roomId}-${row.seasonId}`} className="hover:bg-slate-50 transition-colors">
                       {/* Room & Season */}
                       <td className="px-3 py-3 align-middle">
                          <div className="text-sm font-bold text-slate-800">{row.roomName}</div>
                          <div className="text-xs text-slate-500">{row.seasonName}</div>
                          {row.comment && <div className="text-[10px] text-amber-600 bg-amber-50 inline-block px-1 rounded mt-1 border border-amber-100">{row.comment}</div>}
                       </td>

                       {/* Params */}
                       <td className="px-3 py-3 align-middle">
                          <div className="flex flex-col gap-1 text-xs">
                             <div className="flex justify-between gap-2">
                                <span className="text-slate-400">Bazowa:</span>
                                <input 
                                  disabled={isReadOnly}
                                  type="number" 
                                  className="w-16 text-right border-b border-dotted border-slate-300 focus:border-blue-500 outline-none bg-transparent"
                                  value={row.basePrice}
                                  onChange={(e) => {
                                      // Complex update: need to find room and update seasonBasePrices
                                      const val = Number(e.target.value);
                                      const room = rooms.find(r => r.id === row.roomId);
                                      if(room) {
                                         const newBasePrices = { ...(room.seasonBasePrices || {}), [row.seasonId]: val };
                                         onRoomUpdate(room.id, { seasonBasePrices: newBasePrices });
                                      }
                                  }}
                                />
                             </div>
                             <div className="flex justify-between gap-2">
                                <span className="text-slate-400">Obłożenie:</span>
                                <div className="flex items-center gap-1">
                                   <input 
                                     disabled={isReadOnly}
                                     type="number"
                                     min="0" max="100"
                                     className={`w-12 text-right border-b border-dotted border-slate-300 focus:border-blue-500 outline-none bg-transparent ${row.occupancyRate && row.occupancyRate > 90 ? 'text-red-600 font-bold' : ''}`}
                                     value={row.occupancyRate ?? 0}
                                     onChange={(e) => onOccupancyUpdate(row.roomId, row.seasonId, Number(e.target.value))}
                                   />
                                   <span className="text-slate-400">%</span>
                                </div>
                             </div>
                          </div>
                       </td>

                       {/* Direct Price */}
                       <td className="px-3 py-3 align-middle text-right bg-blue-50/50">
                          <div className="text-lg font-bold text-blue-700">{row.directPrice} zł</div>
                          <div className="text-[10px] text-slate-400">{row.occupancy} os. / {row.minNights} noce</div>
                       </td>

                       {/* Channel Data */}
                       {channelData && (
                          <>
                             <td className="px-3 py-3 align-middle text-right border-l border-slate-200">
                                <div className="text-base font-bold text-slate-800">{channelData.listPrice} zł</div>
                                <div className="text-[10px] text-slate-400">
                                    {channelData.discountPercentages.mobile > 0 && `Mob: -${channelData.discountPercentages.mobile}% `}
                                    {channelData.discountPercentages.genius > 0 && `Gen: -${channelData.discountPercentages.genius}% `}
                                </div>
                             </td>
                             
                             {/* Snippet Logic Here */}
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
               {filteredRows.length === 0 && (
                   <tr>
                       <td colSpan={10} className="px-6 py-10 text-center text-slate-400">Brak danych do wyświetlenia. Sprawdź filtry lub dodaj pokoje/sezony.</td>
                   </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Notes Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notatki Obiektu</label>
        <textarea 
            className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            value={notes}
            disabled={isReadOnly}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Wpisz ważne informacje o obiekcie..."
        />
      </div>
    </div>
  );
};

export default Dashboard;