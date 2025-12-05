
import { Channel, ChannelCalculation, GlobalSettings, PricingRow, RoomType, Season } from "../types";

/**
 * rounds a price to a psychological price point (e.g. ends in 0, 5, or 9)
 * For this engine, we will simply round to nearest integer to keep it clean.
 */
const roundPrice = (price: number): number => {
  return Math.round(price);
};

export const calculateDirectPrice = (
  room: RoomType,
  season: Season,
  occupancy: number,
  settings: GlobalSettings
): number => {
  // 1. Determine Base Price
  // Use specific season base price if available, otherwise global peak
  const basePrice = room.seasonBasePrices?.[season.id] ?? room.basePricePeak;

  // 2. Base Price * Season Multiplier
  let price = basePrice * season.multiplier;

  // 3. Apply OBP
  // Logic: Must be globally enabled AND (enabled for this specific season on this room OR undefined which defaults to true)
  const isSeasonObpActive = room.seasonalObpActive?.[season.id] ?? true;

  if (settings.obpEnabled && isSeasonObpActive) {
    // Determine the effective occupancy for pricing calculation.
    // We cannot go below the minObpOccupancy set for the room.
    const minObpOccupancy = room.minObpOccupancy || 1;
    const effectiveOccupancy = Math.max(occupancy, minObpOccupancy);

    // Calculate missing people based on this effective occupancy
    const missingPeople = Math.max(0, room.maxOccupancy - effectiveOccupancy);
    
    // Use room-specific OBP amount, defaulting to 30 if unset
    const obpAmount = room.obpPerPerson ?? 30;

    if (missingPeople > 0) {
      price = price - (missingPeople * obpAmount);
    }
  }

  // Prevent negative or zero prices (absolute sanity check)
  const finalPrice = Math.max(price, 50); // Minimum 50 currency units
  
  return roundPrice(finalPrice);
};

export const calculateChannelPrice = (
  directPrice: number,
  channel: Channel,
  seasonId: string
): ChannelCalculation => {
  // Fetch discounts for this specific season
  const discounts = channel.seasonDiscounts[seasonId] || { 
    mobile: 0, mobileEnabled: true,
    genius: 0, geniusEnabled: true,
    seasonal: 0, seasonalEnabled: true,
    firstMinute: 0, firstMinuteEnabled: true,
    lastMinute: 0, lastMinuteEnabled: true,
  };

  // Target Net Price is simply the Direct Price (which is already adjusted for OBP)
  let targetNetPrice = directPrice;
  
  // Sanity check target net
  targetNetPrice = Math.max(targetNetPrice, 1);

  // We need: Net Income >= TargetNetPrice
  // Net Income = List Price * (1 - TotalDiscount) * (1 - Commission)
  // ListPrice = TargetNetPrice / (TotalDiscountFactor * CommissionFactor)

  const getDisc = (val: number, enabled: boolean | undefined) => (enabled ?? true) ? val : 0;

  const mobilePct = getDisc(discounts.mobile, discounts.mobileEnabled) / 100;
  const geniusPct = getDisc(discounts.genius, discounts.geniusEnabled) / 100;
  const seasonalPct = getDisc(discounts.seasonal, discounts.seasonalEnabled) / 100;
  const firstMinutePct = getDisc(discounts.firstMinute, discounts.firstMinuteEnabled) / 100;
  const lastMinutePct = getDisc(discounts.lastMinute, discounts.lastMinuteEnabled) / 100;

  const discountFactor = 
    (1 - mobilePct) * 
    (1 - geniusPct) * 
    (1 - seasonalPct) *
    (1 - firstMinutePct) *
    (1 - lastMinutePct);
  
  const commissionFactor = 1 - (channel.commissionPct / 100);
  
  const totalRetainedFactor = discountFactor * commissionFactor;

  // Reverse Calculate List Price
  const safeFactor = Math.max(totalRetainedFactor, 0.01);

  const rawListPrice = targetNetPrice / safeFactor;
  const listPrice = roundPrice(rawListPrice);

  // Forward check to get actual estimated net
  const priceAfterMobile = listPrice * (1 - mobilePct);
  const priceAfterGenius = priceAfterMobile * (1 - geniusPct);
  const priceAfterSeasonal = priceAfterGenius * (1 - seasonalPct);
  const priceAfterFirst = priceAfterSeasonal * (1 - firstMinutePct);
  const priceAfterLast = priceAfterFirst * (1 - lastMinutePct);
  
  const soldPrice = priceAfterLast;
  const commissionAmount = soldPrice * (channel.commissionPct / 100);
  const estimatedNet = soldPrice - commissionAmount;

  // Calculate Breakdown Values (Approximated based on list price cascade for display)
  
  const mobileVal = listPrice * mobilePct;
  const geniusVal = (listPrice - mobileVal) * geniusPct;
  const seasonalVal = (listPrice - mobileVal - geniusVal) * seasonalPct;
  const firstVal = (listPrice - mobileVal - geniusVal - seasonalVal) * firstMinutePct;
  const lastVal = (listPrice - mobileVal - geniusVal - seasonalVal - firstVal) * lastMinutePct;

  return {
    listPrice,
    estimatedNet: roundPrice(estimatedNet),
    commission: roundPrice(commissionAmount),
    // Profitable if we meet the target net
    isProfitable: roundPrice(estimatedNet) >= roundPrice(targetNetPrice) - 1, // Allow 1 unit margin of error
    discountBreakdown: {
      mobile: roundPrice(mobileVal),
      genius: roundPrice(geniusVal),
      seasonal: roundPrice(seasonalVal),
      firstMinute: roundPrice(firstVal),
      lastMinute: roundPrice(lastVal)
    }
  };
};

