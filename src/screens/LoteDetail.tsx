import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { motion } from 'motion/react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db, type Gasto, type Ingreso, type Lote, type Pesaje, type Registro } from '../db/schema'
import { useLoteData, useSettings } from '../lib/hooks'
import { agruparGastos, resumenSemanal, type LoteMetrics } from '../lib/metrics'
import { proyectarVenta } from '../lib/proyeccion'
import { analizarPrecio, precioAlimentoLb, precioQuintalReal } from '../lib/precios'
import { analizarPuntoOptimo } from '../lib/optimo'
import { analizarMuestra, tamanoMuestra } from '../lib/muestreo'
import { computeEquipo, enPies, enPies2, type Distribucion } from '../lib/equipo'
import { computeGuiaDia } from '../lib/guia'
import { computeInventarioAlimento, computePlanAlimento, type InventarioAlimento } from '../lib/plan'
import { computeLiquidacion } from '../lib/sociedad'
import { compartirReporte } from '../lib/reporte'
import { diasEntre, fecha, hoyISO, money, num, numCompacto, pct } from '../lib/format'
import { categoriaLabel, RAZA, tipoIngresoLabel } from '../lib/labels'
import { LB_POR_QUINTAL, PESO_OBJETIVO_DEFAULT, fcaEstandar, pesoEstandarLb } from '../lib/standards'
import { reduceMotion } from '../lib/motion'
import { saveSettings, type Settings } from '../lib/settings'
import { AlertaChip } from '../components/AlertaChip'
import { confirmar } from '../components/confirm'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Button, Card, Pill } from '../components/ui'
import { IconBack, IconMoney, IconPesa, IconPlus, IconScale, IconTrend } from '../components/icons'
import { ActionButton, GastoSheet, IngresoSheet, PesajeSheet, RegistroSheet } from '../components/sheets'

type SheetKind = 'registro' | 'pesaje' | 'gasto' | 'ingreso' | null
type Tab = 'hoy' | 'crecimiento' | 'dinero'
const TABS: { id: Tab; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'crecimiento', label: 'Crecimiento' },
  { id: 'dinero', label: 'Dinero' },
]

