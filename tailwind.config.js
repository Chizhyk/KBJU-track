/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        dark: { 950: '#09090b', 900: '#121215', 800: '#1c1c21', 700: '#27272e' }
      }
    }
  }
};
