import React, { useMemo, useState } from "react";
import { Channel, GlobalSettings, RoomType, Season } from "../types";
import { generatePricingGrid } from "../utils/pricingEngine";
import { AlertCircle, CheckCircle, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
}

const Dashboard: React.FC<DashboardProps> = ({
  rooms,
  seasons,
  channels,
  settings,
}) => {
  const [occupancyFilter, setOccupancyFilter] = useState<"MAX" | number>("MAX");
  const [activeView, setActiveView] = useState<"ALL" | string>("ALL"); // 'ALL' for Direct or Channel ID

  const pricingGrid = useMemo(() => {
    return generatePricingGrid(rooms, seasons, channels, settings, occupancyFilter);
  }, [rooms, seasons, channels, settings, occupancyFilter]);

  // Transform data for charts
  const chartData = useMemo(() => {
    // Show avg direct price per season
    return seasons.map(s => {
      const seasonRows = pricingGrid.filter(r => r.seasonName === s.name);
      const avgDirect = seasonRows.reduce((acc, r) => acc + r.directPrice, 0) / (seasonRows.length || 1);
      return {
        name: s.name,
        avgDirect: Math.round(avgDirect),
      };
    });
  }, [seasons, pricingGrid]);

  const occupancyOptions = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Panel Cenowy</h2>
          <p className="text-sm text-slate-500">Analiza cen bezpośrednich i narzutów kanałów OTA</p>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto max-w-full pb-1">
           <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {occupancyOptions.map(num => (
                <button 
                  key={num}
                  onClick={() => setOccupancyFilter(num)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${occupancyFilter === num ? 'bg-white shadow text-blue-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {num} Os.
                </button>
              ))}
              <div className="w-px h-6 bg-slate-300 mx-1"></div>
              <button 
                onClick={() => setOccupancyFilter("MAX")}
                className={`px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${occupancyFilter === "MAX" ? 'bg-white shadow text-blue-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Maks.
              </button>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left: The Grid */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
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

          {/* Grid Table */}
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Typ Pokoju</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Sezon</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Os.</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider bg-blue-50">Cena Bezp.</th>
                  
                  {activeView !== "ALL" && (
                     <>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider bg-orange-50">Cena na Liście</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Prowizja</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider bg-green-50">Przychód Netto</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                     </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {pricingGrid.map((row, idx) => {
                  const channelData = activeView !== "ALL" ? row.channelCalculations[activeView] : null;
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{row.roomName}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{row.seasonName}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {row.occupancy} <Users size={10} className="ml-1"/>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-700 text-right bg-blue-50/50">
                        {row.directPrice} PLN
                      </td>
                      
                      {channelData && (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-orange-700 text-right bg-orange-50/50">
                            {channelData.listPrice} PLN
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 text-right">
                             -{Math.round(channelData.commission)}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-right bg-green-50/50 ${channelData.estimatedNet < row.directPrice ? 'text-red-600' : 'text-green-700'}`}>
                            {Math.round(channelData.estimatedNet)} PLN
                          </td>
                           <td className="px-4 py-3 whitespace-nowrap text-center">
                             {channelData.isProfitable ? (
                               <CheckCircle size={18} className="text-green-500 inline" />
                             ) : (
                               <div className="group relative inline">
                                <AlertCircle size={18} className="text-red-500 inline cursor-help" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-xs p-1 rounded whitespace-nowrap">Netto &lt; Bezp.</span>
                               </div>
                             )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Stats & Viz */}
        <div className="flex flex-col space-y-6">
          
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

          {/* Quick Logic Explainer */}
           <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 flex-1">
              <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Logika Obliczeń</h3>
              <div className="space-y-4 text-sm text-slate-600">
                <div className="p-3 bg-white rounded border border-slate-200">
                  <div className="font-semibold text-blue-700 mb-1">Cena Bezpośrednia</div>
                  <code>Baza × MnożnikSezonu {settings.defaultObp > 0 ? `- (BrakująceOs × OBP)` : ''}</code>
                </div>
                 <div className="p-3 bg-white rounded border border-slate-200">
                  <div className="font-semibold text-orange-700 mb-1">Cena w Kanale (OTA)</div>
                  <p className="mb-1 text-xs">Wyliczana wstecznie, aby:</p>
                  <code>Przychód Netto ≈ Cena Bezp.</code>
                </div>
                <div className="p-3 bg-white rounded border border-slate-200">
                  <div className="font-semibold text-green-700 mb-1">Przychód Netto</div>
                  <code>CenaListy - Zniżki - Prowizja</code>
                </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;