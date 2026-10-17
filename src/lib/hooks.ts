import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type Gasto, type Ingreso, type Lote } from '../db/schema'
import { computeAlertas, type Alerta } from './alerts'
import { computeMetrics, type LoteMetrics } from './metrics'
import { pesoObjetivoDe } from './lote'
import { analizarPrecio, type AnalisisPrecio } from './precios'
import { proyectarVenta } from './proyeccion'
import { getSettings, type Settings } from './settings'
import { resumenDeudas } from './deudas'
import { hoyISO } from './format'
import { compradoresConocidos, cuentasPorCobrar } from './cobros'
import { computeArranque, type Arranque } from './arranque'
import { retiroEn, type Retiro } from './retiro'

// La fecha de hoy, que cambia sola a medianoche y al volver a la app. Las
// cuentas del ciclo dependen del día: con la app abierta de un día para otro,
// el día del ciclo, los días sin registro y el registro de hoy se quedaban en
// el de ayer hasta cerrarla. El teléfono duerme los temporizadores con la
// pantalla apagada, por eso también se revisa al volver.
export function useHoy(): string {
  const [hoy, setHoy] = useState(hoyISO)
  useEffect(() => {
    let t = 0
    const revisar = () => setHoy(hoyISO())
    const programar = () => {
      const ahora = new Date()
      const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1)
      t = window.setTimeout(() => {
        revisar()
        programar()
      }, manana.getTime() - ahora.getTime() + 1000)
    }
    const alVolver = () => {
      if (document.visibilityState === 'visible') revisar()
    }
    programar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', revisar)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', revisar)
    }
  }, [])
  return hoy
}

// Los ciclos de la granja. Los que mandó un socio no se registran ni ocupan
// un galpón aquí: se ven aparte, en la lista de ciclos.
export function useLotes(estado?: 'activo' | 'cerrado') {
  return useLiveQuery(async () => {
    const all = (await db.lotes.orderBy('fechaInicio').reverse().toArray()).filter((l) => !l.compartido)
    return estado ? all.filter((l) => l.estado === estado) : all
  }, [estado])
}

// Inicio solo necesita saber cuántos ciclos se cerraron: sacar las cuentas de
// cada uno para contarlos eran 248 consultas con 60 ciclos, y la pantalla se
// quedaba en blanco hasta terminar.
export function useCuentaCerrados() {
  return useLiveQuery(() => db.lotes.where('estado').equals('cerrado').filter((l) => !l.compartido).count(), [])
}

export interface LoteConMetrics {
  lote: Lote
  metrics: LoteMetrics
  alertas: Alerta[]
  /** A cómo vender: solo en los ciclos activos que ya tienen un pesaje. */
  precio?: AnalisisPrecio | null
  /** La primera semana: para comparar incubadoras en Reportes. */
  arranque?: Arranque
  /** El retiro de una medicina que todavía no se cumple: no se vende antes. */
  retiro?: Retiro
}

export function useLoteData(id: number | undefined) {
  // El día y los ajustes entran en las cuentas: si cambian, se recalcula.
  const hoy = useHoy()
  const settings = useSettings()
  return useLiveQuery(async () => {
    if (!id || Number.isNaN(id)) return null
    const lote = await db.lotes.get(id)
    if (!lote) return null
    const [registros, gastos, ingresos, pesajes, aplicaciones, entregas] = await Promise.all([
      db.registros.where('loteId').equals(id).toArray(),
      db.gastos.where('loteId').equals(id).toArray(),
      db.ingresos.where('loteId').equals(id).toArray(),
      db.pesajes.where('loteId').equals(id).toArray(),
      db.aplicaciones.where('loteId').equals(id).toArray(),
      db.entregas.where('loteId').equals(id).toArray(),
    ])
    registros.sort((a, b) => a.fecha.localeCompare(b.fecha))
    pesajes.sort((a, b) => a.fecha.localeCompare(b.fecha))
    aplicaciones.sort((a, b) => a.fecha.localeCompare(b.fecha))
    entregas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado)
    const metrics = computeMetrics(lote, registros, gastos, ingresos)
    return {
      lote,
      registros,
      gastos,
      ingresos,
      pesajes,
      aplicaciones,
      entregas,
      metrics,
      alertas: computeAlertas(lote, registros, gastos, metrics, {
        plan: settings.planSanitario,
        aplicaciones,
        ingresos,
        settings,
      }),
    }
  }, [id, hoy, settings])
}

