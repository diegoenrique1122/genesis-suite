import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { supabase } from './supabaseClient';

import {
  GENESIS_MODES,
  canSwitchMode,
  getEntitlements,
} from './core';

import {
  useGenesisMode,
} from './contexts/GenesisModeContext';


// ======================================================
// WHITE LABEL
// ======================================================

import {
  ThemeProvider,
} from './contexts/ThemeContext';


// ======================================================
// PAGES
// ======================================================

import Login from './pages/Login';

import RegisterAthlete from './pages/RegisterAthlete';
import RegisterCoach from './pages/RegisterCoach';

import SuperAdminDashboard from './pages/SuperAdminDashboard';

import CoachDashboard from './pages/CoachDashboard';
import CoachSettings from './pages/CoachSettings';
import CoachNotifications from './pages/CoachNotifications';

import ClientProfile from './pages/ClientProfile';

import ClientDashboard from './pages/ClientDashboard';
import ClientOnboarding from './pages/ClientOnboarding';

import ElArquitecto from './pages/ElArquitecto';
import MonitoreoDisciplina from './pages/MonitoreoDisciplina';
import AppTrainerPro from './pages/AppTrainerPro';
import RegulacionHormonal from './pages/RegulacionHormonal';

import Chat from './pages/Chat';


// ======================================================
// ROLE HOME
// ======================================================

function getHomeForRole(role) {

  if (role === 'SUPER_ADMIN') {
    return '/super-admin';
  }

  if (role === 'COACH') {
    return '/coach';
  }

  if (role === 'ATHLETE') {
    return '/client';
  }

  return '/';
}


// ======================================================
// SECURITY SCREEN
// ======================================================

function SecurityScreen({
  title,
  message,
  allowLogout = true,
}) {

  const handleLogout = async () => {

    await supabase.auth.signOut();

    window.location.href = '/';
  };


  return (

    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 text-center">

      <div className="w-16 h-16 border-4 border-neutral-800 border-t-amber-500 rounded-full animate-spin mb-6" />

      <h1 className="text-xl font-black uppercase tracking-widest mb-3">

        {title}

      </h1>

      <p className="text-sm text-neutral-500 font-mono max-w-lg">

        {message}

      </p>


      {allowLogout && (

        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 text-[10px] uppercase font-bold text-neutral-600 hover:text-white transition-colors"
        >

          Cerrar Sesión

        </button>

      )}

    </div>
  );
}


// ======================================================
// ACCESS DENIED
// ======================================================

function AccessDenied({
  role,
  message = 'Tu cuenta no tiene autorización para acceder a este recurso.',
}) {

  return (

    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 text-center">

      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-2xl mb-6">

        !

      </div>


      <h1 className="text-xl font-black uppercase tracking-widest mb-3">

        Acceso Restringido

      </h1>


      <p className="text-sm text-neutral-500 font-mono max-w-lg mb-8">

        {message}

      </p>


      <a
        href={getHomeForRole(role)}
        className="bg-white text-black px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
      >

        Volver al Portal

      </a>

    </div>
  );
}


// ======================================================
// GENESIS PROTECTED ROUTE
// ======================================================

