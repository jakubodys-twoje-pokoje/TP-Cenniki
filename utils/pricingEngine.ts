
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
  season: Season
): number => {
  // 1. Determine Base Price
  // Use specific season base price if available, otherwise global peak
  const basePrice = room.seasonBasePrices?.[season.id] ?? room.basePricePeak;

  // 2. Base Price * Season Multiplier
  let price = basePrice * season.multiplier;

  // Direct Price is now strictly the Standard Rate (Max Occupancy), unadjusted by Global OBP
  
  // Prevent negative or zero prices (sanity check)
  const finalPrice = Math.max(price, 50); // Minimum 50 currency units
  
  return roundPrice(finalPrice);
};

export const calculateChannelPrice = (
  directPrice: number,
  channel: Channel,
  seasonId: string,
  occupancy: number,
  maxOccupancy: number
): ChannelCalculation => {
  // Fetch discounts for this specific season
  const discounts = channel.seasonDiscounts[seasonId] || { 
    mobile: 0, mobileEnabled: true,
    seasonal: 0, seasonalEnabled: true,
    additional1: 0, additional1Enabled: true,
    additional2: 0, additional2Enabled: true,
    obpAmount: 30, obpEnabled: true
  };

  // Determine Target Net Price
  // If OBP is enabled for this channel/season, the Target Net should be lower if occupancy < max
  let targetNetPrice = directPrice;
  
  if (discounts.obpEnabled) {
    const missingPeople = maxOccupancy - occupancy;
    if (missingPeople > 0) {
      targetNetPrice = targetNetPrice - (missingPeople * discounts.obpAmount);
    }
  }
  
  // Sanity check target net
  targetNetPrice = Math.max(targetNetPrice, 1);

  // We need: Net Income >= TargetNetPrice
  // Net Income = List Price * (1 - TotalDiscount) * (1 - Commission)
  // ListPrice = TargetNetPrice / (TotalDiscountFactor * CommissionFactor)

  const getDisc = (val: number, enabled: boolean | undefined) => (enabled ?? true) ? val : 0;

  const discountFactor = 
    (1 - getDisc(discounts.mobile, discounts.mobileEnabled) / 100) * 
    (1 - getDisc(discounts.seasonal, discounts.seasonalEnabled) / 100) * 
    (1 - getDisc(discounts.additional1, discounts.additional1Enabled) / 100) *
    (1 - getDisc(discounts.additional2, discounts.additional2Enabled) / 100);
  
  const commissionFactor = 1 - (channel.commissionPct / 100);
  
  const totalRetainedFactor = discountFactor * commissionFactor;

  // Reverse Calculate List Price
  const safeFactor = Math.max(totalRetainedFactor, 0.01);

  const rawListPrice = targetNetPrice / safeFactor;
  const listPrice = roundPrice(rawListPrice);

  // Forward check to get actual estimated net
  const soldPrice = listPrice * discountFactor;
  const commissionAmount = soldPrice * (channel.commissionPct / 100);
  const estimatedNet = soldPrice - commissionAmount;

  return {
    listPrice,
    estimatedNet: roundPrice(estimatedNet),
    commission: roundPrice(commissionAmount),
    // Profitable if we meet the target net (which includes the OBP reduction)
    isProfitable: roundPrice(estimatedNet) >= roundPrice(targetNetPrice) - 1, // Allow 1 unit margin of error
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
      
      // Direct Price is now Base * Mult (Flat rate for room)
      const directPrice = calculateDirectPrice(room, season);
      
      const channelCalculations: Record<string, ChannelCalculation> = {};
      
      channels.forEach(channel => {
        // Pass occupancy data to allow channel-specific OBP logic
        channelCalculations[channel.id] = calculateChannelPrice(
          directPrice, 
          channel, 
          season.id, 
          targetOccupancy, 
          room.maxOccupancy
        );
      });

      // Determine which base price to show
      const activeBasePrice = room.seasonBasePrices?.[season.id] ?? room.basePricePeak;

      grid.push({
        roomId: room.id,
        seasonId: season.id,
        roomName: room.name,
        basePrice: activeBasePrice, 
        seasonName: season.name,
        occupancy: targetOccupancy,
        maxOccupancy: room.maxOccupancy,
        directPrice,
        channelCalculations,
      });
    });
  });

  return grid;
};
