import { Link, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import type { LoteConMetrics } from '../lib/hooks'
import { useDeudas, usePorCobrar, useResumen, useSettings } from '../lib/hooks'
import { precioMinimoConjunto } from '../lib/precios'
import { desdeHace, diasEntre, fecha, hoyISO, money, num, pct, plural, porLb } from '../lib/format'
import { Banda, Seccion } from '../components/ui'
import { gananciaPorSocio } from '../lib/sociedad'
import { GraficaBarras } from '../components/chart'
import { ComparacionLotes } from '../components/Comparacion'
import { agruparHitos, hitosEngorde } from '../lib/standards'
import { LIMITE_DOA_PCT, porIncubadora } from '../lib/arranque'
import { LIMITE_PRIMERA_SEMANA_PCT } from '../lib/mortalidad'

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
          {seg === 'activo' ? <TotalesEnCurso lista={lista} /> : <Totales lista={lista} />}
          {lista.length === 1 && <FichaDelCiclo r={lista[0]} enCurso={seg === 'activo'} />}
          <VasMejorando lista={lista} />
          <ComparacionLotes resumen={lista} />
          {seg === 'cerrado' && <PorIncubadora lista={lista} />}
        </>
      )}

      <PorCobrar />
      <DeudasDeLaEmpresa />
    </div>
  )
}

// Lo que te deben de las ventas a crédito, junto a lo que debe la granja.
function PorCobrar() {
  const r = usePorCobrar()
  if (!r || r.total < 1) return null
  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Te deben"
        titulo={`${money(r.total)} de ventas a crédito`}
        accion={
          <Link to="/cobros" className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-forest-600">
            Cobrar →
          </Link>
        }
      />
      <Banda className="divide-y divide-line">
        {r.compradores.slice(0, 4).map((c) => (
          <Link
            key={c.comprador}
            to="/cobros"
            className="flex items-baseline justify-between gap-3 px-5 py-3 transition active:bg-paper-sunken"
          >
            <span className="min-w-0 truncate text-sm font-medium">{c.comprador}</span>
            <span className="shrink-0 text-right tnum">
              <span className="block font-display text-base font-semibold">{money(c.total)}</span>
              <span className="block text-xs text-ink-faint">{desdeHace(c.masVieja)}</span>
            </span>
          </Link>
        ))}
      </Banda>
    </>
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

function FichaDelCiclo({ r, enCurso }: { r: LoteConMetrics; enCurso: boolean }) {
  const { lote, metrics: m } = r
  const filas = [
    { label: 'Peso por ave', valor: m.pesoEstimadoLb != null ? `${num(m.pesoEstimadoLb, 2)} lb` : '—' },
    { label: 'Conversión (FCA)', valor: m.fca != null ? num(m.fca, 2) : '—' },
    { label: 'Mortalidad', valor: pct(m.mortalidadPct, 1) },
    // A medio ciclo, el costo por libra de hoy reparte todo lo gastado entre
    // aves todavía chiquitas: lo que sirve es el mínimo para no perder.
    enCurso
      ? {
          label: 'Mínimo para no perder',
          valor: r.precio ? `${porLb(r.precio.precioEquilibrioLb)}/lb` : '—',
        }
      : { label: 'Costo por libra', valor: m.costoPorLb != null ? porLb(m.costoPorLb) : '—' },
    { label: 'Índice de eficiencia', valor: m.iep != null ? num(m.iep, 0) : '—' },
    { label: 'Días de ciclo', valor: `${num(m.dias)} ${plural(m.dias, 'día', 'días')}` },
  ]

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta={enCurso ? 'Ciclo en curso' : 'Último ciclo'}
        titulo={lote.nombre}
        nota={
          enCurso
            ? 'Cuando lo cierres, aquí verás cómo salió.'
            : 'Cuando cierres el siguiente, aquí aparece la comparación entre los dos.'
        }
      />
      <Banda className="divide-y divide-line">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-ink-soft">{f.label}</span>
            <span className="font-display font-semibold tnum">{f.valor}</span>
          </div>
        ))}
      </Banda>
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
  const reparto = gananciaPorSocio(
    lista.map((r) => ({ socios: r.lote.socios, ganancia: r.metrics.ganancia })),
  )
  const filas: { label: string; valor: number; tono: 'ink' | 'ok' | 'bad' }[] = [
    { label: 'Ingresos', valor: ingresos, tono: 'ink' },
    { label: 'Costos', valor: costos, tono: 'ink' },
    { label: ganancia >= 0 ? 'Ganancia' : 'Pérdida', valor: ganancia, tono: ganancia >= 0 ? 'ok' : 'bad' },
  ]
  return (
    <>
      <Banda className="mt-4 divide-y divide-line">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-5 py-3">
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
      </Banda>
      <RepartoSocios reparto={reparto} />
    </>
  )
}

