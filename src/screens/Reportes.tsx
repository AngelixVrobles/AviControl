import { Link, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import type { LoteConMetrics } from '../lib/hooks'
import { useResumen } from '../lib/hooks'
import { diasEntre, fecha, hoyISO, money, num, pct, plural, porLb } from '../lib/format'
import { Card } from '../components/ui'
import { GraficaBarras } from '../components/chart'
import { ComparacionLotes } from '../components/Comparacion'
import { agruparHitos, hitosEngorde } from '../lib/standards'

type Segmento = 'cerrado' | 'activo'

export function Reportes() {
  const [params, setParams] = useSearchParams()
  const seg: Segmento = params.get('e') === 'activo' ? 'activo' : 'cerrado'
  const setSeg = (e: Segmento) => {
    const p = new URLSearchParams(params)
    p.set('e', e)
    setParams(p, { replace: true })
  }

  const lista = useResumen(seg)
  const activos = useResumen('activo')

  if (!lista || !activos)
    return (
      <div role="status" aria-label="Cargando" className="animate-pulse pt-3">
        <div className="h-8 w-40 rounded-lg bg-paper-sunken" />
        <div className="mt-4 h-11 rounded-full bg-paper-sunken" />
        <div className="mt-6 h-40 rounded-xl2 bg-paper-sunken" />
      </div>
    )

  return (
    <div className="animate-rise pt-3">
      <h1 className="font-display text-2xl font-semibold">Reportes</h1>

      <div className="mt-4 flex gap-1 rounded-full bg-sunken p-1">
        {(['cerrado', 'activo'] as Segmento[]).map((s) => (
          <button
            key={s}
            onClick={() => setSeg(s)}
            className={clsx(
              'flex-1 rounded-full py-2.5 text-sm font-semibold transition',
              seg === s ? 'bg-paper-raised text-ink shadow-card' : 'text-ink-soft',
            )}
          >
            {s === 'cerrado' ? 'Cerrados' : 'En curso'}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-ink-soft">{alcance(lista, seg)}</p>

      {lista.length === 0 ? (
        <VacioReportes seg={seg} activos={activos} />
      ) : (
        <>
          <Totales lista={lista} />
          {lista.length === 1 && <FichaDelCiclo r={lista[0]} />}
          <VasMejorando lista={lista} />
          <ComparacionLotes resumen={lista} />
        </>
      )}
    </div>
  )
}

function alcance(lista: LoteConMetrics[], seg: Segmento): string {
  const n = lista.length
  if (n === 0) return seg === 'cerrado' ? 'Ningún ciclo cerrado todavía' : 'Ningún ciclo en curso'
  const noun =
    seg === 'cerrado'
      ? n === 1
        ? 'ciclo cerrado'
        : 'ciclos cerrados'
      : n === 1
        ? 'ciclo en curso'
        : 'ciclos en curso'
  const fechas = lista.map((r) => r.lote.fechaCierre ?? r.lote.fechaInicio).sort()
  const rango =
    n > 1 ? ` · ${mesAnio(fechas[0])} – ${mesAnio(fechas[n - 1])}` : ` · ${mesAnio(fechas[0])}`
  return `${num(n)} ${noun}${rango}`
}

function FichaDelCiclo({ r }: { r: LoteConMetrics }) {
  const { lote, metrics: m } = r
  const filas = [
    { label: 'Peso por ave', valor: m.pesoEstimadoLb != null ? `${num(m.pesoEstimadoLb, 2)} lb` : '—' },
    { label: 'Conversión (FCA)', valor: m.fca != null ? num(m.fca, 2) : '—' },
    { label: 'Mortalidad', valor: pct(m.mortalidadPct, 1) },
    { label: 'Costo por libra', valor: m.costoPorLb != null ? porLb(m.costoPorLb) : '—' },
    { label: 'Índice de eficiencia', valor: m.iep != null ? num(m.iep, 0) : '—' },
    { label: 'Días de ciclo', valor: `${num(m.dias)} ${plural(m.dias, 'día', 'días')}` },
  ]

  return (
    <>
      <h2 className="mb-1 mt-7 font-display text-lg font-semibold">{lote.nombre}</h2>
      <p className="mb-3 text-xs text-ink-faint">
        Cuando cierres el siguiente, aquí aparece la comparación entre los dos.
      </p>
      <Card className="divide-y divide-line">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-ink-soft">{f.label}</span>
            <span className="font-display font-semibold tnum">{f.valor}</span>
          </div>
        ))}
      </Card>
      <Link
        to={`/lotes/${lote.id}?t=dinero`}
        className="mt-3 block w-full rounded-full bg-forest-50 py-3 text-center text-base font-semibold text-forest-700"
      >
        Ver el ciclo completo
      </Link>
    </>
  )
}

function Totales({ lista }: { lista: LoteConMetrics[] }) {
  const ingresos = lista.reduce((a, r) => a + r.metrics.ingresos, 0)
  const costos = lista.reduce((a, r) => a + r.metrics.costos, 0)
  const ganancia = ingresos - costos
  const filas: { label: string; valor: number; tono: 'ink' | 'ok' | 'bad' }[] = [
    { label: 'Ingresos', valor: ingresos, tono: 'ink' },
    { label: 'Costos', valor: costos, tono: 'ink' },
    { label: ganancia >= 0 ? 'Ganancia' : 'Pérdida', valor: ganancia, tono: ganancia >= 0 ? 'ok' : 'bad' },
  ]
  return (
    <Card tono="elevado" className="mt-4 divide-y divide-line">
      {filas.map((f) => (
        <div key={f.label} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink-soft">{f.label}</span>
          <span
            className={clsx(
              'font-display text-xl font-semibold tnum',
              f.tono === 'ok' ? 'text-forest-600' : f.tono === 'bad' ? 'text-clay-deep' : 'text-ink',
            )}
          >
            {money(f.valor)}
          </span>
        </div>
      ))}
    </Card>
  )
}

function VasMejorando({ lista }: { lista: LoteConMetrics[] }) {
  const conIep = lista
    .filter((r) => r.metrics.iep != null)
    .sort((a, b) => a.lote.fechaInicio.localeCompare(b.lote.fechaInicio))
  if (conIep.length < 2) return null

  const datos = conIep.map((r) => ({
    nombre: r.lote.nombre.replace(/^Lote\s*/i, ''),
    iep: Math.round(r.metrics.iep!),
  }))
  const attr = atribucionIEP(conIep)

  return (
    <>
      <h2 className="mb-1 mt-7 font-display text-lg font-semibold">¿Vas mejorando?</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Índice de eficiencia (IEP) de cada ciclo. Más alto es mejor.
      </p>
      <Card className="p-4 pt-6">
        <GraficaBarras
          etiquetas={datos.map((d) => d.nombre)}
          valores={datos.map((d) => d.iep)}
          alto={180}
          formatoValor={(v) => num(v)}
          resumen={`Índice de eficiencia de ${datos.length} ciclos, de ${datos[0].nombre} a ${datos.at(-1)!.nombre}.`}
        />
        {attr && (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-soft">
            <span className="font-semibold text-forest-600">▲ {attr.delta} puntos</span> desde{' '}
            {attr.desde} — {attr.frase}
          </p>
        )}
      </Card>
    </>
  )
}

interface Atribucion {
  delta: number
  desde: string
  frase: string
}

// Compara el mejor IEP contra el peor y reparte el delta entre conversión,
// mortalidad y peso por el log de la razón de cada factor. Nombra solo el
// dominante; si el segundo está a menos de 15 % de distancia, nombra los dos.
function atribucionIEP(cerrados: LoteConMetrics[]): Atribucion | null {
  const conDatos = cerrados.filter(
    (r) => r.metrics.iep != null && r.metrics.fca != null && r.metrics.pesoPromedioLb != null,
  )
  if (conDatos.length < 2) return null
  const mejor = conDatos.reduce((a, b) => (b.metrics.iep! > a.metrics.iep! ? b : a))
  const peor = conDatos.reduce((a, b) => (b.metrics.iep! < a.metrics.iep! ? b : a))
  const delta = Math.round(mejor.metrics.iep! - peor.metrics.iep!)
  if (delta < 1 || mejor === peor) return null

  const ln = (x: number) => (x > 0 ? Math.log(x) : 0)
  const viab = (m: { mortalidadPct: number }) => Math.max(1, 100 - m.mortalidadPct)
  const factores = [
    {
      key: 'fca',
      w: Math.abs(ln(peor.metrics.fca! / mejor.metrics.fca!)),
      frase: `la conversión (${num(peor.metrics.fca!, 2)} → ${num(mejor.metrics.fca!, 2)} FCA)`,
    },
    {
      key: 'mort',
      w: Math.abs(ln(viab(mejor.metrics) / viab(peor.metrics))),
      frase: `la mortalidad (${num(peor.metrics.mortalidadPct, 1)}% → ${num(mejor.metrics.mortalidadPct, 1)}%)`,
    },
    {
      key: 'peso',
      w: Math.abs(ln(mejor.metrics.pesoPromedioLb! / peor.metrics.pesoPromedioLb!)),
      frase: `el peso (${num(peor.metrics.pesoPromedioLb!, 2)} → ${num(mejor.metrics.pesoPromedioLb!, 2)} lb)`,
    },
  ].sort((a, b) => b.w - a.w)

  const [d1, d2] = factores
  const desde = mesCorto(peor.lote.fechaInicio)
  if (d1.w === 0) return { delta, desde, frase: 'mejoró parejo en todo.' }
  const frase =
    d2.w / d1.w >= 0.85
      ? `mitad y mitad entre ${d1.frase} y ${d2.frase}.`
      : `casi todo por ${d1.frase}.`
  return { delta, desde, frase }
}

function VacioReportes({ seg, activos }: { seg: Segmento; activos: LoteConMetrics[] }) {
  const objeto = seg === 'cerrado' ? 'cerrado' : 'en curso'
  const activo = activos[0]

  const viejo =
    activo && activo.metrics.ultimaFecha && diasEntre(activo.metrics.ultimaFecha, hoyISO()) >= 7
      ? activo
      : undefined

  return (
    <div className="mt-6 space-y-4">
      <Card className="p-5 text-center">
        <h2 className="font-display text-lg font-semibold">
          Todavía no has {seg === 'cerrado' ? 'cerrado' : 'abierto'} ningún ciclo{seg === 'activo' ? ' en curso' : ''}
        </h2>
        {activo ? (
          <p className="mx-auto mt-1 max-w-[30ch] text-sm text-ink-soft">
            {objeto === 'cerrado'
              ? `Faltan ${enDias(activo)} para vender ${activo.lote.nombre}. Ese día este reporte se llena solo.`
              : 'Crea un ciclo para empezar a llevarlo.'}
          </p>
        ) : (
          <p className="mx-auto mt-1 max-w-[30ch] text-sm text-ink-soft">
            Crea tu primer ciclo y aquí verás cómo te fue con cada camada.
          </p>
        )}
      </Card>

      {activo && seg === 'cerrado' && <BarraCiclo r={activo} />}

      {viejo && (
        <div className="rounded-xl2 border border-amber-line border-l-4 border-l-amber bg-amber-tint p-4">
          <p className="text-sm font-medium leading-relaxed text-amber-text">
            El peso, la conversión y el costo por libra que ves son del{' '}
            {fecha(viejo.metrics.ultimaFecha!)} — no de hoy.
          </p>
          <Link
            to={`/lotes/${viejo.lote.id}?reg=1`}
            className="mt-3 inline-flex rounded-full bg-forest-500 px-4 py-2.5 text-sm font-semibold text-paper-raised"
          >
            Ponerme al día
          </Link>
        </div>
      )}

      <div className="space-y-1">
        {activo && (
          <Link to={`/lotes/${activo.lote.id}`} className="block py-1 text-sm font-medium text-forest-600">
            Ver cómo va {activo.lote.nombre} →
          </Link>
        )}
        <p className="pt-1 text-sm leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">¿Qué es el IEP?</span> Un solo número que junta
          peso, conversión, mortalidad y días para comparar una camada con otra. Más alto es mejor
          (un buen ciclo anda por 300–400).
        </p>
      </div>
    </div>
  )
}

function BarraCiclo({ r }: { r: LoteConMetrics }) {
  const total = r.metrics.diaObjetivo
  const dia = Math.min(r.metrics.dias, total)
  const pos = (d: number) => `${Math.max(0, Math.min(100, (d / total) * 100))}%`
  const hitos = agruparHitos(hitosEngorde(total), total)
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-display text-lg font-semibold">{r.lote.nombre}</span>
        <span className="text-sm text-ink-soft tnum">
          día {r.metrics.dias} de {total}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-sunken">
        <div className="absolute inset-y-0 left-0 rounded-full bg-forest-500" style={{ width: pos(dia) }} />
        {hitos.slice(1, -1).map((h) => (
          <span
            key={h.dia}
            className="absolute top-[-3px] h-4 w-0.5 rounded bg-paper"
            style={{ left: pos(h.dia) }}
          />
        ))}
        {dia < total && (
          <span
            className="absolute top-[-7px] h-6 w-6 rounded-full border-[3px] border-paper bg-forest-800"
            style={{ left: pos(dia), marginLeft: -12 }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs font-semibold text-forest-600">
        <span>día 1</span>
        <span>{total} · venta</span>
      </div>
    </Card>
  )
}


function enDias(r: LoteConMetrics): string {
  const d = (r.metrics.diaVentaEstimado ?? r.metrics.diaObjetivo) - r.metrics.dias
  if (d <= 0) return 'pocos días'
  return `${d} ${d === 1 ? 'día' : 'días'}`
}

function mesCorto(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', { month: 'long' }).format(new Date(iso + 'T00:00:00'))
}

function mesAnio(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', { month: 'short', year: 'numeric' }).format(
    new Date(iso + 'T00:00:00'),
  )
}
