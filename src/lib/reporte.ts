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

// La marca de la app (huevo + hoja + yema), mismos paths que public/icon.svg
function dibujarMarca(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 512
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = C.raised
  ctx.fill(
    new Path2D(
      'M256 108c-58 0-116 92-116 168 0 66 52 116 116 116s116-50 116-116c0-76-58-168-116-168Z',
    ),
  )
  ctx.fillStyle = C.forestSoft
  ctx.fill(new Path2D('M256 150c-6 42-30 66-72 78 20 44 58 64 96 56-20-46-24-92-24-134Z'))
  ctx.fillStyle = C.amber
  ctx.beginPath()
  ctx.arc(300, 220, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
