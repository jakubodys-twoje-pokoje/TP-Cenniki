
import React, { useMemo, useState } from 'react';
import { Property, RoomType, Season, Channel, GlobalSettings, ChannelCalculation } from '../types';
import { generatePricingGrid } from '../utils/pricingEngine';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Line 
} from 'recharts';
import { 
  TrendingUp, Users, Wallet, Building, Calendar, Percent, 
  ArrowUpRight, ArrowDownRight, DollarSign, Filter, BedDouble, Layers 
} from 'lucide-react';

interface SummaryDashboardProps {
  property: Property;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ property }) => {
  const { rooms, seasons, channels, settings } = property;

  // Filters State
  const [filterRoomId, setFilterRoomId] = useState<string>("ALL");
  const [filterSeasonId, setFilterSeasonId] = useState<string>("ALL");

  // 1. Calculate Full Pricing Grid (Base for everything)
  const fullGrid = useMemo(() => {
    return generatePricingGrid(rooms, seasons, channels, settings, "MAX");
  }, [rooms, seasons, channels, settings]);

  // 2. Filter Grid based on selection
  const filteredGrid = useMemo(() => {
    return fullGrid.filter(row => {
      const matchRoom = filterRoomId === "ALL" || row.roomId === filterRoomId;
      const matchSeason = filterSeasonId === "ALL" || row.seasonId === filterSeasonId;
      return matchRoom && matchSeason;
    });
  }, [fullGrid, filterRoomId, filterSeasonId]);

  // 3. KPI Metrics (Dynamic based on filter)
  const kpis = useMemo(() => {
    // Unique rooms/seasons in the filtered view
    const activeRooms = new Set(filteredGrid.map(r => r.roomId)).size;
    const activeSeasons = new Set(filteredGrid.map(r => r.seasonId)).size;
    
    // Total Potential Revenue (Sum of direct prices in view)
    // Note: If viewing ALL seasons, this is sum of 1 night per season. 
    // It's an abstract metric of "Power".
    const totalPotential = filteredGrid.reduce((sum, r) => sum + r.directPrice, 0);
    
    // Average Daily Rate (ADR)
    const avgDirectPrice = Math.round(totalPotential / (filteredGrid.length || 1));

    // Occupancy (Avg of available data points)
    const occupancyPoints = filteredGrid.filter(r => r.occupancyRate !== undefined);
    const avgOccupancy = occupancyPoints.length > 0
        ? Math.round(occupancyPoints.reduce((sum, r) => sum + (r.occupancyRate || 0), 0) / occupancyPoints.length)
        : 0;

    return {
      activeCount: filterRoomId === 'ALL' ? activeRooms : activeSeasons, // Context aware counter
      activeLabel: filterRoomId === 'ALL' ? 'Pokoje' : 'Sezony',
      avgDirectPrice,
      totalPotential, // Used for relative scale
      avgOccupancy,
      hasOccupancyData: occupancyPoints.length > 0
    };
  }, [filteredGrid, filterRoomId, filterSeasonId]);

  // 4. Chart: Price Trend (Grouped by Season)
  const trendData = useMemo(() => {
     // If a specific season is selected, showing a trend line over time is moot unless we show day-by-day (which we don't have here).
     // So we show breakdown by Room if Season is selected, or breakdown by Season if ALL seasons.
     
     if (filterSeasonId !== 'ALL') {
         // View: Single Season -> Show Prices per Room
         return rooms
           .filter(r => filterRoomId === 'ALL' || r.id === filterRoomId)
           .map(room => {
               const row = filteredGrid.find(r => r.roomId === room.id);
               if (!row) return null;
               
               // Booking Price
               const bookingChannel = channels.find(c => c.id.includes('booking')) || channels[0];
               const bookingPrice = row.channelCalculations[bookingChannel?.id || '']?.listPrice || 0;

               return {
                   name: room.name,
                   Direct: row.directPrice,
                   OTA: bookingPrice,
                   amt: row.directPrice
               };
           }).filter(Boolean);
     } else {
         // View: All Seasons -> Show Avg Price per Season
         return seasons.map(s => {
             const seasonRows = filteredGrid.filter(r => r.seasonId === s.id);
             if (seasonRows.length === 0) return null;

             const avgDirect = seasonRows.reduce((sum, r) => sum + r.directPrice, 0) / seasonRows.length;
             
             // Avg OTA
             const bookingChannel = channels.find(c => c.id.includes('booking')) || channels[0];
             let avgChannel = 0;
             if (bookingChannel) {
                 avgChannel = seasonRows.reduce((sum, r) => {
                     const calc = r.channelCalculations[bookingChannel.id];
                     return sum + (calc ? calc.listPrice : 0);
                 }, 0) / seasonRows.length;
             }

             return {
                 name: s.name,
                 Direct: Math.round(avgDirect),
                 OTA: Math.round(avgChannel),
                 amt: Math.round(avgDirect)
             };
         }).filter(Boolean);
     }
  }, [filteredGrid, seasons, rooms, channels, filterSeasonId, filterRoomId]);

  // 5. Chart: Revenue/Value Share (Pie Chart)
  // If Room Filter is ALL -> Show share by Room Type
  // If Room Filter is SET -> Show share by Season (When does this room earn most?)
  const shareData = useMemo(() => {
      if (filterRoomId === 'ALL') {
          // By Room
          const data = rooms.map(room => {
              const roomRows = filteredGrid.filter(r => r.roomId === room.id);
              const val = roomRows.reduce((sum, r) => sum + r.directPrice, 0);
              return { name: room.name, value: val };
          });
          return data.sort((a, b) => b.value - a.value);
      } else {
          // By Season (for selected room)
          const data = seasons.map(s => {
              const rows = filteredGrid.filter(r => r.seasonId === s.id);
              const val = rows.reduce((sum, r) => sum + r.directPrice, 0);
              return { name: s.name, value: val };
          });
          return data.filter(d => d.value > 0);
      }
  }, [rooms, seasons, filteredGrid, filterRoomId]);

  // 6. Chart: Occupancy (Bar Chart)
  const occupancyData = useMemo(() => {
     if (filterSeasonId !== 'ALL') {
         // Breakdown by Room for this Season
         return rooms
            .filter(r => filterRoomId === 'ALL' || r.id === filterRoomId)
            .map(room => {
                const row = filteredGrid.find(r => r.roomId === room.id);
                return {
                    name: room.name,
                    rate: row?.occupancyRate || 0
                };
            });
     } else {
         // Breakdown by Season
         return seasons.map(s => {
             const seasonRows = filteredGrid.filter(r => r.seasonId === s.id);
             if (seasonRows.length === 0) return { name: s.name, rate: 0 };
             const validRows = seasonRows.filter(r => r.occupancyRate !== undefined);
             const avg = validRows.length > 0 
                ? validRows.reduce((sum, r) => sum + (r.occupancyRate || 0), 0) / validRows.length 
                : 0;
             return { name: s.name, rate: Math.round(avg) };
         });
     }
  }, [filteredGrid, seasons, rooms, filterSeasonId, filterRoomId]);


  return (
    <div className="space-y-6 h-full flex flex-col overflow-y-auto pr-2 pb-6">
      
      {/* Top Bar: Header & Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Podsumowanie & Analityka</h2>
          <p className="text-sm text-slate-500 hidden sm:block">Analiza potencjału przychodowego i obłożenia.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
             {/* Room Filter */}
             <div className="relative group flex-1 xl:flex-none">
                <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><BedDouble size={16}/></div>
                <select 
                    value={filterRoomId}
                    onChange={(e) => setFilterRoomId(e.target.value)}
                    className="w-full xl:w-48 pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-colors cursor-pointer outline-none"
                >
                    <option value="ALL">Wszystkie Pokoje</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"><ChevronDownIcon /></div>
             </div>

             {/* Season Filter */}
             <div className="relative group flex-1 xl:flex-none">
                <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><Calendar size={16}/></div>
                <select 
                    value={filterSeasonId}
                    onChange={(e) => setFilterSeasonId(e.target.value)}
                    className="w-full xl:w-48 pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-colors cursor-pointer outline-none"
                >
                    <option value="ALL">Wszystkie Sezony</option>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"><ChevronDownIcon /></div>
             </div>
             
             {/* Reset Filter Button */}
             {(filterRoomId !== "ALL" || filterSeasonId !== "ALL") && (
                 <button 
                    onClick={() => { setFilterRoomId("ALL"); setFilterSeasonId("ALL"); }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                    title="Resetuj filtry"
                 >
                    <Filter size={16} className="text-slate-500" />
                 </button>
             )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <KpiCard 
           title="Średnia Cena (Direct)" 
           value={`${kpis.avgDirectPrice} zł`} 
           subtext="Średnia dla wybranego widoku"
           icon={<Wallet size={24} className="text-blue-600"/>}
           bg="bg-blue-50"
           border="border-blue-100"
         />
         <KpiCard 
           title="Obłożenie (Hotres)" 
           value={kpis.hasOccupancyData ? `${kpis.avgOccupancy}%` : '-'} 
           subtext={kpis.hasOccupancyData ? "Średnia z pobranych danych" : "Wymaga synchronizacji"}
           icon={<Users size={24} className={kpis.hasOccupancyData ? "text-violet-600" : "text-slate-400"}/>}
           bg={kpis.hasOccupancyData ? "bg-violet-50" : "bg-slate-50"}
           border={kpis.hasOccupancyData ? "border-violet-100" : "border-slate-200"}
         />
         <KpiCard 
           title="Wartość Cennika" 
           value={`~${kpis.totalPotential.toLocaleString()} zł`} 
           subtext="Suma stawek (1 noc)"
           icon={<TrendingUp size={24} className="text-emerald-600"/>}
           bg="bg-emerald-50"
           border="border-emerald-100"
         />
         <KpiCard 
           title={kpis.activeLabel} 
           value={`${kpis.activeCount}`} 
           subtext="W aktualnym filtrze"
           icon={<Layers size={24} className="text-amber-600"/>}
           bg="bg-amber-50"
           border="border-amber-100"
         />
      </div>

      {/* Row 1: Trends & Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Price Trend Chart */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <DollarSign size={20} className="text-blue-500"/> 
                 {filterSeasonId === 'ALL' ? 'Dynamika Cen (Sezony)' : 'Analiza Cen Pokoi'}
               </h3>
               {filterSeasonId === 'ALL' && <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded">Średnia OTA vs Direct</span>}
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorDirect" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorOTA" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} interval={0} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                     <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                     />
                     <Legend wrapperStyle={{paddingTop: '10px'}}/>
                     <Area type="monotone" dataKey="OTA" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOTA)" name="Cena OTA" />
                     <Area type="monotone" dataKey="Direct" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDirect)" name="Cena Direct" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Occupancy Chart */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <Users size={20} className="text-violet-500"/> 
                 {filterSeasonId === 'ALL' ? 'Obłożenie (Sezony)' : 'Obłożenie Pokoi'}
               </h3>
               {!kpis.hasOccupancyData && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded flex items-center gap-1"><ArrowDownRight size={12}/> Brak danych</span>}
            </div>
            {kpis.hasOccupancyData ? (
                <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={occupancyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} unit="%" domain={[0, 100]}/>
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="rate" name="Obłożenie %" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40}>
                            {occupancyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.rate > 80 ? '#10b981' : entry.rate > 50 ? '#8b5cf6' : '#94a3b8'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Building size={48} className="opacity-20 mb-2"/>
                    <p className="font-medium">Brak danych o obłożeniu</p>
                    <p className="text-xs mt-1">Kliknij "Synchronizuj Dostępność" w panelu głównym.</p>
                </div>
            )}
         </div>

      </div>

      {/* Row 2: Pie Chart & Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Revenue Share Pie Chart - IMPROVED STYLE */}
         <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-[400px]">
            <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
               <Percent size={20} className="text-pink-500"/> Struktura Przychodów
            </h3>
            <p className="text-xs text-slate-400 mb-6">
                {filterRoomId === 'ALL' 
                 ? "Udział poszczególnych pokoi w potencjalnym przychodzie."
                 : `Udział sezonów w przychodzie pokoju ${rooms.find(r => r.id === filterRoomId)?.name}.`
                }
            </p>
            <div className="flex-1 relative">
               <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                  <PieChart>
                     <Pie
                        data={shareData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        {shareData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                        ))}
                     </Pie>
                     <Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} formatter={(value: number) => `${value} zł`} />
                     {/* Legend Moved Bottom for stability */}
                     <Legend 
                        verticalAlign="bottom" 
                        height={80} 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: '11px', overflowY: 'auto' }}
                     />
                  </PieChart>
               </ResponsiveContainer>
               {/* Center Text */}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-16">
                  <div className="text-center">
                     <span className="block text-2xl font-bold text-slate-700">{shareData.length}</span>
                     <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                         {filterRoomId === 'ALL' ? 'Pokoje' : 'Sezony'}
                     </span>
                  </div>
               </div>
            </div>
         </div>

        {/* Filtered Grid - Mini List */}
         <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ArrowUpRight size={20} className="text-indigo-500"/> 
                    Top Wyniki (Wg Ceny)
                </h3>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-xs uppercase">Pokój</th>
                            <th className="px-6 py-3 text-xs uppercase">Sezon</th>
                            <th className="px-6 py-3 text-right text-xs uppercase text-blue-600">Direct</th>
                            <th className="px-6 py-3 text-right text-xs uppercase text-emerald-600">Netto (Est.)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {/* Show top 10 most expensive rows in current filter */}
                        {[...filteredGrid].sort((a,b) => b.directPrice - a.directPrice).slice(0, 8).map((row, idx) => {
                             // Estimate avg net from channels
                             // Cast Object.values result to ensure types
                             const vals = Object.values(row.channelCalculations) as ChannelCalculation[];
                             const avgNet = vals.reduce((sum, c) => sum + c.estimatedNet, 0) / (channels.length || 1);
                             return (
                                <tr key={`${row.roomId}-${row.seasonId}`} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-700">{row.roomName}</td>
                                    <td className="px-6 py-3 text-slate-500 text-xs">{row.seasonName}</td>
                                    <td className="px-6 py-3 text-right font-bold text-blue-700 bg-blue-50/20">{row.directPrice} zł</td>
                                    <td className="px-6 py-3 text-right font-medium text-emerald-600">{Math.round(avgNet)} zł</td>
                                </tr>
                             )
                        })}
                        {filteredGrid.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">Brak danych dla wybranych filtrów.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
         </div>

      </div>

    </div>
  );
};

// Helper Component for KPI Cards
const KpiCard = ({ title, value, subtext, icon, bg, border }: any) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
     <div className={`p-3 rounded-xl ${bg} ${border} border flex-shrink-0`}>
        {icon}
     </div>
     <div className="min-w-0">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 my-0.5 truncate">{value}</h3>
        <p className="text-xs text-slate-500 truncate">{subtext}</p>
     </div>
  </div>
);

// Simple chevron for selects
const ChevronDownIcon = () => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L5 5L9 1" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

export default SummaryDashboard;
