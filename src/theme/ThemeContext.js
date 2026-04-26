import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light } from './tokens';
import { colors as darkColors, lightColors } from '../theme';

const STORAGE_KEY = 'trimmerit.theme';

const ThemeContext = createContext({ theme: dark, mode: 'dark', toggle: () => {} });

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setMode] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      setMode(saved === 'light' || saved === 'dark' ? saved : (system ?? 'dark'));
    });
  }, []);

  async function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const resolved = mode ?? (system ?? 'dark');
  const theme = resolved === 'light' ? light : dark;

  return (
    <ThemeContext.Provider value={{ theme, mode: resolved, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export const useColors = () => {
  const { mode } = useContext(ThemeContext);
  return mode === 'light' ? lightColors : darkColors;
};
