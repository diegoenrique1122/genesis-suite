import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

import {
  Loader2,
  User,
  Mail,
  Lock,
  Building,
} from 'lucide-react';


export default function RegisterCoach() {

  const navigate =
    useNavigate();


  const [
    formData,
    setFormData,
  ] = useState({

    name: '',
    email: '',
    password: '',
  });


  const [
    loading,
    setLoading,
  ] = useState(false);


  const handleRegister = async (e) => {

    e.preventDefault();

    setLoading(true);


    try {

      const fullName =
        formData
          .name
          .trim();


      if (!fullName) {

        throw new Error(
          'Debes ingresar tu nombre completo.'
        );
      }


      /**
       * ================================================
       * GENESIS SECURE COACH SIGNUP
       * ================================================
       *
       * React únicamente crea Auth.
       *
       * Supabase Trigger crea:
       *
       * users_master
       *   role = COACH
       *   account_status = PENDING
       *
       * coaches_profile
       *   b2b_plan = IGNICION
       *
       * El navegador NO puede aprobar al Coach,
       * asignarse ELITE ni convertirse en SUPER_ADMIN.
       */

      const {
        data,
        error: authError,
      } = await supabase.auth.signUp({

        email:
          formData
            .email
            .trim()
            .toLowerCase(),

        password:
          formData.password,

        options: {

          data: {

            genesis_registration_type:
              'COACH',

            full_name:
              fullName,
          },
        },
      });


      if (authError) {
        throw authError;
      }


      if (!data?.user) {

        throw new Error(
          'Supabase no devolvió una identidad válida.'
        );
      }


      /**
       * El Coach siempre nace PENDING.
       *
       * Incluso si obtiene sesión inmediata,
       * ProtectedRoute bloqueará /coach hasta que
       * SuperAdmin cambie account_status → ACTIVE.
       */

      if (data.session) {

        alert(
          '✅ Solicitud enviada. Tu cuenta permanecerá bloqueada hasta que el Súper Admin apruebe tu licencia.'
        );


        navigate(
          '/coach'
        );

        return;
      }


      /**
       * Confirmación de email activada.
       */

      alert(
        '✅ Solicitud creada. Revisa tu correo electrónico para confirmar tu cuenta. Después de confirmar, tu licencia seguirá pendiente de aprobación administrativa.'
      );


      navigate('/');


    } catch (error) {

      console.error(
        'Genesis Coach Registration:',
        error
      );


      alert(
        `❌ Error: ${error.message}`
      );


    } finally {

      setLoading(false);
    }
  };


  return (

    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">

      <div className="w-full max-w-md bg-[#111] border border-neutral-800 rounded-3xl p-8 shadow-2xl">


        <div className="flex flex-col items-center mb-8 text-center">

          <Building
            size={48}
            className="text-white mb-4"
          />


          <h1 className="text-2xl font-black text-white uppercase tracking-widest">

            Aplica a Genesis

          </h1>


          <p className="text-xs text-neutral-500 font-mono mt-2">

            SaaS exclusivo para Entrenadores B2B.

          </p>

        </div>


        <form
          onSubmit={handleRegister}
          className="space-y-4"
        >


          <div>

            <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">

              Nombre Completo

            </label>


            <div className="relative">

              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
                size={16}
              />


              <input
                type="text"
                value={
                  formData.name
                }
                onChange={(e) =>
                  setFormData({

                    ...formData,

                    name:
                      e.target.value,
                  })
                }
                required
                className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-white outline-none transition-colors"
                placeholder="Ej. Carlos Fitness"
              />

            </div>

          </div>


          <div>

            <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">

              Correo de Negocio

            </label>


            <div className="relative">

              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
                size={16}
              />


              <input
                type="email"
                value={
                  formData.email
                }
                onChange={(e) =>
                  setFormData({

                    ...formData,

                    email:
                      e.target.value,
                  })
                }
                required
                className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-white outline-none transition-colors"
                placeholder="coach@tumarca.com"
              />

            </div>

          </div>


          <div>

            <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">

              Contraseña Maestra

            </label>


            <div className="relative">

              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
                size={16}
              />


              <input
                type="password"
                value={
                  formData.password
                }
                onChange={(e) =>
                  setFormData({

                    ...formData,

                    password:
                      e.target.value,
                  })
                }
                required
                minLength="6"
                className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-white outline-none transition-colors"
                placeholder="Mínimo 6 caracteres"
              />

            </div>

          </div>


          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-neutral-200 transition-colors flex justify-center mt-6"
          >

            {loading

              ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              )

              : 'Solicitar Licencia B2B'
            }

          </button>

        </form>


        <div className="mt-6 text-center border-t border-neutral-800 pt-6">

          <Link
            to="/"
            className="text-[10px] font-mono text-neutral-500 hover:text-white uppercase transition-colors"
          >

            &larr; Volver al Login

          </Link>

        </div>

      </div>

    </div>
  );
}