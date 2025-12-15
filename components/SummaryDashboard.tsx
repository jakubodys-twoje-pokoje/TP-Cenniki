
import React, { useMemo } from 'react';
import { Property, RoomType, Season, Channel, GlobalSettings } from '../types';
import { generatePricingGrid } from '../utils/pricingEngine';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Line 
} from 'recharts';
import { 
  TrendingUp, Users, Wallet, Building, Calendar, Percent, 
  ArrowUpRight, ArrowDownRight, DollarSign 
} from 'lucide-react';

interface SummaryDashboardProps {
  property: Property;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ property }) => {
  const { rooms, seasons, channels, settings } = property;

  // 1. Calculate Full Pricing Grid for Analytics
  const grid = useMemo(() => {
    return generatePricingGrid(rooms, seasons, channels, settings, "MAX");
  }, [rooms, seasons, channels, settings]);

  // 2. KPI Metrics
  const kpis = useMemo(() => {
    const totalCapacity = rooms.reduce((acc, r) => acc + r.maxOccupancy, 0);
    const avgDirectPrice = Math.round(grid.reduce((acc, r) => acc + r.directPrice, 0) / (grid.length || 1));
    
    // Calculate Max Potential Revenue (Single night full house per season average)
    const potentialPerNight = seasons.reduce((acc, s) => {
       const seasonRows = grid.filter(r => r.seasonId === s.id);
       const seasonTotal = seasonRows.reduce((sum, r) => sum + r.directPrice, 0);
       return acc + seasonTotal;
    }, 0) / seasons.length;

    const activeChannelsCount = channels.length;

    return {
      totalRooms: rooms.length,
      totalCapacity,
      avgDirectPrice,
      potentialPerNight: Math.round(potentialPerNight),
      activeChannelsCount
    };
  }, [rooms, grid, seasons, channels]);

  // 3. Chart Data: Price Evolution (Direct vs Avg Channel)
  const priceTrendData = useMemo(() => {
    return seasons.map(s => {
      const seasonRows = grid.filter(r => r.seasonId === s.id);
      const avgDirect = seasonRows.reduce((sum, r) => sum + r.directPrice, 0) / seasonRows.length;
      
      // Avg Top Channel Price (e.g. Booking)
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
        amt: Math.round(avgDirect) // for visual weighting
      };
    });
  }, [seasons, grid, channels]);

  // 4. Chart Data: Revenue Share Potential by Room Type
  const roomShareData = useMemo(() => {
      const data = rooms.map(room => {
          const roomRows = grid.filter(r => r.roomId === room.id);
          const totalVal = roomRows.reduce((sum, r) => sum + r.directPrice, 0);
          return {
              name: room.name,
              value: totalVal
          };
      });
      return data.sort((a, b) => b.value - a.value);
  }, [rooms, grid]);

  // 5. Chart Data: Channel Profitability (Net vs Commission)
  const channelProfitabilityData = useMemo(() => {
     // Calculate based on average season
     return channels.map(c => {
         const avgCommission = grid.reduce((sum, r) => {
             const calc = r.channelCalculations[c.id];
             return sum + (calc ? calc.commission : 0);
         }, 0) / grid.length;
         
         const avgNet = grid.reduce((sum, r) => {
             const calc = r.channelCalculations[c.id];
             return sum + (calc ? calc.estimatedNet : 0);
         }, 0) / grid.length;

         return {
             name: c.name,
             Netto: Math.round(avgNet),
             Prowizja: Math.round(avgCommission)
         };
     });
  }, [channels, grid]);


  return (
    <div className="space-y-6 h-full flex flex-col overflow-y-auto pr-2 pb-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Podsumowanie Obiektu</h2>
          <p className="text-slate-500">Analiza wydajności, cen i struktury przychodów dla <span className="font-semibold text-blue-600">{property.name}</span>.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm text-sm text-slate-600">
           <Calendar size={16} className="text-slate-400"/>
           <span>Sezony: <strong>{seasons.length}</strong></span>
           <span className="text-slate-300">|</span>
           <Users size={16} className="text-slate-400"/>
           <span>Pokoje: <strong>{rooms.length}</strong></span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <KpiCard 
           title="Średnia Cena (Direct)" 
           value={`${kpis.avgDirectPrice} zł`} 
           subtext="Średnia za noc w roku"
           icon={<Wallet size={24} className="text-blue-600"/>}
           bg="bg-blue-50"
           border="border-blue-100"
         />
         <KpiCard 
           title="Potencjał Przychodu" 
           value={`~${kpis.potentialPerNight} zł`} 
           subtext="Max przychód za 1 noc"
           icon={<TrendingUp size={24} className="text-emerald-600"/>}
           bg="bg-emerald-50"
           border="border-emerald-100"
         />
         <KpiCard 
           title="Całkowita Pojemność" 
           value={`${kpis.totalCapacity} os.`} 
           subtext={`W ${kpis.totalRooms} pokojach`}
           icon={<Users size={24} className="text-violet-600"/>}
           bg="bg-violet-50"
           border="border-violet-100"
         />
         <KpiCard 
           title="Aktywne Kanały" 
           value={`${kpis.activeChannelsCount}`} 
           subtext="Połączone OTA"
           icon={<Building size={24} className="text-amber-600"/>}
           bg="bg-amber-50"
           border="border-amber-100"
         />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Price Evolution Chart */}
         <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <TrendingUp size={20} className="text-blue-500"/> Dynamika Cen (Direct vs OTA)
               </h3>
               <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded">Średnie stawki sezonowe</span>
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceTrendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                     <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                     />
                     <Legend wrapperStyle={{paddingTop: '20px'}}/>
                     <Area type="monotone" dataKey="OTA" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOTA)" name="Cena OTA (Booking)" />
                     <Area type="monotone" dataKey="Direct" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDirect)" name="Twoja Cena (Direct)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Room Share Pie Chart */}
         <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
               <Percent size={20} className="text-violet-500"/> Udział w Przychodach
            </h3>
            <p className="text-xs text-slate-400 mb-6">Które pokoje generują największy potencjalny obrót?</p>
            <div className="flex-1 min-h-[250px] relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={roomShareData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        {roomShareData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                        ))}
                     </Pie>
                     <Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} />
                     <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
               </ResponsiveContainer>
               {/* Center Text */}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                  <div className="text-center">
                     <span className="block text-2xl font-bold text-slate-700">{rooms.length}</span>
                     <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider">Typy</span>
                  </div>
               </div>
            </div>
         </div>

      </div>

      {/* Secondary Charts & Room Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Channel Profitability */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
               <DollarSign size={20} className="text-emerald-500"/> Rentowność Kanałów
            </h3>
            <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelProfitabilityData} layout="vertical" margin={{left: 0}}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} />
                     <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}}/>
                     <Legend />
                     <Bar dataKey="Netto" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                     <Bar dataKey="Prowizja" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Mini Room Cards */}
         <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
             {rooms.map(room => {
                // Quick stats for room
                const roomAvgPrice = Math.round(grid.filter(r => r.roomId === room.id).reduce((s, x) => s + x.directPrice, 0) / seasons.length);
                const maxPrice = Math.max(...grid.filter(r => r.roomId === room.id).map(r => r.directPrice));
                
                return (
                   <div key={room.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-2">
                         <div>
                            <h4 className="font-bold text-slate-800">{room.name}</h4>
                            <p className="text-xs text-slate-500">Max: {room.maxOccupancy} os.</p>
                         </div>
                         <div className="bg-blue-50 text-blue-700 p-2 rounded-lg">
                            <Building size={16} />
                         </div>
                      </div>
                      <div className="flex items-end justify-between mt-2">
                         <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Średnia Cena</span>
                            <div className="text-xl font-bold text-slate-800">{roomAvgPrice} zł</div>
                         </div>
                         <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Peak Sezon</span>
                            <div className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                               <ArrowUpRight size={14}/> {maxPrice} zł
                            </div>
                         </div>
                      </div>
                   </div>
                )
             })}
         </div>

      </div>

    </div>
  );
};

// Helper Component for KPI Cards
const KpiCard = ({ title, value, subtext, icon, bg, border }: any) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
     <div className={`p-3 rounded-xl ${bg} ${border} border`}>
        {icon}
     </div>
     <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 my-0.5">{value}</h3>
        <p className="text-xs text-slate-500">{subtext}</p>
     </div>
  </div>
);

export default SummaryDashboard;
