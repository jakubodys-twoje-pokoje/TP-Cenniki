
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

  // Fetch discounts for this specific season, or default to 0 if not set
  const discounts = channel.seasonDiscounts[seasonId] || { mobile: 0, seasonal: 0, additional1: 0, additional2: 0 };

  const discountFactor = 
    (1 - discounts.mobile / 100) * 
    (1 - discounts.seasonal / 100) * 
    (1 - discounts.additional1 / 100) *
    (1 - discounts.additional2 / 100);
  
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
  occupancyFilter: number | "MAX"
): PricingRow[] => {
  const grid: PricingRow[] = [];

  rooms.forEach((room) => {
    seasons.forEach((season) => {
      // Determine occupancy to calculate for
      const targetOccupancy = occupancyFilter === "MAX" ? room.maxOccupancy : Math.min(occupancyFilter, room.maxOccupancy);
      
      const directPrice = calculateDirectPrice(room, season, targetOccupancy, settings);
      
      const channelCalculations: Record<string, ChannelCalculation> = {};
      
      channels.forEach(channel => {
        // Pass season.id to calculation
        channelCalculations[channel.id] = calculateChannelPrice(directPrice, channel, season.id);
      });

      grid.push({
        roomName: room.name,
        seasonName: season.name,
        occupancy: targetOccupancy,
        directPrice,
        channelCalculations,
      });
    });
  });

  return grid;
};
