/** @type {import('tailwindcss').Config} */
/* Tailwind scans React source files and supplies the shared visual palette. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep ink navy for text and navigation
        ink: { 900: '#14233B', 800: '#1F3049', 700: '#2E3F58', 500: '#5B6676', 400: '#7D8795', 300: '#A9B1BC' },
        // Cool paper background and hairlines
        paper: '#F6F7F5',
        line: '#DDE2DC',
        // Ledger green: primary actions and "done"
        ledger: { 50: '#EAF3EE', 100: '#D3E6DB', 500: '#2F8A61', 600: '#1E6B4A', 700: '#175A3D', 800: '#114530' },
        // Amber: due soon
        due: { 50: '#FBF3E6', 100: '#F5E1BF', 600: '#B8741A', 700: '#93590F' },
        // Signal red: overdue / destructive
        signal: { 50: '#FDECEA', 100: '#F9D3CE', 600: '#B42318', 700: '#912018' },
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Modular scale (~1.25)
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.875rem', { lineHeight: '1.3rem' }],
        base: ['1rem', { lineHeight: '1.55rem' }],
        lg: ['1.125rem', { lineHeight: '1.65rem' }],
        xl: ['1.375rem', { lineHeight: '1.8rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.1rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.6rem' }],
        '4xl': ['3rem', { lineHeight: '3.3rem' }],
      },
      borderRadius: { DEFAULT: '6px', lg: '10px' },
      boxShadow: { raise: '0 1px 0 rgba(20,35,59,0.04), 0 8px 24px -12px rgba(20,35,59,0.18)' },
    },
  },
  plugins: [],
};
