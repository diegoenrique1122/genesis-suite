import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  GENESIS_MODES,
} from '../core';


const GenesisModeContext =
  createContext(null);


export function GenesisModeProvider({
  children,
}) {

  const [mode, setMode] = useState(() => {

    const savedMode =
      localStorage.getItem(
        'genesis_active_mode'
      );

    return (
      savedMode ||
      GENESIS_MODES.ADMIN
    );
  });


  useEffect(() => {

    localStorage.setItem(
      'genesis_active_mode',
      mode
    );

  }, [mode]);


  const switchMode = (newMode) => {

    setMode(newMode);
  };


  const resetMode = () => {

    setMode(
      GENESIS_MODES.ADMIN
    );
  };


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


export function useGenesisMode() {

  const context =
    useContext(GenesisModeContext);


  if (!context) {

    throw new Error(
      'useGenesisMode debe utilizarse dentro de GenesisModeProvider'
    );
  }


  return context;
}