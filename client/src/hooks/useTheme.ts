import { useContext, createContext } from 'react';
// import { sageTheme } from '@/lib/sage-theme';
const sageTheme = {
  colors: {
    primary: '#8EA58C',
    secondary: '#88A5BC',
    accent: '#738A6E',
    background: '#F2F3F1',
    text: '#344C3D'
  }
};

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
