// Los colores de la app como valores, para lo que no puede usar una clase de
// Tailwind: las gráficas en SVG y la imagen que se manda por WhatsApp, que se
// dibuja en canvas. Antes la imagen tenía su propia paleta, de otros verdes, y
// no parecía de la misma app. Son los de tailwind.config.js: una prueba revisa
// que no se aparten.
export const COLOR = {
  papel: '#F7F5EF', // paper
  papelAlto: '#FFFEFA', // paper-raised
  papelHundido: '#EDE9DD', // paper-sunken
  tinta: '#14201A', // ink
  tintaSuave: '#3A4840', // ink-soft
  tintaTenue: '#5A675F', // ink-faint
  linea: '#DCD6C7', // line
  verde: '#175C31', // forest-600: lo que se toca y lo que va a favor
  verdeDato: '#1E7340', // forest-500: las barras y la línea de tus datos
  verdeClaro: '#4FA968', // forest-400: solo sobre verde oscuro
  verdeOscuro: '#153F27', // forest-700
  verdeTinte: '#E4EEE6', // forest-50
  ambar: '#E9A93C', // amber-400
  ambarTexto: '#8A5510', // amber-text
  barro: '#A03A16', // clay
  barroTexto: '#8A2F11', // clay-text
} as const
