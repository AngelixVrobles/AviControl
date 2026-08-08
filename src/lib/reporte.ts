import type { Lote } from '../db/schema'
import type { LoteMetrics } from './metrics'
import { money, num, pct } from './format'
import { tipoLoteLabel } from './labels'

const C = {
  paper: '#F6F4EE',
  raised: '#FCFBF7',
  line: '#E3DFD3',
  ink: '#1B2B22',
  faint: '#5C6A61',
  forest: '#2F8A4C',
  forestSoft: '#4FA968',
  forestDark: '#1D5730',
  clay: '#9C4218',
  amber: '#E9A93C',
}

export interface KpiReporte {
  label: string
  value: string
}

export async function compartirReporte(
  lote: Lote,
  m: LoteMetrics,
  granja: string,
  kpis: KpiReporte[],
) {
  await document.fonts.ready

  const W = 800
  const filas = Math.ceil(kpis.length / 2)
  const kpisY = 486
  const pieY = kpisY + filas * 132 + 26
  const H = pieY + 100
  const S = 2

  const canvas = document.createElement('canvas')
  canvas.width = W * S
  canvas.height = H * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)

  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = C.forestDark
  ctx.fillRect(0, 0, W, 128)
  dibujarMarca(ctx, 48, 34, 60)
  ctx.fillStyle = C.raised
  ctx.font = '600 34px Fraunces, serif'
  ctx.fillText('AviControl', 126, 62)
  ctx.fillStyle = 'rgba(252,251,247,0.78)'
  ctx.font = '400 19px Geist, sans-serif'
  const fechaHoy = new Date().toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  ctx.fillText(`${granja} · ${fechaHoy}`, 126, 94)

  ctx.fillStyle = C.ink
  ctx.font = '600 40px Fraunces, serif'
  ctx.fillText(recortar(ctx, lote.nombre, W - 96), 48, 198)
  ctx.fillStyle = C.faint
  ctx.font = '500 19px Geist, sans-serif'
  ctx.fillText(
    `${tipoLoteLabel(lote.tipo)} · Día ${m.dias} · ${num(m.avesVivas)} aves vivas`,
    48,
    230,
  )

  caja(ctx, 48, 266, W - 96, 168)
  const pos = m.ganancia >= 0
  ctx.fillStyle = C.faint
  ctx.font = '500 19px Geist, sans-serif'
  ctx.fillText(pos ? 'Ganancia' : 'Pérdida', 76, 308)
  ctx.fillStyle = pos ? C.forest : C.clay
  ctx.font = '600 56px Fraunces, serif'
  ctx.fillText(money(m.ganancia), 76, 368)
  ctx.fillStyle = C.faint
  ctx.font = '400 18px Geist, sans-serif'
  ctx.fillText(
    `Margen ${pct(m.margenPct)}   ·   Ingresos ${money(m.ingresos)}   ·   Costos ${money(m.costos)}`,
    76,
    406,
  )

  const bw = (W - 96 - 24) / 2
  kpis.forEach((k, i) => {
    const x = 48 + (i % 2) * (bw + 24)
    const y = kpisY + Math.floor(i / 2) * 132
    caja(ctx, x, y, bw, 110)
    ctx.fillStyle = C.ink
    ctx.font = '600 33px Fraunces, serif'
    ctx.fillText(k.value, x + 26, y + 52)
    ctx.fillStyle = C.faint
    ctx.font = '400 17px Geist, sans-serif'
    ctx.fillText(k.label, x + 26, y + 84)
  })

  ctx.strokeStyle = C.line
  ctx.beginPath()
  ctx.moveTo(48, pieY)
  ctx.lineTo(W - 48, pieY)
  ctx.stroke()
  ctx.fillStyle = C.faint
  ctx.font = '400 16px Geist, sans-serif'
  ctx.fillText('Generado con AviControl', 48, pieY + 46)

  // sello de campo
  ctx.save()
  ctx.strokeStyle = C.forest
  ctx.setLineDash([6, 5])
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(W - 48 - 220, pieY + 18, 220, 46, 10)
  ctx.stroke()
  ctx.fillStyle = C.forest
  ctx.font = '600 15px Geist, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('REPORTE DE CAMPO', W - 48 - 110, pieY + 46)
  ctx.restore()
  ctx.textAlign = 'left'

  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  const nombre = `reporte-${lote.nombre.toLowerCase().replace(/\s+/g, '-')}.png`
  const file = new File([blob], nombre, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `Reporte · ${lote.nombre}` }).catch(() => {})
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    URL.revokeObjectURL(url)
  }
}

function caja(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = C.raised
  ctx.strokeStyle = C.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 20)
  ctx.fill()
  ctx.stroke()
}

function recortar(ctx: CanvasRenderingContext2D, texto: string, max: number): string {
  if (ctx.measureText(texto).width <= max) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

// La marca «Engorde»: el anillo cónico, mismo path que public/icon.svg. Va en
// blanco sobre la cabecera verde, con el punto del día en verde claro.
const MARCA_RING =
  'M 256 97 L 283.7 98.7 L 310.8 105.3 L 336.5 116.5 L 359.9 132.1 L 380.4 151.6 L 397.2 174.5 L 409.9 200 L 417.9 227.5 L 421.1 256 L 419.2 284.8 L 412.4 312.9 L 400.7 339.6 L 384.5 363.9 L 364.3 385 L 340.6 402.5 L 314.1 415.6 L 285.6 423.9 L 256 427.2 L 226.2 425.2 L 197 418.1 L 169.4 406 L 144.2 389.2 L 122.3 368.2 L 104.2 343.6 L 90.7 316.2 L 82.1 286.7 L 78.7 256 L 80.8 225.1 L 88.2 194.9 L 100.7 166.4 L 118.1 140.3 L 139.9 117.6 L 165.3 99 L 193.8 85 A 34 34 0 0 1 217 148.9 L 198.7 156.7 L 181.9 167.6 L 167.1 181.4 L 154.9 197.6 L 145.7 215.9 L 139.7 235.5 L 137.3 256 L 138.4 276.7 L 143.1 297.1 L 151.4 316.4 L 163 334.1 L 177.5 349.5 L 194.6 362.3 L 213.8 372 L 234.4 378.3 L 256 380.8 L 277.8 379.6 L 299.2 374.6 L 319.4 365.8 L 338 353.7 L 354.2 338.4 L 367.6 320.4 L 377.7 300.3 L 384.2 278.6 L 386.9 256 L 385.6 233.2 L 380.3 210.8 L 371.1 189.5 L 358.4 170.1 L 342.3 153.1 L 323.5 139.1 L 302.4 128.5 L 279.7 121.8 L 256 119 Z'

function dibujarMarca(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 512
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = C.raised
  ctx.fill(new Path2D(MARCA_RING))
  ctx.fillStyle = C.forestSoft
  ctx.beginPath()
  ctx.arc(230.3, 110.3, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
