import React, { createContext, useState, useEffect } from 'react';
import { lightTheme, darkTheme, Theme } from '../core/theme';
import Store from '../core/store';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  isDark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(Store.settings().theme === 'dark');

  useEffect(() => {
    const unsub = Store.subscribe(() => {
      setIsDark(Store.settings().theme === 'dark');
    });
    return () => { unsub(); };
  }, []);

  function toggle() {
    const next = isDark ? 'light' : 'dark';
    Store.setSetting('theme', next);
    setIsDark(next === 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
