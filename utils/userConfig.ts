
import { UserPermissions } from "../types";

// Configuration mapping emails to roles
export const USER_PERMISSIONS: Record<string, UserPermissions> = {
  // Super Admin: Pełny dostęp, edycja, zapis
  "tyberiusz@twojepokoje.pl": { 
    role: "super_admin" 
  },
  
  // Admin: Widzi wszystko, ale Read-Only
  "dorota@twojepokoje.pl": { 
    role: "admin" 
  },
  
  // Klient: Widzi tylko przypisane ID, Read-Only
  "jakub@twojepokoje.pl": { 
    role: "client",
    // UWAGA: Wpisz tutaj ID obiektu, który ma widzieć Jakub.
    // ID znajdziesz w bazie danych (pole id w tabeli properties) lub tworząc obiekt jako super-admin.
    // Na razie wpisane "default" jako placeholder.
    allowedPropertyIds: ["default", "1740923000000"] 
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
