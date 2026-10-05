import type { Lote } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { saveSettings, type Settings } from '../../lib/settings'
import { num, plural } from '../../lib/format'
import {
  EQUIPOS,
  aMedida,
  deMedida,
  enGalones,
  enPies,
  enPies2,
  equipoDeLaGranja,
  type Distribucion,
  type ItemEquipo,
  type TipoEquipo,
} from '../../lib/equipo'
import { PESO_OBJETIVO_DEFAULT } from '../../lib/standards'
import { Banda, Segmentado, Seccion } from '../../components/ui'

function Fila({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right">
        <span className={'font-display font-semibold tnum ' + (valueClass ?? '')}>{value}</span>
        {sub && <span className="block text-xs text-ink-faint tnum">{sub}</span>}
      </span>
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
  const pesoObjetivo = lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT
  const plan = equipoDeLaGranja(aves, pesoObjetivo, metrics.diaObjetivo, settings)
  if (!plan) return null
  const g = plan.galpon
  const u = settings.unidadMedida
  const largo = (m: number, dec = 1) => (u === 'pies' ? `${num(enPies(m), dec)} pies` : `${num(m, dec)} m`)

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-faint">Para las {num(aves)} aves que tienes hoy.</p>

      <div>
        <Seccion className="mb-3" etiqueta="Lo que hace falta" />
        <EquipoDeLaGranja settings={settings} />
        <Banda className="mt-3 divide-y divide-line">
          <FilaEquipo item={plan.bebederos} settings={settings} />
          <FilaEquipo item={plan.comederos} settings={settings} />
        </Banda>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Si tu modelo es otro, cambia el número de aves y todo se recalcula.
        </p>
      </div>

      <div>
        <Seccion
          className="mb-3"
          etiqueta="Para el recibo"
          nota="Además de lo anterior, los primeros días, mientras el pollito aprende a comer y beber."
        />
        <Banda className="divide-y divide-line">
          {plan.crianza.map((e) => (
            <div key={e.nombre} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{e.nombre}</div>
                <div className="text-xs text-ink-faint">{e.regla}</div>
              </div>
              <div className="font-display text-xl font-semibold tnum leading-none">{num(e.cantidad)}</div>
            </div>
          ))}
        </Banda>
      </div>

      <div>
        <Seccion
          className="mb-3"
          etiqueta="Agua"
          titulo={`Al final del ciclo beben unos ${num(Math.round(plan.aguaFinalL / 10) * 10)} litros al día`}
          nota={`Son ${num(Math.round(enGalones(plan.aguaFinalL)))} galones, y más en los días de calor. El tanque de los ${EQUIPOS[settings.bebedero].corto} debe guardar por lo menos un día entero.`}
        />
      </div>

      <div>
        <Seccion
          className="mb-3"
          etiqueta="Medidas del galpón"
          accion={
            <Segmentado
              etiqueta="Unidad de las medidas"
              valor={u}
              onCambio={(v) => saveSettings({ unidadMedida: v })}
              opciones={[
                { id: 'm', label: 'Metros' },
                { id: 'pies', label: 'Pies' },
              ]}
            />
          }
        />
        <MedidasGalpon settings={settings} />

        {!g ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-faint">
            Pon el largo y el ancho del galpón y te digo cuántas aves caben, dónde hacer el recibo,
            cuántas líneas hacen falta y cada cuánto va cada equipo.
          </p>
        ) : (
          <>
            <Banda className="mt-3 divide-y divide-line">
              <Fila
                label="Área"
                value={u === 'pies' ? `${num(enPies2(g.areaM2))} pies²` : `${num(g.areaM2)} m²`}
                sub={u === 'pies' ? `${num(g.areaM2)} m²` : `${num(enPies2(g.areaM2))} pies²`}
              />
              <Fila
                label="Caben"
                value={`${num(g.avesMaximas)} aves`}
                sub={
                  g.limitePorPeso
                    ? `para no pasar de 30 kg/m² a ${num(pesoObjetivo, 1)} lb`
                    : `a ${num(settings.avesPorM2)} aves por m²`
                }
              />
              <Fila
                label="Hoy tienes"
                value={`${num(g.avesPorM2Hoy, 1)} aves/m²`}
                sub={`${num(g.kgM2AlVender, 1)} kg/m² al venderlas`}
                valueClass={g.sobrepoblado ? 'text-clay-deep' : undefined}
              />
              <Fila
                label="Con el galpón lleno"
                value={`${num(g.lleno.bebederos)} ${EQUIPOS[settings.bebedero].corto} · ${num(g.lleno.comederos)} ${EQUIPOS[settings.comedero].corto}`}
                sub={`para ${num(g.avesMaximas)} aves`}
              />
            </Banda>

            {g.sobrepoblado && (
              <div className="mt-2 rounded-xl2 border-l-4 border-amber-400 bg-amber-tint p-4">
                <div className="font-display text-base font-semibold text-amber-text">
                  El galpón queda apretado al peso de venta
                </div>
                <p className="mt-1 text-sm leading-relaxed text-amber-text">
                  Con {num(aves)} aves llegas a {num(g.kgM2AlVender, 1)} kg/m²
                  {g.limitePorPeso ? ', sobre los 30 kg/m² que aguanta un galpón abierto en calor' : ` y ${num(g.avesPorM2Hoy, 1)} aves por m²`}.
                  Saca {num(Math.max(0, aves - g.avesMaximas))} aves antes (raleo) o vende un poco más
                  liviano.
                </p>
              </div>
            )}

            <Seccion
              className="mb-3 mt-6"
              etiqueta="El recibo"
              titulo={`Unos ${num(g.reciboM2)} m² para los ${num(aves)} pollitos`}
              nota={`Cierra con cortina los primeros ${largo(g.reciboLargoM)} del galpón, a todo lo ancho: de 40 a 50 pollitos por m² cerca de las criadoras. Amplía cada 2 o 3 días según los veas: si se amontonan lejos de la criadora tienen calor o les falta espacio. Entre el día 7 y el 10 ya va todo el galpón.`}
            />

            <Seccion className="mb-3 mt-6" etiqueta="Cómo repartirlos" />
            <Banda className="divide-y divide-line">
              <FilaReparto titulo={EQUIPOS[settings.comedero].nombre} d={g.comederos} largo={largo} />
              <FilaReparto titulo={EQUIPOS[settings.bebedero].nombre} d={g.bebederos} largo={largo} />
            </Banda>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Ninguna ave debe caminar más de 3 m (10 pies) para comer o beber; así queda en{' '}
              {largo(g.bebederos.caminataMaxM)}. Alterna las líneas de comederos y bebederos, y sube
              la altura con el ave: el borde del plato y del bebedero a la altura del lomo.
              {settings.bebedero === 'niple' &&
                ` Los niples van cada 35 cm: ${largo(plan.metrosDeNiples)} de línea en total.`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// La regla de cada equipo con la cifra editable en la misma frase: el que
// tiene tolvas de 12 kg las pone a 35 aves y todo se recalcula.
function FilaEquipo({ item, settings }: { item: ItemEquipo; settings: Settings }) {
  const tipo = item.tipo as TipoEquipo
  const porDefecto = EQUIPOS[tipo].aves
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{item.nombre}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-faint">
          <span>1 por cada</span>
          <input
            key={`${tipo}-${item.avesPorUnidad}`}
            type="number"
            inputMode="numeric"
            aria-label={`Aves por cada ${EQUIPOS[tipo].corto}`}
            defaultValue={item.avesPorUnidad}
            onBlur={(e) => {
              const v = Math.round(Number(e.target.value))
              saveSettings({
                avesPorEquipo: { ...settings.avesPorEquipo, [tipo]: v > 0 && v !== porDefecto ? v : undefined },
              })
            }}
            className="h-9 w-14 rounded-lg border border-line bg-paper-raised px-1 text-center text-sm font-semibold text-ink tnum outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
          />
          <span>aves · {item.regla}</span>
        </div>
        {item.alInicio != null && (
          <div className="mt-1 text-xs text-ink-faint tnum">
            Al empezar alcanzan {num(item.alInicio)} (1 por cada {EQUIPOS[tipo].avesInicio} pollitos)
          </div>
        )}
      </div>
      <div className="shrink-0 font-display text-2xl font-semibold tnum leading-none">{num(item.cantidad)}</div>
    </div>
  )
}

function EquipoDeLaGranja({ settings }: { settings: Settings }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-soft">Bebederos</span>
        <Segmentado
          etiqueta="Tipo de bebedero"
          valor={settings.bebedero}
          onCambio={(v) => saveSettings({ bebedero: v })}
          opciones={[
            { id: 'plasson', label: 'Plasson' },
            { id: 'niple', label: 'Niples' },
          ]}
          className="w-48"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-soft">Comederos</span>
        <Segmentado
          etiqueta="Tipo de comedero"
          valor={settings.comedero}
          onCambio={(v) => saveSettings({ comedero: v })}
          opciones={[
            { id: 'tolva', label: 'Tolva' },
            { id: 'plato', label: 'Platos' },
          ]}
          className="w-48"
        />
      </div>
    </div>
  )
}

function FilaReparto({
  titulo,
  d,
  largo,
}: {
  titulo: string
  d: Distribucion
  largo: (m: number, dec?: number) => string
}) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="font-display text-base font-semibold tnum">
          {num(d.lineas)} {plural(d.lineas, 'línea', 'líneas')}
        </span>
      </div>
      <div className="mt-1 text-xs leading-relaxed text-ink-faint tnum">
        {d.lineas === 1
          ? `Una sola línea por el centro del galpón, ${num(d.porLinea)} en total: uno cada ${largo(d.cadaM)}.`
          : `${num(d.lineas)} líneas a lo largo, separadas ${largo(d.separacionM)} y la primera a ${largo(d.desdeParedM)} de la pared. En cada línea, ${num(d.porLinea)}: uno cada ${largo(d.cadaM)}.`}
      </div>
    </div>
  )
}

// Largo y ancho en la unidad que elija el productor; se guardan en metros.
export function MedidasGalpon({ settings }: { settings: Settings }) {
  const u = settings.unidadMedida
  const mostrar = (m?: number) => (m ? String(Math.round(aMedida(m, u) * 10) / 10) : '')
  return (
    <div className="grid grid-cols-2 gap-3">
      {(
        [
          ['galponLargoM', 'Largo'],
          ['galponAnchoM', 'Ancho'],
        ] as const
      ).map(([campo, label]) => (
        <label key={campo} className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">
            {label} en {u === 'pies' ? 'pies' : 'metros'}
          </span>
          <input
            key={`${campo}-${u}-${settings[campo] ?? ''}`}
            type="number"
            inputMode="decimal"
            defaultValue={mostrar(settings[campo])}
            onBlur={(e) => {
              const v = Number(e.target.value.replace(',', '.'))
              saveSettings({ [campo]: v > 0 ? deMedida(v, u) : undefined })
            }}
            placeholder="0"
            className="h-12 w-full rounded-xl border border-line bg-paper-raised px-4 text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
          />
        </label>
      ))}
    </div>
  )
}
