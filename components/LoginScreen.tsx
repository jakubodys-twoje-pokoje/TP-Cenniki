
import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { KeyRound, Mail, User, Loader2, ArrowRight, Sparkles } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Helper to map simple usernames to emails for Supabase
  const getEmail = (user: string) => {
    const cleanUser = user.trim().toLowerCase();
    // Default domain mapping
    return `${cleanUser}@twojepokoje.pl`;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const email = getEmail(username);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Konto zostało utworzone! Możesz się teraz zalogować.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" 
        ? "Nieprawidłowa nazwa użytkownika lub hasło." 
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-900">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 transform scale-105 transition-transform duration-[20s] hover:scale-100"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop")' }}
      ></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-slate-900 via-slate-900/80 to-blue-900/40"></div>

      {/* Glass Card */}
      <div className="relative z-10 w-full max-w-md p-8 m-4">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20"></div>
        
        <div className="relative z-20 flex flex-col items-center">
          {/* Logo Area */}
          <div className="mb-8 p-4 rounded-full bg-white/5 border border-white/10 shadow-lg relative group">
            <div className="absolute inset-0 bg-blue-500 rounded-full opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-700"></div>
            <img 
              src="https://twojepokoje.com.pl/wp-content/uploads/2024/02/Twoje_pokoje_logo_full.webp" 
              alt="Logo" 
              className="h-12 w-auto object-contain filter drop-shadow-lg"
            />
          </div>

          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight text-center">
            {isLogin ? 'Witaj ponownie' : 'Utwórz konto'}
          </h2>
          <p className="text-slate-400 text-sm mb-8 text-center max-w-xs">
            {isLogin 
              ? 'Zaloguj się, aby zarządzać cenami i dostępnością.' 
              : 'Skonfiguruj dostęp dla nowego administratora.'}
          </p>

          <form onSubmit={handleAuth} className="w-full space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Użytkownik</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  placeholder="np. Tyberiusz"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Hasło</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound size={18} className="text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center animate-pulse">
                {error}
              </div>
            )}
            
            {message && (
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/50 text-green-200 text-sm text-center">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/30 font-medium"
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <>
                  {isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 w-full text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setMessage(null);
              }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {isLogin ? (
                <>Nie masz konta? <span className="text-blue-400 hover:underline">Zarejestruj się</span></>
              ) : (
                <>Masz już konto? <span className="text-blue-400 hover:underline">Zaloguj się</span></>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-6 text-slate-500 text-xs flex items-center gap-2">
        <Sparkles size={12} className="text-blue-500" />
        <span>Cennik Twoje Pokoje & Strony Jakubowe 2025</span>
      </div>
    </div>
  );
};

export default LoginScreen;
