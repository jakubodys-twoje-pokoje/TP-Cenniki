
import { Channel, ChannelCalculation, GlobalSettings, PricingRow, RoomType, Season } from "../types";

/**
 * rounds a price to a psychological price point (e.g. ends in 0, 5, or 9)
 * For this engine, we will simply round to nearest integer to keep it clean,
 * or nearest 5 if needed. Let's stick to nearest integer for precision checking.
 */
const roundPrice = (price: number): number => {
  return Math.ceil(price);
};

export const calculateDirectPrice = (
  room: RoomType,
  season: Season,
  occupancy: number,
  globalSettings: GlobalSettings
): number => {
  // 1. Base Peak Price * Season Multiplier
  let price = room.basePricePeak * season.multiplier;

  // 2. OBP Adjustment (Occupancy Based Pricing)
  // If season enables OBP, subtract discount for missing persons
  if (season.obpEnabled) {
    const missingPeople = room.maxOccupancy - occupancy;
    if (missingPeople > 0) {
      price = price - (missingPeople * globalSettings.defaultObp);
    }
  }

  // Prevent negative or zero prices (sanity check)
  return Math.max(price, 50); // Minimum 50 currency units
};

export const calculateChannelPrice = (
  directPrice: number,
  channel: Channel,
  seasonId: string
): ChannelCalculation => {
  // We need: Net Income >= Direct Price
  // Net Income = List Price * (1 - TotalDiscount) * (1 - Commission)
  // Note: Usually commission is on the sold price.
  // Sold Price = List Price * (1 - MobileDisc) * (1 - SeasonalDisc) ...
  // This is a simplified waterfall model:
  // ListPrice -> Apply Discounts -> SoldPrice -> Apply Commission -> Net

  // Fetch discounts for this specific season
  // Use 'any' type cast momentarily if migrated data structure is missing fields, 
  // but strictly we expect the interface. We'll default enabled to true if undefined for backward compatibility.
  const discounts = channel.seasonDiscounts[seasonId] || { 
    mobile: 0, mobileEnabled: true,
    seasonal: 0, seasonalEnabled: true,
    additional1: 0, additional1Enabled: true,
    additional2: 0, additional2Enabled: true
  };

  const getDisc = (val: number, enabled: boolean | undefined) => (enabled ?? true) ? val : 0;

  const discountFactor = 
    (1 - getDisc(discounts.mobile, discounts.mobileEnabled) / 100) * 
    (1 - getDisc(discounts.seasonal, discounts.seasonalEnabled) / 100) * 
    (1 - getDisc(discounts.additional1, discounts.additional1Enabled) / 100) *
    (1 - getDisc(discounts.additional2, discounts.additional2Enabled) / 100);
  
  const commissionFactor = 1 - (channel.commissionPct / 100);
  
  const totalRetainedFactor = discountFactor * commissionFactor;

  // Reverse Calculate List Price
  // DirectPrice = ListPrice * totalRetainedFactor
  // ListPrice = DirectPrice / totalRetainedFactor
  
  // Guard against divide by zero if discounts/commissions are 100%
  const safeFactor = Math.max(totalRetainedFactor, 0.01);

  const rawListPrice = directPrice / safeFactor;
  const listPrice = roundPrice(rawListPrice);

  // Forward check to get actual estimated net
  const soldPrice = listPrice * discountFactor;
  const commissionAmount = soldPrice * (channel.commissionPct / 100);
  const estimatedNet = soldPrice - commissionAmount;

  return {
    listPrice,
    estimatedNet,
    commission: commissionAmount,
    isProfitable: estimatedNet >= directPrice - 1, // Allow 1 unit margin of error for rounding
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
      // 1. Check override for this specific row (Room + Season)
      // 2. Check global filter
      let targetOccupancy = room.maxOccupancy;
      
      const overrideKey = `${room.id}-${season.id}`;
      
      if (overrides[overrideKey] !== undefined) {
        targetOccupancy = overrides[overrideKey];
      } else if (occupancyFilter !== "MAX") {
        targetOccupancy = Math.min(occupancyFilter, room.maxOccupancy);
      }
      
      // Ensure target doesn't exceed max (sanity check)
      targetOccupancy = Math.min(targetOccupancy, room.maxOccupancy);
      
      const directPrice = calculateDirectPrice(room, season, targetOccupancy, settings);
      
      const channelCalculations: Record<string, ChannelCalculation> = {};
      
      channels.forEach(channel => {
        // Pass season.id to calculation
        channelCalculations[channel.id] = calculateChannelPrice(directPrice, channel, season.id);
      });

      grid.push({
        roomId: room.id,
        seasonId: season.id,
        roomName: room.name,
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
