
import { UserPermissions } from "../types";

// Configuration mapping emails to roles
export const USER_PERMISSIONS: Record<string, UserPermissions> = {
  // Super Admins: Pełny dostęp, edycja, zapis
  "tyberiusz@twojepokoje.pl": { 
    role: "super_admin" 
  },
  "kontakt@twojepokoje.com.pl": { 
    role: "super_admin" 
  },
  "admin@twojepokoje.com.pl": { 
    role: "super_admin" 
  },
  
  // Admin: Widzi wszystko, ale Read-Only
  "dorota@twojepokoje.com.pl": { 
    role: "admin" 
  },
  
  // Klient: Widzi tylko przypisane ID, Read-Only
  "jakub@twojepokoje.pl": { 
    role: "client",
    allowedPropertyIds: ["default"] 
  }
};

// Default permission for unknown users (Safety fallback)
const DEFAULT_PERMISSION: UserPermissions = {
  role: "client",
  allowedPropertyIds: [] // See nothing by default
};

export const getUserPermissions = (email: string | undefined): UserPermissions => {
  if (!email) return DEFAULT_PERMISSION;
  const lowerEmail = email.toLowerCase().trim();
  return USER_PERMISSIONS[lowerEmail] || DEFAULT_PERMISSION;
};
