// Material Design M3 테마 유틸리티
import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    primary: {
      main: '#6750A4',
      light: '#EADDFF',
      dark: '#21005E',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#625B71',
      light: '#E8DEF8',
      dark: '#1E192B',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#B3261E',
      light: '#F9DEDC',
      dark: '#410E0B',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFBFE',
      paper: '#FFFBFE',
    },
    text: {
      primary: '#1C1B1F',
      secondary: '#49454F',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: {
      fontSize: '57px',
      lineHeight: '64px',
      fontWeight: 400,
      letterSpacing: '-0.25px',
    },
    h2: {
      fontSize: '32px',
      lineHeight: '40px',
      fontWeight: 400,
    },
    body1: {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 400,
      letterSpacing: '0.5px',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          textTransform: 'none',
          padding: '10px 24px',
        },
        contained: {
          boxShadow: '0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '4px',
          },
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  ...lightTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#D0BCFF',
      light: '#EADDFF',
      dark: '#381E72',
      contrastText: '#381E72',
    },
    secondary: {
      main: '#CCC2DC',
      light: '#E8DEF8',
      dark: '#332D41',
      contrastText: '#332D41',
    },
    background: {
      default: '#1C1B1F',
      paper: '#1C1B1F',
    },
    text: {
      primary: '#E6E1E5',
      secondary: '#CAC4D0',
    },
  },
});
