import type { Abono, CategoriaDeuda, Deuda, Socio } from '../db/schema'

export const CATEGORIAS_DEUDA: { id: CategoriaDeuda; label: string }[] = [
  { id: 'estructura', label: 'Estructura' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'terreno', label: 'Terreno' },
  { id: 'otros', label: 'Otros' },
]

export const categoriaDeudaLabel = (id: string) =>
  CATEGORIAS_DEUDA.find((c) => c.id === id)?.label ?? id

export interface ParteSocio {
  nombre: string
  pct: number
  leToca: number
  haPuesto: number
  leFalta: number
  ajuste: number
}

export interface EstadoDeuda {
  deuda: Deuda
  abonos: Abono[]
  abonado: number
  saldo: number
  pagadoPct: number
  ultimoAbono?: Abono
  socios: ParteSocio[]
}

export interface ResumenDeudas {
  deudas: EstadoDeuda[]
  total: number
  abonado: number
  saldo: number
  pagadoPct: number
}

const fracciones = (socios: Socio[]): number[] => {
  const total = socios.reduce((a, s) => a + (s.pct || 0), 0)
  return total > 0 ? socios.map((s) => (s.pct || 0) / total) : socios.map(() => 1 / socios.length)
}

export function estadoDeuda(deuda: Deuda, abonos: Abono[]): EstadoDeuda {
  const propios = abonos
    .filter((a) => a.deudaId === deuda.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const abonado = propios.reduce((a, x) => a + x.monto, 0)
  const saldo = Math.max(0, deuda.monto - abonado)

  return {
    deuda,
    abonos: propios,
    abonado,
    saldo,
    pagadoPct: deuda.monto > 0 ? Math.min(100, (abonado / deuda.monto) * 100) : 0,
    ultimoAbono: propios[propios.length - 1],
    socios: partesPorSocio(deuda, propios, abonado),
  }
}

function partesPorSocio(deuda: Deuda, abonos: Abono[], abonado: number): ParteSocio[] {
  const socios = deuda.socios
  if (!socios || socios.length < 2) return []

  const fr = fracciones(socios)
  const puesto = socios.map(() => 0)
  for (const a of abonos) {
    // Un abono sin dueño salió de la caja común y se reparte según el acuerdo.
    if (a.pagadoPor != null && a.pagadoPor >= 0 && a.pagadoPor < puesto.length)
      puesto[a.pagadoPor] += a.monto
    else fr.forEach((f, i) => (puesto[i] += a.monto * f))
  }

  return socios.map((s, i) => {
    const leToca = fr[i] * deuda.monto
    return {
      nombre: s.nombre,
      pct: fr[i] * 100,
      leToca,
      haPuesto: puesto[i],
      leFalta: Math.max(0, leToca - puesto[i]),
      ajuste: puesto[i] - fr[i] * abonado,
    }
  })
}

export function resumenDeudas(deudas: Deuda[], abonos: Abono[]): ResumenDeudas {
  const estados = deudas
    .map((d) => estadoDeuda(d, abonos))
    // Primero lo que falta por pagar, y dentro de eso lo más grande.
    .sort((a, b) => (b.saldo > 0 ? 1 : 0) - (a.saldo > 0 ? 1 : 0) || b.saldo - a.saldo)
  const total = estados.reduce((a, e) => a + e.deuda.monto, 0)
  const abonado = estados.reduce((a, e) => a + e.abonado, 0)

  return {
    deudas: estados,
    total,
    abonado,
    saldo: Math.max(0, total - abonado),
    pagadoPct: total > 0 ? Math.min(100, (abonado / total) * 100) : 0,
  }
}

/** Lo que cada socio lleva puesto en todas las deudas, no en una sola. */
export function deudaPorSocio(estados: EstadoDeuda[]): ParteSocio[] {
  const acumulado = new Map<string, ParteSocio>()
  for (const e of estados) {
    for (const s of e.socios) {
      const previo = acumulado.get(s.nombre) ?? {
        nombre: s.nombre,
        pct: s.pct,
        leToca: 0,
        haPuesto: 0,
        leFalta: 0,
        ajuste: 0,
      }
      acumulado.set(s.nombre, {
        nombre: s.nombre,
        pct: s.pct,
        leToca: previo.leToca + s.leToca,
        haPuesto: previo.haPuesto + s.haPuesto,
        leFalta: previo.leFalta + s.leFalta,
        ajuste: previo.ajuste + s.ajuste,
      })
    }
  }
  return [...acumulado.values()]
}
