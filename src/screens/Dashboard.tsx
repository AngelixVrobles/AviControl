import { Link } from 'react-router-dom'
import { AlertaChip } from '../components/AlertaChip'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { LoteCard } from '../components/LoteCard'
import { Button, EmptyState } from '../components/ui'
import { IconEgg, IconTrend, LogoAviControl } from '../components/icons'
import { money, num } from '../lib/format'
import { useResumen, useSettings } from '../lib/hooks'

export function Dashboard() {
  const resumen = useResumen()
  const settings = useSettings()

  if (!resumen) return <SkeletonHeader />

  const activos = resumen.filter((r) => r.lote.estado === 'activo')
  const gananciaNeta = resumen.reduce((a, r) => a + r.metrics.ganancia, 0)
  const avesTotales = activos.reduce((a, r) => a + r.metrics.avesVivas, 0)
  const ingresosTot = resumen.reduce((a, r) => a + r.metrics.ingresos, 0)
  const positivo = gananciaNeta >= 0

  return (
    <div className="animate-rise">
      <header className="flex items-center justify-between pt-3">
        <div>
          <p className="text-sm text-ink-faint">{settings.granja}</p>
          <h1 className="font-display text-[26px] font-semibold leading-tight">AviControl</h1>
        </div>
        <LogoAviControl width={40} height={40} className="shadow-card" />
      </header>

      <section className="mt-5 overflow-hidden rounded-xl2 border border-forest-700 bg-forest-700 p-5 text-paper-raised shadow-card">
        <div className="flex items-center gap-2 text-forest-100">
          <IconTrend width={18} height={18} />
          <span className="text-[13px] font-medium">Ganancia neta · todos los lotes</span>
        </div>
        <div className="mt-2 font-display text-[40px] font-semibold leading-none tracking-tight tnum">
          <span className={positivo ? '' : 'text-amber-400'}>
            <AnimatedNumber value={gananciaNeta} format={(n) => money(n)} />
          </span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <HeroStat label="Lotes activos" value={num(activos.length)} />
          <HeroStat label="Aves vivas" value={num(avesTotales)} />
          <HeroStat label="Ingresos" value={money(ingresosTot, { compact: true })} />
        </div>
      </section>

      {activos.some((r) => r.alertas.length > 0) && (
        <section className="mt-7">
          <h2 className="mb-3 font-display text-lg font-semibold">Alertas</h2>
          <div className="space-y-2">
            {activos.flatMap((r) =>
              r.alertas.map((a, i) => (
                <AlertaChip
                  key={`${r.lote.id}-${i}`}
                  alerta={a}
                  titulo={r.lote.nombre}
                  to={`/lotes/${r.lote.id}`}
                />
              )),
            )}
          </div>
        </section>
      )}

      <div className="mt-7 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Lotes activos</h2>
        <Link to="/lotes" className="-m-2 p-2 text-sm font-medium text-forest-600">
          Ver todos
        </Link>
      </div>

      <div className="mt-3 space-y-3">
        {activos.length === 0 ? (
          <EmptyState
            icon={<IconEgg width={28} height={28} />}
            title="Aún no tienes lotes"
            text="Crea tu primer lote de engorde o ponedoras para empezar a llevar el control."
            action={
              <Link to="/lotes/nuevo">
                <Button>Crear lote</Button>
              </Link>
            }
          />
        ) : (
          activos.map((d, i) => (
            <div key={d.lote.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <LoteCard data={d} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold tnum leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-forest-100/80">{label}</div>
    </div>
  )
}

function SkeletonHeader() {
  return (
    <div role="status" aria-label="Cargando" className="animate-pulse pt-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-24 rounded bg-paper-sunken" />
          <div className="mt-2 h-8 w-40 rounded-lg bg-paper-sunken" />
        </div>
        <div className="h-10 w-10 rounded-xl bg-paper-sunken" />
      </div>
      <div className="mt-5 h-[172px] rounded-xl2 bg-paper-sunken" />
      <div className="mt-7 h-6 w-32 rounded bg-paper-sunken" />
      <div className="mt-3 h-32 rounded-xl2 bg-paper-sunken" />
    </div>
  )
}
