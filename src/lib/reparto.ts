import type { Ingreso, Lote, MovimientoAves, Registro } from '../db/schema'
import { num, plural } from './format'
import { equipoDeLaGranja } from './equipo'
import { galponInicial, nombreDeGalpon } from './galpones'
import { pesoObjetivoDe } from './lote'
import type { Galpon, Settings } from './settings'
import { diaParaPeso } from './standards'

// Una pollada puede estar en más de un galpón: los pollitos llegan a uno y,
// cuando crecen y ya no caben, parte se pasa a otro. Las bajas y las ventas se
// anotan para todo el ciclo; en cada galpón se reparten según las aves que
// tiene, salvo la venta que dice de qué galpón salieron.

export interface AvesEnGalpon {
  galponId: string
  aves: number
}

type LoteReparto = Pick<Lote, 'fechaInicio' | 'cantidadInicial' | 'muertosLlegada' | 'movimientos'>
type RegistroReparto = Pick<Registro, 'fecha' | 'mortalidad' | 'descarte'>
type VentaReparto = Pick<Ingreso, 'fecha' | 'tipo' | 'cantidad' | 'galponId'>

/** Si parte de la pollada se pasó a otro galpón. */
export const repartido = (lote: Pick<Lote, 'movimientos'>) => (lote.movimientos?.length ?? 0) > 0

/** Saca `n` aves de los galpones que tienen, a cada uno según las que tiene. */
function sacarParejo(aves: Map<string, number>, n: number) {
  const total = [...aves.values()].reduce((a, v) => a + v, 0)
  if (total <= 0 || n <= 0) return
  const parte = Math.min(1, n / total)
  for (const [g, v] of aves) aves.set(g, Math.max(0, v - v * parte))
}

function mover(aves: Map<string, number>, m: MovimientoAves) {
  const hay = aves.get(m.de) ?? 0
  const n = Math.max(0, Math.min(m.aves, hay))
  aves.set(m.de, hay - n)
  aves.set(m.a, (aves.get(m.a) ?? 0) + n)
}

/**
 * Las aves de cada galpón al final del día `hasta`. En un mismo día van
 * primero las bajas, después lo que se pasó y al final las ventas: así las 350
 * que se pasaron llegan 350, y las que se pasaron a un galpón y se vendieron
 * ese mismo día salen de ahí. Antes la venta iba antes del movimiento y el
 * galpón quedaba con 350 aves que ya no estaban. Con `sin`, se deja fuera ese
 * movimiento: el que se está corrigiendo.
 */
export function avesPorGalpon(
  lote: LoteReparto,
  inicial: string,
  registros: RegistroReparto[],
  ingresos: VentaReparto[],
  hasta: string,
  { sin }: { sin?: number } = {},
): AvesEnGalpon[] {
  const movimientos = (lote.movimientos ?? []).filter((_, i) => i !== sin)
  return redondear(simular(lote, inicial, registros, ingresos, movimientos, hasta).aves)
}

export interface MovimientoSinAves {
  movimiento: MovimientoAves
  /** Las aves que había en el galpón de donde salen ese día. */
  habia: number
}

/**
 * Los movimientos que ya no se pueden hacer como se anotaron: al borrar o
 * corregir uno de antes, el galpón de donde salen se queda sin esas aves. Antes
 * se movían las que hubiera —a veces ninguna— y la lista seguía diciendo 300.
 */
export function movimientosSinAves(
  lote: LoteReparto,
  inicial: string,
  registros: RegistroReparto[],
  ingresos: VentaReparto[],
  movimientos: MovimientoAves[],
): MovimientoSinAves[] {
  return simular(lote, inicial, registros, ingresos, movimientos, '9999-12-31').sinAves
}

function simular(
  lote: LoteReparto,
  inicial: string,
  registros: RegistroReparto[],
  ingresos: VentaReparto[],
  todos: MovimientoAves[],
  hasta: string,
) {
  const movimientos = todos.filter((m) => m.fecha <= hasta)
  const ventas = ingresos.filter((v) => v.tipo === 'aves' && v.fecha <= hasta)
  const dias = [
    ...new Set([
      ...movimientos.map((m) => m.fecha),
      ...registros.filter((r) => r.fecha <= hasta).map((r) => r.fecha),
      ...ventas.map((v) => v.fecha),
    ]),
  ].sort()

  const aves = new Map<string, number>([[inicial, Math.max(0, lote.cantidadInicial - (lote.muertosLlegada ?? 0))]])
  const sinAves: MovimientoSinAves[] = []
  for (const dia of dias) {
    const bajas = registros
      .filter((r) => r.fecha === dia)
      .reduce((a, r) => a + (r.mortalidad ?? 0) + (r.descarte ?? 0), 0)
    sacarParejo(aves, bajas)
    for (const m of movimientos) {
      if (m.fecha !== dia) continue
      // Media ave de diferencia es el reparto de las bajas, no falta de aves.
      const habia = aves.get(m.de) ?? 0
      if (m.aves > habia + 0.5) sinAves.push({ movimiento: m, habia: Math.round(habia) })
      mover(aves, m)
    }
    for (const v of ventas) {
      if (v.fecha !== dia) continue
      let resto = v.cantidad
      // La venta que dice de qué galpón salió se lleva primero las de ahí.
      if (v.galponId && aves.has(v.galponId)) {
        const de = Math.min(resto, aves.get(v.galponId)!)
        aves.set(v.galponId, aves.get(v.galponId)! - de)
        resto -= de
      }
      sacarParejo(aves, resto)
    }
  }
  return { aves, sinAves }
}