const ProtectedRoute = ({

  children,

  allowedRoles,

  requiredMode = null,

  requiredApp = null,

}) => {

  const {
    mode,
    switchMode,
  } = useGenesisMode();


  const [
    authData,
    setAuthData,
  ] = useState({

    loading: true,

    user: null,

    identity: null,

    coachProfile: null,

    athleteProfile: null,

    error: null,
  });


  // ====================================================
  // LOAD CANONICAL IDENTITY
  // ====================================================

  useEffect(() => {

    let mounted = true;


    const checkAuth = async () => {

      try {

        /**
         * -----------------------------------------------
         * AUTH SESSION
         * -----------------------------------------------
         */

        const {
          data: {
            session,
          },
          error: sessionError,
        } = await supabase.auth.getSession();


        if (sessionError) {

          throw sessionError;
        }


        if (!session) {

          if (mounted) {

            setAuthData({

              loading: false,

              user: null,

              identity: null,

              coachProfile: null,

              athleteProfile: null,

              error: null,
            });
          }

          return;
        }


        /**
         * -----------------------------------------------
         * USERS_MASTER
         *
         * SOURCE OF TRUTH:
         *
         * - role
         * - account_status
         * -----------------------------------------------
         */

        const {
          data: identity,
          error: identityError,
        } = await supabase
          .from('users_master')
          .select(
            'id, role, account_status, is_chat_banned'
          )
          .eq(
            'id',
            session.user.id
          )
          .maybeSingle();


        if (
          identityError ||
          !identity
        ) {

          throw (
            identityError ||
            new Error(
              'Genesis Identity no encontrada.'
            )
          );
        }


        let coachProfile = null;
        let athleteProfile = null;


        /**
         * -----------------------------------------------
         * COACH OPERATIONAL PROFILE
         * -----------------------------------------------
         *
         * SUPER_ADMIN también puede tener perfil Coach.
         */

        if (
          identity.role === 'COACH' ||
          identity.role === 'SUPER_ADMIN'
        ) {

          const {
            data,
            error,
          } = await supabase
            .from('coaches_profile')
            .select(
              `
                id,
                user_id,
                full_name,
                b2b_plan,
                subscription_tier
              `
            )
            .eq(
              'user_id',
              session.user.id
            )
            .maybeSingle();


          if (error) {

            throw error;
          }


          coachProfile = data;
        }


        /**
         * -----------------------------------------------
         * ATHLETE OPERATIONAL PROFILE
         * -----------------------------------------------
         *
         * SUPER_ADMIN y COACH ELITE pueden tener
         * perfil operacional Athlete.
         */

        if (
          identity.role === 'ATHLETE' ||
          identity.role === 'COACH' ||
          identity.role === 'SUPER_ADMIN'
        ) {

          const {
            data,
            error,
          } = await supabase
            .from('athletes_profile')
            .select(
              `
                id,
                user_id,
                coach_id,
                full_name,
                b2c_plan,
                gender,
                selected_app_single,
                is_onboarded
              `
            )
            .eq(
              'user_id',
              session.user.id
            )
            .maybeSingle();


          if (error) {

            throw error;
          }


          athleteProfile = data;
        }


        if (!mounted) {
          return;
        }


        setAuthData({

          loading: false,

          user: session.user,

          identity,

          coachProfile,

          athleteProfile,

          error: null,
        });


      } catch (error) {

        console.error(
          'Genesis ProtectedRoute:',
          error
        );


        if (!mounted) {
          return;
        }


        setAuthData({

          loading: false,

          user: null,

          identity: null,

          coachProfile: null,

          athleteProfile: null,

          error,
        });
      }
    };


    checkAuth();


    return () => {

      mounted = false;
    };

  }, []);


  // ====================================================
  // DERIVED SECURITY DATA
  // ====================================================

  const identity =
    authData.identity;


  const role =
    identity?.role || null;


  const accountStatus =
    identity?.account_status || null;


  /**
   * SUPER ADMIN obtiene capacidades Coach Elite
   * cuando opera en COACH MODE.
   *
   * Para un Coach normal usamos su plan real.
   */

  const coachPlan =

    role === 'SUPER_ADMIN'

      ? 'ELITE'

      : authData
          .coachProfile
          ?.b2b_plan ||
        'IGNICION';


  /**
   * El plan Athlete real se obtiene exclusivamente
   * del perfil operacional.
   *
   * SUPER_ADMIN recibe Elite por diseño cuando
   * entra en Athlete Mode.
   */

  const athletePlan =

    role === 'SUPER_ADMIN'

      ? 'ELITE'

      : authData
          .athleteProfile
          ?.b2c_plan ||
        'IGNICION';


  /**
   * ----------------------------------------------------
   * MODE AUTHORIZATION
   * ----------------------------------------------------
   */

  const modeAllowed =
    useMemo(() => {

      if (
        !role ||
        !requiredMode
      ) {

        return true;
      }


      return canSwitchMode({

        role,

        targetMode:
          requiredMode,

        coachPlan,
      });

    }, [
      role,
      requiredMode,
      coachPlan,
    ]);


  /**
   * ----------------------------------------------------
   * CENTRAL ENTITLEMENTS
   * ----------------------------------------------------
   */

  const entitlements =
    useMemo(() => {

      if (!role) {

        return null;
      }


      return getEntitlements({

        role,

        mode:
          requiredMode ||
          mode,

        coachPlan,

        athletePlan,

        gender:
          authData
            .athleteProfile
            ?.gender,

        selectedAppSingle:
          authData
            .athleteProfile
            ?.selected_app_single,
      });

    }, [
      role,
      requiredMode,
      mode,
      coachPlan,
      athletePlan,
      authData.athleteProfile,
    ]);


  // ====================================================
  // SYNCHRONIZE UI MODE
  // ====================================================
  //
  // IMPORTANTE:
  //
  // La ruta + identidad ya fueron validadas ANTES.
  //
  // localStorage NO autoriza.
  //
  // Solo recuerda el modo visual una vez que Genesis
  // confirma que ese modo está permitido.
  // ====================================================

  useEffect(() => {

    if (
      authData.loading ||
      !role ||
      !requiredMode ||
      !modeAllowed
    ) {

      return;
    }


    if (
      mode !== requiredMode
    ) {

      switchMode(
        requiredMode
      );
    }

  }, [
    authData.loading,
    role,
    requiredMode,
    modeAllowed,
    mode,
    switchMode,
  ]);


  // ====================================================
  // LOADING
  // ====================================================

  if (authData.loading) {

    return (

      <div className="min-h-screen bg-[#0a0a0a] text-amber-500 flex items-center justify-center font-bold uppercase tracking-widest">

        Validando Seguridad Genesis...

      </div>
    );
  }


  // ====================================================
  // AUTH ERROR
  // ====================================================

  if (authData.error) {

    return (

      <SecurityScreen
        title="Error de Identidad"
        message="Genesis no pudo validar la identidad de esta sesión."
      />
    );
  }


  // ====================================================
  // NO SESSION
  // ====================================================

  if (
    !authData.user ||
    !identity
  ) {

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  // ====================================================
  // ACCOUNT STATUS
  // ====================================================

  if (
    accountStatus === 'PENDING'
  ) {

    return (

      <SecurityScreen
        title="Cuenta en Revisión"
        message="Tu solicitud de licencia o acceso está pendiente de revisión."
      />
    );
  }


  if (
    accountStatus === 'SUSPENDED'
  ) {

    return (

      <SecurityScreen
        title="Cuenta Suspendida"
        message="El acceso a esta cuenta se encuentra suspendido. Contacta con administración."
      />
    );
  }


  /**
   * FAIL CLOSED
   *
   * Cualquier estado desconocido queda bloqueado.
   */

  if (
    accountStatus !== 'ACTIVE'
  ) {

    return (

      <SecurityScreen
        title="Estado de Cuenta Inválido"
        message="Genesis no reconoce el estado actual de esta cuenta."
      />
    );
  }


  // ====================================================
  // ROLE GATE
  // ====================================================

  if (
    !allowedRoles.includes(role)
  ) {

    return (

      <Navigate
        to={getHomeForRole(role)}
        replace
      />
    );
  }


  // ====================================================
  // MODE GATE
  // ====================================================

  if (
    requiredMode &&
    !modeAllowed
  ) {

    return (

      <AccessDenied
        role={role}
        message="Tu rol o plan actual no permite utilizar este modo operacional."
      />
    );
  }


  // ====================================================
  // OPERATIONAL PROFILE GATE
  // ====================================================

  if (
    requiredMode ===
      GENESIS_MODES.COACH &&
    !authData.coachProfile
  ) {

    return (

      <AccessDenied
        role={role}
        message="Genesis no encontró el perfil operacional Coach requerido para esta experiencia."
      />
    );
  }


  if (
    requiredMode ===
      GENESIS_MODES.ATHLETE &&
    !authData.athleteProfile
  ) {

    return (

      <AccessDenied
        role={role}
        message="Genesis no encontró el perfil operacional Athlete requerido para esta experiencia."
      />
    );
  }


  // ====================================================
  // APP ENTITLEMENT GATE
  // ====================================================

  if (
    requiredApp &&
    !entitlements
      ?.apps
      ?.[requiredApp]
  ) {

    return (

      <AccessDenied
        role={role}
        message="Esta aplicación no está incluida en tu plan o no cumple las reglas de elegibilidad."
      />
    );
  }


  // ====================================================
  // ACCESS GRANTED
  // ====================================================

  return children;
};


// ======================================================
// MAIN APPLICATION
// ======================================================

export default function App() {

  return (

    <ThemeProvider>

      <BrowserRouter>

        <Routes>


          {/* ============================================= */}
          {/* PUBLIC */}
          {/* ============================================= */}

          <Route
            path="/"
            element={<Login />}
          />


          <Route
            path="/register/coach"
            element={<RegisterCoach />}
          />


          <Route
            path="/register/athlete"
            element={<RegisterAthlete />}
          />


          {/* ============================================= */}
          {/* SUPER ADMIN */}
          {/* ============================================= */}

          <Route
            path="/super-admin"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                ]}
                requiredMode={
                  GENESIS_MODES.ADMIN
                }
              >

                <SuperAdminDashboard />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* COACH MODE */}
          {/* ============================================= */}

          <Route
            path="/coach"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                ]}
                requiredMode={
                  GENESIS_MODES.COACH
                }
              >

                <CoachDashboard />

              </ProtectedRoute>
            }
          />


          <Route
            path="/coach/settings"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                ]}
                requiredMode={
                  GENESIS_MODES.COACH
                }
              >

                <CoachSettings />

              </ProtectedRoute>
            }
          />


          <Route
            path="/coach/notifications"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                ]}
                requiredMode={
                  GENESIS_MODES.COACH
                }
              >

                <CoachNotifications />

              </ProtectedRoute>
            }
          />


          <Route
            path="/coach/client/:id"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                ]}
                requiredMode={
                  GENESIS_MODES.COACH
                }
              >

                <ClientProfile />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* ATHLETE MODE */}
          {/* ============================================= */}

          <Route
            path="/client"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                  'ATHLETE',
                ]}
                requiredMode={
                  GENESIS_MODES.ATHLETE
                }
              >

                <ClientDashboard />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* ATHLETE ONBOARDING */}
          {/* ============================================= */}
          {/*
              Solo una cuenta ATHLETE real debe ejecutar
              el onboarding comercial inicial.

              Los perfiles inmersivos de Coach/Admin
              no pasan por este formulario.
          */}

          <Route
            path="/client/onboarding"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'ATHLETE',
                ]}
                requiredMode={
                  GENESIS_MODES.ATHLETE
                }
              >

                <ClientOnboarding />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* EL ARQUITECTO */}
          {/* ============================================= */}

          <Route
            path="/client/arquitecto"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                  'ATHLETE',
                ]}
                requiredMode={
                  GENESIS_MODES.ATHLETE
                }
                requiredApp="architect"
              >

                <ElArquitecto />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* TRAINER PRO */}
          {/* ============================================= */}

          <Route
            path="/client/entrenamiento"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                  'ATHLETE',
                ]}
                requiredMode={
                  GENESIS_MODES.ATHLETE
                }
                requiredApp="trainerPro"
              >

                <AppTrainerPro />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* DISCIPLINA */}
          {/* ============================================= */}

          <Route
            path="/client/disciplina"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                  'ATHLETE',
                ]}
                requiredMode={
                  GENESIS_MODES.ATHLETE
                }
                requiredApp="discipline"
              >

                <MonitoreoDisciplina />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* REGULACIÓN HORMONAL */}
          {/* ============================================= */}

          <Route
            path="/client/hormonal"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                  'ATHLETE',
                ]}
                requiredMode={
                  GENESIS_MODES.ATHLETE
                }
                requiredApp="hormonal"
              >

                <RegulacionHormonal />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* COMMUNICATION NETWORK */}
          {/* ============================================= */}
          {/*
              Chat todavía utiliza el ROLE real internamente.

              En una fase posterior lo volveremos
              MODE-AWARE para que un Coach Elite
              en Athlete Mode tenga experiencia Athlete.
          */}

          <Route
            path="/chat"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                  'COACH',
                  'ATHLETE',
                ]}
              >

                <Chat />

              </ProtectedRoute>
            }
          />


          {/* ============================================= */}
          {/* FALLBACK */}
          {/* ============================================= */}

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />


        </Routes>

      </BrowserRouter>

    </ThemeProvider>
  );
}