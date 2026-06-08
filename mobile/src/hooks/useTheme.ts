import { useContext } from 'react';
import { ThemeContext } from '../navigation/ThemeContext';

export function useTheme() {
  return useContext(ThemeContext);
}
