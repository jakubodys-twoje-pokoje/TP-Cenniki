
import { UserPermissions } from "../types";

// Configuration mapping emails to roles
// UWAGA: Tutaj wpisujemy TYLKO Super Adminów (Dev/Właściciel).
// Wszyscy inni (Admini, Klienci) muszą być w bazie danych Supabase (tabela user_roles).
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
  }
};

// Default permission for unknown users (Safety fallback)
const DEFAULT_PERMISSION: UserPermissions = {
  role: "client",
  allowedPropertyIds: [] // Domyślnie brak dostępu do czegokolwiek
};

export const getUserPermissions = (email: string | undefined): UserPermissions => {
  if (!email) return DEFAULT_PERMISSION;
  const lowerEmail = email.toLowerCase().trim();
  return USER_PERMISSIONS[lowerEmail] || DEFAULT_PERMISSION;
};
