/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wathba: {
          50: '#f4f7f8',
          100: '#e3ecf3', // Secondary Brand Color (اللون الثانوي المعتمد)
          200: '#c5d8df',
          300: '#9ebdca',
          400: '#6997a6',
          500: '#4c7f8f',
          600: '#3b707d', // Primary Brand Color (اللون الأساسي المعتمد للمكتبة)
          700: '#325d68',
          800: '#2b4e57',
          900: '#27434b',
          950: '#162b31',
        },
        brand: {
          primary: '#3b707d',
          secondary: '#e3ecf3',
          dark: '#162b31',
          light: '#f6f8fa',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f6f8fa',
          muted: '#e3ecf3',
        },
        royal: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9ddfd',
          300: '#7cc2fb',
          400: '#36a3f7',
          500: '#0c87eb',
          600: '#026bc9',
          700: '#0255a2',
          800: '#064885',
          900: '#0b3d6f',
          950: '#07274a',
        },
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        }
      },
      fontFamily: {
        arabic: ['Tajawal', 'Cairo', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(59, 112, 125, 0.08)',
        'card': '0 10px 25px -5px rgba(59, 112, 125, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
        'premium': '0 20px 40px -15px rgba(59, 112, 125, 0.18)',
      }
    },
  },
  plugins: [],
}
