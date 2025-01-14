/** @type {import('tailwindcss').Config} */
import { colors } from 'tailwindcss/defaultTheme';

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        ...colors, // Spread the default colors
        // Add your custom colors here
        titleBar: '#FEF9F4',
        primary: '#F45513',
      },
    },
  },
  plugins: [],
}