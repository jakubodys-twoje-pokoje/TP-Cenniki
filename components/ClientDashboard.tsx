
import React, { useState, useMemo } from 'react';
import { RoomType, Season, Channel, GlobalSettings } from '../types';
import { calculateDirectPrice, calculateChannelPrice } from '../utils/pricingEngine';
import { Printer, Calendar, Users, Eye, EyeOff, LayoutList, TableProperties, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [activeView, setActiveView] = useState<'OVERVIEW' | 'SEASON'>('OVERVIEW');

  // Helper for Polish night plural forms
  const getNightLabel = (count: number): string => {
    if (count === 1) return 'noc';
    if (count >= 2 && count <= 4) return 'noce';
    return 'nocy';
  };
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(seasons[0]?.id || "");
  const [visibleChannels, setVisibleChannels] = useState<Set<string>>(new Set(channels.map(c => c.id)));
  const [showPif, setShowPif] = useState(false); // Toggle for PIF
  const [expandedRoomIds, setExpandedRoomIds] = useState<Set<string>>(new Set());

  // Palette for season columns to create a rainbow effect
  const seasonColors = [
    'blue',
    'emerald',
    'violet',
    'amber',
    'rose',
    'cyan',
    'fuchsia',
    'lime',
    'indigo',
    'orange'
  ];

  const getSeasonColor = (index: number) => seasonColors[index % seasonColors.length];

  // Ensure we have a valid season selected for Season View
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

  const toggleRoomExpansion = (roomId: string) => {
    setExpandedRoomIds(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Data for Single Season View
  const seasonTableData = useMemo(() => {
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

  if (!seasons || seasons.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-500">
      <LayoutList size={48} className="mb-4 opacity-20"/>
      <p>Brak zdefiniowanych sezonów.</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Print Styles Injection */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 5mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          .printable-content {
             zoom: 0.70; /* Scale content to fit width */
             width: 100%;
          }
          /* Ensure expanded rows are visible */
          .print-visible {
             display: table-row !important;
          }
          /* Hide non-printable UI elements */
          .no-print {
             display: none !important;
          }
        }
      `}</style>

      {/* Controls - Hidden on Print */}
      <div className="p-4 border-b border-slate-200 flex flex-col gap-4 bg-slate-50 print:hidden">
        
        {/* Top Bar: View Switcher & Print */}
        <div className="flex justify-between items-center">
            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                <button 
                    onClick={() => setActiveView('OVERVIEW')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeView === 'OVERVIEW' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                >
                    <TableProperties size={16} /> Przegląd Roczny (Direct)
                </button>
                <button 
                    onClick={() => setActiveView('SEASON')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeView === 'SEASON' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                >
                    <Calendar size={16} /> Szczegóły Sezonu (OTA)
                </button>
            </div>

            <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-md hover:bg-slate-800 transition-colors shadow-md text-sm font-medium"
            >
                <Printer size={18} />
                Drukuj Cennik
            </button>
        </div>

        {/* Filters Bar (Conditional based on View) */}
        {activeView === 'SEASON' && (
            <div className="flex items-center gap-6 flex-wrap pt-2 border-t border-slate-200">
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
        )}
      </div>

      {/* Main Content / Printable Area */}
      <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible printable-content">
        <div className="max-w-[95%] mx-auto print:max-w-none print:w-full">
          
          {/* Header */}
          {activeView === 'SEASON' && (
            <div className="mb-8 text-center border-b pb-8 print:mb-4 print:pb-4">
                <h1 className="text-3xl font-bold text-slate-900 mb-3">{selectedSeason.name}</h1>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-100 print:bg-transparent print:text-slate-600 print:px-0 print:border-none">
                <Calendar size={16} />
                <span>{selectedSeason.startDate} — {selectedSeason.endDate}</span>
                </div>
            </div>
          )}
          {activeView === 'OVERVIEW' && (
              <div className="mb-6 border-b pb-4 print:mb-4 print:pb-4">
                  <h1 className="text-2xl font-bold text-slate-800">Cennik Bezpośredni (Wszystkie Sezony)</h1>
                  <p className="text-slate-500 text-sm mt-1 print:hidden">Kliknij na wiersz, aby zobaczyć ceny dla mniejszej liczby osób.</p>
              </div>
          )}

          {/* TABLE: OVERVIEW MODE (ALL SEASONS, DIRECT ONLY) */}
          {activeView === 'OVERVIEW' && (
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 print:bg-white print:border-slate-900 print:border-b-2">
                      <tr>
                         <th className="px-4 py-3 w-10"></th>
                         <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-500 text-left">Pokój / Apartament</th>
                         <th className="px-4 py-3 font-bold uppercase tracking-wider text-center w-20 text-[10px] text-slate-500">Osoby</th>
                         {seasons.map((s, i) => {
                             const color = getSeasonColor(i);
                             return (
                                <th key={s.id} className={`px-2 py-3 font-bold uppercase tracking-wider text-center text-[10px] text-${color}-700 bg-${color}-50 border-l border-${color}-100`}>
                                    {s.name}
                                </th>
                             );
                         })}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                      {rooms.map((room, idx) => {
                         const isExpanded = expandedRoomIds.has(room.id);
                         return (
                            <React.Fragment key={room.id}>
                                <tr 
                                    onClick={() => toggleRoomExpansion(room.id)}
                                    className={`cursor-pointer hover:bg-slate-50 transition-colors print:hover:bg-transparent ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} ${isExpanded ? 'bg-blue-50/20' : ''}`}
                                >
                                    <td className="px-4 py-3 text-center text-slate-400">
                                        {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-800 text-sm">{room.name}</td>
                                    <td className="px-4 py-3 text-center text-slate-600 font-medium text-sm">{room.maxOccupancy} os.</td>
                                    {seasons.map((s, i) => {
                                        const color = getSeasonColor(i);
                                        const price = calculateDirectPrice(room, s, room.maxOccupancy, settings);
                                        const foodOption = room.seasonalFoodOption?.[s.id];
                                        return (
                                            <td key={s.id} className={`px-2 py-3 text-center font-bold text-${color}-700 text-sm bg-${color}-50/20 border-l border-${color}-50`}>
                                                <div className="flex flex-col items-center">
                                                    <span>{price} zł</span>
                                                    {settings.foodEnabled && foodOption && foodOption !== 'none' && (() => {
                                                        const pricePerPerson = foodOption === 'breakfast'
                                                            ? (room.foodBreakfastPrice ?? 50)
                                                            : (room.foodFullPrice ?? 100);
                                                        const totalPrice = pricePerPerson * room.maxOccupancy;
                                                        const label = foodOption === 'breakfast' ? 'Śniadanie' : 'Pełne';
                                                        return (
                                                            <span className="text-[9px] text-green-600 font-normal mt-0.5">
                                                                +{label} ({pricePerPerson}×{room.maxOccupancy})
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="text-[9px] text-slate-400 font-normal mt-0.5">
                                                        min {s.minNights || 2} {getNightLabel(s.minNights || 2)}
                                                    </span>
                                                </div>
                                            </td>
                                        )
                                    })}
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-slate-50/50 print:bg-transparent print-visible">
                                        <td colSpan={3 + seasons.length} className="p-0">
                                            <div className="px-12 py-4 border-b border-slate-100">
                                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-inner print:border print:border-slate-300">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50 text-slate-500">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left font-semibold uppercase text-[10px] tracking-wider text-slate-400">Wariant (Osób)</th>
                                                                {seasons.map((s, i) => {
                                                                    const color = getSeasonColor(i);
                                                                    return (
                                                                        <th key={s.id} className={`px-3 py-2 text-center font-semibold text-[10px] text-${color}-600 border-l border-slate-200 uppercase tracking-wider bg-${color}-50/30`}>
                                                                            {s.name}
                                                                        </th>
                                                                    );
                                                                })}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {Array.from({length: room.maxOccupancy}, (_, i) => i + 1).map(occ => (
                                                                <tr key={occ} className={occ === room.maxOccupancy ? "bg-slate-50/80 font-medium" : ""}>
                                                                    <td className="px-3 py-2 flex items-center gap-2 text-slate-700 font-medium">
                                                                        <Users size={12} className="text-slate-400"/> 
                                                                        {occ} os.
                                                                        {occ === room.maxOccupancy && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded ml-1 print:hidden">Max</span>}
                                                                    </td>
                                                                    {seasons.map((s, i) => {
                                                                        const color = getSeasonColor(i);
                                                                        const occPrice = calculateDirectPrice(room, s, occ, settings);
                                                                        const foodOption = room.seasonalFoodOption?.[s.id];
                                                                        return (
                                                                            <td key={s.id} className={`px-3 py-2 text-center text-${color}-700 border-l border-slate-100 font-medium bg-${color}-50/10`}>
                                                                                <div className="flex flex-col items-center">
                                                                                    <span>{occPrice} zł</span>
                                                                                    {settings.foodEnabled && foodOption && foodOption !== 'none' && (() => {
                                                                                        const pricePerPerson = foodOption === 'breakfast'
                                                                                            ? (room.foodBreakfastPrice ?? 50)
                                                                                            : (room.foodFullPrice ?? 100);
                                                                                        const label = foodOption === 'breakfast' ? 'Ś' : 'P';
                                                                                        return (
                                                                                            <span className="text-[8px] text-green-600 font-normal">
                                                                                                +{label} ({pricePerPerson}×{occ})
                                                                                            </span>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </td>
                                                                        )
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          )}


          {/* TABLE: SEASON MODE (SINGLE SEASON, WITH CHANNELS) */}
          {activeView === 'SEASON' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
                <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 print:bg-white print:border-slate-900 print:border-b-2">
                    <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Pokój / Apartament</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-center w-32 text-xs">Pojemność</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-center w-32 text-xs">Min. Noclegi</th>
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
                    {seasonTableData.map((row, idx) => (
                    <tr key={row.room.id} className={`hover:bg-slate-50 transition-colors print:hover:bg-transparent ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="px-6 py-4 font-semibold text-slate-800 text-base">{row.room.name}</td>
                        <td className="px-6 py-4 text-center text-slate-600 flex justify-center items-center gap-1.5">
                        <Users size={16} className="text-slate-400"/>
                        <span className="font-medium">{row.room.maxOccupancy} os.</span>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-600">
                        <span className="font-medium">{selectedSeason.minNights || 2} {getNightLabel(selectedSeason.minNights || 2)}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-blue-700 text-lg bg-blue-50/30 border-l border-blue-100 print:bg-transparent print:border-none">
                        <div className="flex flex-col items-end">
                            <span>{row.directPrice} zł</span>
                            {settings.foodEnabled && (() => {
                                const foodOption = row.room.seasonalFoodOption?.[selectedSeason.id];
                                if (foodOption && foodOption !== 'none') {
                                    const pricePerPerson = foodOption === 'breakfast'
                                        ? (row.room.foodBreakfastPrice ?? 50)
                                        : (row.room.foodFullPrice ?? 100);
                                    const totalPrice = pricePerPerson * row.room.maxOccupancy;
                                    const label = foodOption === 'breakfast' ? 'Śniadanie' : 'Pełne';
                                    return (
                                        <span className="text-[10px] text-green-600 font-normal mt-0.5">
                                            +{label} ({pricePerPerson}×{row.room.maxOccupancy} = {totalPrice})
                                        </span>
                                    );
                                }
                                return null;
                            })()}
                        </div>
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
          )}

          <div className="mt-8 text-center text-slate-400 text-[10px] uppercase tracking-widest print:mt-8">
            <p>Wygenerowano w systemie Cennik Twoje Pokoje</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
