
import React, { useState, useMemo } from 'react';
import { Channel, GlobalSettings, RoomType, Season } from '../types';
import { calculateChannelPrice } from '../utils/pricingEngine';
import { X, Calculator, ArrowRight, TrendingUp, DollarSign, Users } from 'lucide-react';

interface CalculatorModalProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  onClose: () => void;
}

const CalculatorModal: React.FC<CalculatorModalProps> = ({
  rooms,
  seasons,
  channels,
  settings,
  onClose
}) => {
  // Form State
  const [targetNet, setTargetNet] = useState<number>(200);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || "");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(seasons[0]?.id || "");
  const [occupancy, setOccupancy] = useState<number | "MAX">("MAX");

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  // Determine Max Occupancy for selector
  const maxOcc = selectedRoom?.maxOccupancy || 2;
  const currentOccupancy = occupancy === "MAX" ? maxOcc : occupancy;

  // --- CALCULATION LOGIC ---
  const calculationResult = useMemo(() => {
    if (!selectedRoom || !selectedSeason) return null;

    // 1. Direct Price Target
    // We assume the user wants 'TargetNet' specifically for the Direct channel first.
    // In our logic: Direct Price = Target Net (since direct has 0 commission).
    const desiredDirectPrice = targetNet;

    // 2. Reverse Calculate Base Price
    // Formula: DirectPrice = (BasePrice * Multiplier) - OBP_Deduction
    // Therefore: BasePrice = (DirectPrice + OBP_Deduction) / Multiplier
    
    let obpDeduction = 0;
    const isObpActive = selectedRoom.seasonalObpActive?.[selectedSeason.id] ?? true;

    if (settings.obpEnabled && isObpActive) {
       const minObp = selectedRoom.minObpOccupancy || 1;
       const effectiveOcc = Math.max(currentOccupancy, minObp);
       const missingPeople = Math.max(0, selectedRoom.maxOccupancy - effectiveOcc);
       const obpAmount = selectedRoom.obpPerPerson ?? 30;
       obpDeduction = missingPeople * obpAmount;
    }

    const requiredBasePrice = (desiredDirectPrice + obpDeduction) / selectedSeason.multiplier;

    // 3. Calculate Channel Lists
    // We use the existing 'calculateChannelPrice' which takes a DirectPrice (Net Target for Channel) 
    // and inflates it to cover commissions and discounts.
    const channelResults = channels.map(channel => {
       const calc = calculateChannelPrice(desiredDirectPrice, channel, selectedSeason.id);
       return {
         channel,
         calc
       };
    });

    return {
      desiredDirectPrice,
      requiredBasePrice: Math.round(requiredBasePrice),
      obpDeduction,
      channelResults
    };
  }, [targetNet, selectedRoomId, selectedSeasonId, occupancy, rooms, seasons, channels, settings]);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
               <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Szybki Kalkulator (Odwrócony)</h2>
              <p className="text-xs text-slate-500">Wpisz ile chcesz zarobić na rękę, a my policzymy ceny dla kanałów.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
           
           {/* Inputs Panel */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="col-span-1 md:col-span-1">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kwota Netto (Na rękę)</label>
                 <div className="relative">
                    <input 
                      type="number" 
                      min="1"
                      value={targetNet}
                      onChange={(e) => setTargetNet(Number(e.target.value))}
                      className="w-full pl-3 pr-8 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold text-emerald-700 text-lg"
                    />
                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">PLN</span>
                 </div>
              </div>

              <div className="col-span-1 md:col-span-1">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obiekt / Pokój</label>
                 <select 
                   value={selectedRoomId}
                   onChange={(e) => setSelectedRoomId(e.target.value)}
                   className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-blue-500 text-sm"
                 >
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                 </select>
              </div>

              <div className="col-span-1 md:col-span-1">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sezon</label>
                 <select 
                   value={selectedSeasonId}
                   onChange={(e) => setSelectedSeasonId(e.target.value)}
                   className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-blue-500 text-sm"
                 >
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name} (x{s.multiplier})</option>)}
                 </select>
              </div>

              <div className="col-span-1 md:col-span-1">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obłożenie</label>
                 <select 
                   value={occupancy}
                   onChange={(e) => setOccupancy(e.target.value === "MAX" ? "MAX" : Number(e.target.value))}
                   className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-blue-500 text-sm"
                 >
                    <option value="MAX">Maksymalne ({maxOcc} os.)</option>
                    {Array.from({length: maxOcc}, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n} os.</option>
                    ))}
                 </select>
              </div>
           </div>

           {/* Results Area */}
           {calculationResult && (
             <div className="space-y-6">
                
                {/* Main Suggestion Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                         <TrendingUp size={24} />
                      </div>
                      <div>
                         <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Sugerowana Konfiguracja</h3>
                         <p className="text-sm text-blue-700 mt-1">
                            Aby uzyskać <strong>{targetNet} zł</strong> netto przy obłożeniu <strong>{currentOccupancy} os.</strong> w sezonie <strong>{selectedSeason?.name}</strong>:
                         </p>
                      </div>
                   </div>
                   <div className="text-right bg-white px-5 py-3 rounded-lg border border-blue-100 shadow-sm">
                      <div className="text-xs text-slate-500 uppercase font-semibold">Ustaw Cenę Bazową na</div>
                      <div className="text-2xl font-bold text-blue-700">{calculationResult.requiredBasePrice} zł</div>
                   </div>
                </div>

                {/* Channels Breakdown Table */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                   <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                      Wyniki dla Kanałów (OTA)
                   </div>
                   <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-white text-slate-500">
                         <tr>
                            <th className="px-4 py-3 text-left font-semibold">Kanał</th>
                            <th className="px-4 py-3 text-right font-semibold text-orange-600">Cena na Liście (Brutto)</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-500">Prowizja</th>
                            <th className="px-4 py-3 text-right font-semibold text-emerald-600">Twoje Netto</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {/* Direct Row */}
                         <tr className="bg-blue-50/10">
                            <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                               <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                               Direct (Strona WWW)
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-orange-600 opacity-50">-</td>
                            <td className="px-4 py-3 text-right text-slate-400">0 zł</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{calculationResult.desiredDirectPrice} zł</td>
                         </tr>
                         
                         {/* Channels */}
                         {calculationResult.channelResults.map(({ channel, calc }) => (
                            <tr key={channel.id} className="hover:bg-slate-50">
                               <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{backgroundColor: channel.color}}></span>
                                  {channel.name}
                               </td>
                               <td className="px-4 py-3 text-right font-bold text-orange-600 text-lg">
                                  {calc.listPrice} zł
                               </td>
                               <td className="px-4 py-3 text-right text-slate-500">
                                  -{calc.commission} zł <span className="text-xs text-slate-400">({channel.commissionPct}%)</span>
                               </td>
                               <td className="px-4 py-3 text-right font-bold text-emerald-600 text-lg">
                                  {calc.estimatedNet} zł
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                   <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-center">
                      Ceny na liście uwzględniają narzuty potrzebne na pokrycie zniżek (np. Genius, Mobile) i prowizji.
                   </div>
                </div>

             </div>
           )}

        </div>
      </div>
    </div>
  );
};

export default CalculatorModal;