// Con `neutro`, los montos no son ganancia ni pérdida —lo que puso cada socio
// en ciclos que siguen— y van sin el verde ni el rojo.
function RepartoSocios({
  reparto,
  neutro = false,
}: {
  reparto: ReturnType<typeof gananciaPorSocio>
  neutro?: boolean
}) {
  if (reparto.socios.length === 0) return null
  return (
    <Banda className={clsx('divide-y divide-line', neutro ? 'mt-2' : 'border-t-0')}>
      {reparto.socios.map((s) => (
        <div key={s.nombre} className="flex items-baseline justify-between px-5 py-2.5">
          <span className="text-sm">
            {s.nombre} <span className="text-ink-faint tnum">{pct(s.pct, 0)}</span>
          </span>
          <span
            className={clsx(
              'font-display text-lg font-semibold tnum',
              neutro ? 'text-ink' : s.monto >= 0 ? 'text-forest-600' : 'text-clay-deep',
            )}
          >
            {money(s.monto)}
          </span>
        </div>
      ))}
      {Math.abs(reparto.sinSociedad) >= 1 && (
        <div className="flex items-baseline justify-between px-5 py-2.5 text-sm text-ink-faint">
          <span>De ciclos sin sociedad</span>
          <span className="tnum">{money(reparto.sinSociedad)}</span>
        </div>
      )}
    </Banda>
  )
}

// Los ciclos que siguen no tienen ganancia todavía: lo vendido no cubre aún lo
// puesto, y restarlo daba una «Pérdida» del tamaño de toda la inversión, en
// rojo también en la parte de cada socio. Se muestra lo que se sabe: lo
// invertido, lo vendido, lo que vale hoy lo que está en el galpón y a cuánto
// hay que vender para no perder.
function TotalesEnCurso({ lista }: { lista: LoteConMetrics[] }) {
  const { precioMercadoLb } = useSettings()
  const invertido = lista.reduce((a, r) => a + r.metrics.costos, 0)
  const vendido = lista.reduce((a, r) => a + r.metrics.ingresos, 0)
  const valorEnPie = lista.reduce((a, r) => {
    const precio = r.lote.precioVentaLb ?? precioMercadoLb
    if (!precio || r.metrics.pesoEstimadoLb == null) return a
    return a + r.metrics.avesVivas * r.metrics.pesoEstimadoLb * precio
  }, 0)
  const minimo = precioMinimoConjunto(lista.filter((r) => r.precio).map((r) => r.precio!))
  const reparto = gananciaPorSocio(
    lista.map((r) => ({ socios: r.lote.socios, ganancia: r.metrics.costos })),
  )
  const filas = [
    { label: 'Invertido', valor: money(invertido) },
    ...(vendido > 0 ? [{ label: 'Vendido hasta hoy', valor: money(vendido) }] : []),
    ...(valorEnPie > 0 ? [{ label: 'Valor en pie', valor: money(valorEnPie) }] : []),
    ...(minimo != null ? [{ label: 'Mínimo para no perder', valor: `${porLb(minimo)}/lb` }] : []),
  ]
  return (
    <>
      <Banda className="mt-4 divide-y divide-line">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-ink-soft">{f.label}</span>
            <span className="font-display text-xl font-semibold text-ink tnum">{f.valor}</span>
          </div>
        ))}
      </Banda>
      {reparto.socios.length > 0 && (
        <>
          <p className="mt-3 text-xs text-ink-faint">Lo invertido, según la parte de cada socio:</p>
          <RepartoSocios reparto={reparto} neutro />
        </>
      )}
    </>
  )
}

