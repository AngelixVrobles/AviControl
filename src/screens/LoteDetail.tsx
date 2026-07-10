import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, type Gasto, type Ingreso, type Lote, type Registro } from '../db/schema'
import { useLoteData, useSettings } from '../lib/hooks'
import { agruparGastos, resumenSemanal, type LoteMetrics } from '../lib/metrics'
import { proyectarVenta } from '../lib/proyeccion'
import { compartirReporte } from '../lib/reporte'
import { diasEntre, fecha, hoyISO, money, num, pct } from '../lib/format'
import { categoriaLabel, tipoIngresoLabel } from '../lib/labels'
import { EDAD_INICIAL_DEFAULT, pesoEstandarLb, posturaEstandarPct } from '../lib/standards'
import { reduceMotion } from '../lib/motion'
import { AlertaChip } from '../components/AlertaChip'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Button, Card, Pill } from '../components/ui'
import { IconBack, IconEgg, IconMoney, IconPlus, IconScale, IconTrend } from '../components/icons'
import { ActionButton, GastoSheet, IngresoSheet, RegistroSheet } from '../components/sheets'

type SheetKind = 'registro' | 'gasto' | 'ingreso' | null

export function LoteDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const data = useLoteData(id ? Number(id) : undefined)
  const settings = useSettings()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [editRegistro, setEditRegistro] = useState<Registro>()
  const [editGasto, setEditGasto] = useState<Gasto>()
  const [editIngreso, setEditIngreso] = useState<Ingreso>()
  const [todosMovs, setTodosMovs] = useState(false)
  const [todoHistorial, setTodoHistorial] = useState(false)

  function abrir(kind: SheetKind) {
    setEditRegistro(undefined)
    setEditGasto(undefined)
    setEditIngreso(undefined)
    setSheet(kind)
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

  const { lote, registros, gastos, ingresos, metrics, alertas } = data
  const engorde = lote.tipo === 'engorde'
  const gastosCat = agruparGastos(gastos)
  const maxCat = Math.max(1, ...gastosCat.map((g) => g.total))
  const positivo = metrics.ganancia >= 0

  async function cerrar() {
    const activo = lote.estado === 'activo'
    const msg = activo
      ? '¿Cerrar este lote? Podrás seguir viéndolo pero no aparecerá como activo.'
      : '¿Reabrir este lote? Volverá a aparecer como activo.'
    if (!confirm(msg)) return
    await db.lotes.update(
      lote.id,
      activo
        ? { estado: 'cerrado', fechaCierre: hoyISO() }
        : { estado: 'activo', fechaCierre: undefined },
    )
  }

  const registroDeHoy = metrics.ultimaFecha === hoyISO()
  const kpis = engorde
    ? [
        { label: 'Peso prom.', value: metrics.pesoPromedioLb != null ? `${num(metrics.pesoPromedioLb, 2)} lb` : '—' },
        { label: 'Conv. alim. (FCA)', value: metrics.fca != null ? num(metrics.fca, 2) : '—' },
        { label: 'Mortalidad', value: pct(metrics.mortalidadPct) },
        { label: 'Alimento total', value: `${num(metrics.alimentoTotalLb)} lb` },
        { label: 'Costo / lb', value: metrics.costoPorLb != null ? money(metrics.costoPorLb) : '—' },
        { label: 'Aves vendidas', value: num(metrics.vendidas) },
      ]
    : [
        {
          label: registroDeHoy ? 'Postura hoy' : 'Postura últ. día',
          value: metrics.posturaPct != null ? pct(metrics.posturaPct) : '—',
        },
        { label: registroDeHoy ? 'Huevos hoy' : 'Huevos últ. día', value: num(metrics.huevosHoy ?? 0) },
        { label: 'Huevos total', value: num(metrics.huevosTotal ?? 0) },
        { label: 'Mortalidad', value: pct(metrics.mortalidadPct) },
        { label: 'Alimento total', value: `${num(metrics.alimentoTotalLb)} lb` },
        { label: 'Costo / huevo', value: metrics.costoPorHuevo != null ? money(metrics.costoPorHuevo) : '—' },
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
            <Pill tone={engorde ? 'engorde' : 'ponedora'}>{engorde ? 'Engorde' : 'Ponedora'}</Pill>
            <span className="text-xs text-ink-faint tnum">Día {metrics.dias}</span>
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

      <Card className="overflow-hidden">
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

      <div className="mt-4 grid grid-cols-3 gap-3">
        <ActionButton
          label="Registrar día"
          tone="green"
          icon={<IconPlus width={20} height={20} />}
          onClick={() => abrir('registro')}
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

      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Indicadores</h2>
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-3.5">
            <div className="font-display text-[22px] font-semibold tnum leading-none">{k.value}</div>
            <div className="mt-1.5 text-xs text-ink-faint">{k.label}</div>
          </Card>
        ))}
      </div>

      {engorde && <ProyeccionVenta lote={lote} registros={registros} metrics={metrics} />}

      <CurvaEstandar lote={lote} registros={registros} ingresos={ingresos} />

      <TablaSemanal lote={lote} registros={registros} />

      {gastosCat.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Gastos por categoría</h2>
          <Card className="divide-y divide-line">
            {gastosCat.map((g) => (
              <div key={g.categoria} className="px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-soft">{categoriaLabel(g.categoria)}</span>
                  <span className="font-display font-semibold tnum">{money(g.total)}</span>
                </div>
                <div className="relative mt-2.5 h-[3px]">
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
                  <motion.div
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-forest-500"
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

      <h2 className="mb-1 mt-7 font-display text-lg font-semibold">Historial</h2>
      {registros.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-line bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-faint">
          Sin registros aún. Toca “Registrar día” para empezar.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-faint">Toca un día para corregirlo.</p>
          <Card className="divide-y divide-line">
            {[...registros].reverse().slice(0, todoHistorial ? undefined : 12).map((r) => (
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
                  {engorde
                    ? r.pesoPromedio != null && <span>{num(r.pesoPromedio, 2)} lb</span>
                    : r.huevos != null && (
                        <span className="inline-flex items-center gap-1">
                          {num(r.huevos)}
                          <IconEgg width={13} height={13} aria-hidden className="text-amber-600" />
                        </span>
                      )}
                  {r.alimentoLb > 0 && <span className="text-ink-faint">{num(r.alimentoLb)} lb alim.</span>}
                  {r.mortalidad > 0 && <span className="text-clay-deep">−{num(r.mortalidad)}</span>}
                </div>
              </button>
            ))}
          </Card>
          {!todoHistorial && registros.length > 12 && (
            <button
              onClick={() => setTodoHistorial(true)}
              className="mt-2 w-full py-2 text-center text-[13px] font-medium text-forest-600"
            >
              Ver los {num(registros.length)} registros
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
            {lote.estado === 'activo' ? 'Cerrar lote' : 'Reabrir lote'}
          </Button>
        </div>
      </div>

      <RegistroSheet lote={lote} open={sheet === 'registro'} onClose={() => setSheet(null)} editar={editRegistro} />
      <GastoSheet lote={lote} open={sheet === 'gasto'} onClose={() => setSheet(null)} editar={editGasto} />
      <IngresoSheet lote={lote} open={sheet === 'ingreso'} onClose={() => setSheet(null)} editar={editIngreso} />
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
  metrics,
}: {
  lote: Lote
  registros: Registro[]
  metrics: LoteMetrics
}) {
  const [objetivo, setObjetivo] = useState(String(lote.pesoObjetivoLb ?? 5.5))
  if (lote.estado !== 'activo' || !registros.some((r) => r.pesoPromedio != null)) return null

  const target = Number(objetivo) || 0
  const p = target > 0 ? proyectarVenta(lote, registros, metrics, target) : null

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
      ) : p.listo ? (
        <Card className="border-forest-400/40 bg-forest-50 p-4">
          <div className="font-display text-lg font-semibold text-forest-700">
            El lote ya está en peso de venta
          </div>
          <div className="mt-1 text-sm text-forest-600 tnum">
            ~{num(p.lbEnPie)} lb en pie listas para vender
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          <FilaProyeccion
            label="Fecha estimada"
            value={
              p.diasRestantes > 0
                ? `${fecha(p.fechaEstimada)} · en ${p.diasRestantes} días`
                : 'Ya debería estar en peso; pésalo'
            }
          />
          <FilaProyeccion label="Alimento restante aprox." value={`${num(p.alimentoRestanteLb)} lb`} />
          <FilaProyeccion label="Peso total a vender" value={`~${num(p.lbEnPie)} lb en pie`} />
        </Card>
      )}
    </>
  )
}

function FilaProyeccion({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className="font-display font-semibold tnum">{value}</span>
    </div>
  )
}

function TablaSemanal({ lote, registros }: { lote: Lote; registros: Registro[] }) {
  const semanas = resumenSemanal(lote, registros)
  if (semanas.length < 2) return null
  const engorde = lote.tipo === 'engorde'

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
              <th className="px-4 py-2.5 text-right font-medium">{engorde ? 'Peso (lb)' : 'Huevos'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tnum">
            {semanas.map((s) => (
              <tr key={s.semana}>
                <td className="px-4 py-2.5 font-display font-semibold">{s.semana}</td>
                <td className={'px-2 py-2.5 ' + (s.mortalidad > 0 ? 'text-clay-deep' : 'text-ink-faint')}>
                  {s.mortalidad > 0 ? `−${num(s.mortalidad)}` : '0'}
                </td>
                <td className="px-2 py-2.5 text-right text-ink-soft">{num(s.alimentoLb)}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {engorde
                    ? s.pesoFinal != null
                      ? num(s.pesoFinal, 2)
                      : '—'
                    : num(s.huevos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

function CurvaEstandar({
  lote,
  registros,
  ingresos,
}: {
  lote: Lote
  registros: Registro[]
  ingresos: Ingreso[]
}) {
  const engorde = lote.tipo === 'engorde'

  let puntos: { x: number; real?: number; std: number }[]
  let titulo: string
  let unidadX: string

  if (engorde) {
    const conPeso = registros.filter((r) => r.pesoPromedio != null)
    if (conPeso.length === 0) return null
    const reales = new Map(conPeso.map((r) => [diasEntre(lote.fechaInicio, r.fecha), r.pesoPromedio!]))
    const maxDia = Math.max(...reales.keys(), 21)
    const dias = new Set<number>(reales.keys())
    for (let d = 0; d <= maxDia; d += 7) dias.add(d)
    puntos = [...dias]
      .sort((a, b) => a - b)
      .map((d) => ({ x: d, real: reales.get(d), std: Number(pesoEstandarLb(d).toFixed(2)) }))
    titulo = 'Curva de peso vs. estándar Ross 308 (lb)'
    unidadX = 'día'
  } else {
    const conHuevos = registros.filter((r) => (r.huevos ?? 0) > 0)
    if (conHuevos.length === 0) return null
    const edadBase = lote.edadInicialSemanas ?? EDAD_INICIAL_DEFAULT
    const ventasAves = ingresos
      .filter((i) => i.tipo === 'aves')
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    let vi = 0
    let vivas = lote.cantidadInicial
    const porDia: { x: number; real: number; std: number }[] = []
    for (const r of registros) {
      vivas -= r.mortalidad + r.descarte
      while (vi < ventasAves.length && ventasAves[vi].fecha <= r.fecha) {
        vivas -= ventasAves[vi].cantidad
        vi++
      }
      if ((r.huevos ?? 0) > 0 && vivas > 0) {
        const semana = edadBase + diasEntre(lote.fechaInicio, r.fecha) / 7
        porDia.push({
          x: Number(semana.toFixed(1)),
          real: Number((((r.huevos ?? 0) / vivas) * 100).toFixed(1)),
          std: Number(posturaEstandarPct(semana).toFixed(1)),
        })
      }
    }
    puntos = porDia
    titulo = 'Postura vs. estándar (%)'
    unidadX = 'semana de edad'
  }

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
