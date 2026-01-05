
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { Property, DbUserRole, UserRole } from '../types';
import { Plus, Trash2, User, KeyRound, Building, Check, X, Shield, Loader2, AlertCircle } from 'lucide-react';

interface UserManagementPanelProps {
  properties: Property[];
  onClose: () => void;
}

// Temporary client to create users without logging out the admin
// Note: We need to use the URL and Anon Key from environment variables or hardcoded constants matching utils/supabaseClient.ts
const SUPABASE_URL = 'https://stdepyblwccelpbrqjux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGVweWJsd2NjZWxwYnJxanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg0MjksImV4cCI6MjA4MDQ1NDQyOX0.4PI0txHrLVQIscfoOgj_Aeo-uRwbIWARvzArk12erqg';

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ properties, onClose }) => {
  const [users, setUsers] = useState<DbUserRole[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('*');
    
    if (error) {
      console.error('Error fetching users:', error);
      setStatusMessage({ type: 'error', text: 'Błąd pobierania listy użytkowników.' });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const togglePropertySelection = (propId: string) => {
    setSelectedPropertyIds(prev => {
      const next = new Set(prev);
      if (next.has(propId)) next.delete(propId);
      else next.add(propId);
      return next;
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsCreating(true);
    setStatusMessage(null);

    try {
      // 1. Create Permission Entry in Database FIRST
      // We do this first so if auth fails (e.g. user already exists), we at least updated permissions
      const { error: dbError } = await supabase
        .from('user_roles')
        .upsert({
          email: email.toLowerCase().trim(),
          role: role,
          allowed_property_ids: Array.from(selectedPropertyIds)
        });

      if (dbError) throw new Error("Błąd zapisu uprawnień: " + dbError.message);

      // 2. Create Auth User (Using ISOLATED secondary client)
      // FIX: We explicitly mock 'storage' to prevent the client from touching localStorage.
      // This ensures the new session is completely thrown away and doesn't trigger the main App's onAuthStateChange.
      const dummyStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };

      const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: dummyStorage // Critical: Redirect storage to void
        }
      });

      const { data: signUpData, error: authError } = await tempClient.auth.signUp({
        email: email.trim(),
        password: password,
      });

      // DEBUG: Log signup response
      console.log('SignUp Response:', { data: signUpData, error: authError });

      // Handle specific Auth cases
      if (authError) {
        if (authError.message.includes('already registered')) {
          // If user exists in Auth but not DB, step 1 fixed it. Just notify.
          setStatusMessage({ type: 'success', text: 'Zaktualizowano uprawnienia dla istniejącego użytkownika.' });
        } else if (authError.message.includes('Signups not allowed')) {
          throw new Error("Rejestracja jest wyłączona w Supabase. Włącz 'Enable Email Signup' w Authentication → Providers → Email.");
        } else if (authError.message.includes('Email link is invalid') || authError.message.includes('confirmation')) {
          throw new Error("Problem z konfirmacją email. Wyłącz 'Confirm email' w Supabase: Authentication → Providers → Email.");
        } else {
          throw new Error("Błąd tworzenia konta: " + authError.message);
        }
      } else {
        setStatusMessage({ type: 'success', text: 'Użytkownik dodany! Jeśli nie może się zalogować, wyłącz "Confirm email" w Supabase.' });
      }

      // Reset Form
      setEmail('');
      setPassword('');
      setSelectedPropertyIds(new Set());
      fetchUsers(); // Refresh list

    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (emailToDelete: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć uprawnienia dla ${emailToDelete}? (Konto logowania pozostanie w systemie, ale użytkownik straci dostęp)`)) return;

    try {
      const { error } = await supabase.from('user_roles').delete().eq('email', emailToDelete);
      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert("Błąd usuwania: " + err.message);
    }
  };

  const inputClass = "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
               <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Zarządzanie Użytkownikami</h2>
              <p className="text-xs text-slate-500">Dodawaj klientów i przypisuj im obiekty.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
          
          {/* Left Column: Form */}
          <div className="w-full md:w-1/3 space-y-6">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Plus size={18} className="text-blue-500"/> Dodaj Nowego
            </h3>

            {/* Configuration Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0"/>
                <div className="text-xs text-amber-800">
                  <p className="font-semibold mb-1">Wymagana konfiguracja Supabase:</p>
                  <p className="text-[11px] leading-relaxed">
                    Authentication → Providers → Email →
                    <span className="font-mono bg-amber-100 px-1 rounded"> Confirm email: OFF</span>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email (Login)</label>
                 <div className="relative">
                   <User size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                   <input 
                     type="email" 
                     required
                     value={email}
                     onChange={e => setEmail(e.target.value)}
                     className={`${inputClass} pl-9`}
                     placeholder="klient@firma.pl"
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Hasło</label>
                 <div className="relative">
                   <KeyRound size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                   <input 
                     type="password" 
                     required
                     value={password}
                     onChange={e => setPassword(e.target.value)}
                     className={`${inputClass} pl-9`}
                     placeholder="Minimum 6 znaków"
                     minLength={6}
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Rola</label>
                 <select 
                   value={role} 
                   onChange={(e) => setRole(e.target.value as UserRole)}
                   className={inputClass}
                 >
                   <option value="client">Klient (Dostęp do wybranych)</option>
                   <option value="admin">Admin (Podgląd wszystkiego)</option>
                   <option value="super_admin">Super Admin (Pełna edycja)</option>
                 </select>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Dostęp do obiektów</label>
                 <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-1 bg-slate-50">
                    {properties.map(p => (
                      <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox"
                          checked={selectedPropertyIds.has(p.id)}
                          onChange={() => togglePropertySelection(p.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 truncate">{p.name}</span>
                      </label>
                    ))}
                    {properties.length === 0 && <p className="text-xs text-slate-400 italic">Brak obiektów.</p>}
                 </div>
                 {role !== 'client' && <p className="text-[10px] text-amber-600 mt-1">Admin widzi wszystkie obiekty niezależnie od zaznaczenia.</p>}
               </div>

               {statusMessage && (
                 <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {statusMessage.type === 'success' ? <Check size={16} className="mt-0.5"/> : <AlertCircle size={16} className="mt-0.5"/>}
                    {statusMessage.text}
                 </div>
               )}

               <button 
                 type="submit" 
                 disabled={isCreating}
                 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-md shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
               >
                 {isCreating ? <Loader2 size={18} className="animate-spin"/> : <Plus size={18}/>}
                 Dodaj Użytkownika
               </button>
            </form>
          </div>

          {/* Right Column: List */}
          <div className="w-full md:w-2/3 border-l border-slate-200 pl-0 md:pl-8 pt-8 md:pt-0">
             <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
               <Shield size={18} className="text-slate-400"/> Lista Użytkowników
             </h3>
             
             {loading ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <Loader2 size={24} className="animate-spin mr-2"/> Ładowanie...
                </div>
             ) : (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                   <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Użytkownik</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Rola</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Dostęp</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map(u => (
                          <tr key={u.email} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
                            <td className="px-4 py-3">
                               <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                                 ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 
                                   u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 
                                   'bg-blue-100 text-blue-800'}`}>
                                 {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Klient'}
                               </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                               {u.role !== 'client' ? (
                                 <span className="italic text-slate-400">Pełny dostęp</span>
                               ) : (
                                 u.allowed_property_ids && u.allowed_property_ids.length > 0 
                                  ? `${u.allowed_property_ids.length} obiektów` 
                                  : <span className="text-red-400">Brak przypisań</span>
                               )}
                            </td>
                            <td className="px-4 py-3 text-right">
                               <button 
                                 onClick={() => handleDeleteUser(u.email)}
                                 className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                 title="Usuń uprawnienia"
                               >
                                 <Trash2 size={16}/>
                               </button>
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Brak zdefiniowanych użytkowników w bazie.</td></tr>
                        )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserManagementPanel;
