
import React, { useState, useMemo } from 'react';
import { Channel, GlobalSettings, RoomType, Season } from '../types';
import { calculateChannelPrice, calculateDirectPrice } from '../utils/pricingEngine';
import { X, Calculator, ArrowRight, TrendingUp, DollarSign, Users, ChevronDown, ChevronRight, Info } from 'lucide-react';

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
  const [isObpExpanded, setIsObpExpanded] = useState(false);

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
    const minObp = selectedRoom.minObpOccupancy || 1;
    const effectiveOcc = Math.max(currentOccupancy, minObp);

    if (settings.obpEnabled && isObpActive) {
       const missingPeople = Math.max(0, selectedRoom.maxOccupancy - effectiveOcc);
       const obpAmount = selectedRoom.obpPerPerson ?? 30;
       obpDeduction = missingPeople * obpAmount;
    }

    const requiredBasePriceRaw = (desiredDirectPrice + obpDeduction) / selectedSeason.multiplier;
    const requiredBasePrice = Math.round(requiredBasePriceRaw);

    // 3. Calculate Channel Lists based on the calculated Base Price (forward calculation for accuracy)
    // Recalculate direct price from the rounded base price to be exact
    // This handles the rounding difference.
    
    // We create a "Virtual" Room object with the calculated base price to run the engine
    const virtualRoom = {
        ...selectedRoom,
        seasonBasePrices: {
            ...selectedRoom.seasonBasePrices,
            [selectedSeason.id]: requiredBasePrice
        },
        basePricePeak: requiredBasePrice // fallback
    };
    
    // Re-calculate actual direct price resulting from this base price
    const actualDirectPrice = calculateDirectPrice(virtualRoom, selectedSeason, currentOccupancy, settings);

    const channelResults = channels.map(channel => {
       const calc = calculateChannelPrice(actualDirectPrice, channel, selectedSeason.id);
       return {
         channel,
         calc
       };
    });

    // 4. OBP Simulation (Ladder)
    const obpLadder = [];
    for (let i = 1; i <= selectedRoom.maxOccupancy; i++) {
        const simDirectPrice = calculateDirectPrice(virtualRoom, selectedSeason, i, settings);
        
        // Calculate OBP deduction for display
        let simDeduction = 0;
        if (settings.obpEnabled && isObpActive) {
            const simEffectiveOcc = Math.max(i, minObp);
            const simMissing = Math.max(0, selectedRoom.maxOccupancy - simEffectiveOcc);
            simDeduction = simMissing * (selectedRoom.obpPerPerson ?? 30);
        }

        obpLadder.push({
            occupancy: i,
            directPrice: simDirectPrice,
            deduction: simDeduction
        });
    }

    return {
      actualDirectPrice,
      requiredBasePrice,
      obpDeduction, // Deduction for the SELECTED occupancy
      channelResults,
      obpLadder
    };
  }, [targetNet, selectedRoomId, selectedSeasonId, occupancy, rooms, seasons, channels, settings]);


  const renderDiscountCell = (amount: number, percentage: number, colorClass: string, label: string) => {
      if (percentage === 0) return <td className="px-2 py-3 text-center text-slate-300">-</td>;
      return (
        <td className={`px-2 py-3 text-right text-xs`}>
            <div className={`flex flex-col items-end font-medium ${colorClass}`}>
                <span>-{amount} zł</span>
                <span className="text-[10px] opacity-70">({percentage}%)</span>
            </div>
        </td>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
               <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Kalkulator Ceny (Odwrócony)</h2>
              <p className="text-xs text-slate-500">Wpisz ile chcesz zarobić netto, a my wyliczymy cenę bazową i koszty kanałów.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
           
           {/* Inputs Panel */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="col-span-1 md:col-span-1">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cel Netto (Na rękę)</label>
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
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obłożenie (do wyliczeń)</label>
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm relative overflow-hidden">
                   <div className="absolute right-0 top-0 h-full w-2 bg-blue-600"></div>
                   <div className="flex items-center gap-4 z-10">
                      <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                         <TrendingUp size={24} />
                      </div>
                      <div>
                         <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Wynik Symulacji</h3>
                         <p className="text-sm text-blue-700 mt-1">
                            Dla celu <strong>{targetNet} zł</strong> netto przy <strong>{currentOccupancy} os.</strong>:
                         </p>
                      </div>
                   </div>
                   
                   <div className="flex gap-6 items-center">
                       <div className="text-right">
                          <div className="text-xs text-slate-500 uppercase font-semibold">Potrącenie OBP</div>
                          <div className="text-lg font-bold text-slate-600">-{calculationResult.obpDeduction} zł</div>
                       </div>
                       <div className="h-10 w-px bg-blue-200"></div>
                       <div className="text-right bg-white px-5 py-3 rounded-lg border border-blue-100 shadow-sm">
                          <div className="text-xs text-slate-500 uppercase font-semibold">Ustaw Cenę Bazową na</div>
                          <div className="text-3xl font-bold text-blue-700">{calculationResult.requiredBasePrice} zł</div>
                       </div>
                   </div>
                </div>

                {/* Direct Price & OBP Simulation Accordion */}
                <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                    <div 
                        onClick={() => setIsObpExpanded(!isObpExpanded)}
                        className="px-4 py-3 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                             <div className="p-1 bg-emerald-100 rounded text-emerald-700">
                                <Users size={16} />
                             </div>
                             <span className="font-bold text-slate-700">Symulacja OBP (Direct)</span>
                             <span className="text-xs text-slate-500 font-normal ml-2">Zobacz ceny dla innych obłożeń przy tej Bazie ({calculationResult.requiredBasePrice} zł)</span>
                        </div>
                        {isObpExpanded ? <ChevronDown size={18} className="text-slate-400"/> : <ChevronRight size={18} className="text-slate-400"/>}
                    </div>
                    
                    {isObpExpanded && (
                        <div className="p-4 bg-slate-50/50 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 mb-2 font-semibold">Jak liczona jest cena?</p>
                                    <div className="text-xs text-slate-600 space-y-1 bg-white p-2 rounded border border-slate-200">
                                        <p>1. <strong>Baza</strong> ({calculationResult.requiredBasePrice}) × <strong>Mnożnik</strong> ({selectedSeason?.multiplier}) = <strong>{Math.round(calculationResult.requiredBasePrice * (selectedSeason?.multiplier || 1))} zł</strong> (Peak)</p>
                                        <p>2. <strong>Peak</strong> - <strong>Potrącenie OBP</strong> = <strong>Cena Direct</strong></p>
                                    </div>
                                </div>
                                <div>
                                    <table className="w-full text-sm bg-white rounded border border-slate-200">
                                        <thead className="bg-slate-100 text-xs text-slate-500">
                                            <tr>
                                                <th className="px-3 py-1 text-left">Osoby</th>
                                                <th className="px-3 py-1 text-right">Potrącenie OBP</th>
                                                <th className="px-3 py-1 text-right font-bold text-blue-700">Cena Direct</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calculationResult.obpLadder.map((row) => (
                                                <tr key={row.occupancy} className={row.occupancy === currentOccupancy ? "bg-blue-50" : ""}>
                                                    <td className="px-3 py-1.5 flex items-center gap-1">
                                                        <Users size={12} className="text-slate-400"/> {row.occupancy} os.
                                                        {row.occupancy === currentOccupancy && <span className="text-[9px] bg-blue-600 text-white px-1 rounded ml-1">TERAZ</span>}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-slate-500">-{row.deduction} zł</td>
                                                    <td className="px-3 py-1.5 text-right font-bold text-blue-700">{row.directPrice} zł</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Channels Breakdown Table */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                   <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                      <span>Szczegóły dla Kanałów OTA</span>
                      <span className="normal-case font-normal text-slate-400 flex items-center gap-1"><Info size={12}/> Obliczone dla {currentOccupancy} os.</span>
                   </div>
                   <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                        <thead className="bg-white text-slate-500">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Kanał</th>
                                <th className="px-2 py-3 text-right font-semibold text-orange-600 bg-orange-50/30">Cena Listowa</th>
                                <th className="px-2 py-3 text-right font-semibold text-blue-600 w-20">Mobile</th>
                                <th className="px-2 py-3 text-right font-semibold text-purple-600 w-20">Genius</th>
                                <th className="px-2 py-3 text-right font-semibold text-green-600 w-20">Sezon</th>
                                <th className="px-2 py-3 text-right font-semibold text-amber-600 w-20">Inne</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Prowizja</th>
                                <th className="px-4 py-3 text-right font-semibold text-emerald-600 bg-emerald-50/30">Twoje Netto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {/* Direct Row */}
                            <tr className="bg-blue-50/10">
                                <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Direct / WWW
                                </td>
                                <td className="px-2 py-3 text-right font-bold text-orange-600 opacity-50 bg-orange-50/10">-</td>
                                <td colSpan={4} className="text-center text-slate-300 text-xs">- brak zniżek OTA -</td>
                                <td className="px-4 py-3 text-right text-slate-400">0 zł</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-600 bg-emerald-50/10 text-lg">{calculationResult.actualDirectPrice} zł</td>
                            </tr>
                            
                            {/* Channels */}
                            {calculationResult.channelResults.map(({ channel, calc }) => {
                                const otherDiscountsVal = calc.discountBreakdown.firstMinute + calc.discountBreakdown.lastMinute;
                                const otherDiscountsPct = calc.discountPercentages.firstMinute + calc.discountPercentages.lastMinute; // Approx sum for display

                                return (
                                <tr key={channel.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{backgroundColor: channel.color}}></span>
                                        {channel.name}
                                    </td>
                                    <td className="px-2 py-3 text-right font-bold text-orange-600 text-lg bg-orange-50/30">
                                        {calc.listPrice} zł
                                    </td>
                                    
                                    {renderDiscountCell(calc.discountBreakdown.mobile, calc.discountPercentages.mobile, 'text-blue-600', 'Mobile')}
                                    {renderDiscountCell(calc.discountBreakdown.genius, calc.discountPercentages.genius, 'text-purple-600', 'Genius')}
                                    {renderDiscountCell(calc.discountBreakdown.seasonal, calc.discountPercentages.seasonal, 'text-green-600', 'Sezon')}
                                    {renderDiscountCell(otherDiscountsVal, otherDiscountsPct, 'text-amber-600', 'Inne')}

                                    <td className="px-4 py-3 text-right text-slate-500">
                                        <div className="flex flex-col items-end">
                                            <span>-{calc.commission} zł</span>
                                            <span className="text-[10px] opacity-70">({channel.commissionPct}%)</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-600 text-lg bg-emerald-50/30">
                                        {calc.estimatedNet} zł
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                   </div>
                   <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-center">
                      Ceny na liście są sztucznie zawyżane, aby po odjęciu wszystkich zniżek i prowizji dać Twoje Netto.
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
