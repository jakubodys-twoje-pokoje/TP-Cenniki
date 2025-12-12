
import React, { useState, useMemo } from 'react';
import { RoomType, Season, Channel, GlobalSettings } from '../types';
import { calculateDirectPrice, calculateChannelPrice } from '../utils/pricingEngine';
import { Printer, Calendar, Users, Eye, EyeOff, LayoutList } from 'lucide-react';

interface ClientDashboardProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({
  rooms,
  seasons,
  channels,
  settings
}) => {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(seasons[0]?.id || "");
  const [visibleChannels, setVisibleChannels] = useState<Set<string>>(new Set(channels.map(c => c.id)));
  const [showPif, setShowPif] = useState(false); // Toggle for PIF

  // Ensure we have a valid season selected
  const selectedSeason = seasons.find(s => s.id === selectedSeasonId) || seasons[0];

  // Update selected season if the current one is invalid (e.g. after data change)
  if (selectedSeasonId === "" && seasons.length > 0 && selectedSeasonId !== seasons[0].id) {
      setSelectedSeasonId(seasons[0].id);
  }

  const toggleChannel = (channelId: string) => {
    setVisibleChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const tableData = useMemo(() => {
    if (!selectedSeason) return [];

    return rooms.map(room => {
      // Calculate for MAX occupancy as per requirements for the standard price list
      const directPrice = calculateDirectPrice(room, selectedSeason, room.maxOccupancy, settings);
      
      const channelPrices = channels.map(channel => {
        const calc = calculateChannelPrice(directPrice, channel, selectedSeason.id);
        const isBooking = channel.id.toLowerCase().includes('booking') || channel.name.toLowerCase().includes('booking');
        return {
          id: channel.id,
          price: calc.listPrice,
          color: channel.color,
          pif5: calc.pif5,
          pif10: calc.pif10,
          pif5Direct: calc.pif5Direct,
          pif10Direct: calc.pif10Direct,
          isBooking: isBooking
        };
      });

      return {
        room,
        directPrice,
        channelPrices
      };
    });
  }, [rooms, selectedSeason, channels, settings]);

  if (!selectedSeason) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-500">
      <LayoutList size={48} className="mb-4 opacity-20"/>
      <p>Brak zdefiniowanych sezonów.</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Controls - Hidden on Print */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap gap-6 items-start justify-between bg-slate-50 print:hidden">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Season Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wybierz Sezon</label>
            <div className="relative">
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none cursor-pointer min-w-[220px] font-medium text-slate-700 hover:border-slate-400 transition-colors"
              >
                {seasons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Calendar className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>

          {/* Channel Toggles */}
          <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pokaż Kanały</label>
             <div className="flex gap-2 flex-wrap">
               {channels.map(c => (
                 <button
                   key={c.id}
                   onClick={() => toggleChannel(c.id)}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                     visibleChannels.has(c.id)
                       ? 'bg-white text-slate-800 border-slate-300 shadow-sm'
                       : 'bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200'
                   }`}
                   style={visibleChannels.has(c.id) ? { borderLeftColor: c.color, borderLeftWidth: 4 } : {}}
                 >
                   {visibleChannels.has(c.id) ? <Eye size={12}/> : <EyeOff size={12}/>}
                   {c.name}
                 </button>
               ))}
             </div>
          </div>

          {/* PIF Toggle */}
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opcje Booking</label>
             <button
               onClick={() => setShowPif(!showPif)}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                 showPif
                   ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                   : 'bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200'
               }`}
             >
                {showPif ? <Eye size={12}/> : <EyeOff size={12}/>}
                PIF (5%/10%)
             </button>
           </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-md hover:bg-slate-800 transition-colors shadow-md text-sm font-medium"
        >
          <Printer size={18} />
          Drukuj Cennik
        </button>
      </div>

      {/* Main Content / Printable Area */}
      <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible">
        <div className="max-w-6xl mx-auto print:max-w-none print:w-full">
          
          {/* Header */}
          <div className="mb-8 text-center border-b pb-8 print:mb-4 print:pb-4">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">{selectedSeason.name}</h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-100 print:bg-transparent print:text-slate-600 print:px-0 print:border-none">
              <Calendar size={16} />
              <span>{selectedSeason.startDate} — {selectedSeason.endDate}</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 print:bg-white print:border-slate-900 print:border-b-2">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Pokój / Apartament</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-center w-32 text-xs">Pojemność</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-blue-700 w-40 text-xs bg-blue-50/50 print:bg-transparent">Cena Direct</th>
                  {channels.filter(c => visibleChannels.has(c.id)).map(c => {
                    const isBooking = c.id.toLowerCase().includes('booking') || c.name.toLowerCase().includes('booking');
                    return (
                    <React.Fragment key={c.id}>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-right w-40 text-xs" style={{color: c.color}}>
                        {c.name}
                      </th>
                      {showPif && isBooking && (
                        <>
                          <th className="px-4 py-4 font-bold uppercase tracking-wider text-right w-24 text-[10px] text-slate-400">PIF 5%</th>
                          <th className="px-4 py-4 font-bold uppercase tracking-wider text-right w-24 text-[10px] text-slate-400">PIF 10%</th>
                        </>
                      )}
                    </React.Fragment>
                  )})}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                {tableData.map((row, idx) => (
                  <tr key={row.room.id} className={`hover:bg-slate-50 transition-colors print:hover:bg-transparent ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-6 py-4 font-semibold text-slate-800 text-base">{row.room.name}</td>
                    <td className="px-6 py-4 text-center text-slate-600 flex justify-center items-center gap-1.5">
                      <Users size={16} className="text-slate-400"/>
                      <span className="font-medium">{row.room.maxOccupancy} os.</span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-blue-700 text-lg bg-blue-50/30 border-l border-blue-100 print:bg-transparent print:border-none">
                      {row.directPrice} zł
                    </td>
                    {row.channelPrices.filter(cp => visibleChannels.has(cp.id)).map(cp => {
                       return (
                        <React.Fragment key={cp.id}>
                          <td className="px-6 py-4 text-right font-bold text-lg border-l border-slate-100 print:border-none" style={{color: cp.color}}>
                            {cp.price} zł
                          </td>
                          {showPif && cp.isBooking && (
                            <>
                              <td className="px-4 py-4 text-right font-medium text-slate-500 text-sm border-l border-slate-100 print:border-none align-middle">
                                <div className="font-bold text-slate-700">{cp.pif5} zł</div>
                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">D: {cp.pif5Direct}</div>
                              </td>
                              <td className="px-4 py-4 text-right font-medium text-slate-500 text-sm border-l border-slate-100 print:border-none align-middle">
                                <div className="font-bold text-slate-700">{cp.pif10} zł</div>
                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">D: {cp.pif10Direct}</div>
                              </td>
                            </>
                          )}
                        </React.Fragment>
                       );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 text-center text-slate-400 text-[10px] uppercase tracking-widest print:mt-8">
            <p>Wygenerowano w systemie Cennik Twoje Pokoje</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
