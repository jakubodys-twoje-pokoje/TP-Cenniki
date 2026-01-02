import { Property, Profile } from "../types";
import { INITIAL_SETTINGS } from "../constants";

/**
 * Migrates a Property from the old structure (direct rooms/channels/seasons/settings)
 * to the new Profile-based structure.
 *
 * If the property already has profiles, it returns the property as-is.
 * Otherwise, creates a "Domyślny" (Default) profile from existing data.
 */
export function migratePropertyToProfiles(property: Property): Property {
  // If already has profiles, return as-is
  if (property.profiles && property.profiles.length > 0) {
    return property;
  }

  // Create default profile from existing data
  const defaultProfile: Profile = {
    id: "default",
    name: "Domyślny",
    description: "Standardowy cennik",
    sortOrder: 0,
    isDefault: true,
    settings: property.settings || INITIAL_SETTINGS,
    channels: property.channels || [],
    rooms: property.rooms || [],
    seasons: property.seasons || [],
  };

  // Return migrated property
  return {
    ...property,
    profiles: [defaultProfile],
    // Clear old fields (optional - we keep them for now to maintain backward compatibility)
    // Uncomment these lines if you want to completely remove old structure:
    // settings: undefined,
    // channels: undefined,
    // rooms: undefined,
    // seasons: undefined,
  };
}

/**
 * Ensures all properties in an array are migrated to the profile structure
 */
export function migrateAllProperties(properties: Property[]): Property[] {
  return properties.map(migratePropertyToProfiles);
}
