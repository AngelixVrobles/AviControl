// La marca de AviControl: el anillo del ciclo, que engorda del día 1 al 42,
// con el pollito de un día adentro, el que entra al galpón al empezar cada
// pollada. Son las mismas formas de public/icon.svg, en una cuadrícula de 512:
// el logo de Inicio y la imagen que se manda por WhatsApp la dibujan de aquí.

/** El anillo: grosor de 22 a 68 a lo largo de 340°, abierto arriba. */
export const ANILLO =
  'M 256 97 L 283.7 98.7 L 310.8 105.3 L 336.5 116.5 L 359.9 132.1 L 380.4 151.6 L 397.2 174.5 L 409.9 200 L 417.9 227.5 L 421.1 256 L 419.2 284.8 L 412.4 312.9 L 400.7 339.6 L 384.5 363.9 L 364.3 385 L 340.6 402.5 L 314.1 415.6 L 285.6 423.9 L 256 427.2 L 226.2 425.2 L 197 418.1 L 169.4 406 L 144.2 389.2 L 122.3 368.2 L 104.2 343.6 L 90.7 316.2 L 82.1 286.7 L 78.7 256 L 80.8 225.1 L 88.2 194.9 L 100.7 166.4 L 118.1 140.3 L 139.9 117.6 L 165.3 99 L 193.8 85 A 34 34 0 0 1 217 148.9 L 198.7 156.7 L 181.9 167.6 L 167.1 181.4 L 154.9 197.6 L 145.7 215.9 L 139.7 235.5 L 137.3 256 L 138.4 276.7 L 143.1 297.1 L 151.4 316.4 L 163 334.1 L 177.5 349.5 L 194.6 362.3 L 213.8 372 L 234.4 378.3 L 256 380.8 L 277.8 379.6 L 299.2 374.6 L 319.4 365.8 L 338 353.7 L 354.2 338.4 L 367.6 320.4 L 377.7 300.3 L 384.2 278.6 L 386.9 256 L 385.6 233.2 L 380.3 210.8 L 371.1 189.5 L 358.4 170.1 L 342.3 153.1 L 323.5 139.1 L 302.4 128.5 L 279.7 121.8 L 256 119 Z'

/** El pollito: cuerpo y cabeza que se funden, pico corto, ala y patitas. */
export const POLLITO = {
  cuerpo: { cx: 244, cy: 272, r: 60.8 },
  cabeza: { cx: 272.5, cy: 218.8, r: 39.9 },
  pico: 'M 306.7 209.3 L 329.5 218.8 L 306.7 228.3 Z',
  ojo: { cx: 285.8, cy: 211.2, r: 6.7 },
  ala: 'M 206 266.3 C 225 254.9, 261.1 260.6, 272.5 283.4 C 253.5 302.4, 219.3 298.6, 206 266.3 Z',
  patas: [226.9, 257.3].map((x) => ({ x, y: 321.4, w: 7.6, h: 24.7 })),
}

export const TINTA_MARCA = {
  fondo: '#153F27',
  fondoArriba: '#1E5638',
  fondoAbajo: '#112F1F',
  anillo: '#FBF8F1',
  pollito: '#F7C948',
  ala: '#E3A72C',
  pico: '#E58F2A',
}

/** La teja de 512, con las esquinas como las de un ícono de iPhone. */
export const RADIO_TEJA = 114
