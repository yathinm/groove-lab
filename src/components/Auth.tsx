import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (e) {
      setError((e as Error).message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5">
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Welcome to Groove Lab</h2>
        {error && <div className="mt-2 rounded-md bg-rose-50 p-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{error}</div>}
        <button
          className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          {loading ? 'Redirecting…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}