function DeudasDeLaEmpresa() {
  const resumen = useDeudas()
  if (!resumen) return null

  if (resumen.deudas.length === 0)
    return (
      <Seccion
        className="mt-8"
        etiqueta="Deudas de la empresa"
        titulo="No has anotado ninguna"
        nota="El galpón, el equipo o el terreno que estás pagando poco a poco van aquí: se abonan cuando puedes y no ensucian el resultado de ningún ciclo."
        accion={
          <Link to="/deudas" className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-forest-600">
            Anotar →
          </Link>
        }
      />
    )

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Deudas de la empresa"
        titulo={
          resumen.saldo > 0
            ? `Faltan ${money(resumen.saldo)} de ${money(resumen.total)}`
            : 'Todo lo de la granja está pagado'
        }
        nota="El galpón, el equipo y el terreno se abonan poco a poco, así que no entran en el resultado de ningún ciclo."
        accion={
          <Link to="/deudas" className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-forest-600">
            Ver todas
          </Link>
        }
      />
      <Banda className="divide-y divide-line">
        {resumen.deudas.slice(0, 4).map((e) => (
          <Link
            key={e.deuda.id}
            to="/deudas"
            className="block px-5 py-3 transition active:bg-paper-sunken"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium">{e.deuda.concepto}</span>
              <span
                className={clsx(
                  'shrink-0 font-display text-base font-semibold tnum',
                  e.saldo > 0 ? 'text-ink' : 'text-forest-600',
                )}
              >
                {e.saldo > 0 ? money(e.saldo) : 'Saldada'}
              </span>
            </div>
            <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-forest-500"
                style={{ width: `${e.pagadoPct}%` }}
              />
            </div>
          </Link>
        ))}
      </Banda>
    </>
  )
}

function VasMejorando({ lista }: { lista: LoteConMetrics[] }) {
  const conIep = lista
    .filter((r) => r.metrics.iep != null)
    .sort((a, b) => a.lote.fechaInicio.localeCompare(b.lote.fechaInicio))
  if (conIep.length < 2) return null

  const datos = conIep.map((r) => ({
    nombre: r.lote.nombre.replace(/^(Lote|Ciclo)\s*/i, ''),
    iep: Math.round(r.metrics.iep!),
  }))
  const attr = atribucionIEP(conIep)

  return (
    <>
      <Seccion
        className="mt-8"
        etiqueta="Ciclo contra ciclo"
        titulo={
          attr
            ? `Subiste ${attr.delta} puntos de eficiencia desde ${attr.desde}`
            : 'Índice de eficiencia de cada ciclo'
        }
        nota="El IEP junta peso, conversión, mortalidad y días en un solo número. Más alto es mejor."
      />
      <Banda className="mt-3 px-5 py-4 pt-6">
        <GraficaBarras
          etiquetas={datos.map((d) => d.nombre)}
          valores={datos.map((d) => d.iep)}
          alto={180}
          formatoValor={(v) => num(v)}
          resumen={`Índice de eficiencia de ${datos.length} ciclos, de ${datos[0].nombre} a ${datos.at(-1)!.nombre}.`}
        />
        {attr && (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-soft">
            {attr.frase}
          </p>
        )}
      </Banda>
    </>
  )
}

