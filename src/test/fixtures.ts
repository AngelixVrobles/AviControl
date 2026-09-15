import type { Gasto, Ingreso, Lote, Registro } from '../db/schema'

export function hace(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function lote(patch: Partial<Lote> = {}): Lote {
  return {
    id: 1,
    tipo: 'engorde',
    nombre: 'Galpón A',
    fechaInicio: hace(30),
    cantidadInicial: 500,
    costoInicial: 24000,
    estado: 'activo',
    pesoObjetivoLb: 5.5,
    creado: 0,
    ...patch,
  }
}

export function registro(diaDeVida: number, patch: Partial<Registro> = {}): Registro {
  return {
    id: diaDeVida,
    loteId: 1,
    fecha: hace(30 - diaDeVida),
    mortalidad: 0,
    descarte: 0,
    alimentoLb: 0,
    creado: 0,
    ...patch,
  }
}

export function gasto(patch: Partial<Gasto> = {}): Gasto {
  return { id: 1, loteId: 1, categoria: 'otros', monto: 0, fecha: hace(30), creado: 0, ...patch }
}

export function ingreso(patch: Partial<Ingreso> = {}): Ingreso {
  return { id: 1, loteId: 1, tipo: 'aves', cantidad: 0, monto: 0, fecha: hace(0), creado: 0, ...patch }
}
