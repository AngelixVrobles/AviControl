import type { Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { entregarArchivo, nombreArchivo, type ComoSeGuardo } from './archivo'
import { COLOR } from './colores'
import { money, num, pct } from './format'

export interface KpiReporte {
  label: string
  value: string
}

// Lo que se sabe de un ciclo que sigue: todavía no hay ganancia que mostrar,
// pero sí la que se estima con lo que falta por pagar.
// El mínimo para no perder va entre los números del ciclo.
export interface EnCursoReporte {
  valorEnPie?: number
  gananciaEstimada?: number
  /** Se vende arreglado: el mínimo es por libra arreglada y el valor, arreglado. */
  arreglado?: boolean
}

const W = 800
const M = 48 // margen
const S = 2 // a doble resolución: en el teléfono del socio se ve nítida

const LETRA = {
  granja: '600 38px Fraunces, serif',
  fecha: '400 20px Geist, sans-serif',
  ciclo: '600 44px Fraunces, serif',
  sub: '500 21px Geist, sans-serif',
  etiqueta: '500 21px Geist, sans-serif',
  heroe: '600 64px Fraunces, serif',
  fila: '400 21px Geist, sans-serif',
  filaValor: '600 23px Geist, sans-serif',
  kpi: '600 36px Fraunces, serif',
  kpiEtiqueta: '400 19px Geist, sans-serif',
  pie: '500 18px Geist, sans-serif',
}

// La imagen que se manda por WhatsApp al socio o al que compra. Primero de
// quién es —la granja—, después la cifra que importa en grande y debajo el
// resto, todo con letra que se lea en un teléfono sin hacer zoom. Antes la
// cabecera era de la app, la cifra grande de un ciclo en curso era lo
// invertido y los textos largos se cortaban con «…».
export async function compartirReporte(
  lote: Lote,
  m: LoteMetrics,
  granja: string,
  kpis: KpiReporte[],
  enCurso?: EnCursoReporte,
): Promise<ComoSeGuardo> {
  // El menú de compartir solo se abre justo después del toque: nada de esperas
  // entre el toque y él. Las letras casi siempre ya están; si no, se esperan.
  if (document.fonts.status !== 'loaded') await document.fonts.ready

  // Se dibuja en un lienzo alto y se recorta al final: con los textos que
  // pasan de renglón, el alto no se sabe hasta terminar.
  const lienzo = document.createElement('canvas')
  lienzo.width = W * S
  lienzo.height = 2000 * S
  const ctx = lienzo.getContext('2d')!
  ctx.scale(S, S)
  ctx.fillStyle = COLOR.papel
  ctx.fillRect(0, 0, W, 2000)

  // Cabecera: la granja y el día.
  const fechaHoy = new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.font = LETRA.granja
  const lineasGranja = partir(ctx, granja.trim() || 'Mi granja', W - 2 * M)
  const altoCabecera = 44 + lineasGranja.length * 46 + 40
  ctx.fillStyle = COLOR.verdeOscuro
  ctx.fillRect(0, 0, W, altoCabecera)
  ctx.fillStyle = COLOR.papelAlto
  let y = 44
  for (const l of lineasGranja) {
    y += 36
    ctx.fillText(l, M, y)
    y += 10
  }
  ctx.fillStyle = 'rgba(255,254,250,0.8)'
  ctx.font = LETRA.fecha
  ctx.fillText(fechaHoy, M, y + 22)
  y = altoCabecera + 64

  // El ciclo.
  ctx.fillStyle = COLOR.tinta
  ctx.font = LETRA.ciclo
  for (const l of partir(ctx, lote.nombre, W - 2 * M)) {
    ctx.fillText(l, M, y)
    y += 52
  }
  ctx.fillStyle = COLOR.tintaTenue
  ctx.font = LETRA.sub
  const sub = [
    `Día ${num(m.dias)}`,
    m.avesVivas > 0 ? `${num(m.avesVivas)} aves vivas` : null,
    lote.estado === 'cerrado' ? 'ciclo cerrado' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  y = escribir(ctx, sub, M, y - 40, W - 2 * M, 30) + 30

  // La cifra grande y lo que la explica.
  const heroe = cifraPrincipal(m, enCurso)
  const filas = filasDelHeroe(m, enCurso, heroe.esInvertido)
  const altoCaja = 40 + 26 + 72 + (filas.length ? 24 + filas.length * 50 : 0) + 22
  caja(ctx, M, y, W - 2 * M, altoCaja)
  let yc = y + 40
  ctx.fillStyle = COLOR.tintaTenue
  ctx.font = LETRA.etiqueta
  ctx.fillText(heroe.etiqueta, M + 30, yc + 16)
  yc += 26 + 60
  ctx.fillStyle = heroe.color
  ctx.font = LETRA.heroe
  ctx.fillText(heroe.valor, M + 30, yc)
  yc += 12
  if (filas.length) {
    yc += 24
    for (const [etiqueta, valor] of filas) {
      ctx.strokeStyle = COLOR.linea
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(M + 30, yc)
      ctx.lineTo(W - M - 30, yc)
      ctx.stroke()
      ctx.fillStyle = COLOR.tintaSuave
      ctx.font = LETRA.fila
      ctx.fillText(etiqueta, M + 30, yc + 33)
      ctx.fillStyle = COLOR.tinta
      ctx.font = LETRA.filaValor
      ctx.textAlign = 'right'
      ctx.fillText(valor, W - M - 30, yc + 33)
      ctx.textAlign = 'left'
      yc += 50
    }
  }
  y += altoCaja + 24

  // Los números del ciclo, de dos en dos. La etiqueta pasa de renglón si no
  // cabe: «Mínimo por lb arreglada» se cortaba.
  const anchoKpi = (W - 2 * M - 20) / 2
  for (let i = 0; i < kpis.length; i += 2) {
    const par = kpis.slice(i, i + 2)
    ctx.font = LETRA.kpiEtiqueta
    const etiquetas = par.map((k) => partir(ctx, k.label, anchoKpi - 52))
    const altoFila = 48 + 28 + Math.max(...etiquetas.map((e) => e.length)) * 25 + 20
    par.forEach((k, j) => {
      const x = M + j * (anchoKpi + 20)
      caja(ctx, x, y, anchoKpi, altoFila)
      ctx.fillStyle = COLOR.tinta
      ctx.font = LETRA.kpi
      ctx.fillText(recortar(ctx, k.value, anchoKpi - 52), x + 26, y + 56)
      ctx.fillStyle = COLOR.tintaTenue
      ctx.font = LETRA.kpiEtiqueta
      etiquetas[j].forEach((l, n) => ctx.fillText(l, x + 26, y + 90 + n * 25))
    })
    y += altoFila + 20
  }

  // Pie: de dónde sale, chiquito.
  y += 8
  ctx.strokeStyle = COLOR.linea
  ctx.beginPath()
  ctx.moveTo(M, y)
  ctx.lineTo(W - M, y)
  ctx.stroke()
  dibujarMarca(ctx, M, y + 22, 30)
  ctx.fillStyle = COLOR.tintaTenue
  ctx.font = LETRA.pie
  ctx.fillText('Hecho con AviControl', M + 42, y + 43)
  const H = y + 74

  const canvas = document.createElement('canvas')
  canvas.width = W * S
  canvas.height = H * S
  canvas.getContext('2d')!.drawImage(lienzo, 0, 0)

  // `toDataURL` y no `toBlob`: es inmediato, y la imagen llega al menú de
  // compartir sin perder el permiso del toque. Antes, si el menú no se abría,
  // no pasaba nada y nadie se enteraba; ahora se descarga y se avisa.
  const datos = atob(canvas.toDataURL('image/png').split(',')[1])
  const bytes = new Uint8Array(datos.length)
  for (let i = 0; i < datos.length; i++) bytes[i] = datos.charCodeAt(i)
  const file = new File([bytes], `reporte-${nombreArchivo(lote.nombre)}.png`, { type: 'image/png' })
  return entregarArchivo(file)
}

// Con el ciclo en curso, lo que se espera ganar al vender; si todavía no se
// puede estimar, lo invertido. Decir «Pérdida» por toda la inversión de un
// ciclo que no ha vendido asustaba al socio que recibía la imagen.
function cifraPrincipal(m: LoteMetrics, enCurso?: EnCursoReporte) {
  if (enCurso?.gananciaEstimada != null) {
    const g = enCurso.gananciaEstimada
    return {
      etiqueta: g >= 0 ? 'Ganancia estimada al vender' : 'Pérdida estimada al vender',
      valor: money(g),
      color: g >= 0 ? COLOR.verde : COLOR.barroTexto,
      esInvertido: false,
    }
  }
  if (enCurso) return { etiqueta: 'Invertido hasta hoy', valor: money(m.costos), color: COLOR.tinta, esInvertido: true }
  return {
    etiqueta: m.ganancia >= 0 ? 'Ganancia' : 'Pérdida',
    valor: money(m.ganancia),
    color: m.ganancia >= 0 ? COLOR.verde : COLOR.barroTexto,
    esInvertido: false,
  }
}

function filasDelHeroe(m: LoteMetrics, enCurso: EnCursoReporte | undefined, esInvertido: boolean): [string, string][] {
  if (!enCurso)
    return [
      ['Ingresos', money(m.ingresos)],
      ['Costos', money(m.costos)],
      ['Margen', pct(m.margenPct)],
    ]
  const filas: [string, string][] = []
  if (!esInvertido) filas.push(['Invertido hasta hoy', money(m.costos)])
  if (m.ingresos > 0) filas.push(['Vendido', money(m.ingresos)])
  if (enCurso.valorEnPie != null && enCurso.valorEnPie > 0)
    filas.push([enCurso.arreglado ? 'Vale hoy, arreglado' : 'Valor en pie hoy', money(enCurso.valorEnPie)])
  if (esInvertido && m.ingresos === 0 && filas.length === 0) filas.push(['Vendido', 'todavía nada'])
  return filas
}

function caja(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = COLOR.papelAlto
  ctx.strokeStyle = COLOR.linea
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 20)
  ctx.fill()
  ctx.stroke()
}

/** Los renglones de un texto que no cabe en `max`, partido por palabras. */
export function partir(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, texto: string, max: number): string[] {
  const lineas: string[] = []
  let linea = ''
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra
    if (linea && ctx.measureText(prueba).width > max) {
      lineas.push(linea)
      linea = palabra
    } else linea = prueba
  }
  if (linea) lineas.push(linea)
  return lineas.length ? lineas : ['']
}

