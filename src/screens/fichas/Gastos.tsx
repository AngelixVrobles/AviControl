import { useState } from 'react'
import { clsx } from 'clsx'
import type { Gasto, Lote } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { fecha, money, num, pct, porLb } from '../../lib/format'
import { categoriaLabel } from '../../lib/labels'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { Card } from '../../components/ui'
import { GastoSheet } from '../../components/sheets'
import { Vacio } from './Vacio'

interface Linea {
  id: string
  categoria: string
  fecha: string
  monto: number
  label: string
  detalle?: string
  gasto?: Gasto
}

export function FichaGastos({
  lote,
  gastos,
  metrics,
}: {
  lote: Lote
  gastos: Gasto[]
  metrics: LoteMetrics
}) {
  const [cat, setCat] = useState<string>('todo')
  const [editar, setEditar] = useState<Gasto>()
  const [abierta, setAbierta] = useState(false)

  // La compra de los pollitos vive en el lote, no en gastos: sin ella el
  // desglose no suma lo mismo que el costo total del ciclo.
  const lineas: Linea[] = [
    ...(lote.costoInicial > 0
      ? [
          {
            id: 'inicial',
            categoria: 'aves',
            fecha: lote.fechaInicio,
            monto: lote.costoInicial,
            label: `${num(lote.cantidadInicial)} pollitos`,
            detalle: `${money(lote.costoInicial / Math.max(1, lote.cantidadInicial))} cada uno`,
          },
        ]
      : []),
    ...gastos.map((g) => ({
      id: `g${g.id}`,
      categoria: g.categoria,
      fecha: g.fecha,
      monto: g.monto,
      label: g.descripcion || categoriaLabel(g.categoria),
      detalle: g.cantidadQq ? `${num(g.cantidadQq, 1)} qq · ${money(g.monto / g.cantidadQq)} el quintal` : undefined,
      gasto: g,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

  if (!lineas.length) return <Vacio texto="Todavía no has anotado gastos en este ciclo." />

  const totales = new Map<string, number>()
  for (const l of lineas) totales.set(l.categoria, (totales.get(l.categoria) ?? 0) + l.monto)
  const categorias = [...totales.entries()].sort((a, b) => b[1] - a[1])
  const total = lineas.reduce((a, l) => a + l.monto, 0)

  const visibles = cat === 'todo' ? lineas : lineas.filter((l) => l.categoria === cat)
  const subtotal = visibles.reduce((a, l) => a + l.monto, 0)

  return (
    <div className="space-y-5">
      <Card tono="elevado" className="p-4">
        <div className="text-xs text-ink-faint">Gastado en el ciclo</div>
        <div className="font-display text-2xl font-semibold leading-none tnum">
          <AnimatedNumber value={total} format={(n) => money(n)} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <div className="font-display text-lg font-semibold leading-none tnum">
              {money(total / Math.max(1, lote.cantidadInicial))}
            </div>
            <div className="mt-1 text-xs text-ink-faint">Por ave recibida</div>
          </div>
          <div>
            <div className="font-display text-lg font-semibold leading-none tnum">
              {metrics.costoPorLb != null ? porLb(metrics.costoPorLb) : '—'}
            </div>
            <div className="mt-1 text-xs text-ink-faint">Por libra producida</div>
          </div>
        </div>
      </Card>

      <div>
        <h3 className="mb-2 font-display text-base font-semibold">En qué se fue</h3>
        <Card className="divide-y divide-line">
          {categorias.map(([id, monto]) => {
            const activa = cat === id
            return (
              <button
                key={id}
                onClick={() => setCat(activa ? 'todo' : id)}
                className={clsx(
                  'w-full px-4 py-3 text-left transition active:bg-paper-sunken',
                  activa && 'bg-forest-50',
                )}
              >
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">
                    {categoriaLabel(id)}
                    <span className="ml-2 text-xs text-ink-faint tnum">
                      {pct((monto / total) * 100, 0)}
                    </span>
                  </span>
                  <span className="font-display font-semibold tnum">{money(monto)}</span>
                </div>
                <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={clsx(
                      'absolute inset-y-0 left-0 rounded-full',
                      activa ? 'bg-forest-600' : 'bg-green-action',
                    )}
                    style={{ width: `${(monto / total) * 100}%` }}
                  />
                </div>
              </button>
            )
          })}
        </Card>
        <p className="mt-2 text-xs text-ink-faint">
          {cat === 'todo'
            ? 'Toca una categoría para ver solo sus movimientos.'
            : `Viendo ${categoriaLabel(cat).toLowerCase()}. Toca otra vez para ver todo.`}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-display text-base font-semibold">
            {cat === 'todo' ? 'Todos los movimientos' : categoriaLabel(cat)}
          </h3>
          <span className="text-sm font-semibold tnum">{money(subtotal)}</span>
        </div>
        <Card className="divide-y divide-line">
          {visibles.map((l) => (
            <button
              key={l.id}
              disabled={!l.gasto}
              onClick={() => {
                setEditar(l.gasto)
                setAbierta(true)
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition active:bg-paper-sunken disabled:active:bg-transparent"
            >
              <div className="min-w-0">
                <div className="font-medium">{l.label}</div>
                <div className="text-xs text-ink-faint tnum">
                  {fecha(l.fecha)}
                  {cat === 'todo' ? ` · ${categoriaLabel(l.categoria)}` : ''}
                  {l.detalle ? ` · ${l.detalle}` : ''}
                </div>
              </div>
              <span className="shrink-0 pl-3 font-display font-semibold tnum">{money(l.monto)}</span>
            </button>
          ))}
        </Card>
      </div>

      <GastoSheet lote={lote} open={abierta} onClose={() => setAbierta(false)} editar={editar} />
    </div>
  )
}
