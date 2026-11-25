import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PlayNex master palette
        page: '#F8FAFC',
        card: '#FFFFFF',
        brand: {
          50:  '#E8F5EE',
          100: '#C5E9D7',
          200: '#9DD8BC',
          300: '#6DC5A0',
          400: '#3DB585',
          500: '#16A36A',   // PlayNex primary green
          600: '#12896A',
          700: '#0E7055',
          800: '#0B5940',
          900: '#07432E',
          DEFAULT: '#16A36A',
          primary: '#16A36A',
          secondary: '#C5E9D7',
        },
        navy: {
          50:  '#E8EAF0',
          100: '#C5CAD8',
          200: '#9EA6BE',
          300: '#7782A4',
          400: '#566490',
          500: '#354778',
          600: '#1D2F60',
          700: '#131F47',
          800: '#101828',   // PlayNex primary navy (darkest)
          900: '#0B1020',
          DEFAULT: '#101828',
        },
        ink: {
          DEFAULT: '#172033',
          muted:   '#667085',
          subtle:  '#98A2B3',
          faint:   '#D0D5DD',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          card:    '#FFFFFF',
          subtle:  '#F8FAFC',
          muted:   '#F2F4F7',
          border:  '#E5E7EB',
        },
        ok:   '#10B981',
        warn: '#F59E0B',
        bad:  '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'xs':         '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card':       '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