// Aves enteras que suman lo mismo que el total redondeado: con 649.6 y 349.4
// salen 650 y 349, no 650 y 349 de un total de 1,000.
function redondear(aves: Map<string, number>): AvesEnGalpon[] {
  const filas = [...aves.entries()].map(([galponId, v]) => ({ galponId, v: Math.max(0, v) }))
  const total = Math.round(filas.reduce((a, f) => a + f.v, 0))
  const enteras = filas.map((f) => ({ galponId: f.galponId, aves: Math.floor(f.v), resto: f.v - Math.floor(f.v) }))
  let falta = total - enteras.reduce((a, f) => a + f.aves, 0)
  for (const f of [...enteras].sort((a, b) => b.resto - a.resto)) {
    if (falta <= 0) break
    f.aves++
    falta--
  }
  return enteras.filter((f) => f.aves > 0).map(({ galponId, aves }) => ({ galponId, aves }))
}

/** El movimiento en palabras: «350 aves de Galpón 1 a Galpón 2». */
export const fraseMovimiento = (m: MovimientoAves, s: Pick<Settings, 'galpones'>) =>
  `${num(m.aves)} ${plural(m.aves, 'ave', 'aves')} de ${nombreDeGalpon(m.de, s)} a ${nombreDeGalpon(m.a, s)}`

/** Los galpones de la granja a donde se pueden pasar aves desde `de`. */
export const destinosPosibles = (galpones: Galpon[], de: string) => galpones.filter((g) => g.id !== de)

/** Las aves que aguanta un galpón al peso de venta, si tiene medidas. */
export function caben(
  aves: number,
  lote: Pick<Lote, 'pesoObjetivoLb'>,
  s: Settings,
  g?: Galpon,
): number | undefined {
  if (!g?.largoM || !g.anchoM) return undefined
  const peso = pesoObjetivoDe(lote)
  return equipoDeLaGranja(Math.max(1, aves), peso, diaParaPeso(peso), s, g)?.galpon?.avesMaximas
}

export interface CiclosDeGalpon {
  /** El galpón, o `varios` para las polladas repartidas. */
  id: string
  nombre: string
  ciclos: number
  mortalidadPct: number
  fca?: number
  iep?: number
  /** Lo que dejó cada ave vendida. */
  gananciaPorAve?: number
}

export const VARIOS_GALPONES = 'varios'

const promedio = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}

// Los ciclos cerrados de cada galpón, uno junto a otro: el galpón que da más
// mortalidad o peor conversión se nota. Una pollada repartida no es de uno
// solo: va aparte, en «Varios galpones».
export function ciclosPorGalpon(
  ciclos: {
    lote: Pick<Lote, 'galponId' | 'movimientos'>
    metrics: { mortalidadPct: number; fca?: number; iep?: number; ganancia: number; vendidas: number }
  }[],
  s: Pick<Settings, 'galpones'>,
): CiclosDeGalpon[] {
  const grupos = new Map<string, typeof ciclos>()
  for (const c of ciclos) {
    const id = repartido(c.lote) ? VARIOS_GALPONES : galponInicial(c.lote, s)
    grupos.set(id, [...(grupos.get(id) ?? []), c])
  }
  return [...grupos.entries()]
    .map(([id, xs]) => ({
      id,
      nombre: id === VARIOS_GALPONES ? 'Varios galpones' : nombreDeGalpon(id, s),
      ciclos: xs.length,
      mortalidadPct: promedio(xs.map((c) => c.metrics.mortalidadPct)) ?? 0,
      fca: promedio(xs.map((c) => c.metrics.fca)),
      iep: promedio(xs.map((c) => c.metrics.iep)),
      gananciaPorAve: promedio(xs.map((c) => (c.metrics.vendidas > 0 ? c.metrics.ganancia / c.metrics.vendidas : undefined))),
    }))
    .sort((a, b) => (a.id === VARIOS_GALPONES ? 1 : b.id === VARIOS_GALPONES ? -1 : a.nombre.localeCompare(b.nombre)))
}