// Escribe partido en renglones y devuelve dónde quedó el último.
function escribir(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, max: number, alto: number) {
  for (const l of partir(ctx, texto, max)) {
    y += alto
    ctx.fillText(l, x, y)
  }
  return y
}

// Para una cifra, que no se parte: si de verdad no cabe, se corta.
function recortar(ctx: CanvasRenderingContext2D, texto: string, max: number): string {
  if (ctx.measureText(texto).width <= max) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

// La marca «Engorde»: el anillo cónico, mismo path que public/icon.svg, en el
// verde de la app, con el punto del día en verde claro.
const MARCA_RING =
  'M 256 97 L 283.7 98.7 L 310.8 105.3 L 336.5 116.5 L 359.9 132.1 L 380.4 151.6 L 397.2 174.5 L 409.9 200 L 417.9 227.5 L 421.1 256 L 419.2 284.8 L 412.4 312.9 L 400.7 339.6 L 384.5 363.9 L 364.3 385 L 340.6 402.5 L 314.1 415.6 L 285.6 423.9 L 256 427.2 L 226.2 425.2 L 197 418.1 L 169.4 406 L 144.2 389.2 L 122.3 368.2 L 104.2 343.6 L 90.7 316.2 L 82.1 286.7 L 78.7 256 L 80.8 225.1 L 88.2 194.9 L 100.7 166.4 L 118.1 140.3 L 139.9 117.6 L 165.3 99 L 193.8 85 A 34 34 0 0 1 217 148.9 L 198.7 156.7 L 181.9 167.6 L 167.1 181.4 L 154.9 197.6 L 145.7 215.9 L 139.7 235.5 L 137.3 256 L 138.4 276.7 L 143.1 297.1 L 151.4 316.4 L 163 334.1 L 177.5 349.5 L 194.6 362.3 L 213.8 372 L 234.4 378.3 L 256 380.8 L 277.8 379.6 L 299.2 374.6 L 319.4 365.8 L 338 353.7 L 354.2 338.4 L 367.6 320.4 L 377.7 300.3 L 384.2 278.6 L 386.9 256 L 385.6 233.2 L 380.3 210.8 L 371.1 189.5 L 358.4 170.1 L 342.3 153.1 L 323.5 139.1 L 302.4 128.5 L 279.7 121.8 L 256 119 Z'

function dibujarMarca(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 512
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = COLOR.verdeOscuro
  ctx.beginPath()
  ctx.roundRect(0, 0, 512, 512, 118)
  ctx.fill()
  ctx.fillStyle = COLOR.papelAlto
  ctx.fill(new Path2D(MARCA_RING))
  ctx.fillStyle = COLOR.verdeClaro
  ctx.beginPath()
  ctx.arc(230.3, 110.3, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
