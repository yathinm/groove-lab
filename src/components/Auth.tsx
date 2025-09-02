import { LogIn, Music } from 'lucide-react'
import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin,
          skipBrowserRedirect: true // Prevent embedded redirect
        },
      });
      if (error) throw error;
      
      // Open Google OAuth in system browser
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        setMessage('Google sign-in opened in new tab. Complete sign-in there.');
      }
    } catch (e) {
      setError((e as Error).message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-lg ring-1 ring-orange-200">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400" />
        <div className="mb-3 flex items-center gap-3">
          <span className="rounded-lg bg-orange-50 p-2 ring-1 ring-orange-100">
            <Music className="h-5 w-5 text-orange-600" />
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Welcome to Groove Lab</h2>
        </div>
        <p className="text-sm text-gray-600">Sign in to save projects and access them anywhere.</p>
        {error && <div className="mt-3 rounded-md bg-rose-50 p-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{error}</div>}
        {message && <div className="mt-3 rounded-md bg-green-50 p-2 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-200">{message}</div>}
        <button
          aria-label="Sign in with Google"
          className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <LogIn className="mr-2 h-4 w-4" /> {loading ? 'Opening Google...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}



