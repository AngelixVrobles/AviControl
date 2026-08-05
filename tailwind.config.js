/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F7F5EF',
          raised: '#FFFEFA',
          sunken: '#EDE9DD',
        },
        sunken: '#EDE9DD',
        ink: {
          DEFAULT: '#14201A',
          soft: '#3A4840',
          faint: '#5F6D64',
          muted: '#5F6D64',
        },
        line: '#DCD6C7',
        forest: {
          50: '#E4EEE6',
          100: '#C5DACB',
          400: '#4FA968',
          500: '#1E7340',
          600: '#175C31',
          700: '#153F27',
          deep: '#153F27',
          darkest: '#123F24',
        },
        green: {
          action: '#1E7340',
          text: '#146B34',
          tint: '#E4EEE6',
          'tint-line': '#C5DACB',
          'on-dark': '#4FA968',
          pale: '#B9DCC3',
        },
        amber: {
          400: '#E9A93C',
          500: '#B8720F',
          600: '#B8720F',
          700: '#8A5510',
          text: '#8A5510',
          tint: '#FDF0D6',
          line: '#EBC77F',
        },
        clay: {
          DEFAULT: '#A03A16',
          deep: '#8A2F11',
          text: '#8A2F11',
          tint: '#FBE7DE',
          line: '#F0CFC0',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: '#DCD6C7',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,32,26,0.04), 0 8px 24px -12px rgba(20,32,26,0.10)',
        pop: '0 8px 24px -6px rgba(20,32,26,0.4)',
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem',
      },
    },
  },
  plugins: [],
}
