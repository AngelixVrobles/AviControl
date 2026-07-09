/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F6F4EE',
          raised: '#FCFBF7',
          sunken: '#EEEBE2',
        },
        ink: {
          DEFAULT: '#1B2B22',
          soft: '#3E4E44',
          faint: '#5C6A61',
        },
        line: '#E3DFD3',
        forest: {
          50: '#EAF4EC',
          100: '#CDE6D3',
          400: '#4FA968',
          500: '#2F8A4C',
          600: '#256F3D',
          700: '#1D5730',
        },
        amber: {
          400: '#E9A93C',
          500: '#D98E22',
          600: '#B4711A',
          700: '#8A5510',
        },
        clay: {
          DEFAULT: '#C4622D',
          deep: '#9C4218',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: '#E3DFD3',
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,43,34,0.04), 0 8px 24px -12px rgba(27,43,34,0.10)',
        pop: '0 8px 40px -8px rgba(27,43,34,0.22)',
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem',
      },
    },
  },
  plugins: [],
}
