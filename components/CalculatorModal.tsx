
import React, { useState, useMemo, useEffect } from 'react';
import { Channel, GlobalSettings, RoomType, Season } from '../types';
import { calculateChannelPrice, calculateDirectPrice } from '../utils/pricingEngine';
import { pushManualPriceUpdate } from '../utils/hotresApi';
import { X, Calculator, TrendingUp, Users, Info, Calendar, CloudUpload, Loader2, CheckCircle2 } from 'lucide-react';

interface CalculatorModalProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  onClose: () => void;
  propertyOid?: string; // Needed for sending to API
}

const CalculatorModal: React.FC<CalculatorModalProps> = ({
  rooms,
  seasons,
  channels,
  settings,
  onClose,
  propertyOid
}) => {
  // Form State
  const [targetNetInput, setTargetNetInput] = useState<number>(200);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || "");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(seasons[0]?.id || "");
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sending State
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  const maxOcc = selectedRoom?.maxOccupancy || 2;
  const currentOccupancy = maxOcc; 

  // Sync dates when season changes
  useEffect(() => {
    if (selectedSeason) {
      setStartDate(selectedSeason.startDate);
      setEndDate(selectedSeason.endDate);
    }
  }, [selectedSeasonId, seasons]);

  // --- CALCULATION LOGIC ---
  const calculationResult = useMemo(() => {
    if (!selectedRoom || !selectedSeason) return null;

    // REVERSE CALCULATION MODE
    // 1. User inputs desired Net (for Max Occupancy / Standard Rate)
    const desiredDirectPrice = targetNetInput;

    // 2. Reverse Calculate required Base Price
    // Formula: BasePrice = (TargetNet + OBP_Deduction - Food_Price) / Multiplier
    // OBP deduction at max is usually 0, but we keep logic generic if needed.
    let obpDeduction = 0;
    const isObpActive = selectedRoom.seasonalObpActive?.[selectedSeason.id] ?? true;
    const minObp = selectedRoom.minObpOccupancy || 1;
    const effectiveOcc = Math.max(currentOccupancy, minObp);

    if (settings.obpEnabled && isObpActive) {
       const missingPeople = Math.max(0, selectedRoom.maxOccupancy - effectiveOcc);
       const obpAmount = selectedRoom.obpPerPerson ?? 30;
       obpDeduction = missingPeople * obpAmount;
    }

    // Account for food pricing in reverse calculation
    // Food price is per person, so multiply by occupancy
    let foodAddition = 0;
    const seasonalFoodOption = selectedRoom.seasonalFoodOption?.[selectedSeason.id] ?? 'none';
    if ((settings.foodEnabled ?? false) && seasonalFoodOption !== 'none') {
      if (seasonalFoodOption === 'breakfast') {
        const breakfastPricePerPerson = selectedRoom.foodBreakfastPrice ?? 50;
        foodAddition = breakfastPricePerPerson * currentOccupancy;
      } else if (seasonalFoodOption === 'full') {
        const fullPricePerPerson = selectedRoom.foodFullPrice ?? 100;
        foodAddition = fullPricePerPerson * currentOccupancy;
      }
    }

    const requiredBasePriceRaw = (desiredDirectPrice + obpDeduction - foodAddition) / selectedSeason.multiplier;
    const requiredBasePrice = Math.round(requiredBasePriceRaw);

    // 3. Create Virtual Room with this Calculated Base Price
    const virtualRoom = {
        ...selectedRoom,
        seasonBasePrices: {
            ...selectedRoom.seasonBasePrices,
            [selectedSeason.id]: requiredBasePrice
        },
        basePricePeak: requiredBasePrice 
    };
    
    // 4. Calculate actual prices based on this virtual room
    // Direct Price should match targetNetInput (roughly due to rounding)
    const actualDirectPrice = calculateDirectPrice(virtualRoom, selectedSeason, currentOccupancy, settings);

    const channelResults = channels.map(channel => {
       const calc = calculateChannelPrice(actualDirectPrice, channel, selectedSeason.id);
       return {
         channel,
         calc
       };
    });

    // 5. OBP Matrix Simulation (Ladder)
    const obpLadder = [];
    for (let i = 1; i <= selectedRoom.maxOccupancy; i++) {
        const simDirectPrice = calculateDirectPrice(virtualRoom, selectedSeason, i, settings);
        
        const simChannelPrices = channels.map(c => {
            const calc = calculateChannelPrice(simDirectPrice, c, selectedSeason.id);
            return {
                id: c.id,
                name: c.name,
                color: c.color,
                listPrice: calc.listPrice,
                net: calc.estimatedNet
            };
        });

        obpLadder.push({
            occupancy: i,
            directPrice: simDirectPrice,
            channelPrices: simChannelPrices
        });
    }

    return {
      actualDirectPrice,
      requiredBasePrice,
      channelResults,
      obpLadder
    };
  }, [targetNetInput, selectedRoomId, selectedSeasonId, currentOccupancy, rooms, seasons, channels, settings]);


  const handleSendToHotres = async () => {
    if (!propertyOid || !selectedRoom || !selectedSeason || !calculationResult) return;
    
    if (!confirm(`⚠️ POTWIERDZENIE WYSYŁKI ⚠️\n\nZamierzasz wysłać ceny na okres:\n📅 ${startDate} - ${endDate}\n\nTa operacja NADPISZE ceny w Hotres. Zmiany nie zostaną zapisane w lokalnej bazie danych aplikacji.\n\nKontynuować?`)) {
        return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
        await pushManualPriceUpdate(
            propertyOid,
            selectedRoom,
            startDate,
            endDate,
            channels,
            calculationResult.obpLadder,
            selectedSeason.minNights || 1
        );
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 5000);
    } catch (err: any) {
        setSendError(err.message);
    } finally {
        setIsSending(false);
    }
  };


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

  const inputBaseClass = "w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-700 text-lg h-[50px]";

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
              <h2 className="text-lg font-bold text-slate-800">Kalkulator Ceny</h2>
              <p className="text-xs text-slate-500">Wylicz cenę bazową i wyślij szybką aktualizację do Hotres.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
           
           {/* Inputs Panel */}
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Chcę zarobić (Netto)</label>
                     <div className="relative">
                        <input 
                          type="number" 
                          min="1"
                          value={targetNetInput}
                          onChange={(e) => setTargetNetInput(Number(e.target.value))}
                          className={`${inputBaseClass} text-emerald-700 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 pl-4 pr-12`}
                        />
                        <span className="absolute right-4 top-3 text-sm text-slate-400 font-bold">PLN</span>
                     </div>
                  </div>

                  <div className="col-span-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Obiekt / Pokój</label>
                     <select 
                       value={selectedRoomId}
                       onChange={(e) => setSelectedRoomId(e.target.value)}
                       className={inputBaseClass}
                     >
                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                     </select>
                  </div>

                  <div className="col-span-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Bazuj na sezonie</label>
                     <select 
                       value={selectedSeasonId}
                       onChange={(e) => setSelectedSeasonId(e.target.value)}
                       className={inputBaseClass}
                     >
                        {seasons.map(s => <option key={s.id} value={s.id}>{s.name} (x{s.multiplier})</option>)}
                     </select>
                  </div>
               </div>

               {/* Date Range Selection for API Push */}
               <div className="border-t border-slate-200 pt-4 mt-2">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 w-full">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 flex items-center gap-1"><Calendar size={12}/> Obowiązuje od</label>
                         <input 
                           type="date" 
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                         />
                      </div>
                      <div className="flex-1 w-full">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1 flex items-center gap-1"><Calendar size={12}/> Obowiązuje do</label>
                         <input 
                           type="date" 
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                           className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                         />
                      </div>
                      <div className="w-full md:w-auto">
                         <button 
                            onClick={handleSendToHotres}
                            disabled={isSending || !propertyOid}
                            className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-all ${
                                isSending ? 'bg-slate-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 active:scale-95'
                            } ${!propertyOid ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={!propertyOid ? "Brak OID w konfiguracji" : "Wyślij ceny"}
                         >
                            {isSending ? <Loader2 size={20} className="animate-spin" /> : <CloudUpload size={20} />}
                            {isSending ? 'Wysyłanie...' : 'Wyślij do Hotres'}
                         </button>
                      </div>
                  </div>
                  {sendSuccess && (
                      <div className="mt-3 bg-green-50 text-green-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                          <CheckCircle2 size={16} /> Pomyślnie wysłano ceny do Hotres!
                      </div>
                  )}
                  {sendError && (
                      <div className="mt-3 bg-red-50 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                          <X size={16} /> Błąd: {sendError}
                      </div>
                  )}
               </div>
           </div>

           {/* Results Area */}
           {calculationResult && (
             <div className="space-y-6">
                
                {/* Full OBP Matrix */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                   <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-2 flex-wrap">
                         <div className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
                            <TrendingUp size={18} className="text-blue-600"/>
                            Symulacja Cen
                         </div>
                         <div className="h-4 w-px bg-slate-300 mx-2"></div>
                         <div className="text-sm text-slate-600">
                            Wymagana Cena Bazowa: <span className="font-bold text-lg text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 ml-1">{calculationResult.requiredBasePrice} zł</span>
                         </div>
                         {(settings.foodEnabled ?? false) && selectedRoom && (() => {
                           const foodOption = selectedRoom.seasonalFoodOption?.[selectedSeasonId];
                           if (foodOption === 'breakfast') {
                             const pricePerPerson = selectedRoom.foodBreakfastPrice ?? 50;
                             const totalPrice = pricePerPerson * currentOccupancy;
                             return (
                               <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 font-medium">
                                 +Śniadanie ({pricePerPerson} zł × {currentOccupancy} os. = {totalPrice} zł)
                               </div>
                             );
                           } else if (foodOption === 'full') {
                             const pricePerPerson = selectedRoom.foodFullPrice ?? 100;
                             const totalPrice = pricePerPerson * currentOccupancy;
                             return (
                               <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 font-medium">
                                 +Pełne ({pricePerPerson} zł × {currentOccupancy} os. = {totalPrice} zł)
                               </div>
                             );
                           }
                           return null;
                         })()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                         Góra: Cena Listowa (Brutto) • Dół: Twoje Netto
                      </div>
                   </div>
                   <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                       <thead>
                          <tr className="bg-white text-slate-500 text-xs">
                             <th className="px-4 py-3 text-left w-24 bg-slate-50/50">Obłożenie</th>
                             {calculationResult.obpLadder[0]?.channelPrices.map(c => (
                                <th key={c.id} className="px-4 py-3 text-right border-l border-slate-100" style={{color: c.color}}>{c.name}</th>
                             ))}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {calculationResult.obpLadder.map((row) => (
                             <tr key={row.occupancy} className={row.occupancy === currentOccupancy ? "bg-emerald-50/30" : "hover:bg-slate-50"}>
                                <td className="px-4 py-3 font-medium text-slate-700 flex items-center gap-2 bg-slate-50/30">
                                   <Users size={14} className="text-slate-400"/> {row.occupancy} os.
                                   {row.occupancy === currentOccupancy && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold">MAX</span>}
                                </td>
                                
                                {/* Channel Columns */}
                                {row.channelPrices.map(c => (
                                   <td key={c.id} className="px-4 py-3 text-right border-l border-slate-100">
                                      <div className="font-bold text-slate-700">{c.listPrice} zł</div>
                                      <div className={`text-[10px] font-medium mt-0.5 ${c.net < row.directPrice ? 'text-red-500' : 'text-emerald-600'}`}>
                                         Netto: {c.net}
                                      </div>
                                   </td>
                                ))}
                             </tr>
                          ))}
                       </tbody>
                    </table>
                   </div>
                </div>

                {/* Detailed Breakdown Table (For Target Occupancy Only) */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                   <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                      <span>Struktura Cen (Dla {currentOccupancy} os.)</span>
                      <span className="normal-case font-normal text-slate-400 flex items-center gap-1"><Info size={12}/> Zniżki i Prowizje</span>
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
                            {/* Channels Only */}
                            {calculationResult.channelResults.map(({ channel, calc }) => {
                                const otherDiscountsVal = calc.discountBreakdown.firstMinute + calc.discountBreakdown.lastMinute;
                                const otherDiscountsPct = calc.discountPercentages.firstMinute + calc.discountPercentages.lastMinute;

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
                </div>

             </div>
           )}

        </div>
      </div>
    </div>
  );
};

export default CalculatorModal;
