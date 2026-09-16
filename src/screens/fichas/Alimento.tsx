import { useState } from 'react'
import type { Gasto, Lote, Registro } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { fecha, money, num, numCompacto, pct, porLb } from '../../lib/format'
import { estadoAgua, type ResumenAgua, resumenAgua } from '../../lib/agua'
import { computeInventarioAlimento, computePlanAlimento, consumoPorFase } from '../../lib/plan'
import { precioQuintalReal } from '../../lib/precios'
import { fcaEstandar, LB_POR_QUINTAL } from '../../lib/standards'
import { db } from '../../db/schema'
import { Banda, Seccion } from '../../components/ui'
import { GraficaLineas } from '../../components/chart'
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
      <Banda className="px-5 py-4">
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
      </Banda>

      <div>
        <Seccion
          className="mb-3"
          etiqueta="Lo que diste en cada fase"
          nota="Contra lo que tocaba hasta hoy, no la fase entera."
        />
        <Banda className="divide-y divide-line">
          {fases.map((f) => {
            const dif = f.planALaFechaLb > 0 ? ((f.realLb - f.planALaFechaLb) / f.planALaFechaLb) * 100 : 0
            const notable = Math.abs(dif) >= 5 && f.realLb > 0
            return (
              <div key={f.nombre} className={'px-5 py-3 ' + (f.enCurso ? 'bg-forest-50' : '')}>
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
        </Banda>
      </div>

      {agua && <Agua resumen={agua} />}

      {plan && (
        <div>
          <Seccion
            className="mb-3"
            etiqueta="El plan del ciclo"
            accion={
              precioQq ? (
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
              )
            }
          />
          <Banda className="divide-y divide-line">
            {plan.fases.map((f) => (
              <div key={f.nombre} className="flex items-center justify-between px-5 py-2.5 text-sm">
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
            <div className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-ink-faint">Todo el ciclo</span>
              <span className="tnum">
                <span className="font-display font-semibold">{num(plan.totalQuintales, 1)} qq</span>
                {plan.costoTotal != null && (
                  <span className="text-ink-faint"> · {money(plan.costoTotal)}</span>
                )}
              </span>
            </div>
          </Banda>
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
          <Seccion className="mb-3" etiqueta="Existencia" />
          <Banda className="px-5 py-4">
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
          </Banda>
        </div>
      )}

      {compras.length > 0 && (
        <div>
          <Seccion className="mb-3" etiqueta="Compras" />
          <Banda className="divide-y divide-line">
            {compras.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-5 py-3 text-sm">
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
          </Banda>
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

function Agua({ resumen }: { resumen: ResumenAgua }) {
  const [foco, setFoco] = useState<number>()
  const dia = resumen.dias[foco ?? resumen.dias.length - 1]
  const estado = estadoAgua(dia.litrosPorLb)

  return (
    <div>
      <Seccion etiqueta="Agua" titulo={tituloAgua(resumen)} />
      <Banda className="mt-3 px-5 py-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-faint">
              {foco != null ? `Día ${dia.dia}` : `Último día anotado · día ${dia.dia}`}
            </div>
            <div className="font-display text-xl font-semibold leading-none tnum">
              {num(dia.litros)} L
            </div>
            <div className="mt-1 text-sm text-ink-soft tnum">
              lo normal eran {num(dia.esperadoL)} L
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-faint">Por libra de alimento</div>
            <div
              className={
                'font-display text-xl font-semibold leading-none tnum ' +
                (estado === 'normal' ? 'text-forest-600' : 'text-clay-deep')
              }
            >
              {num(dia.litrosPorLb, 2)} L
            </div>
            <div className="mt-0.5 text-xs text-ink-faint">
              {estado === 'normal' ? '✓ normal' : estado === 'bajo' ? '▼ beben poco' : '▲ beben de más'}
            </div>
          </div>
        </div>

        {resumen.dias.length > 1 && (
          <div className="mt-4 border-t border-line pt-4">
            <GraficaLineas
              x={resumen.dias.map((d) => d.dia)}
              series={[
                {
                  datos: resumen.dias.map((d) => d.esperadoL),
                  tono: 'guia',
                  punteada: true,
                },
                { datos: resumen.dias.map((d) => d.litros) },
              ]}
              alto={150}
              banda="neutro"
              formatoY={(v) => numCompacto(v)}
              etiquetaX={(v) => `d${v}`}
              nota={
                resumen.caidaPct != null
                  ? {
                      indice: resumen.dias.length - 1,
                      texto: `${pct(resumen.caidaPct, 0)} menos`,
                    }
                  : undefined
              }
              foco={foco}
              onFoco={setFoco}
              resumen={`Agua bebida por día contra lo esperado, del día ${resumen.dias[0].dia} al ${resumen.ultimo.dia}.`}
            />
            <p className="mt-2 text-center text-xs text-ink-faint">
              La punteada es lo que les tocaba beber ese día.
            </p>
          </div>
        )}
      </Banda>
      {resumen.caidaPct != null && (
        <p className="mt-2 rounded-xl border-l-4 border-clay bg-clay-tint px-4 py-3 text-sm leading-relaxed text-clay-text">
          Revisa que los bebederos tengan presión y altura, y mira si hay aves decaídas: el agua se
          cae un día antes que todo lo demás.
        </p>
      )}
    </div>
  )
}

function tituloAgua(resumen: ResumenAgua) {
  if (resumen.caidaPct != null)
    return `El último día bebieron ${pct(resumen.caidaPct, 0)} menos que los anteriores`
  if (resumen.estado === 'bajo') return 'Están bebiendo por debajo de lo normal'
  if (resumen.estado === 'alto') return 'Están bebiendo más de lo normal'
  return 'Beben lo que les toca'
}
