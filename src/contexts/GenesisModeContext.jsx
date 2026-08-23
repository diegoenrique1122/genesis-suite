import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  GENESIS_MODES,
} from '../core';


const GenesisModeContext =
  createContext(null);


const VALID_MODES = new Set([
  GENESIS_MODES.ADMIN,
  GENESIS_MODES.COACH,
  GENESIS_MODES.ATHLETE,
]);


/**
 * =====================================================
 * NORMALIZE STORED MODE
 * =====================================================
 *
 * localStorage es únicamente memoria de interfaz.
 *
 * NUNCA concede permisos.
 *
 * ProtectedRoute es quien valida:
 *
 * - identidad
 * - role
 * - account status
 * - plan
 * - mode
 * - entitlement
 */

function getStoredMode() {

  try {

    const stored =
      localStorage.getItem(
        'genesis_active_mode'
      );


    if (
      stored &&
      VALID_MODES.has(stored)
    ) {

      return stored;
    }


  } catch (error) {

    console.warn(
      'Genesis Mode localStorage unavailable:',
      error
    );
  }


  /**
   * Default visual únicamente.
   *
   * ProtectedRoute lo reemplazará
   * por el modo autorizado de la ruta.
   */

  return GENESIS_MODES.ADMIN;
}


/**
 * =====================================================
 * PROVIDER
 * =====================================================
 */

export function GenesisModeProvider({
  children,
}) {

  const [
    mode,
    setMode,
  ] = useState(
    getStoredMode
  );


  /**
   * ===================================================
   * PERSIST UI MODE
   * ===================================================
   */

  useEffect(() => {

    try {

      localStorage.setItem(
        'genesis_active_mode',
        mode
      );


    } catch (error) {

      console.warn(
        'Genesis Mode could not be persisted:',
        error
      );
    }

  }, [mode]);


  /**
   * ===================================================
   * SWITCH MODE
   * ===================================================
   *
   * Este método NO autoriza.
   *
   * ProtectedRoute debe haber validado
   * previamente el modo solicitado.
   */

  const switchMode =
    useCallback(
      (newMode) => {

        if (
          !VALID_MODES.has(newMode)
        ) {

          console.warn(
            'Genesis rejected invalid UI mode:',
            newMode
          );

          return false;
        }


        setMode(
          newMode
        );


        return true;
      },
      []
    );


  /**
   * ===================================================
   * RESET
   * ===================================================
   */

  const resetMode =
    useCallback(
      () => {

        setMode(
          GENESIS_MODES.ADMIN
        );
      },
      []
    );


  return (

    <GenesisModeContext.Provider
      value={{
        mode,
        switchMode,
        resetMode,
      }}
    >

      {children}

    </GenesisModeContext.Provider>
  );
}


/**
 * =====================================================
 * HOOK
 * =====================================================
 */

export function useGenesisMode() {

  const context =
    useContext(
      GenesisModeContext
    );


  if (!context) {

    throw new Error(
      'useGenesisMode debe utilizarse dentro de GenesisModeProvider'
    );
  }


  return context;
}