export const generatePricingGrid = (
  rooms: RoomType[],
  seasons: Season[],
  channels: Channel[],
  settings: GlobalSettings,
  occupancyFilter: number | "MAX",
  overrides: Record<string, number> = {}
): PricingRow[] => {
  const grid: PricingRow[] = [];

  rooms.forEach((room) => {
    seasons.forEach((season) => {
      // Determine occupancy to calculate for
      let targetOccupancy = room.maxOccupancy;
      
      const overrideKey = `${room.id}-${season.id}`;
      
      if (overrides[overrideKey] !== undefined) {
        targetOccupancy = overrides[overrideKey];
      } else if (occupancyFilter !== "MAX") {
        targetOccupancy = Math.min(occupancyFilter, room.maxOccupancy);
      }
      
      // Ensure target doesn't exceed max (sanity check)
      targetOccupancy = Math.min(targetOccupancy, room.maxOccupancy);
      
      // Direct Price (Calculated with OBP and Min OBP)
      const directPrice = calculateDirectPrice(room, season, targetOccupancy, settings);
      
      const channelCalculations: Record<string, ChannelCalculation> = {};
      
      channels.forEach(channel => {
        channelCalculations[channel.id] = calculateChannelPrice(
          directPrice, 
          channel, 
          season.id
        );
      });

      // Determine which base price to show
      const activeBasePrice = room.seasonBasePrices?.[season.id] ?? room.basePricePeak;
      // Determine active comment
      const activeComment = room.seasonComments?.[season.id] ?? "";
      // Determine active occupancy rate
      const activeOccupancy = room.seasonOccupancy?.[season.id];

      grid.push({
        roomId: room.id,
        seasonId: season.id,
        roomName: room.name,
        basePrice: activeBasePrice, 
        seasonName: season.name,
        occupancy: targetOccupancy,
        maxOccupancy: room.maxOccupancy,
        directPrice,
        minNights: season.minNights || 2, // Use Season Min Nights (default 2)
        comment: activeComment,
        occupancyRate: activeOccupancy,
        channelCalculations,
      });
    });
  });

  return grid;
};
