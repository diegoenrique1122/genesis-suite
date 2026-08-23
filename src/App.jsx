import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import RegisterAthlete from './pages/RegisterAthlete';

// IMPORTACIONES DEL MOTOR WHITE-LABEL
import { ThemeProvider } from './contexts/ThemeContext';

// IMPORTACIONES DE TODAS TUS PANTALLAS
import Login from './pages/Login';
import RegisterCoach from './pages/RegisterCoach'; 
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import CoachDashboard from './pages/CoachDashboard';
import CoachSettings from './pages/CoachSettings'; 
import CoachNotifications from './pages/CoachNotifications'; // 🔥 NUEVO: Importación del Centro de Notificaciones
import ClientProfile from './pages/ClientProfile'; 
import ClientDashboard from './pages/ClientDashboard';
import ClientOnboarding from './pages/ClientOnboarding';
import ElArquitecto from './pages/ElArquitecto';
import MonitoreoDisciplina from './pages/MonitoreoDisciplina';
import AppTrainerPro from './pages/AppTrainerPro';
import RegulacionHormonal from './pages/RegulacionHormonal';
import Chat from './pages/Chat'; 

// ------------------------------------------------------------------
// ESCUDO DE SEGURIDAD BLINDADO (ROUTER POLICE)
// ------------------------------------------------------------------
const ProtectedRoute = ({ children, allowedRoles }) => {
  const [authData, setAuthData] = useState({ loading: true, user: null, role: null });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthData({ loading: false, user: null, role: null });
        return;
      }

      const { data: userMaster } = await supabase
        .from('users_master')
        .select('role, account_status')
        .eq('id', session.user.id)
        .single();

      setAuthData({ 
        loading: false, 
        user: session.user, 
        role: userMaster?.role,
        status: userMaster?.account_status
      });
    };
    checkAuth();
  }, []);

  if (authData.loading) {
    return <div className="min-h-screen bg-[#0a0a0a] text-[var(--primary-color,#f59e0b)] flex items-center justify-center font-bold uppercase tracking-widest">Validando Seguridad...</div>;
  }

  if (!authData.user) return <Navigate to="/" />;

  // HARD-GATE: Cuenta en estado de Purgatorio
  if (authData.status === 'PENDING') return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 border-4 border-neutral-800 border-t-[var(--primary-color,#f59e0b)] rounded-full animate-spin mb-6"></div>
      <h1 className="text-xl font-black uppercase tracking-widest mb-2">Cuenta en Revisión</h1>
      <p className="text-sm text-neutral-500 font-mono">Tu solicitud de licencia o acceso está pendiente de revisión.</p>
      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="mt-8 text-[10px] uppercase font-bold text-neutral-600 hover:text-white transition-colors">Cerrar Sesión</button>
    </div>
  );

  // ANTI-CRASH SHIELD: Si el usuario existe pero perdió su rol en la BD
  if (!authData.role) {
    supabase.auth.signOut();
    return <Navigate to="/" />;
  }

  if (!allowedRoles.includes(authData.role)) {
    if (authData.role === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
    if (authData.role === 'COACH') return <Navigate to="/coach" />;
    return <Navigate to="/client" />;
  }

  return children;
};

// ------------------------------------------------------------------
// APLICACIÓN PRINCIPAL
// ------------------------------------------------------------------
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register/coach" element={<RegisterCoach />} />
          <Route path="/register/athlete" element={<RegisterAthlete />} />
          
          <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminDashboard /></ProtectedRoute>} />

          {/* RUTAS DEL COACH */}
          <Route path="/coach" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COACH']}><CoachDashboard /></ProtectedRoute>} />
          <Route path="/coach/settings" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COACH']}><CoachSettings /></ProtectedRoute>} />
          <Route path="/coach/notifications" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COACH']}><CoachNotifications /></ProtectedRoute>} /> {/* 🔥 NUEVO: Ruta registrada */}
          <Route path="/coach/client/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COACH']}><ClientProfile /></ProtectedRoute>} />

          {/* RUTAS DEL ATLETA */}
          <Route path="/client" element={<ProtectedRoute allowedRoles={['ATHLETE']}><ClientDashboard /></ProtectedRoute>} />
          <Route path="/client/onboarding" element={<ProtectedRoute allowedRoles={['ATHLETE']}><ClientOnboarding /></ProtectedRoute>} />
          <Route path="/client/arquitecto" element={<ProtectedRoute allowedRoles={['ATHLETE']}><ElArquitecto /></ProtectedRoute>} />
          <Route path="/client/disciplina" element={<ProtectedRoute allowedRoles={['ATHLETE']}><MonitoreoDisciplina /></ProtectedRoute>} />
          <Route path="/client/entrenamiento" element={<ProtectedRoute allowedRoles={['ATHLETE']}><AppTrainerPro /></ProtectedRoute>} />
          <Route path="/client/hormonal" element={<ProtectedRoute allowedRoles={['ATHLETE']}><RegulacionHormonal /></ProtectedRoute>} />
          {/* RUTAS DEL ATLETA (MODO INMERSIVO PARA TODOS) */}
          <Route path="/client" element={<ProtectedRoute allowedRoles={['ATHLETE', 'COACH', 'SUPER_ADMIN']}><ClientDashboard /></ProtectedRoute>} />
          <Route path="/client/onboarding" element={<ProtectedRoute allowedRoles={['ATHLETE']}><ClientOnboarding /></ProtectedRoute>} />
          <Route path="/client/arquitecto" element={<ProtectedRoute allowedRoles={['ATHLETE', 'COACH', 'SUPER_ADMIN']}><ElArquitecto /></ProtectedRoute>} />
          <Route path="/client/disciplina" element={<ProtectedRoute allowedRoles={['ATHLETE', 'COACH', 'SUPER_ADMIN']}><MonitoreoDisciplina /></ProtectedRoute>} />
          <Route path="/client/entrenamiento" element={<ProtectedRoute allowedRoles={['ATHLETE', 'COACH', 'SUPER_ADMIN']}><AppTrainerPro /></ProtectedRoute>} />
          <Route path="/client/hormonal" element={<ProtectedRoute allowedRoles={['ATHLETE', 'COACH', 'SUPER_ADMIN']}><RegulacionHormonal /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COACH', 'ATHLETE']}><Chat /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}