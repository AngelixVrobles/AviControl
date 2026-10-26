import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertaChip } from '../components/AlertaChip'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { LoteCard } from '../components/LoteCard'
import type { LoteConMetrics } from '../lib/hooks'
import { Button, EmptyState, Seccion } from '../components/ui'
import { IconCheck, IconScale, LogoAviControl } from '../components/icons'
import { alimentoEn, desdeHace, fechaLarga, hoyISO, money, num, pct, plural, porLb } from '../lib/format'
import { precioMinimoConjunto } from '../lib/precios'
import { sinAves } from '../lib/lote'
import { nombreGalpon } from '../lib/galpones'
import { useCuentaCerrados, useModoVenta, usePorCobrar, useResumen, useSettings } from '../lib/hooks'
import { valorHoy } from '../lib/venta'
import { diasSinRespaldo, tocaRecordarRespaldo } from '../lib/respaldo'
import { useRespaldo } from '../components/useRespaldo'
import { ListaNovedades } from '../components/Novedades'
import { leerNovedadesVistas, marcarNovedadesVistas, NOVEDADES, tocaNovedades } from '../lib/novedades'

export function Dashboard() {
  const activos = useResumen('activo')
  const cerrados = useCuentaCerrados()
  const compartidos = useResumen('activo', { compartidos: 'solo' })
  const settings = useSettings()
  const [novedadesVistas, setNovedadesVistas] = useState(leerNovedadesVistas)
  const sinDatos = activos != null && cerrados === 0 && activos.length === 0

  // Quien estrena la app empieza con esta versión: lo nuevo no le dice nada.
  useEffect(() => {
    if (sinDatos && novedadesVistas == null) marcarNovedadesVistas()
  }, [sinDatos, novedadesVistas])

  if (!activos || cerrados == null) return <SkeletonHeader />

  const hoy = capitalizar(fechaLarga(hoyISO()))
  const recordar = tocaRecordarRespaldo(settings.ultimoRespaldo, activos.length + cerrados > 0)

  return (
    <div className="animate-rise">
      <header className="flex items-center justify-between gap-4 pt-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-soft">{settings.granja}</p>
          <h1 className="font-display text-xl font-semibold leading-tight">{hoy}</h1>
        </div>
        <LogoAviControl size={40} tile className="shrink-0 rounded-[9px] shadow-card" />
      </header>

      {tocaNovedades(novedadesVistas, activos.length + cerrados > 0) && (
        <section className="mt-6 rounded-xl2 border border-forest-200 bg-forest-50 p-4">
          <h2 className="mb-2 font-display text-base font-semibold text-forest-800">
            Lo nuevo de la versión {NOVEDADES.version}
          </h2>
          <ListaNovedades corta />
          <button
            type="button"
            onClick={() => {
              marcarNovedadesVistas()
              setNovedadesVistas(NOVEDADES.version)
            }}
            className="mt-2 block h-11 rounded-full bg-forest-500 px-5 text-sm font-semibold text-paper-raised transition active:scale-95"
          >
            Entendido
          </button>
        </section>
      )}

      {activos.length === 0 ? (
        <div className="mt-6">
          <Compartidos lista={compartidos} />
          <EmptyState
            icon={<IconScale width={28} height={28} />}
            title={cerrados ? 'No tienes ciclos en curso' : 'Aún no tienes ciclos'}
            text={
              cerrados
                ? `Cerraste ${cerrados === 1 ? 'tu último ciclo' : `${num(cerrados)} ciclos`}. El resultado está en Reportes; cuando recibas los pollitos, abre el siguiente.`
                : 'Crea tu primer ciclo de engorde para empezar a llevar el control.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/lotes/nuevo">
                  <Button>Crear ciclo</Button>
                </Link>
                {cerrados > 0 && (
                  <Link to="/reportes">
                    <Button variant="soft">Ver el resultado</Button>
                  </Link>
                )}
              </div>
            }
          />
          <TeDeben />
          {recordar && <RecordarRespaldo ultimo={settings.ultimoRespaldo} />}
        </div>
      ) : (
        <>
          <RegistroDeHoy activos={activos} />

          <Alertas activos={activos} />

          <TeDeben />

          {recordar && <RecordarRespaldo ultimo={settings.ultimoRespaldo} />}

          <Seccion
            className="mt-8"
            etiqueta="Ciclos en curso"
            accion={
              <Link to="/lotes" className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-forest-600">
                Ver todos
              </Link>
            }
          />
          <div className="mt-3 space-y-3">
            {activos.map((d, i) => (
              <div key={d.lote.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <LoteCard data={d} />
              </div>
            ))}
          </div>

          <BloqueFinanciero activos={activos} precioMercado={settings.precioMercadoLb} />

          <Compartidos lista={compartidos} />
        </>
      )}
    </div>
  )
}

// Los ciclos que mandó un socio: para quien no lleva los datos, es lo que viene
// a ver. Van aparte y no entran en las cuentas de la granja.
function Compartidos({ lista }: { lista?: LoteConMetrics[] }) {
  if (!lista?.length) return null
  return (
    <section className="mb-6 mt-8 first:mt-0">
      <Seccion className="mb-3" etiqueta="Compartidos contigo" />
      <div className="space-y-3">
        {lista.map((d) => (
          <LoteCard key={d.lote.id} data={d} />
        ))}
      </div>
    </section>
  )
}

// Lo vendido a crédito que no ha entrado, de todos los ciclos, con quién debe
// más y desde cuándo.
function TeDeben() {
  const r = usePorCobrar()
  if (!r || r.total < 1) return null
  const masVieja = Math.max(...r.compradores.map((c) => c.masVieja))
  return (
    <Link
      to="/cobros"
      className="mt-7 block rounded-xl2 border border-line bg-paper-raised p-4 transition active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-soft">Te deben</span>
        <span className="font-display text-xl font-semibold tnum">{money(r.total)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft tnum">
        {r.compradores.length === 1
          ? `${r.compradores[0].comprador} te debe ${desdeHace(masVieja)}`
          : `${num(r.compradores.length)} compradores · ${r.compradores[0].comprador} debe más · lo más viejo, ${desdeHace(masVieja)}`}
      </p>
    </Link>
  )
}

// Todo vive en el teléfono: si pasa una semana sin respaldo, Inicio lo dice y
// deja hacerlo ahí mismo, sin ir a Ajustes.
function RecordarRespaldo({ ultimo }: { ultimo: string | null }) {
  const { respaldar } = useRespaldo()
  const dias = diasSinRespaldo(ultimo)
  return (
    <section className="mt-7 rounded-xl2 border border-amber-line border-l-4 border-l-amber bg-amber-tint p-4">
      <h2 className="font-display text-base font-semibold text-amber-text">
        {dias == null ? 'Nunca has respaldado tus datos' : `Hace ${num(dias)} días del último respaldo`}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-text">
        Viven solo en este teléfono. Guarda el respaldo fuera de él: WhatsApp, el correo o Drive.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={respaldar}
          className="rounded-full bg-forest-500 px-5 py-2.5 text-sm font-semibold text-paper-raised transition active:scale-95"
        >
          Respaldar ahora
        </button>
        <Link to="/ajustes" className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-amber-text">
          Ver Ajustes
        </Link>
      </div>
    </section>
  )
}

function Alertas({ activos }: { activos: LoteConMetrics[] }) {
  const [todas, setTodas] = useState(false)
  const orden = { bad: 0, warn: 1, info: 2 }
  const items = activos
    .flatMap((r) => r.alertas.map((a) => ({ a, lote: r.lote })))
    .sort((x, y) => orden[x.a.nivel] - orden[y.a.nivel])
  if (items.length === 0) return null
  const visibles = todas ? items : items.slice(0, 2)

  return (
    <section className="mt-7">
      <Seccion className="mb-3" etiqueta="Alertas" />
      <div className="space-y-2">
        {visibles.map(({ a, lote }, i) => (
          <AlertaChip key={`${lote.id}-${i}`} alerta={a} titulo={lote.nombre} to={`/lotes/${lote.id}`} />
        ))}
      </div>
      {!todas && items.length > 2 && (
        <button
          onClick={() => setTodas(true)}
          className="mt-2 w-full rounded-xl border border-dashed border-line py-2.5 text-center text-sm font-medium text-ink-soft"
        >
          Ver {items.length - 2} {plural(items.length - 2, 'aviso', 'avisos')} más
        </button>
      )}
    </section>
  )
}

function RegistroDeHoy({ activos: todos }: { activos: LoteConMetrics[] }) {
  const nav = useNavigate()
  const settings = useSettings()
  const { unidadAlimento } = settings
  // Con varios galpones, el nombre del ciclo no siempre dice dónde está.
  const donde = (r: LoteConMetrics) => {
    const g = nombreGalpon(r.lote, settings)
    return g ? `${g} · ` : ''
  }
  // El ciclo que ya no tiene aves no tiene día que anotar: su aviso es cerrarlo.
  const activos = todos.filter((r) => !sinAves(r.metrics))
  const listos = activos.filter((r) => r.metrics.registroHoy).length
  if (activos.length === 0) return null

  return (
    <section className="mt-6 rounded-xl2 bg-sunken p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-display text-lg font-semibold">Registro de hoy</h2>
        <span className="text-sm font-medium text-ink-soft tnum">
          {listos} de {activos.length} {plural(activos.length, 'listo', 'listos')}
        </span>
      </div>
      <div className="space-y-2">
        {activos.map((r) => {
          const rh = r.metrics.registroHoy
          if (rh) {
            const resumen = [
              rh.pesoPromedio != null ? `${num(rh.pesoPromedio, 2)} lb` : null,
              rh.alimentoLb > 0 ? `${alimentoEn(rh.alimentoLb, unidadAlimento)} de alimento` : null,
              rh.mortalidad > 0 ? `${num(rh.mortalidad)} bajas` : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <Link
                key={r.lote.id}
                to={`/lotes/${r.lote.id}`}
                className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-600 text-paper">
                  <IconCheck width={15} height={15} strokeWidth={2.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-tight">
                    {r.lote.nombre}{' '}
                    <span className="font-normal text-ink-faint">
                      · {donde(r)}día {r.metrics.dias}
                    </span>
                  </div>
                  {resumen && <div className="text-sm text-ink-soft tnum">{resumen}</div>}
                </div>
              </Link>
            )
          }
          return (
            <div
              key={r.lote.id}
              className="flex items-center gap-3 rounded-xl border-t-2 border-amber-line bg-amber-tint px-3 py-2.5"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-dashed border-amber text-sm font-bold text-amber-text">
                !
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight">
                  {r.lote.nombre}{' '}
                  <span className="font-normal text-ink-soft">
                    · {donde(r)}día {r.metrics.dias}
                  </span>
                </div>
                <div className="text-sm font-medium text-amber-text">Falta el de hoy</div>
              </div>
              <button
                onClick={() => nav(`/lotes/${r.lote.id}?reg=1`)}
                className="shrink-0 rounded-full bg-forest-500 px-4 py-2.5 text-sm font-semibold text-paper-raised transition active:scale-95"
              >
                Registrar
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BloqueFinanciero({
  activos,
  precioMercado,
}: {
  activos: LoteConMetrics[]
  precioMercado?: number
}) {
  // El número grande es a cómo hay que vender para no perder, con lo que costará
  // el ciclo entero y las libras que saldrán. Antes era el costo por libra de
  // hoy: todo lo gastado entre aves todavía chiquitas, que al principio del
  // ciclo asustaba sin decir nada, y con varios ciclos un promedio simple.
  const modo = useModoVenta()
  const conPrecio = activos.filter((r) => r.precio)
  const minimo = precioMinimoConjunto(conPrecio.map((r) => r.precio!))
  const avesVivas = activos.reduce((a, r) => a + r.metrics.avesVivas, 0)
  const invertido = activos.reduce((a, r) => a + r.metrics.costos, 0)

  // Durante el ciclo no hay ganancia que mostrar: los costos entran desde el
  // día 1 y el ingreso llega al vender. Lo que sí se puede decir es cuánto se
  // lleva puesto, cuánto vale hoy lo que está en el galpón y lo que quedaría
  // al vender a tu precio, con lo que falta por pagar.
  const valorEnPie = activos.reduce(
    (a, r) => a + valorHoy(r.metrics.avesVivas, r.metrics.pesoEstimadoLb, r.lote.precioVentaLb, precioMercado, modo),
    0,
  )
  const estimadas = activos.map((r) => r.precio?.actual?.ganancia)
  const estimada = estimadas.every((g) => g != null) ? estimadas.reduce((a, g) => a! + g!, 0) : undefined
  // Arreglado, el mínimo es por libra arreglada y el mercado paga la libra en
  // pie: se compara lo que tendría que pagar el pollero, sin lo de arreglarlo.
  const minimoPie = modo.arreglado
    ? precioMinimoConjunto(conPrecio.map((r) => r.precio!), { enPie: true })
    : minimo
  const sobreMercado =
    minimoPie != null && minimoPie > 0 && precioMercado ? ((precioMercado - minimoPie) / minimoPie) * 100 : undefined

  return (
    <section className="mt-8 overflow-hidden rounded-xl2 bg-forest-700 p-5 text-paper-raised">
      <div className="text-sm font-medium text-forest-200">
        {modo.arreglado ? 'Precio mínimo por libra arreglada' : 'Precio mínimo para no perder'}
        {activos.length > 1 &&
          (conPrecio.length === activos.length
            ? ` · tus ${num(activos.length)} ciclos juntos`
            : ` · ${num(conPrecio.length)} de ${num(activos.length)} ciclos, los que ya tienen pesaje`)}
      </div>
      <div className="mt-2 font-display text-hero font-semibold leading-none tracking-tight tnum">
        {minimo != null ? <AnimatedNumber value={minimo} format={porLb} /> : '—'}
        <span className="ml-1 align-baseline text-lg font-medium text-forest-200">/ lb</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-forest-100">
        {minimo == null
          ? 'Pesa una muestra de aves y te digo a cómo vender.'
          : modo.arreglado
            ? sobreMercado != null
              ? sobreMercado >= 0
                ? `En pie no perderías: el pollero paga ${porLb(precioMercado!)} y te bastan ${porLb(minimoPie!)}.`
                : `En pie el pollero paga ${porLb(precioMercado!)} y necesitas ${porLb(minimoPie!)}: arreglado es como no pierdes.`
              : 'Con lo que costará el ciclo entero y las libras arregladas que vas a sacar.'
            : sobreMercado != null
              ? sobreMercado >= 0
                ? `El mercado paga ${porLb(precioMercado!)}, ${pct(sobreMercado, 0)} por encima.`
                : `El mercado paga ${porLb(precioMercado!)}, ${pct(-sobreMercado, 0)} por debajo: a ese precio perderías.`
              : 'Con lo que costará el ciclo entero y las libras que vas a sacar.'}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <HeroStat label="Invertido" value={money(invertido, { compact: true })} />
        <HeroStat
          label={`${modo.arreglado ? 'Vale hoy' : 'Valor en pie'} · ${num(avesVivas)} aves`}
          value={valorEnPie > 0 ? money(valorEnPie, { compact: true }) : '—'}
        />
      </div>
      {estimada != null && activos.length > 0 && (
        <p className="mt-3 border-t border-white/10 pt-3 text-sm text-forest-100 tnum">
          {estimada >= 0 ? 'Ganancia estimada' : 'Pérdida estimada'} al vender a tu precio:{' '}
          <span className="font-display text-lg font-semibold text-paper-raised">{money(Math.abs(estimada))}</span>
        </p>
      )}
    </section>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold tnum leading-none">{value}</div>
      <div className="mt-1 text-xs text-forest-200/80">{label}</div>
    </div>
  )
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function SkeletonHeader() {
  return (
    <div role="status" aria-label="Cargando" className="animate-pulse pt-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-24 rounded bg-paper-sunken" />
          <div className="mt-2 h-8 w-52 rounded-lg bg-paper-sunken" />
        </div>
        <div className="h-10 w-10 rounded-xl bg-paper-sunken" />
      </div>
      <div className="mt-6 h-28 rounded-xl2 bg-paper-sunken" />
      <div className="mt-7 h-6 w-40 rounded bg-paper-sunken" />
      <div className="mt-3 h-44 rounded-xl2 bg-paper-sunken" />
    </div>
  )
}