export function LoteDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const data = useLoteData(id ? Number(id) : undefined)
  const settings = useSettings()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [editRegistro, setEditRegistro] = useState<Registro>()
  const [editGasto, setEditGasto] = useState<Gasto>()
  const [editIngreso, setEditIngreso] = useState<Ingreso>()
  const [editPesaje, setEditPesaje] = useState<Pesaje>()
  const [todosMovs, setTodosMovs] = useState(false)
  const [todoHistorial, setTodoHistorial] = useState(false)

  function abrir(kind: SheetKind) {
    setEditRegistro(undefined)
    setEditGasto(undefined)
    setEditIngreso(undefined)
    setEditPesaje(undefined)
    setSheet(kind)
  }

  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('reg') !== '1') return
    abrir('registro')
    const next = new URLSearchParams(searchParams)
    next.delete('reg')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const tab = (searchParams.get('t') as Tab) || 'hoy'
  function setTab(t: Tab) {
    const next = new URLSearchParams(searchParams)
    next.set('t', t)
    setSearchParams(next, { replace: true })
  }

  if (data === undefined) return <div className="pt-10 text-center text-ink-faint">Cargando…</div>
  if (data === null)
    return (
      <div className="pt-10 text-center">
        <p className="text-ink-faint">Este lote no existe.</p>
        <Button variant="soft" className="mt-4" onClick={() => nav('/lotes')}>
          Volver a lotes
        </Button>
      </div>
    )

  const { lote, registros, gastos, ingresos, pesajes, metrics, alertas } = data
  const gastosCat = agruparGastos(gastos)
  const maxCat = Math.max(1, ...gastosCat.map((g) => g.total))
  const positivo = metrics.ganancia >= 0

  async function cerrar() {
    const activo = lote.estado === 'activo'
    const ok = await confirmar(
      activo
        ? { titulo: 'Cerrar ciclo', mensaje: 'Podrás seguir viéndolo, pero no aparecerá como activo.', confirmar: 'Cerrar ciclo' }
        : { titulo: 'Reabrir ciclo', mensaje: 'Volverá a aparecer como activo.', confirmar: 'Reabrir' },
    )
    if (!ok) return
    await db.lotes.update(
      lote.id,
      activo
        ? { estado: 'cerrado', fechaCierre: hoyISO() }
        : { estado: 'activo', fechaCierre: undefined },
    )
  }

  const kpis = [
    { label: 'Peso prom.', value: metrics.pesoPromedioLb != null ? `${num(metrics.pesoPromedioLb, 2)} lb` : '—' },
    { label: 'Conv. alim. (FCA)', value: metrics.fca != null ? num(metrics.fca, 2) : '—' },
    { label: 'Mortalidad', value: pct(metrics.mortalidadPct) },
    { label: 'Alimento total', value: `${num(metrics.alimentoTotalLb)} lb` },
    { label: 'Costo / lb', value: metrics.costoPorLb != null ? money(metrics.costoPorLb) : '—' },
    { label: 'Aves vendidas', value: num(metrics.vendidas) },
  ]

  return (
    <div className="animate-rise">
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => nav(-1)}
          className="grid h-11 w-11 place-items-center rounded-full bg-paper-sunken"
          aria-label="Volver"
        >
          <IconBack width={22} height={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold leading-tight">{lote.nombre}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[13px] text-ink-soft tnum">Día {metrics.dias}</span>
            <span className="text-[13px] text-ink-soft">· {RAZA}</span>
            {lote.estado === 'cerrado' && <Pill tone="neutral">Cerrado</Pill>}
          </div>
        </div>
      </header>

      {alertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {alertas.map((a, i) => (
            <AlertaChip key={i} alerta={a} />
          ))}
        </div>
      )}

      <div className="mt-1 grid grid-cols-4 gap-2">
        <ActionButton
          label="Día"
          tone="green"
          icon={<IconPlus width={20} height={20} />}
          onClick={() => abrir('registro')}
        />
        <ActionButton
          label="Pesaje"
          tone="green"
          icon={<IconPesa width={20} height={20} />}
          onClick={() => abrir('pesaje')}
        />
        <ActionButton
          label="Gasto"
          tone="neutral"
          icon={<IconMoney width={20} height={20} />}
          onClick={() => abrir('gasto')}
        />
        <ActionButton
          label="Venta"
          tone="amber"
          icon={<IconScale width={20} height={20} />}
          onClick={() => abrir('ingreso')}
        />
      </div>

      <div className="sticky top-0 z-30 -mx-5 mt-5 bg-paper px-5 pb-2 pt-2">
        <div className="flex gap-1 rounded-full bg-sunken p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex-1 rounded-full py-2 text-sm font-semibold"
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tab-activa"
                  className="absolute inset-0 rounded-full bg-paper-raised shadow-card"
                  transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                />
              )}
              <span className={'relative ' + (tab === t.id ? 'text-ink' : 'text-ink-soft')}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'hoy' && (
        <div className="animate-rise">
          <GuiaDelDia lote={lote} metrics={metrics} />
          <PlanAlimento lote={lote} gastos={gastos} metrics={metrics} />
          <Equipo lote={lote} metrics={metrics} settings={settings} />

          <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Indicadores</h2>
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <Card key={k.label} className="p-3.5">
                <div className="font-display text-[22px] font-semibold tnum leading-none">{k.value}</div>
                <div className="mt-1.5 text-[13px] text-ink-soft">{k.label}</div>
              </Card>
            ))}
          </div>

          <h2 className="mb-1 mt-7 font-display text-lg font-semibold">Historial</h2>
          {registros.length === 0 ? (
            <p className="rounded-xl2 border border-dashed border-line bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-faint">
              Sin registros aún. Toca “Registrar día” para empezar.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-faint">Toca un día para corregirlo.</p>
              <Card className="divide-y divide-line">
                {[...registros].reverse().slice(0, todoHistorial ? undefined : 8).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setEditRegistro(r)
                      setEditGasto(undefined)
                      setEditIngreso(undefined)
                      setSheet('registro')
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition active:bg-paper-sunken"
                  >
                    <span className="font-medium">{fecha(r.fecha)}</span>
                    <div className="flex items-center gap-3 text-ink-soft tnum">
                      {r.pesoPromedio != null && <span>{num(r.pesoPromedio, 2)} lb</span>}
                      {r.alimentoLb > 0 && <span className="text-ink-faint">{num(r.alimentoLb)} lb alim.</span>}
                      {r.mortalidad > 0 && <span className="text-ink-soft">{num(r.mortalidad)} bajas</span>}
                    </div>
                  </button>
                ))}
              </Card>
              {!todoHistorial && registros.length > 8 && (
                <button
                  onClick={() => setTodoHistorial(true)}
                  className="mt-2 w-full py-2 text-center text-[13px] font-medium text-forest-600"
                >
                  Ver los {num(registros.length)} registros
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'crecimiento' && (
        <div className="animate-rise">
          <CurvaEstandar lote={lote} registros={registros} />
          <GridCrecimiento metrics={metrics} />
          <Muestreo
            lote={lote}
            pesajes={pesajes}
            metrics={metrics}
            onNuevo={() => abrir('pesaje')}
            onEditar={(p) => {
              setEditRegistro(undefined)
              setEditGasto(undefined)
              setEditIngreso(undefined)
              setEditPesaje(p)
              setSheet('pesaje')
            }}
          />
          <TablaSemanal lote={lote} registros={registros} />
          <Diagnostico metrics={metrics} />
        </div>
      )}

      {tab === 'dinero' && (
        <div className="animate-rise">
          <Card className="mt-5 overflow-hidden">
            <div className="flex items-stretch">
              <div className="flex-1 p-4">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <IconTrend width={16} height={16} />
                  <span className="text-[12px] font-medium">{positivo ? 'Ganancia' : 'Pérdida'}</span>
                </div>
                <div
                  className={
                    'mt-1 font-display text-[28px] font-semibold tracking-tight tnum leading-none ' +
                    (positivo ? 'text-forest-600' : 'text-clay-deep')
                  }
                >
                  <AnimatedNumber value={metrics.ganancia} format={(n) => money(n)} />
                </div>
                <div className="mt-1 text-xs text-ink-faint tnum">Margen {pct(metrics.margenPct)}</div>
              </div>
              <div className="w-px bg-line" />
              <div className="grid flex-1 grid-rows-2">
                <div className="border-b border-line px-4 py-2.5">
                  <div className="text-xs text-ink-faint">Ingresos</div>
                  <div className="font-display text-[17px] font-semibold tnum leading-tight">
                    {money(metrics.ingresos)}
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-xs text-ink-faint">Costos</div>
                  <div className="font-display text-[17px] font-semibold tnum leading-tight">
                    {money(metrics.costos)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <PrecioMinimo lote={lote} registros={registros} gastos={gastos} metrics={metrics} />
          <PuntoOptimo lote={lote} registros={registros} gastos={gastos} metrics={metrics} />
          <SiVendes lote={lote} registros={registros} gastos={gastos} metrics={metrics} />
          <ProyeccionVenta lote={lote} registros={registros} gastos={gastos} metrics={metrics} />

          {gastosCat.length > 0 && (
            <>
              <h2 className="mb-3 mt-7 font-display text-lg font-semibold">A dónde se fue el dinero</h2>
              <Card className="divide-y divide-line">
                {gastosCat.map((g) => (
                  <div key={g.categoria} className="px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink-soft">
                        {categoriaLabel(g.categoria)}
                        <span className="ml-2 text-xs text-ink-faint tnum">
                          {pct((g.total / Math.max(1, metrics.costos)) * 100, 0)}
                        </span>
                      </span>
                      <span className="font-display font-semibold tnum">{money(g.total)}</span>
                    </div>
                    <div className="relative mt-2.5 h-[3px]">
                      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
                      <motion.div
                        className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-green-action"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: g.total / maxCat }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}

          <Sociedad lote={lote} gastos={gastos} ingresos={ingresos} metrics={metrics} settings={settings} />

          {(gastos.length > 0 || ingresos.length > 0) && (
            <>
              <h2 className="mb-1 mt-7 font-display text-lg font-semibold">Movimientos</h2>
              <p className="mb-3 text-xs text-ink-faint">Toca uno para editarlo o eliminarlo.</p>
              <Card className="divide-y divide-line">
                {movimientos(gastos, ingresos, todosMovs ? Infinity : 15).map((m) => (
                  <button
                    key={`${m.kind}-${m.id}`}
                    onClick={() => {
                      if (m.kind === 'gasto') setEditGasto(m.gasto)
                      else setEditIngreso(m.ingreso)
                      setEditRegistro(undefined)
                      setSheet(m.kind === 'gasto' ? 'gasto' : 'ingreso')
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition active:bg-paper-sunken"
                  >
                    <div>
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs text-ink-faint">{fecha(m.fecha)}</div>
                    </div>
                    <span
                      className={
                        'font-display font-semibold tnum ' +
                        (m.kind === 'ingreso' ? 'text-forest-600' : 'text-ink')
                      }
                    >
                      {m.kind === 'ingreso' ? '+' : '−'}
                      {money(m.monto)}
                    </span>
                  </button>
                ))}
              </Card>
              {!todosMovs && gastos.length + ingresos.length > 15 && (
                <button
                  onClick={() => setTodosMovs(true)}
                  className="mt-2 w-full py-2 text-center text-[13px] font-medium text-forest-600"
                >
                  Ver los {num(gastos.length + ingresos.length)} movimientos
                </button>
              )}
            </>
          )}

          <div className="mt-8 space-y-2">
            <Button
              block
              variant="soft"
              onClick={() => compartirReporte(lote, metrics, settings.granja, kpis)}
            >
              Compartir reporte
            </Button>
            <div className="flex justify-center">
              <Button variant="ghost" onClick={cerrar}>
                {lote.estado === 'activo' ? 'Cerrar ciclo' : 'Reabrir ciclo'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <RegistroSheet
        lote={lote}
        registros={registros}
        open={sheet === 'registro'}
        onClose={() => setSheet(null)}
        editar={editRegistro}
      />
      <PesajeSheet
        lote={lote}
        avesVivas={metrics.avesVivas}
        open={sheet === 'pesaje'}
        onClose={() => setSheet(null)}
        editar={editPesaje}
      />
      <GastoSheet lote={lote} open={sheet === 'gasto'} onClose={() => setSheet(null)} editar={editGasto} />
      <IngresoSheet lote={lote} open={sheet === 'ingreso'} onClose={() => setSheet(null)} editar={editIngreso} />
    </div>
  )
}

function SiVendes({
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
  const pesoActual = metrics.pesoPromedioLb
  if (pesoActual == null || metrics.avesVivas <= 0) return null
  const objetivo = lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT

  const defs = [
    { key: 'hoy', titulo: 'Hoy', peso: pesoActual },
    { key: 'obj', titulo: 'Al peso objetivo', peso: Math.max(objetivo, pesoActual) },
    { key: 'tarde', titulo: 'Una semana más', peso: Math.max(objetivo, pesoActual) + 0.8 },
  ]
  const escenarios = defs
    .map((d) => ({ ...d, p: proyectarVenta(lote, registros, gastos, metrics, d.peso) }))
    .filter((e) => e.p)

  if (escenarios.length === 0) return null
  const rec = escenarios.find((e) => e.key === 'obj') ?? escenarios[0]
  const gananciaRec = rec.p!.gananciaProyectada

  return (
    <>
      <h2 className="mb-1 mt-7 font-display text-lg font-semibold">Si vendes…</h2>
      <p className="mb-3 text-xs text-ink-faint">
        {lote.precioVentaLb
          ? 'Cuánto ganarías según cuándo vendas.'
          : 'Agrega el precio de venta por libra para ver la ganancia de cada opción.'}
      </p>
      <div className="space-y-2">
        {escenarios.map((e) => {
          const p = e.p!
          const esRec = e.key === rec.key && escenarios.length > 1
          const comeMas =
            e.key === 'tarde' && gananciaRec != null && p.gananciaProyectada != null && p.gananciaProyectada <= gananciaRec
          return (
            <div
              key={e.key}
              className={clsx(
                'flex items-center justify-between rounded-xl2 border px-4 py-3',
                esRec ? 'border-2 border-green-action bg-green-tint' : 'border-line bg-paper-raised',
              )}
            >
              <div className="min-w-0">
                <div className="font-display text-[15px] font-semibold">
                  {e.titulo}
                  {p.diasRestantes > 0 && (
                    <span className="ml-1.5 text-[13px] font-normal text-ink-soft tnum">
                      · día {metrics.dias + p.diasRestantes}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-ink-soft tnum">
                  {num(p.lbEnPie)} lb · {num(e.peso, 2)} lb/ave
                </div>
                {comeMas && (
                  <div className="mt-0.5 text-[12px] font-semibold text-clay-text">
                    ▼ come más de lo que crece
                  </div>
                )}
              </div>
              <div className="shrink-0 pl-3 text-right">
                {p.gananciaProyectada != null ? (
                  <div
                    className={clsx(
                      'font-display text-[19px] font-semibold tnum leading-none',
                      p.gananciaProyectada >= 0 ? 'text-forest-600' : 'text-clay-deep',
                    )}
                  >
                    {money(p.gananciaProyectada, { compact: true })}
                  </div>
                ) : (
                  <div className="font-display text-[17px] font-semibold tnum">{num(p.lbEnPie)} lb</div>
                )}
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  {p.diasRestantes > 0 ? `en ${p.diasRestantes} días` : 'ahora'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Muestreo({
  lote,
  pesajes,
  metrics,
  onNuevo,
  onEditar,
}: {
  lote: Lote
  pesajes: Pesaje[]
  metrics: LoteMetrics
  onNuevo: () => void
  onEditar: (p: Pesaje) => void
}) {
  const aves = metrics.avesVivas
  const sugeridas = tamanoMuestra(aves)
  const ultimo = pesajes.length ? pesajes[pesajes.length - 1] : undefined
  const m = ultimo ? analizarMuestra(ultimo.pesos, aves) : null

  return (
    <>
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Muestreo de peso</h2>
        <button onClick={onNuevo} className="text-[13px] font-semibold text-forest-600">
          Pesar aves →
        </button>
      </div>

      {!m || !ultimo ? (
        <Card className="p-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            Pesando <span className="font-semibold text-ink">{num(sugeridas)} aves al azar</span> de las{' '}
            {num(aves)} del galpón sabes el peso promedio de todas con un margen de ±3 %. De ahí salen
            las libras que vas a vender y a qué precio te conviene.
          </p>
          <Button variant="soft" block className="mt-3" onClick={onNuevo}>
            Empezar pesaje
          </Button>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-ink-faint">
                  {fecha(ultimo.fecha)} · día {diasEntre(lote.fechaInicio, ultimo.fecha)}
                </div>
                <div className="font-display text-[28px] font-semibold leading-none tnum">
                  {num(m.promedioLb, 2)} lb
                </div>
                <div className="mt-1 text-[12px] text-ink-soft tnum">
                  ± {num(m.margenLb, 2)} lb · {num(m.n)} aves ({pct(m.pctLote, 1)} del galpón)
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-faint">del estándar Cobb</div>
                <div
                  className={clsx(
                    'font-display text-[22px] font-semibold leading-none tnum',
                    m.promedioLb >= pesoEstandarLb(diasEntre(lote.fechaInicio, ultimo.fecha)) * 0.95
                      ? 'text-forest-600'
                      : 'text-clay-deep',
                  )}
                >
                  {pct((m.promedioLb / pesoEstandarLb(diasEntre(lote.fechaInicio, ultimo.fecha))) * 100, 0)}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div>
                <div className="font-display text-[17px] font-semibold leading-none tnum">
                  {pct(m.uniformidadPct, 0)}
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">Uniformidad</div>
                <div className="text-[11px] text-ink-soft">{m.uniformidad}</div>
              </div>
              <div>
                <div className="font-display text-[17px] font-semibold leading-none tnum">
                  {pct(m.cvPct, 1)}
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">Desparejo (CV)</div>
                <div className="text-[11px] text-ink-soft tnum">
                  {num(m.minLb, 2)}–{num(m.maxLb, 2)} lb
                </div>
              </div>
              <div>
                <div className="font-display text-[17px] font-semibold leading-none tnum">
                  {num(m.biomasaLb ?? 0)}
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">Libras vivas</div>
                <div className="text-[11px] text-ink-soft tnum">
                  ±{num((m.biomasaMaxLb ?? 0) - (m.biomasaLb ?? 0))} lb
                </div>
              </div>
            </div>
          </Card>

          {m.uniformidad === 'despareja' && (
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Un lote desparejo (CV sobre 12 %) suele ser falta de comedero o bebedero por ave: las
              aves chicas no alcanzan. Revisa espacio y altura de los equipos.
            </p>
          )}

          {pesajes.length > 1 && (
            <Card className="mt-3 divide-y divide-line">
              {[...pesajes].reverse().slice(0, 6).map((p) => {
                const s = analizarMuestra(p.pesos, aves)
                if (!s) return null
                return (
                  <button
                    key={p.id}
                    onClick={() => onEditar(p)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition active:bg-paper-sunken"
                  >
                    <span className="font-medium">
                      Día {diasEntre(lote.fechaInicio, p.fecha)}
                      <span className="ml-2 text-xs text-ink-faint">{num(s.n)} aves</span>
                    </span>
                    <span className="text-ink-soft tnum">
                      {num(s.promedioLb, 2)} lb
                      <span className="ml-2 text-xs text-ink-faint">±{pct(s.margenPct, 1)}</span>
                    </span>
                  </button>
                )
              })}
            </Card>
          )}
        </>
      )}
    </>
  )
}

function PrecioMinimo({
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
  const objetivo = lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT
  const p = proyectarVenta(lote, registros, gastos, metrics, objetivo)
  const a = analizarPrecio(lote, gastos, metrics, p)

  if (!a)
    return (
      <>
        <h2 className="mb-3 mt-7 font-display text-lg font-semibold">¿A cómo vender?</h2>
        <Card className="p-4 text-sm text-ink-faint">
          Pesa unas aves para saber cuántas libras vas a vender; con eso se calcula el precio mínimo
          por libra.
        </Card>
      </>
    )

  const lbPorAve = a.lbEnPie / Math.max(1, a.aves)

  return (
    <>
      <div className="mb-1 mt-7 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">¿A cómo vender?</h2>
        <label className="flex items-center gap-1.5 text-xs text-ink-faint">
          Tu precio
          <input
            type="number"
            inputMode="decimal"
            defaultValue={lote.precioVentaLb ?? ''}
            onBlur={(e) => db.lotes.update(lote.id, { precioVentaLb: Number(e.target.value) || undefined })}
            className="h-11 w-20 rounded-xl border border-line bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
          />
          /lb
        </label>
      </div>
      <p className="mb-3 text-xs text-ink-faint">
        Sobre el cierre proyectado: {num(a.lbEnPie)} lb de {num(a.aves)} aves, incluyendo el alimento
        que falta comprar.
      </p>

      <Card className="p-4">
        <div className="text-xs text-ink-faint">Precio mínimo para no perder</div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[32px] font-semibold leading-none tnum">
            {money(a.precioEquilibrioLb)}
          </span>
          <span className="text-sm text-ink-soft">/ lb</span>
        </div>
        <div className="mt-1.5 text-[13px] text-ink-soft tnum">
          = {money(a.precioEquilibrioAve)} por pollo de {num(lbPorAve, 2)} lb
        </div>
        <div className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-faint">
          De cada libra que vendas, {money(a.costoAlimento / a.lbEnPie)} son alimento (
          {pct(a.alimentoPctDelCosto, 0)} del costo), {money(a.costoAves / a.lbEnPie)} el pollito y{' '}
          {money(a.costoOtros / a.lbEnPie)} lo demás. Cada {money(1)} de más por libra son{' '}
          <span className="font-semibold text-ink-soft">{money(a.gananciaPorPesoDeMas)}</span> de
          ganancia.
        </div>
      </Card>

      <Card className="mt-3 divide-y divide-line">
        {[...a.escalones, ...(a.actual ? [a.actual] : [])]
          .sort((x, y) => x.precioLb - y.precioLb)
          .map((e) => (
            <div
              key={e.etiqueta}
              className={clsx(
                'flex items-center justify-between px-4 py-2.5',
                e.esActual && 'bg-green-tint',
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{e.etiqueta}</div>
                <div className="text-[11px] text-ink-faint tnum">
                  {money(e.precioPorAve)} por pollo
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <span className="font-display text-[15px] font-semibold tnum">
                  {money(e.precioLb)}
                  <span className="text-[11px] font-normal text-ink-faint">/lb</span>
                </span>
                <span
                  className={clsx(
                    'w-[74px] font-display text-[15px] font-semibold tnum',
                    e.ganancia >= 0 ? 'text-forest-600' : 'text-clay-deep',
                  )}
                >
                  {money(e.ganancia, { compact: true })}
                </span>
              </div>
            </div>
          ))}
      </Card>
      {a.actual && (
        <p className="mt-2 text-xs text-ink-faint">
          {a.actual.ganancia >= 0
            ? `A ${money(a.actual.precioLb)}/lb vendes ${pct(a.actual.sobreEquilibrioPct, 0)} por encima del equilibrio: ${money(a.actual.gananciaPorAve)} por pollo.`
            : `A ${money(a.actual.precioLb)}/lb estás vendiendo por debajo del costo: pierdes ${money(-a.actual.gananciaPorAve)} por pollo.`}
        </p>
      )}
    </>
  )
}

function PuntoOptimo({
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
  if (lote.estado !== 'activo') return null
  const a = analizarPuntoOptimo(lote, registros, gastos, metrics)
  if (!a)
    return (
      <>
        <h2 className="mb-3 mt-7 font-display text-lg font-semibold">¿Hasta qué día conviene?</h2>
        <Card className="p-4 text-sm text-ink-faint">
          Necesita tu precio de venta por libra, el precio del quintal y al menos un pesaje para
          decirte hasta qué día vale la pena engordar.
        </Card>
      </>
    )

  const faltan = a.optimo.dia - metrics.dias
  const datos = a.puntos.map((p) => ({ x: p.dia, g: Math.round(p.ganancia) }))
  const marginalHoy = a.puntos[1]?.costoLbMarginal ?? 0

  return (
    <>
      <h2 className="mb-1 mt-7 font-display text-lg font-semibold">¿Hasta qué día conviene?</h2>
      <p className="mb-3 text-xs text-ink-faint">
        Cada día extra el pollo convierte peor. Aquí está el día en que la ganancia deja de subir.
      </p>

      <Card className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-ink-faint">Mejor día para vender</div>
            <div className="font-display text-[30px] font-semibold leading-none tnum">
              Día {a.optimo.dia}
            </div>
            <div className="mt-1 text-[13px] text-ink-soft tnum">
              {fecha(a.optimo.fecha)} · {faltan > 0 ? `en ${faltan} días` : 'ya pasó'} ·{' '}
              {num(a.optimo.pesoLb, 2)} lb/ave
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-ink-faint">Ganancia</div>
            <div
              className={clsx(
                'font-display text-[19px] font-semibold leading-none tnum',
                a.optimo.ganancia >= 0 ? 'text-forest-600' : 'text-clay-deep',
              )}
            >
              {money(a.optimo.ganancia, { compact: true })}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={datos} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="#EEEBE2" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 11, fill: '#5C6A61' }} axisLine={false} tickLine={false} />
              <YAxis
                width={44}
                tick={{ fontSize: 11, fill: '#5C6A61' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => numCompacto(Number(v))}
              />
              <Tooltip
                labelFormatter={(x) => `día ${x}`}
                formatter={(v) => [money(Number(v)), 'Ganancia']}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E3DFD3',
                  background: '#FCFBF7',
                  fontSize: 13,
                  boxShadow: '0 8px 24px -12px rgba(27,43,34,0.2)',
                }}
              />
              <ReferenceLine x={a.optimo.dia} stroke="#1E7340" strokeDasharray="4 3" />
              <Line
                dataKey="g"
                stroke="#2F8A4C"
                strokeWidth={2.5}
                dot={false}
                animationDuration={600}
                isAnimationActive={!reduceMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-3 divide-y divide-line">
        <FilaProyeccion
          label="Esperar hasta ahí"
          value={faltan > 0 ? `+${money(a.gananciaExtra)}` : 'Ya lo pasaste'}
          valueClass={a.gananciaExtra > 0 ? 'text-forest-600' : undefined}
        />
        <FilaProyeccion
          label="La próxima libra te cuesta"
          value={`${money(marginalHoy)} de ${money(a.precioVentaLb)}`}
          valueClass={marginalHoy > a.precioVentaLb ? 'text-clay-deep' : 'text-forest-600'}
        />
        {a.diaCruce != null && (
          <FilaProyeccion label="Deja de convenir" value={`día ${a.diaCruce}`} valueClass="text-clay-deep" />
        )}
        {a.excedeObjetivo && (
          <FilaProyeccion
            label={`Si topan en ${num(a.objetivoLb, 1)} lb`}
            value={`día ${a.tope.dia} · ${money(a.tope.ganancia, { compact: true })}`}
          />
        )}
      </Card>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        {a.excedeObjetivo
          ? `El día ${a.optimo.dia} sale un pollo de ${num(a.optimo.pesoLb, 2)} lb: solo conviene si te lo pagan a ${money(a.precioVentaLb)} la libra igual que uno de ${num(a.objetivoLb, 1)} lb. `
          : ''}
        Cuenta el alimento de los días extra y la mortalidad que falta por ocurrir. Si pagas mano de
        obra por día, el mejor día es un poco antes del que sale aquí.
      </p>
    </>
  )
}

function Equipo({
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
      <h2 className="mb-1 mt-7 font-display text-lg font-semibold">Comederos y bebederos</h2>
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
            <FilaProyeccion label="Área" value={`${num(g.areaM2)} m² · ${num(enPies2(g.areaM2))} pies²`} />
            <FilaProyeccion
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

function GridCrecimiento({ metrics: m }: { metrics: LoteMetrics }) {
  const gananciaDiaria = m.pesoPromedioLb != null && m.dias > 0 ? m.pesoPromedioLb / m.dias : undefined
  // Índice de eficiencia productiva europeo (EPEF): rango típico 250–400.
  const iep =
    m.pesoPromedioLb != null && m.fca != null && m.dias > 0
      ? (((100 - m.mortalidadPct) * (m.pesoPromedioLb / 2.2046)) / (m.dias * m.fca)) * 100
      : undefined

  const celdas = [
    { label: 'Ganancia diaria', value: gananciaDiaria != null ? `${num(gananciaDiaria, 3)} lb` : '—' },
    { label: 'Alimento total', value: `${num(m.alimentoTotalLb)} lb` },
    { label: 'Mortalidad acum.', value: pct(m.mortalidadPct) },
    { label: 'Índice de eficiencia', value: iep != null ? num(iep, 0) : '—' },
  ]
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {celdas.map((c) => (
        <Card key={c.label} className="p-3.5">
          <div className="font-display text-[22px] font-semibold tnum leading-none">{c.value}</div>
          <div className="mt-1.5 text-[13px] text-ink-soft">{c.label}</div>
        </Card>
      ))}
    </div>
  )
}

function Diagnostico({ metrics: m }: { metrics: LoteMetrics }) {
  const std = fcaEstandar(m.dias)
  if (m.dias < 21 || m.fca == null || m.fca <= std + 0.15) return null
  return (
    <div className="mt-6 rounded-xl2 border-l-4 border-amber-400 bg-amber-tint p-4">
      <div className="font-display text-[15px] font-semibold text-amber-text">
        La conversión va por encima del estándar
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-amber-text">
        Con FCA {num(m.fca, 2)} (Cobb 500 al día {m.dias}: {num(std, 2)}) las aves comen de más por
        cada libra que ganan. Revisa desperdicio en comederos, densidad y temperatura del galpón
        antes del día 35.
      </p>
    </div>
  )
}

type Movimiento =
  | { kind: 'gasto'; id: number; fecha: string; monto: number; label: string; gasto: Gasto }
  | { kind: 'ingreso'; id: number; fecha: string; monto: number; label: string; ingreso: Ingreso }

function movimientos(gastos: Gasto[], ingresos: Ingreso[], limite: number): Movimiento[] {
  const items: Movimiento[] = [
    ...gastos.map((g) => ({
      kind: 'gasto' as const,
      id: g.id,
      fecha: g.fecha,
      monto: g.monto,
      label: g.descripcion || categoriaLabel(g.categoria),
      gasto: g,
    })),
    ...ingresos.map((i) => ({
      kind: 'ingreso' as const,
      id: i.id,
      fecha: i.fecha,
      monto: i.monto,
      label: i.descripcion || tipoIngresoLabel(i.tipo),
      ingreso: i,
    })),
  ]
  const orden = items.sort((a, b) => b.fecha.localeCompare(a.fecha))
  return Number.isFinite(limite) ? orden.slice(0, limite) : orden
}

function ProyeccionVenta({
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
  const [objetivo, setObjetivo] = useState(String(lote.pesoObjetivoLb ?? 5.5))
  if (lote.estado !== 'activo' || !registros.some((r) => r.pesoPromedio != null)) return null

  const target = Number(objetivo) || 0
  const p = target > 0 ? proyectarVenta(lote, registros, gastos, metrics, target) : null

  return (
    <>
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Proyección de venta</h2>
        <label className="flex items-center gap-1.5 text-xs text-ink-faint">
          Objetivo
          <input
            type="number"
            inputMode="decimal"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            onBlur={() => db.lotes.update(lote.id, { pesoObjetivoLb: Number(objetivo) || undefined })}
            className="h-11 w-20 rounded-xl border border-line bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
          />
          lb
        </label>
      </div>
      {!p ? (
        <Card className="p-4 text-sm text-ink-faint">
          {target > 0
            ? `Con el ritmo actual el lote no alcanza ${num(target, 1)} lb antes del día 90. Revisa el alimento o ajusta el objetivo.`
            : 'Ingresa un peso objetivo para ver la proyección.'}
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {p.listo ? (
            <FilaProyeccion label="Estado" value="Ya está en peso de venta" valueClass="text-forest-600" />
          ) : (
            <FilaProyeccion
              label="Fecha estimada"
              value={
                p.diasRestantes > 0
                  ? `${fecha(p.fechaEstimada)} · en ${p.diasRestantes} días`
                  : 'Ya debería estar en peso'
              }
            />
          )}
          {!p.listo && (
            <FilaProyeccion
              label="Alimento restante aprox."
              value={`${num(p.alimentoRestanteQuintales, 1)} qq · ${num(p.alimentoRestanteLb)} lb`}
            />
          )}
          <FilaProyeccion label="Peso total a vender" value={`~${num(p.lbEnPie)} lb en pie`} />
          <FilaProyeccion label="Costo proyectado al cierre" value={money(p.costoProyectado)} />
          {p.ingresoProyectado != null ? (
            <>
              <FilaProyeccion label="Ingreso proyectado" value={money(p.ingresoProyectado)} />
              <FilaProyeccion
                label="Ganancia proyectada"
                value={`${money(p.gananciaProyectada!)} · ${pct(p.margenProyectadoPct ?? 0)}`}
                valueClass={p.gananciaProyectada! >= 0 ? 'text-forest-600' : 'text-clay-deep'}
              />
            </>
          ) : (
            <div className="px-4 py-3 text-xs text-ink-faint">
              Agrega el precio de venta por libra para proyectar el ingreso y la ganancia.
            </div>
          )}
          <FilaProyeccion
            label="Precio de equilibrio"
            value={`${money(p.precioEquilibrioLb)} / lb`}
          />
        </Card>
      )}
    </>
  )
}

function FilaProyeccion({
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

function GuiaDelDia({ lote, metrics }: { lote: Lote; metrics: LoteMetrics }) {
  const g = computeGuiaDia(lote, metrics)
  if (!g) return null
  const desv = g.desviacionPct
  const stats = [
    { label: 'Alimento hoy', value: `${num(g.alimentoDiaLb)} lb` },
    { label: 'Alimento acum.', value: `${num(g.alimentoAcumLb)} lb` },
    { label: 'FCA esperado', value: num(g.fcaEsperado, 2) },
    { label: 'Temperatura', value: `${g.tempC} °C` },
    { label: 'Agua hoy', value: `~${num(g.aguaLitrosDia)} L` },
    { label: 'Mort. esperada', value: pct(g.mortalidadEsperadaPct, 1) },
  ]
  return (
    <>
      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Guía del día {g.dia}</h2>
      <Card className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-ink-faint">Peso ideal hoy</div>
            <div className="font-display text-[26px] font-semibold tnum leading-none">
              {num(g.pesoObjetivoLb, 2)} lb
            </div>
          </div>
          {desv != null && g.pesoRealLb != null && (
            <div className="text-right">
              <div className="text-xs text-ink-faint">Tu lote</div>
              <div
                className={
                  'font-display text-lg font-semibold tnum leading-none ' +
                  (desv >= -3 ? 'text-forest-600' : 'text-clay-deep')
                }
              >
                {num(g.pesoRealLb, 2)} lb
              </div>
              <div className={'text-xs tnum ' + (desv >= -3 ? 'text-forest-600' : 'text-clay-deep')}>
                {desv >= 0 ? '+' : ''}
                {pct(desv, 0)}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-line pt-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-[15px] font-semibold tnum leading-none">{s.value}</div>
              <div className="mt-1 text-[11px] text-ink-faint">{s.label}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function PlanAlimento({
  lote,
  gastos,
  metrics,
}: {
  lote: Lote
  gastos: Gasto[]
  metrics: LoteMetrics
}) {
  const precioReal = precioQuintalReal(gastos)
  const precioQuintal =
    precioReal ?? lote.precioQuintal ?? Math.round(precioAlimentoLb(lote, gastos, metrics) * LB_POR_QUINTAL)
  const plan = computePlanAlimento(lote, metrics, precioQuintal || undefined)
  if (!plan || plan.fases.length === 0) return null
  const inv = computeInventarioAlimento(gastos, metrics, plan.totalQuintales)

  return (
    <>
      <div className="mb-3 mt-7 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Plan de alimento</h2>
        {precioReal ? (
          <span className="text-right text-xs text-ink-faint tnum">
            {money(precioReal)} el quintal
            <span className="block text-[11px]">precio real de tus compras</span>
          </span>
        ) : (
          <label className="flex items-center gap-1.5 text-xs text-ink-faint">
            Quintal
            <input
              type="number"
              inputMode="decimal"
              defaultValue={precioQuintal || ''}
              onBlur={(e) => db.lotes.update(lote.id, { precioQuintal: Number(e.target.value) || undefined })}
              className="h-11 w-24 rounded-xl border border-line bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
            />
          </label>
        )}
      </div>
      <Card className="divide-y divide-line">
        {plan.fases.map((f) => (
          <div
            key={f.nombre}
            className={'flex items-center justify-between px-4 py-3 ' + (f.activa ? 'bg-forest-50' : '')}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                {f.nombre}
                {f.activa && (
                  <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-700">
                    En curso
                  </span>
                )}
                {f.cumplida && <span className="text-[11px] text-ink-faint">✓</span>}
              </div>
              <div className="text-xs text-ink-faint tnum">
                {f.desde === f.hasta ? `Día ${f.desde}` : `Días ${f.desde}–${f.hasta}`} ·{' '}
                {f.proteinaPct}% PC · {f.presentacion.toLowerCase()}
              </div>
            </div>
            <div className="shrink-0 pl-3 text-right">
              <div className="font-display font-semibold tnum">{num(f.quintales, 1)} qq</div>
              <div className="text-xs text-ink-faint tnum">
                {f.costo != null ? money(f.costo) : `${num(f.lb)} lb`}
              </div>
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
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-ink-faint">Llevas consumido</span>
          <span className="tnum">
            <span className="font-display font-semibold">{num(plan.consumidoQuintales, 1)} qq</span>
            <span className="text-ink-faint">
              {' '}
              / {num(plan.esperadoHoyLb / LB_POR_QUINTAL, 1)} qq esperados
            </span>
          </span>
        </div>
      </Card>
      <p className="mt-2 text-xs text-ink-faint">
        {plan.proximoCambio ? (
          <>
            Cambia a <span className="font-medium text-ink-soft">{plan.proximoCambio.nombre}</span> en{' '}
            {plan.proximoCambio.enDias} días.{' '}
          </>
        ) : null}
        Falta por dar {num(plan.restanteQuintales, 1)} qq.
      </p>

      <Existencia inv={inv} lote={lote} />
    </>
  )
}

function Existencia({ inv, lote }: { inv: InventarioAlimento | null; lote: Lote }) {
  if (!inv) return null

  if (!inv.completo)
    return (
      <Card className="mt-3 p-4 text-[13px] leading-relaxed text-ink-soft">
        Anota los quintales en tus compras de alimento ({inv.comprasSinCantidad}{' '}
        {inv.comprasSinCantidad === 1 ? 'compra sin cantidad' : 'compras sin cantidad'}) y la app te
        lleva la existencia del galpón, el día que se acaba y el precio real de tu quintal.
      </Card>
    )

  const faltante = inv.existenciaQq < -1
  const alcanza = inv.diasQueAlcanza

  return (
    <>
      <Card className="mt-3 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-ink-faint">Te queda en el galpón</div>
            <div
              className={clsx(
                'font-display text-[28px] font-semibold leading-none tnum',
                alcanza <= 3 && !faltante ? 'text-clay-deep' : '',
              )}
            >
              {num(Math.max(0, inv.existenciaQq), 1)} qq
            </div>
            <div className="mt-1 text-[13px] text-ink-soft tnum">
              {num(inv.compradoQq, 1)} comprados − {num(inv.consumidoQq, 1)} dados
            </div>
          </div>
          {!faltante && (
            <div className="shrink-0 text-right">
              <div className="text-xs text-ink-faint">Alcanza hasta</div>
              <div className="font-display text-[17px] font-semibold leading-none tnum">
                {alcanza > 0 ? fecha(inv.fechaSeAcaba) : 'hoy'}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-faint tnum">
                {alcanza > 0 ? `${alcanza} ${alcanza === 1 ? 'día' : 'días'}` : 'compra ya'}
              </div>
            </div>
          )}
        </div>
        {inv.faltaComprarQq > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-ink-faint">Falta comprar hasta la venta</span>
            <span className="tnum">
              <span className="font-display font-semibold">{num(inv.faltaComprarQq, 1)} qq</span>
              {inv.costoFaltante != null && (
                <span className="text-ink-faint"> · {money(inv.costoFaltante)}</span>
              )}
            </span>
          </div>
        )}
      </Card>
      {faltante && (
        <p className="mt-2 text-xs leading-relaxed text-clay-text">
          Diste más alimento del que aparece comprado en {lote.nombre}: falta anotar una compra o hay
          quintales mal contados.
        </p>
      )}
    </>
  )
}

function Sociedad({
  lote,
  gastos,
  ingresos,
  metrics,
  settings,
}: {
  lote: Lote
  gastos: Gasto[]
  ingresos: Ingreso[]
  metrics: LoteMetrics
  settings: Settings
}) {
  const liq = computeLiquidacion(lote, gastos, ingresos, metrics)
  if (!liq) return null
  const hayGanancia = metrics.ingresos > 0

  function compartir() {
    const L = [`${settings.granja} — Liquidación`, lote.nombre, '']
    for (const s of liq!.socios) {
      L.push(`${s.nombre} (${pct(s.pct, 0)})`)
      L.push(`  Aportó: ${money(s.aporte)}`)
      if (hayGanancia) L.push(`  Le corresponde: ${money(s.corresponde)}`)
    }
    L.push('', `Ganancia total: ${money(liq!.ganancia)}`)
    for (const t of liq!.traspasos) L.push(`${t.de} le paga ${money(t.monto)} a ${t.a}`)
    const text = L.join('\n')
    if (navigator.share) navigator.share({ title: `Liquidación ${lote.nombre}`, text }).catch(() => {})
    else {
      navigator.clipboard?.writeText(text)
      alert('Liquidación copiada.')
    }
  }

  return (
    <>
      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Sociedad</h2>
      <Card className="divide-y divide-line">
        {liq.socios.map((s, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{s.nombre}</span>
              <Pill tone="neutral">{pct(s.pct, 0)}</Pill>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-faint">Aportó</span>
              <span className="font-display font-semibold tnum">{money(s.aporte)}</span>
            </div>
            {hayGanancia && (
              <div className="mt-0.5 flex items-center justify-between text-sm">
                <span className="text-ink-faint">Le corresponde</span>
                <span
                  className={
                    'font-display font-semibold tnum ' +
                    (s.corresponde >= 0 ? 'text-forest-600' : 'text-clay-deep')
                  }
                >
                  {money(s.corresponde)}
                </span>
              </div>
            )}
          </div>
        ))}
      </Card>
      {liq.traspasos.length > 0 && (
        <>
          <div className="mb-2 mt-3 text-xs font-medium text-ink-faint">
            {lote.estado === 'cerrado' ? 'Liquidación final' : 'Para igualar aportes'}
          </div>
          <div className="space-y-1.5">
            {liq.traspasos.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border border-forest-400/30 bg-forest-50 px-3.5 py-2.5 text-[13px] font-medium text-forest-700"
              >
                <span className="font-semibold">{t.de}</span> le paga{' '}
                <span className="font-semibold tnum">{money(t.monto)}</span> a{' '}
                <span className="font-semibold">{t.a}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <Button block variant="soft" className="mt-3" onClick={compartir}>
        Compartir liquidación
      </Button>
    </>
  )
}

function TablaSemanal({ lote, registros }: { lote: Lote; registros: Registro[] }) {
  const semanas = resumenSemanal(lote, registros)
  if (semanas.length < 2) return null

  return (
    <>
      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Resumen semanal</h2>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Sem</th>
              <th className="px-2 py-2.5 font-medium">Mort.</th>
              <th className="px-2 py-2.5 text-right font-medium">Alim. (lb)</th>
              <th className="px-4 py-2.5 text-right font-medium">Peso (lb)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tnum">
            {semanas.map((s) => (
              <tr key={s.semana}>
                <td className="px-4 py-2.5 font-display font-semibold">{s.semana}</td>
                <td className={'px-2 py-2.5 ' + (s.mortalidad > 0 ? 'text-ink-soft' : 'text-ink-faint')}>
                  {num(s.mortalidad)}
                </td>
                <td className="px-2 py-2.5 text-right text-ink-soft">{num(s.alimentoLb)}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {s.pesoFinal != null ? num(s.pesoFinal, 2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

function CurvaEstandar({ lote, registros }: { lote: Lote; registros: Registro[] }) {
  const conPeso = registros.filter((r) => r.pesoPromedio != null)
  if (conPeso.length === 0) return null
  const reales = new Map(conPeso.map((r) => [diasEntre(lote.fechaInicio, r.fecha), r.pesoPromedio!]))
  const maxDia = Math.max(...reales.keys(), 21)
  const dias = new Set<number>(reales.keys())
  for (let d = 0; d <= maxDia; d += 7) dias.add(d)
  const puntos = [...dias]
    .sort((a, b) => a - b)
    .map((d) => ({ x: d, real: reales.get(d), std: Number(pesoEstandarLb(d).toFixed(2)) }))
  const titulo = `Curva de peso vs. ${RAZA} (lb)`
  const unidadX = 'día'

  return (
    <>
      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">{titulo}</h2>
      <Card className="p-4 pt-5">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={puntos} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#EEEBE2" vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 11, fill: '#5C6A61' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: '#5C6A61' }} axisLine={false} tickLine={false} />
            <Tooltip
              labelFormatter={(x) => `${unidadX} ${x}`}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #E3DFD3',
                background: '#FCFBF7',
                fontSize: 13,
                boxShadow: '0 8px 24px -12px rgba(27,43,34,0.2)',
              }}
            />
            <Line
              dataKey="std"
              name="Estándar"
              stroke="#5C6A61"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              dot={false}
              animationDuration={600}
              animationEasing="ease-out"
              isAnimationActive={!reduceMotion}
            />
            <Line
              dataKey="real"
              name="Tu lote"
              stroke="#2F8A4C"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#2F8A4C' }}
              connectNulls
              animationDuration={600}
              animationEasing="ease-out"
              isAnimationActive={!reduceMotion}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center justify-center gap-5 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-forest-500" /> Tu lote
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded border-b border-dashed border-ink-faint" /> Estándar
          </span>
        </div>
      </Card>
    </>
  )
}