// Los ciclos cerrados de cada incubadora, una junto a otra: la que manda
// pollitos que llegan muertos o arrancan flojos se nota.
function PorIncubadora({ lista }: { lista: LoteConMetrics[] }) {
  const grupos = porIncubadora(
    lista
      .filter((r) => r.arranque)
      .map((r) => ({ arranque: r.arranque!, mortalidadPct: r.metrics.mortalidadPct, fca: r.metrics.fca })),
  )
  if (grupos.length === 0) return null
  return (
    <>
      <Seccion
        className="mt-8"
        etiqueta="Por incubadora"
        titulo={grupos.length > 1 ? 'Cómo arrancan los pollitos de cada una' : `Los pollitos de ${grupos[0].incubadora}`}
        nota={`Promedio de los ciclos cerrados. En la primera semana lo normal es hasta ${pct(LIMITE_PRIMERA_SEMANA_PCT, 0)}, y en las cajas hasta ${pct(LIMITE_DOA_PCT, 1)}.`}
      />
      <Banda className="mt-3 divide-y divide-line">
        {grupos.map((g) => (
          <div key={g.incubadora} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium">{g.incubadora}</span>
              <span className="shrink-0 text-xs text-ink-faint">
                {num(g.ciclos)} {plural(g.ciclos, 'ciclo', 'ciclos')}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-2 text-xs text-ink-faint">
              <Cifra valor={pct(g.doaPct, 2)} label="en las cajas" mal={g.doaPct > LIMITE_DOA_PCT} />
              <Cifra valor={pct(g.pct7, 2)} label="1ª semana" mal={g.pct7 > LIMITE_PRIMERA_SEMANA_PCT} />
              <Cifra valor={pct(g.mortalidadPct, 1)} label="mortalidad" />
              <Cifra valor={g.fca != null ? num(g.fca, 2) : '—'} label="conversión" />
            </div>
          </div>
        ))}
      </Banda>
    </>
  )
}

function Cifra({ valor, label, mal }: { valor: string; label: string; mal?: boolean }) {
  return (
    <div>
      <div className={clsx('font-display text-base font-semibold tnum', mal ? 'text-clay-deep' : 'text-ink')}>
        {valor}
      </div>
      {label}
    </div>
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
    (r) => r.metrics.iep != null && r.metrics.fca != null && r.metrics.pesoFinalLb != null,
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
      w: Math.abs(ln(mejor.metrics.pesoFinalLb! / peor.metrics.pesoFinalLb!)),
      frase: `el peso (${num(peor.metrics.pesoFinalLb!, 2)} → ${num(mejor.metrics.pesoFinalLb!, 2)} lb)`,
    },
  ].sort((a, b) => b.w - a.w)

  const [d1, d2] = factores
  const desde = mesCorto(peor.lote.fechaInicio)
  if (d1.w === 0) return { delta, desde, frase: 'Mejoró parejo en todo.' }
  const frase =
    d2.w / d1.w >= 0.85
      ? `La mitad viene ${de(d1.frase)} y la otra mitad, ${de(d2.frase)}.`
      : `Casi todo viene ${de(d1.frase)}.`
  return { delta, desde, frase }
}

// «de el peso» no existe.
const de = (frase: string) => (frase.startsWith('el ') ? `del ${frase.slice(3)}` : `de ${frase}`)

function VacioReportes({ seg, activos }: { seg: Segmento; activos: LoteConMetrics[] }) {
  const objeto = seg === 'cerrado' ? 'cerrado' : 'en curso'
  const activo = activos[0]

  const viejo =
    activo && activo.metrics.ultimaFecha && diasEntre(activo.metrics.ultimaFecha, hoyISO()) >= 7
      ? activo
      : undefined

  return (
    <div className="mt-6 space-y-4">
      <Banda className="px-5 py-5 text-center">
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
      </Banda>

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
          <Link to={`/lotes/${activo.lote.id}`} className="block py-3 text-sm font-medium text-forest-600">
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
    <Banda className="px-5 py-4">
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
    </Banda>
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
