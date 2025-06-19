/* eslint-disable prettier/prettier */
/** @type {import('tailwindcss').Config} */
import { colors } from 'tailwindcss/defaultTheme';

module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '950px',
      'lg': '980px',
      '2xl': '1400px',
    },
    container: {
      center: true,
      padding: '2rem',
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '900px',
        'lg': '950px',
        '2xl': '1400px',
      },
    },
    extend: {
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      colors: {
        ...colors, // Spread the default colors
        titleBar: {
          DEFAULT: '#FEF9F4',
          dark: '#09090B',
        },
        body:{
          DEFAULT: '#fff',
          dark: '#09090B',
        },
        primary: '#F45513',
        secondary: '#202020',
        divider: '#D1D5DB',
        tabs: '#fef9f4',
        lightGray: '#EDEDED',
        darkMode: '#09090B',
        darkModeCompliment: '#272727',
        darkModeBorderColor: '#434347',
        darkModeDropdown: '#18181B',
        darkModeLight: '#D4D4D8',
        darkModeHover: '#3E3E46',
        inputDarkMode: '#FEF9F426',
        skeleton: '#E8EDF1',
        border: '#E4E4E7',
        detailsTab: '#EDEDED',
        componentBorder:'#BCBCBC',
        availableStatus: '#34C759', // Status Available and Download Icon
        notAvailableStatus: '#787575',
        darkModeNotAvailableStatus: '#C6C6C6',
        darkModeButtonDefault: '#71717A',
        darkModeButtonActive: '#E4E4E7',
        darkModeButtonHover: '#D4D4D8',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
