import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type Lote } from '../db/schema'
import { computeAlertas, type Alerta } from './alerts'
import { computeMetrics, type LoteMetrics } from './metrics'
import { getSettings, type Settings } from './settings'

export function useLotes(estado?: 'activo' | 'cerrado') {
  return useLiveQuery(async () => {
    const all = await db.lotes.orderBy('fechaInicio').reverse().toArray()
    return estado ? all.filter((l) => l.estado === estado) : all
  }, [estado])
}

export interface LoteConMetrics {
  lote: Lote
  metrics: LoteMetrics
  alertas: Alerta[]
}

export function useLoteData(id: number | undefined) {
  return useLiveQuery(async () => {
    if (!id || Number.isNaN(id)) return null
    const lote = await db.lotes.get(id)
    if (!lote) return null
    const [registros, gastos, ingresos] = await Promise.all([
      db.registros.where('loteId').equals(id).toArray(),
      db.gastos.where('loteId').equals(id).toArray(),
      db.ingresos.where('loteId').equals(id).toArray(),
    ])
    registros.sort((a, b) => a.fecha.localeCompare(b.fecha))
    const metrics = computeMetrics(lote, registros, gastos, ingresos)
    return {
      lote,
      registros,
      gastos,
      ingresos,
      metrics,
      alertas: computeAlertas(lote, registros, metrics),
    }
  }, [id])
}

export function useResumen() {
  return useLiveQuery(async () => {
    const lotes = await db.lotes.toArray()
    const out: LoteConMetrics[] = []
    for (const lote of lotes) {
      const [registros, gastos, ingresos] = await Promise.all([
        db.registros.where('loteId').equals(lote.id).toArray(),
        db.gastos.where('loteId').equals(lote.id).toArray(),
        db.ingresos.where('loteId').equals(lote.id).toArray(),
      ])
      registros.sort((a, b) => a.fecha.localeCompare(b.fecha))
      const metrics = computeMetrics(lote, registros, gastos, ingresos)
      out.push({ lote, metrics, alertas: computeAlertas(lote, registros, metrics) })
    }
    return out
  }, [])
}

export function useSettings(): Settings {
  const [s, setS] = useState(getSettings)
  useEffect(() => {
    const h = () => setS(getSettings())
    window.addEventListener('settings-changed', h)
    return () => window.removeEventListener('settings-changed', h)
  }, [])
  return s
}
