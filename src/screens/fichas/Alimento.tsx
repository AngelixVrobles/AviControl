import type { Gasto, Lote, Registro } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { fecha, money, num, pct, porLb } from '../../lib/format'
import { computeInventarioAlimento, computePlanAlimento, consumoPorFase } from '../../lib/plan'
import { precioQuintalReal } from '../../lib/precios'
import { fcaEstandar, LB_POR_QUINTAL } from '../../lib/standards'
import { Card } from '../../components/ui'
import { Vacio } from './Vacio'

export function FichaAlimento({
  lote,
  registros,
  gastos,
  metrics,
}: {
  lote: Lote
  registros: Registro[]
  gastos: Gasto[]
  metrics: LoteMetrics
}) {
  const fases = consumoPorFase(lote, registros, metrics).filter((f) => f.realLb > 0 || f.planALaFechaLb > 0)
  const plan = computePlanAlimento(lote, metrics)
  const inv = computeInventarioAlimento(gastos, metrics, plan?.totalQuintales ?? 0)
  const compras = gastos
    .filter((g) => g.categoria === 'alimento')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const precioQq = precioQuintalReal(gastos)
  const stdFca = fcaEstandar(metrics.dias)

  if (metrics.alimentoTotalLb === 0 && !compras.length)
    return <Vacio texto="Todavía no has anotado alimento en este ciclo." />

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-faint">Consumido</div>
            <div className="font-display text-[30px] font-semibold leading-none tnum">
              {num(metrics.alimentoTotalLb / LB_POR_QUINTAL, 1)} qq
            </div>
            <div className="mt-1 text-[13px] text-ink-soft tnum">
              {num(metrics.alimentoTotalLb)} lb
              {precioQq ? ` · ${money(precioQq)} el quintal` : ''}
            </div>
          </div>
          {metrics.fca != null && (
            <div className="text-right">
              <div className="text-xs text-ink-faint">Conversión</div>
              <div
                className={
                  'font-display text-[22px] font-semibold leading-none tnum ' +
                  (metrics.fca > stdFca + 0.1 ? 'text-clay-deep' : 'text-forest-600')
                }
              >
                {num(metrics.fca, 2)}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-faint tnum">
                Cobb {num(stdFca, 2)}
              </div>
            </div>
          )}
        </div>
      </Card>

      <div>
        <h3 className="mb-1 font-display text-base font-semibold">Lo que diste en cada fase</h3>
        <p className="mb-2 text-xs text-ink-faint">Contra lo que tocaba hasta hoy, no la fase entera.</p>
        <Card className="divide-y divide-line">
          {fases.map((f) => {
            const dif = f.planALaFechaLb > 0 ? ((f.realLb - f.planALaFechaLb) / f.planALaFechaLb) * 100 : 0
            const notable = Math.abs(dif) >= 5 && f.realLb > 0
            return (
              <div key={f.nombre} className={'px-4 py-3 ' + (f.enCurso ? 'bg-forest-50' : '')}>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {f.nombre}
                    {f.enCurso && (
                      <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-700">
                        En curso
                      </span>
                    )}
                  </div>
                  <div className="text-right tnum">
                    <span className="font-display font-semibold">
                      {num(f.realLb / LB_POR_QUINTAL, 1)} qq
                    </span>
                    {notable && (
                      <span
                        className={
                          'ml-1.5 text-[11px] font-semibold ' +
                          (dif > 0 ? 'text-clay-text' : 'text-forest-600')
                        }
                      >
                        {dif > 0 ? '▲' : '▼'} {num(Math.abs(dif), 0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-baseline justify-between text-xs text-ink-faint tnum">
                  <span>
                    Días {f.desde}–{f.hasta} · {f.diasRegistrados} anotados
                  </span>
                  <span>tocaban {num(f.planALaFechaLb / LB_POR_QUINTAL, 1)} qq</span>
                </div>
                <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-green-action"
                    style={{
                      width: `${Math.min(100, f.planTotalLb > 0 ? (f.realLb / f.planTotalLb) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </Card>
      </div>

      {inv?.completo && (
        <div>
          <h3 className="mb-2 font-display text-base font-semibold">Existencia</h3>
          <Card className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-display text-[24px] font-semibold leading-none tnum">
                  {num(Math.max(0, inv.existenciaQq), 1)} qq
                </div>
                <div className="mt-1 text-[13px] text-ink-soft tnum">
                  {num(inv.compradoQq, 1)} comprados − {num(inv.consumidoQq, 1)} dados
                </div>
              </div>
              {inv.existenciaQq > 0 && (
                <div className="text-right">
                  <div className="text-xs text-ink-faint">Alcanza</div>
                  <div className="font-display text-[15px] font-semibold leading-none tnum">
                    {inv.diasQueAlcanza > 0 ? `${inv.diasQueAlcanza} días` : 'hoy'}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {compras.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-base font-semibold">Compras</h3>
          <Card className="divide-y divide-line">
            {compras.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{g.descripcion || 'Alimento'}</div>
                  <div className="text-xs text-ink-faint tnum">
                    {fecha(g.fecha)}
                    {g.cantidadQq ? ` · ${num(g.cantidadQq, 1)} qq` : ' · sin cantidad anotada'}
                  </div>
                </div>
                <div className="shrink-0 pl-3 text-right tnum">
                  <div className="font-display font-semibold">{money(g.monto)}</div>
                  {g.cantidadQq ? (
                    <div className="text-xs text-ink-faint">
                      {money(g.monto / g.cantidadQq)} / qq
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
          {metrics.biomasaLb != null && metrics.biomasaLb > 0 && (
            <p className="mt-2 text-xs text-ink-faint tnum">
              El alimento va en{' '}
              {porLb(compras.reduce((a, g) => a + g.monto, 0) / metrics.biomasaLb)} por libra de pollo
              producida, {pct((compras.reduce((a, g) => a + g.monto, 0) / metrics.costos) * 100, 0)} de
              todo lo que llevas gastado.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
