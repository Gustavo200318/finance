/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#E6EEF6',
        surface: '#EDF4FA',
        card: '#FFFFFF',
        'card-top': '#F6FBFF',
        border: '#D0DFEE',
        'border-lt': '#E4EFF8',
        'text-1': '#0C1B2C',
        'text-2': '#3A5570',
        'text-3': '#7A97B0',
        'text-4': '#AABFCF',
        green: {
          DEFAULT: '#0B6847',
          lt: '#E2F5EC',
          md: '#D0EFE1',
        },
        red: {
          DEFAULT: '#B83A30',
          lt: '#FAECEA',
        },
        amber: {
          DEFAULT: '#8A6010',
          lt: '#FEF6E4',
        },
        slate: {
          DEFAULT: '#2E4D65',
          soft: '#CBD8E5',
        },
      },
      fontFamily: {
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        glass: '14px',
        pill: '20px',
      },
      boxShadow: {
        shell: '0 4px 60px rgba(12, 27, 44, 0.12)',
      },
      letterSpacing: {
        tight2: '-0.02em',
        tight3: '-0.025em',
        wide1: '0.1em',
        wide2: '0.12em',
        wide3: '0.14em',
      },
      fontSize: {
        '2xs': '9px',
        '3xs': '9.5px',
      },
    },
  },
  plugins: [],
};
