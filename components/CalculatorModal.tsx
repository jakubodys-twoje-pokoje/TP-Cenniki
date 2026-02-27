
import React, { useState, useMemo, useEffect } from 'react';
import { Channel, GlobalSettings, RoomType, Season } from '../types';
import { calculateChannelPrice, calculateDirectPrice } from '../utils/pricingEngine';
import { pushMultipleSnapshotsToHotres } from '../utils/hotresApi';
import { X, Calculator, TrendingUp, Users, Info, Calendar, CloudUpload, Loader2, CheckCircle2, Save } from 'lucide-react';

interface CalculatorModalProps {
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  onClose: () => void;
  propertyOid?: string; // Needed for sending to API
  onSaveToSeasons?: (snapshots: {
    seasonId: string;
    startDate: string;
    endDate: string;
    minNights: number;
    roomIds: string[];
    obpLadder: { occupancy: number, directPrice: number, channelPrices: { id: string, listPrice: number }[] }[];
  }[]) => void; // Callback to save snapshots: update season dates + set manual prices for rooms
}

const CalculatorModal: React.FC<CalculatorModalProps> = ({
  rooms,
  seasons,
  channels,
  settings,
  onClose,
  propertyOid,
  onSaveToSeasons
}) => {
  // Form State
  const [targetNetInput, setTargetNetInput] = useState<number>(200);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(rooms[0] ? [rooms[0].id] : []);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(seasons[0]?.id || "");

  // Snapshot-based Date Ranges State
  // Each range is a snapshot of: rooms, prices, dates
  const [dateRanges, setDateRanges] = useState<{
    id: string,
    startDate: string,
    endDate: string,
    minNights: number,
    roomIds: string[],  // Which rooms for THIS range
    targetNet: number,  // What net price was calculated
    obpLadder: { occupancy: number, directPrice: number, channelPrices: { id: string, name: string, color: string, listPrice: number, net: number }[] }[],
    seasonId: string,
    seasonName: string
  }[]>([]);

  // Temporary inputs for adding new range
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempMinNights, setTempMinNights] = useState<number>(1);

  // Food pricing toggle for calculator
  const [includeFoodPricing, setIncludeFoodPricing] = useState(true);

  // Sending State
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Use first selected room for calculation preview
  const selectedRoom = rooms.find(r => r.id === selectedRoomIds[0]);
  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRoomIds(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const maxOcc = selectedRoom?.maxOccupancy || 2;
  const currentOccupancy = maxOcc; 

  // Sync temporary dates when season changes
  useEffect(() => {
    if (selectedSeason) {
      setTempStartDate(selectedSeason.startDate);
      setTempEndDate(selectedSeason.endDate);
      setTempMinNights(selectedSeason.minNights || 1);
    }
  }, [selectedSeasonId, seasons]);

  // Functions for managing date ranges (snapshot-based)
  const addDateRange = () => {
    if (!tempStartDate || !tempEndDate) {
      alert("Wypełnij daty rozpoczęcia i zakończenia.");
      return;
    }
    if (tempStartDate > tempEndDate) {
      alert("Data rozpoczęcia nie może być późniejsza niż data zakończenia.");
      return;
    }
    if (selectedRoomIds.length === 0) {
      alert("Wybierz przynajmniej jeden pokój.");
      return;
    }
    if (!calculationResult) {
      alert("Wylicz cenę przed dodaniem zakresu.");
      return;
    }
    if (!selectedSeason) {
      alert("Wybierz sezon.");
      return;
    }

    // Create snapshot of current state
    const newRange = {
      id: Date.now().toString(),
      startDate: tempStartDate,
      endDate: tempEndDate,
      minNights: tempMinNights,
      roomIds: [...selectedRoomIds],  // Snapshot of selected rooms
      targetNet: targetNetInput,
      obpLadder: calculationResult.obpLadder,  // Snapshot of calculated prices
      seasonId: selectedSeasonId,
      seasonName: selectedSeason.name
    };
    setDateRanges([...dateRanges, newRange]);
  };

  const removeDateRange = (id: string) => {
    setDateRanges(dateRanges.filter(r => r.id !== id));
  };

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
    // When toggle is OFF: subtract food from calculation (user wants net WITHOUT food costs)
    // When toggle is ON: don't subtract (user wants food cost added to final price)
    let foodDeduction = 0;
    const seasonalFoodOption = selectedRoom.seasonalFoodOption?.[selectedSeason.id] ?? 'none';
    if (!includeFoodPricing && (settings.foodEnabled ?? false) && seasonalFoodOption !== 'none') {
      // Only deduct food cost if toggle is OFF
      if (seasonalFoodOption === 'breakfast') {
        const breakfastPricePerPerson = selectedRoom.foodBreakfastPrice ?? 50;
        foodDeduction = breakfastPricePerPerson * currentOccupancy;
      } else if (seasonalFoodOption === 'full') {
        const fullPricePerPerson = selectedRoom.foodFullPrice ?? 100;
        foodDeduction = fullPricePerPerson * currentOccupancy;
      }
    }

    const requiredBasePriceRaw = (desiredDirectPrice + obpDeduction - foodDeduction) / selectedSeason.multiplier;
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
    // IMPORTANT: Pass false to ignore manual prices in calculator
    const actualDirectPrice = calculateDirectPrice(virtualRoom, selectedSeason, currentOccupancy, settings, false);

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
        // IMPORTANT: Pass false to ignore manual prices in calculator
        const simDirectPrice = calculateDirectPrice(virtualRoom, selectedSeason, i, settings, false);
        
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
  }, [targetNetInput, selectedRoomIds, selectedSeasonId, currentOccupancy, rooms, seasons, channels, settings, includeFoodPricing]);


  const handleSendToHotres = async () => {
    if (!propertyOid) return;

    if (dateRanges.length === 0) {
      alert("Dodaj przynajmniej jeden zakres dat przed wysłaniem.");
      return;
    }

    // Build confirmation message with all snapshots
    const rangesText = dateRanges.map((r, idx) => {
      const roomNamesForRange = rooms.filter(room => r.roomIds.includes(room.id)).map(room => room.name).join(', ');
      return `${idx + 1}. ${roomNamesForRange}\n   📅 ${r.startDate} - ${r.endDate} (min ${r.minNights} nocy)\n   💰 Netto: ${r.targetNet} zł | Sezon: ${r.seasonName}`;
    }).join('\n\n');

    // Calculate unique rooms count
    const uniqueRoomIds = new Set(dateRanges.flatMap(r => r.roomIds));

    // Count payload items (room×channel combinations)
    const roomsWithTid = rooms.filter(r => uniqueRoomIds.has(r.id) && r.tid);
    const channelsWithRid = channels.filter(c => c.rid && c.rid.trim() !== "");
    const estimatedPayloadSize = roomsWithTid.length * channelsWithRid.length;

    if (!confirm(`⚠️ POTWIERDZENIE WYSYŁKI ⚠️\n\nZamierzasz wysłać ${dateRanges.length} różnych konfiguracji dla ${uniqueRoomIds.size} pokoi:\n\n${rangesText}\n\nTa operacja NADPISZE ceny w Hotres.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Optymalizacja: 1 HTTP request\n⚠️  Hotres API cost: ~2-5 "calls" (varies)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nKontynuować?`)) {
        return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
        // Send ALL snapshots in ONE request (optimized!)
        await pushMultipleSnapshotsToHotres(
            propertyOid,
            dateRanges,
            rooms,
            channels
        );
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 5000);
    } catch (err: any) {
        setSendError(err.message);
    } finally {
        setIsSending(false);
    }
  };

  const handleApplyToSeasons = () => {
    if (!onSaveToSeasons) {
      alert("Funkcja nie jest dostępna.");
      return;
    }

    if (dateRanges.length === 0) {
      alert("Dodaj przynajmniej jeden zakres dat przed zapisem.");
      return;
    }

    // Build confirmation message
    const rangesText = dateRanges.map((r, idx) => {
      const roomNamesForRange = rooms.filter(room => r.roomIds.includes(room.id)).map(room => room.name).join(', ');
      return `${idx + 1}. ${r.seasonName}\n   📅 ${r.startDate} - ${r.endDate} (min ${r.minNights} nocy)\n   🏠 ${roomNamesForRange}`;
    }).join('\n\n');

    if (!confirm(`✏️ NAŁÓŻ NA SEZON\n\nNadpiszesz ceny Direct dla ${dateRanges.length} ${dateRanges.length === 1 ? 'sezonu' : dateRanges.length <= 4 ? 'sezonów' : 'sezonów'}:\n\n${rangesText}\n\nCeny zostaną zapisane jako ręczne dla wybranych pokoi.\n\nKontynuować?`)) {
      return;
    }

    try {
      // Pass full snapshot data to handler
      const snapshotsToSave = dateRanges.map(snapshot => ({
        seasonId: snapshot.seasonId,
        startDate: snapshot.startDate,
        endDate: snapshot.endDate,
        minNights: snapshot.minNights,
        roomIds: snapshot.roomIds,
        obpLadder: snapshot.obpLadder
      }));

      onSaveToSeasons(snapshotsToSave);

      // Clear date ranges after successful save
      setDateRanges([]);

      alert(`✅ Nałożono ceny na ${dateRanges.length} ${dateRanges.length === 1 ? 'sezon' : dateRanges.length <= 4 ? 'sezony' : 'sezonów'}!\n\nWyślij cennik do Hotres z Settings → "Wyślij cały cennik".`);
    } catch (err: any) {
      alert(`Błąd podczas zapisu: ${err.message}`);
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
                  <div className="col-span-1 space-y-3">
                     <div>
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

                     {/* Food Pricing Toggle - under target net input */}
                     <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors">
                       <input
                         type="checkbox"
                         checked={includeFoodPricing}
                         onChange={(e) => setIncludeFoodPricing(e.target.checked)}
                         className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                       />
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-700">Uwzględnij wyżywienie</span>
                         <span className="text-[10px] text-slate-500">Jeśli skonfigurowane</span>
                       </div>
                     </label>

                     {/* Direct Price Display */}
                     {calculationResult && (
                       <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cena Direct</label>
                         <div className="flex flex-col gap-1">
                           <div className="text-2xl font-bold text-blue-700">
                             {calculationResult.actualDirectPrice} zł
                           </div>
                           {includeFoodPricing && selectedRoom && selectedSeason && (() => {
                             const foodOption = selectedRoom.seasonalFoodOption?.[selectedSeason.id];
                             if (foodOption === 'breakfast') {
                               const pricePerPerson = selectedRoom.foodBreakfastPrice ?? 50;
                               const totalFood = pricePerPerson * currentOccupancy;
                               const netAmount = calculationResult.actualDirectPrice - totalFood;
                               return (
                                 <div className="text-[10px] text-slate-600">
                                   {netAmount} zł + Śniadanie ({pricePerPerson}×{currentOccupancy} = {totalFood} zł)
                                 </div>
                               );
                             } else if (foodOption === 'full') {
                               const pricePerPerson = selectedRoom.foodFullPrice ?? 100;
                               const totalFood = pricePerPerson * currentOccupancy;
                               const netAmount = calculationResult.actualDirectPrice - totalFood;
                               return (
                                 <div className="text-[10px] text-slate-600">
                                   {netAmount} zł + Pełne ({pricePerPerson}×{currentOccupancy} = {totalFood} zł)
                                 </div>
                               );
                             }
                             return null;
                           })()}
                         </div>
                       </div>
                     )}
                  </div>

                  <div className="col-span-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Wybierz Pokoje</label>
                     <div className="border border-slate-300 rounded-lg p-3 bg-white max-h-[120px] overflow-y-auto space-y-2">
                        {rooms.map(r => (
                          <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedRoomIds.includes(r.id)}
                              onChange={() => toggleRoomSelection(r.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700">{r.name}</span>
                          </label>
                        ))}
                     </div>
                     <div className="text-xs text-slate-500 mt-1">{selectedRoomIds.length} wybranych</div>
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

               {/* Multiple Date Ranges Management */}
               <div className="border-t border-slate-200 pt-4 mt-2">
                  <div className="mb-3">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Zakresy dat do wysłania ({dateRanges.length})</label>

                     {/* Add new range form */}
                     <div className="flex flex-col md:flex-row gap-2 items-end bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex-1 w-full">
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Calendar size={10}/> Od</label>
                           <input
                             type="date"
                             value={tempStartDate}
                             onChange={(e) => setTempStartDate(e.target.value)}
                             className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-medium"
                           />
                        </div>
                        <div className="flex-1 w-full">
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Calendar size={10}/> Do</label>
                           <input
                             type="date"
                             value={tempEndDate}
                             onChange={(e) => setTempEndDate(e.target.value)}
                             className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-medium"
                           />
                        </div>
                        <div className="w-24">
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Min. nocy</label>
                           <input
                             type="number"
                             min="1"
                             max="30"
                             value={tempMinNights}
                             onChange={(e) => setTempMinNights(Number(e.target.value))}
                             className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-medium"
                           />
                        </div>
                        <button
                          onClick={addDateRange}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-sm flex items-center gap-1 transition-colors"
                        >
                          + Dodaj
                        </button>
                     </div>

                     {/* List of added snapshots */}
                     {dateRanges.length > 0 && (
                       <div className="mt-3 space-y-2">
                         {dateRanges.map((snapshot, idx) => {
                           const snapshotRooms = rooms.filter(r => snapshot.roomIds.includes(r.id));
                           const roomNames = snapshotRooms.map(r => r.name).join(', ');
                           const maxOccRow = snapshot.obpLadder.find(r => r.occupancy === (snapshotRooms[0]?.maxOccupancy || 2));
                           const directPrice = maxOccRow?.directPrice || snapshot.targetNet;

                           return (
                             <div key={snapshot.id} className="bg-gradient-to-r from-white to-blue-50 border-l-4 border-blue-500 rounded-lg p-3 shadow-sm">
                               <div className="flex items-start justify-between">
                                 <div className="flex-1 space-y-2">
                                   {/* Header with index */}
                                   <div className="flex items-center gap-2">
                                     <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">#{idx + 1}</span>
                                     <span className="text-xs text-slate-500">{snapshot.seasonName}</span>
                                   </div>

                                   {/* Rooms */}
                                   <div className="flex items-center gap-2 text-sm">
                                     <span className="text-[10px] text-slate-500 uppercase font-bold">Pokoje:</span>
                                     <span className="font-medium text-slate-700">{roomNames}</span>
                                   </div>

                                   {/* Dates */}
                                   <div className="flex items-center gap-2 text-sm">
                                     <Calendar size={12} className="text-blue-600"/>
                                     <span className="font-medium text-slate-700">{snapshot.startDate}</span>
                                     <span className="text-slate-400">→</span>
                                     <span className="font-medium text-slate-700">{snapshot.endDate}</span>
                                     <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                       min {snapshot.minNights} {snapshot.minNights === 1 ? 'noc' : snapshot.minNights <= 4 ? 'noce' : 'nocy'}
                                     </span>
                                   </div>

                                   {/* Price */}
                                   <div className="flex items-center gap-3">
                                     <div className="flex items-center gap-1">
                                       <span className="text-[10px] text-slate-500 uppercase font-bold">Netto:</span>
                                       <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                         {snapshot.targetNet} zł
                                       </span>
                                     </div>
                                     <div className="flex items-center gap-1">
                                       <span className="text-[10px] text-slate-500 uppercase font-bold">Direct:</span>
                                       <span className="text-sm font-bold text-blue-700">
                                         {directPrice} zł
                                       </span>
                                     </div>
                                   </div>
                                 </div>

                                 <button
                                   onClick={() => removeDateRange(snapshot.id)}
                                   className="text-red-500 hover:text-red-700 hover:bg-red-100 p-1.5 rounded transition-colors ml-2"
                                   title="Usuń snapshot"
                                 >
                                   <X size={18}/>
                                 </button>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-3">
                     {/* Apply to Season button */}
                     <button
                        onClick={handleApplyToSeasons}
                        disabled={!onSaveToSeasons || dateRanges.length === 0}
                        className={`px-6 py-2.5 rounded-lg font-bold text-white shadow-sm flex items-center gap-2 transition-all ${
                            !onSaveToSeasons || dateRanges.length === 0 ? 'bg-slate-400 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                        title={dateRanges.length === 0 ? "Dodaj przynajmniej jeden zakres dat" : "Nałóż ceny na wybrane sezony"}
                     >
                        <Save size={20} />
                        Nałóż na sezon ({dateRanges.length})
                     </button>

                     {/* Send to Hotres button */}
                     <button
                        onClick={handleSendToHotres}
                        disabled={isSending || !propertyOid || dateRanges.length === 0}
                        className={`px-6 py-2.5 rounded-lg font-bold text-white shadow-sm flex items-center gap-2 transition-all ${
                            isSending ? 'bg-slate-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 active:scale-95'
                        } ${!propertyOid || dateRanges.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!propertyOid ? "Brak OID w konfiguracji" : dateRanges.length === 0 ? "Dodaj przynajmniej jeden zakres dat" : "Wyślij ceny"}
                     >
                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <CloudUpload size={20} />}
                        {isSending ? 'Wysyłanie...' : `Wyślij do Hotres (${dateRanges.length})`}
                     </button>
                  </div>

                  {sendSuccess && (
                      <div className="mt-3 bg-green-50 text-green-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                          <CheckCircle2 size={16} /> Pomyślnie wysłano {dateRanges.length} {dateRanges.length === 1 ? 'konfigurację' : dateRanges.length <= 4 ? 'konfiguracje' : 'konfiguracji'} do Hotres!
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
                         {includeFoodPricing && (settings.foodEnabled ?? false) && selectedRoom && (() => {
                           const foodOption = selectedRoom.seasonalFoodOption?.[selectedSeasonId];
                           if (foodOption === 'breakfast') {
                             const pricePerPerson = selectedRoom.foodBreakfastPrice ?? 50;
                             const totalPrice = pricePerPerson * currentOccupancy;
                             return (
                               <div className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-md border-2 border-green-300 font-bold shadow-sm">
                                 ✓ Z WYŻYWIENIEM: Śniadanie ({pricePerPerson} zł × {currentOccupancy} os. = {totalPrice} zł)
                               </div>
                             );
                           } else if (foodOption === 'full') {
                             const pricePerPerson = selectedRoom.foodFullPrice ?? 100;
                             const totalPrice = pricePerPerson * currentOccupancy;
                             return (
                               <div className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-md border-2 border-green-300 font-bold shadow-sm">
                                 ✓ Z WYŻYWIENIEM: Pełne ({pricePerPerson} zł × {currentOccupancy} os. = {totalPrice} zł)
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
