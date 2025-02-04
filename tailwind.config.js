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
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
        'xs': '475px',
        'sm': '640px',
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
        // Add your custom colors here
        titleBar: {
          DEFAULT: '#FEF9F4',
          dark: '#16161E',
        },
        body:{
          DEFAULT: '#fff',
          dark: '#16161E',
        },
        primary: '#F45513',
        secondary: '#202020',
        divider: '#D1D5DB',
        tabs: '#fef9f4',
        lightGray: '#EDEDED',
        darkMode: '#16161E',
        darkModeCompliment: '#21212d',
        inputDarkMode: '#FEF9F426',
        skeleton: '#E8EDF1',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
