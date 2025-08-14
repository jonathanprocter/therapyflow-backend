import { useContext, createContext } from 'react';
import { sageTheme } from '@/lib/sage-theme';

export const ThemeContext = createContext({
  theme: sageTheme,
  isDark: false,
  toggleDark: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
