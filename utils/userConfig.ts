
import { UserPermissions } from "../types";

// Default permission is DENIED. 
// If a user is not found in the database, they get this role.
export const DEFAULT_DENIED_PERMISSION: UserPermissions = {
  role: "client", // Fallback type, but with empty IDs it sees nothing.
  allowedPropertyIds: [] 
};

/**
 * DEPRECATED: Hardcoded permissions are removed.
 * validation is now handled strictly via Supabase 'user_roles' table lookup in App.tsx.
 */
export const getUserPermissions = (email: string | undefined): UserPermissions => {
  return DEFAULT_DENIED_PERMISSION;
};
