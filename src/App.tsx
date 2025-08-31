// src/App.tsx

import './App.css';
//
import { useEffect, useState } from 'react';
// import { useDispatch } from 'react-redux';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import NavBar from './components/NavBar';
import { Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import Profile from './components/Profile';

export default function App() {
  // const dispatch = useDispatch();
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Auth />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <NavBar
        current={location.pathname === '/profile' ? 'profile' : 'home'}
        onNavigate={(p) => navigate(p === 'home' ? '/home' : '/profile')}
      />
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}