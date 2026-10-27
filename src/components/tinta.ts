import { COLOR } from '../lib/colores'

// SVG necesita el valor, no la clase de Tailwind, así que los tonos de las
// gráficas salen de los colores de la app.
export const TINTA = {
  serie: COLOR.verdeDato, // la línea que es tuya
  guia: COLOR.tintaTenue, // la referencia contra la que te mides
  aviso: COLOR.barro,
  texto: COLOR.tintaSuave, // las notas
  reja: COLOR.papelHundido,
  papel: COLOR.papelAlto,
}
