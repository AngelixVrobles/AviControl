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
        ink: {
          DEFAULT: '#14201A',
          soft: '#3A4840',
          // 4.9 sobre el fondo hundido: el de antes se quedaba en 4.48, debajo de AA.
          faint: '#5A675F',
        },
        line: '#DCD6C7',
        // El borde de lo que se llena. `line` separa y no tiene que verse mucho,
        // pero una casilla con ese borde (1.4 de contraste) desaparecía al sol:
        // este pasa de 3, lo que pide un control para distinguirse.
        borde: '#8A8374',
        // Una sola familia. Antes convivían `forest` y `green` con los mismos
        // hexes bajo dos nombres: ocho colores repartidos en dieciocho tokens.
        //
        // El 600 es el verde de la app y hace dos trabajos —lo que se toca y lo
        // que va a favor—, porque no cabe un segundo: sobre este papel, los
        // únicos verdes que llegan a AA caen entre 5.4 y 7.4 de contraste, y el
        // primero más claro (400) se queda en 2.7 y no puede llevar texto. La
        // diferencia la marca la forma, no el color: los enlaces llevan verbo o
        // flecha, los valores llevan ✓ o ▲.
        forest: {
          50: '#E4EEE6',
          100: '#C5DACB',
          200: '#B9DCC3',
          400: '#4FA968',
          500: '#1E7340',
          600: '#175C31',
          700: '#153F27',
        },
        amber: {
          400: '#E9A93C',
          text: '#8A5510',
          tint: '#FDF0D6',
          line: '#EBC77F',
        },
        clay: {
          DEFAULT: '#A03A16',
          text: '#8A2F11',
          tint: '#FBE7DE',
          line: '#F0CFC0',
        },
      },
      // La escala de Tailwind ya servía: xs/sm/base/lg quedan como están y solo
      // se añaden los pasos de display, que es donde hacía falta aire. Antes
      // convivían 22 tamaños distintos elegidos a ojo pantalla por pantalla.
      fontSize: {
        // 13 px: a 12 las notas al pie no se leían al sol con el brazo estirado.
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
        xl: ['1.375rem', { lineHeight: '1.25' }],
        '2xl': ['1.75rem', { lineHeight: '1.15' }],
        '3xl': ['2.125rem', { lineHeight: '1.05' }],
        hero: ['2.5rem', { lineHeight: '1' }],
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
        xl2: '1rem',
        xl3: '1.75rem',
      },
    },
  },
  plugins: [],
}