// Con `compartidos`, también los ciclos que mandó un socio (con 'solo', nada
// más esos). Sin eso —Inicio, Reportes— solo los de la granja: un ciclo ajeno
// no entra en sus cuentas.
export function useResumen(
  estado: 'cerrado' | 'activo' | 'todos' = 'todos',
  { compartidos = false }: { compartidos?: boolean | 'solo' } = {},
) {
  const hoy = useHoy()
  const settings = useSettings()
  return useLiveQuery(async () => {
    const todos = (await db.lotes.toArray()).filter((l) =>
      compartidos === 'solo' ? !!l.compartido : compartidos || !l.compartido,
    )
    const lotes = estado === 'todos' ? todos : todos.filter((l) => l.estado === estado)
    const out: LoteConMetrics[] = []
    for (const lote of lotes) {
      const [registros, gastos, ingresos, aplicaciones] = await Promise.all([
        db.registros.where('loteId').equals(lote.id).toArray(),
        db.gastos.where('loteId').equals(lote.id).toArray(),
        db.ingresos.where('loteId').equals(lote.id).toArray(),
        db.aplicaciones.where('loteId').equals(lote.id).toArray(),
      ])
      registros.sort((a, b) => a.fecha.localeCompare(b.fecha))
      aplicaciones.sort((a, b) => a.fecha.localeCompare(b.fecha))
      const metrics = computeMetrics(lote, registros, gastos, ingresos)
      const precio =
        lote.estado === 'activo'
          ? analizarPrecio(
              lote,
              gastos,
              metrics,
              proyectarVenta(lote, registros, gastos, metrics, pesoObjetivoDe(lote)),
            )
          : undefined
      out.push({
        lote,
        metrics,
        alertas: computeAlertas(lote, registros, gastos, metrics, {
          plan: settings.planSanitario,
          aplicaciones,
          ingresos,
          settings,
        }),
        precio,
        arranque: computeArranque(lote, registros, metrics.dias),
        retiro: lote.estado === 'activo' ? retiroEn(aplicaciones, hoy) : undefined,
      })
    }
    return out
  }, [estado, compartidos, hoy, settings])
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

export function useDeudas() {
  return useLiveQuery(async () => {
    const [deudas, abonos] = await Promise.all([db.deudas.toArray(), db.abonos.toArray()])
    return resumenDeudas(deudas, abonos)
  }, [])
}

// Los gastos de todos los ciclos, agrupados: para comparar lo invertido a la
// misma edad entre un ciclo y los demás.
export function useGastosPorCiclo() {
  const hoy = useHoy()
  return useLiveQuery(async () => {
    const [todos, gastos] = await Promise.all([db.lotes.toArray(), db.gastos.toArray()])
    const lotes = todos.filter((l) => !l.compartido)
    const porLote = new Map<number, Gasto[]>()
    for (const g of gastos) {
      if (g.loteId == null) continue
      const lista = porLote.get(g.loteId)
      if (lista) lista.push(g)
      else porLote.set(g.loteId, [g])
    }
    return lotes.map((lote) => ({ lote, gastos: porLote.get(lote.id) ?? [] }))
  }, [hoy])
}

// Las incubadoras de los ciclos de antes, la más reciente primero, para no
// escribirla cada vez y para que «Pollos del Este» no salga de tres maneras.
export function useIncubadoras(): string[] {
  return (
    useLiveQuery(async () => {
      const lotes = (await db.lotes.orderBy('fechaInicio').reverse().toArray()).filter((l) => !l.compartido)
      // Por cada incubadora, como más veces se escribió; la más reciente primero.
      const vistas = new Map<string, Map<string, number>>()
      for (const l of lotes) {
        const n = l.incubadora?.trim()
        if (!n) continue
        const formas = vistas.get(n.toLowerCase()) ?? new Map<string, number>()
        formas.set(n, (formas.get(n) ?? 0) + 1)
        vistas.set(n.toLowerCase(), formas)
      }
      return [...vistas.values()].map((formas) => [...formas].reduce((a, b) => (b[1] > a[1] ? b : a))[0])
    }, []) ?? []
  )
}

// Los compradores de antes, para no escribir el nombre cada vez.
export function useCompradores(): string[] {
  return (
    useLiveQuery(async () => {
      const [ingresos, lotes] = await Promise.all([db.ingresos.toArray(), db.lotes.toArray()])
      return compradoresConocidos(deLaGranja(ingresos, lotes))
    }, []) ?? []
  )
}

// Las ventas de los ciclos de la granja: las de un ciclo compartido son del socio
// que lo lleva, y lo que le deben a él no es lo que te deben a ti.
function deLaGranja(ingresos: Ingreso[], lotes: Lote[]) {
  const ajenos = new Set(lotes.filter((l) => l.compartido).map((l) => l.id))
  return ingresos.filter((i) => i.loteId == null || !ajenos.has(i.loteId))
}

// Lo que te deben de las ventas a crédito, de todos los ciclos.
export function usePorCobrar() {
  const hoy = useHoy()
  return useLiveQuery(async () => {
    const [ingresos, lotes] = await Promise.all([db.ingresos.toArray(), db.lotes.toArray()])
    return cuentasPorCobrar(deLaGranja(ingresos, lotes), lotes, hoy)
  }, [hoy])
}
