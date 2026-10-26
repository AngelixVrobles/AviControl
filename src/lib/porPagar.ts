import type { CadaPago, Gasto, Lote, PagoEmpleados } from '../db/schema'

export const CADA_PAGO: { id: CadaPago; label: string; frase: string }[] = [
  { id: 'dia', label: 'Por día', frase: 'al día' },
  { id: 'semana', label: 'Por semana', frase: 'a la semana' },
  { id: 'quincena', label: 'Por quincena', frase: 'a la quincena' },
  { id: 'mes', label: 'Por mes', frase: 'al mes' },
  { id: 'ciclo', label: 'Por toda la pollada', frase: 'por la pollada' },
  { id: 'ave', label: 'Por pollo que sale', frase: 'por pollo' },
]

const DIAS_DEL_PAGO: Partial<Record<CadaPago, number>> = { dia: 1, semana: 7, quincena: 15, mes: 30 }

export const fraseDelPago = (cada: CadaPago) => CADA_PAGO.find((c) => c.id === cada)?.frase ?? ''

export interface PagoDelCiclo {
  /** Lo que les toca en todo el ciclo, hasta el día de la venta. */
  total: number
  /** Lo ya anotado como mano de obra en el ciclo. */
  anotado: number
  /** Lo que falta por pagarles: el total menos lo anotado. */
  falta: number
}

// Lo que les toca a los empleados en el ciclo y lo que falta de eso. Pagados a
// la semana, un ciclo que se vende el día 42 son seis semanas; por pollo, las
// aves que salen. Lo que ya se les pagó está en los gastos de mano de obra, y
// se descuenta: si no, se contaba dos veces.
export function pagoEmpleados(
  e: PagoEmpleados | undefined,
  gastos: Gasto[],
  { diaVenta, aves }: { diaVenta: number; aves: number },
): PagoDelCiclo | undefined {
  if (!e || !(e.monto > 0)) return undefined
  const dias = DIAS_DEL_PAGO[e.cada]
  const total =
    e.cada === 'ciclo'
      ? e.monto
      : e.cada === 'ave'
        ? e.monto * Math.max(0, aves)
        : dias
          ? (e.monto / dias) * Math.max(0, diaVenta)
          : undefined
  if (total == null) return undefined
  const anotado = gastos
    .filter((g) => g.categoria === 'mano_obra')
    .reduce((a, g) => a + g.monto, 0)
  return { total, anotado, falta: Math.max(0, total - anotado) }
}

/** Lo que suman los gastos que ya se sabe que vienen. */
export const totalPorVenir = (l: Pick<Lote, 'gastosPorVenir'>) =>
  (l.gastosPorVenir ?? []).reduce((a, g) => a + (g.monto > 0 ? g.monto : 0), 0)
