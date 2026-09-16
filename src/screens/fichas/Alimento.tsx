import type { Gasto, Lote, Registro } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fecha, money, num, pct, porLb } from '../../lib/format'
import { resumenAgua } from '../../lib/agua'
import { reduceMotion } from '../../lib/motion'
import { computeInventarioAlimento, computePlanAlimento, consumoPorFase } from '../../lib/plan'
import { precioQuintalReal } from '../../lib/precios'
import { fcaEstandar, LB_POR_QUINTAL } from '../../lib/standards'
import { db } from '../../db/schema'
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
  const precioQq = precioQuintalReal(gastos)
  const plan = computePlanAlimento(lote, metrics, precioQq ?? lote.precioQuintal)
  const inv = computeInventarioAlimento(gastos, metrics, plan?.totalQuintales ?? 0)
  const compras = gastos
    .filter((g) => g.categoria === 'alimento')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const stdFca = fcaEstandar(metrics.dias)
  const agua = resumenAgua(lote, registros)

  if (metrics.alimentoTotalLb === 0 && !compras.length)
    return <Vacio texto="Todavía no has anotado alimento en este ciclo." />

  return (
    <div className="space-y-5">
      <Card tono="elevado" className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-faint">Consumido</div>
            <div className="font-display text-2xl font-semibold leading-none tnum">
              {num(metrics.alimentoTotalLb / LB_POR_QUINTAL, 1)} qq
            </div>
            <div className="mt-1 text-sm text-ink-soft tnum">
              {num(metrics.alimentoTotalLb)} lb
              {precioQq ? ` · ${money(precioQq)} el quintal` : ''}
            </div>
          </div>
          {metrics.fca != null && (
            <div className="text-right">
              <div className="text-xs text-ink-faint">Conversión</div>
              <div
                className={
                  'font-display text-xl font-semibold leading-none tnum ' +
                  (metrics.fca > stdFca + 0.1 ? 'text-clay-deep' : 'text-forest-600')
                }
              >
                {num(metrics.fca, 2)}
              </div>
              <div className="mt-0.5 text-xs text-ink-faint tnum">
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
                      <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-forest-700">
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
                          'ml-1.5 text-xs font-semibold ' +
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
                    className="absolute inset-y-0 left-0 rounded-full bg-forest-500"
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

      {agua && (
        <div>
          <h3 className="mb-1 font-display text-base font-semibold">Agua</h3>
          <p className="mb-2 text-xs text-ink-faint">
            Un pollo bebe cerca del doble de lo que come. Cuando el agua cae, cae antes que
            cualquier síntoma.
          </p>
          <Card className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-ink-faint">
                  Último día anotado · día {agua.ultimo.dia}
                </div>
                <div className="font-display text-xl font-semibold leading-none tnum">
                  {num(agua.ultimo.litros)} L
                </div>
                <div className="mt-1 text-sm text-ink-soft tnum">
                  lo normal eran {num(agua.ultimo.esperadoL)} L
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-faint">Por libra de alimento</div>
                <div
                  className={
                    'font-display text-xl font-semibold leading-none tnum ' +
                    (agua.estado === 'normal' ? 'text-forest-600' : 'text-clay-deep')
                  }
                >
                  {num(agua.ultimo.litrosPorLb, 2)} L
                </div>
                <div className="mt-0.5 text-xs text-ink-faint">
                  {agua.estado === 'normal'
                    ? '✓ normal'
                    : agua.estado === 'bajo'
                      ? '▼ beben poco'
                      : '▲ beben de más'}
                </div>
              </div>
            </div>

            {agua.dias.length > 1 && (
              <div className="mt-4 border-t border-line pt-4">
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={agua.dias} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#EEEBE2" vertical={false} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: '#5F6D64' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#5F6D64' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      labelFormatter={(d) => `Día ${d}`}
                      formatter={(v, n) => [`${num(Number(v))} L`, n === 'litros' ? 'Bebieron' : 'Normal']}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #DCD6C7',
                        background: '#FFFEFA',
                        fontSize: 13,
                      }}
                    />
                    <Line
                      dataKey="esperadoL"
                      stroke="#5F6D64"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={!reduceMotion}
                    />
                    <Line
                      dataKey="litros"
                      stroke="#1E7340"
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: '#1E7340' }}
                      isAnimationActive={!reduceMotion}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          {agua.caidaPct != null && (
            <p className="mt-2 rounded-xl border-l-4 border-clay bg-clay-tint px-4 py-3 text-sm leading-relaxed text-clay-text">
              El último día bebieron {pct(agua.caidaPct, 0)} menos que los anteriores. Revisa que los
              bebederos tengan presión y altura, y mira si hay aves decaídas: el agua se cae un día
              antes que todo lo demás.
            </p>
          )}
        </div>
      )}

      {plan && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold">El plan del ciclo</h3>
            {precioQq ? (
              <span className="text-xs text-ink-faint tnum">{money(precioQq)} el quintal</span>
            ) : (
              <label className="flex items-center gap-1.5 text-xs text-ink-faint">
                Quintal
                <input
                  type="number"
                  inputMode="decimal"
                  defaultValue={lote.precioQuintal || ''}
                  onBlur={(e) =>
                    db.lotes.update(lote.id, { precioQuintal: Number(e.target.value) || undefined })
                  }
                  className="h-11 w-24 rounded-xl border border-line bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
                />
              </label>
            )}
          </div>
          <Card className="divide-y divide-line">
            {plan.fases.map((f) => (
              <div key={f.nombre} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{f.nombre}</div>
                  <div className="text-xs text-ink-faint tnum">
                    {f.desde === f.hasta ? `Día ${f.desde}` : `Días ${f.desde}–${f.hasta}`} ·{' '}
                    {f.proteinaPct}% PC · {f.kcalKg} kcal/kg
                  </div>
                </div>
                <div className="shrink-0 pl-3 text-right tnum">
                  <div className="font-display font-semibold">{num(f.quintales, 1)} qq</div>
                  {f.costo != null && (
                    <div className="text-xs text-ink-faint">{money(f.costo)}</div>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-ink-faint">Todo el ciclo</span>
              <span className="tnum">
                <span className="font-display font-semibold">{num(plan.totalQuintales, 1)} qq</span>
                {plan.costoTotal != null && (
                  <span className="text-ink-faint"> · {money(plan.costoTotal)}</span>
                )}
              </span>
            </div>
          </Card>
          {plan.proximoCambio && (
            <p className="mt-2 text-xs text-ink-faint">
              Cambia a <span className="font-medium text-ink-soft">{plan.proximoCambio.nombre}</span>{' '}
              en {plan.proximoCambio.enDias} días.
            </p>
          )}
        </div>
      )}

      {inv?.completo && (
        <div>
          <h3 className="mb-2 font-display text-base font-semibold">Existencia</h3>
          <Card className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-display text-xl font-semibold leading-none tnum">
                  {num(Math.max(0, inv.existenciaQq), 1)} qq
                </div>
                <div className="mt-1 text-sm text-ink-soft tnum">
                  {num(inv.compradoQq, 1)} comprados − {num(inv.consumidoQq, 1)} dados
                </div>
              </div>
              {inv.existenciaQq > 0 && (
                <div className="text-right">
                  <div className="text-xs text-ink-faint">Alcanza</div>
                  <div className="font-display text-base font-semibold leading-none tnum">
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
