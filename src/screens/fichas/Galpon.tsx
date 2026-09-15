import type { Lote } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { saveSettings, type Settings } from '../../lib/settings'
import { num } from '../../lib/format'
import { computeEquipo, enPies, enPies2, type Distribucion } from '../../lib/equipo'
import { PESO_OBJETIVO_DEFAULT } from '../../lib/standards'
import { Card } from '../../components/ui'

function Fila({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className={'text-right font-display font-semibold tnum ' + (valueClass ?? '')}>{value}</span>
    </div>
  )
}

export function FichaGalpon({
  lote,
  metrics,
  settings,
}: {
  lote: Lote
  metrics: LoteMetrics
  settings: Settings
}) {
  const aves = metrics.avesVivas > 0 ? metrics.avesVivas : lote.cantidadInicial
  const plan = computeEquipo(
    aves,
    lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT,
    settings.galponLargoM,
    settings.galponAnchoM,
  )
  if (!plan) return null
  const g = plan.galpon

  return (
    <>
      <p className="mb-3 text-xs text-ink-faint">Para las {num(aves)} aves que tienes hoy.</p>

      <Card className="divide-y divide-line">
        {plan.ciclo.map((e) => (
          <div key={e.nombre} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{e.nombre}</div>
              <div className="text-xs text-ink-faint">{e.regla}</div>
            </div>
            <div className="font-display text-[22px] font-semibold tnum leading-none">{num(e.cantidad)}</div>
          </div>
        ))}
      </Card>

      <div className="mb-2 mt-4 text-xs font-medium text-ink-faint">Además, los primeros 10 días</div>
      <Card className="divide-y divide-line">
        {plan.crianza.map((e) => (
          <div key={e.nombre} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{e.nombre}</div>
              <div className="text-xs text-ink-faint">{e.regla}</div>
            </div>
            <div className="font-display text-[22px] font-semibold tnum leading-none">{num(e.cantidad)}</div>
          </div>
        ))}
      </Card>

      <div className="mb-2 mt-4 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-faint">Medidas del galpón</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-faint">
          <MedidaGalpon
            valor={settings.galponLargoM}
            onGuardar={(v) => saveSettings({ galponLargoM: v })}
            etiqueta="Largo en metros"
          />
          ×
          <MedidaGalpon
            valor={settings.galponAnchoM}
            onGuardar={(v) => saveSettings({ galponAnchoM: v })}
            etiqueta="Ancho en metros"
          />
          m
        </span>
      </div>

      {!g ? (
        <Card className="p-4 text-sm text-ink-faint">
          Pon el largo y el ancho del galpón y te digo cuántas líneas hacen falta, cada cuántos
          metros va cada equipo y si las aves caben al peso de venta.
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-line">
            <Fila label="Área" value={`${num(g.areaM2)} m² · ${num(enPies2(g.areaM2))} pies²`} />
            <Fila
              label={`Densidad a ${num(lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT, 1)} lb`}
              value={`${num(g.densidadKgM2, 1)} kg/m² · caben ${num(g.avesMaximas)} aves`}
              valueClass={g.sobrepoblado ? 'text-clay-deep' : 'text-forest-600'}
            />
          </Card>

          {g.sobrepoblado && (
            <div className="mt-2 rounded-xl2 border-l-4 border-amber-400 bg-amber-tint p-4">
              <div className="font-display text-[15px] font-semibold text-amber-text">
                El galpón queda apretado al peso de venta
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-amber-text">
                Con {num(aves)} aves llegas a {num(g.densidadKgM2, 1)} kg/m², sobre los 30 kg/m² que
                aguanta un galpón abierto en calor. Saca {num(Math.max(0, aves - g.avesMaximas))} aves
                antes (raleo) o vende un poco más liviano.
              </p>
            </div>
          )}

          <div className="mb-2 mt-4 text-xs font-medium text-ink-faint">Cómo repartirlos</div>
          <Card className="divide-y divide-line">
            <FilaEquipo titulo="Comederos" d={g.comederos} />
            <FilaEquipo titulo="Bebederos" d={g.bebederos} />
          </Card>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            Ninguna ave debe caminar más de 3 m (10 pies) para comer o beber; así queda en{' '}
            {num(g.bebederos.caminataMaxM, 1)} m. Los niples van cada 35 cm, o sea{' '}
            {num(plan.metrosDeNiples, 1)} m de línea en total.
          </p>
        </>
      )}
    </>
  )
}

function FilaEquipo({ titulo, d }: { titulo: string; d: Distribucion }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="font-display text-[15px] font-semibold tnum">
          {num(d.lineas * d.porLinea)} repartidos
        </span>
      </div>
      <div className="mt-1 text-xs leading-relaxed text-ink-faint tnum">
        {d.lineas === 1
          ? `Una sola línea por el centro del galpón, uno cada ${num(d.cadaM, 1)} m (${num(enPies(d.cadaM), 1)} pies).`
          : `${num(d.lineas)} líneas a lo largo, separadas ${num(d.separacionM, 1)} m (${num(enPies(d.separacionM), 1)} pies) y la primera a ${num(d.desdeParedM, 1)} m de la pared. En cada línea, ${num(d.porLinea)}: uno cada ${num(d.cadaM, 1)} m (${num(enPies(d.cadaM), 1)} pies).`}
      </div>
    </div>
  )
}

function MedidaGalpon({
  valor,
  onGuardar,
  etiqueta,
}: {
  valor?: number
  onGuardar: (v: number | undefined) => void
  etiqueta: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={etiqueta}
      defaultValue={valor ?? ''}
      onBlur={(e) => onGuardar(Number(e.target.value) || undefined)}
      className="h-11 w-16 rounded-xl border border-line bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
    />
  )
}
