import { useState } from 'react'
import { clsx } from 'clsx'
import type { Gasto, Lote } from '../db/schema'
import { useGastosPorCiclo } from '../lib/hooks'
import { compararConOtros, curvaInversion, invertidoAlDia } from '../lib/inversion'
import { fecha, money, num, plural } from '../lib/format'
import { categoriaLabel } from '../lib/labels'
import { Banda, Pill, Seccion } from './ui'
import { GraficaLineas } from './chart'
import { TINTA } from './tinta'

const EDADES = [10, 20, 30, 40]
const DIA_MAX = 70

// ¿Cuánto llevaba puesto a esta edad? Se elige el día y se ve este ciclo contra
// los demás a la misma edad, por pollito, que es lo único comparable entre un
// ciclo de 1.000 aves y otro de 2.000.
export function InversionPorDia({
  lote,
  gastos,
  diaActual,
}: {
  lote: Lote
  gastos: Gasto[]
  diaActual: number
}) {
  const ciclos = useGastosPorCiclo()
  const [elegido, setElegido] = useState<number>()
  const [foco, setFoco] = useState<number>()
  const dia = elegido ?? diaActual

  const propio = invertidoAlDia(lote, gastos, dia)
  const otros = ciclos ? compararConOtros(lote, propio, ciclos, dia) : []
  const anterior = otros.find((o) => o.anterior)
  const cerrado = lote.estado === 'cerrado'

  const opciones = [...new Set([diaActual, ...EDADES])].sort((a, b) => a - b)
  const etiquetaOpcion = (d: number) =>
    d === diaActual ? (cerrado ? `Al cerrar · ${d}` : `Hoy · ${d}`) : `${d} días`

  // La gráfica cubre lo que alcanzó cualquiera de los dos ciclos, y como mínimo
  // la edad elegida para que la marca caiga dentro.
  const hasta = Math.min(
    DIA_MAX,
    Math.max(dia, propio.diaFinal, anterior ? anterior.inversion.diaFinal : 0),
  )
  const anteriorDatos = ciclos?.find((c) => c.lote.id === anterior?.lote.id)
  const curvaPropia = curvaInversion(lote, gastos, hasta)
  const curvaAnterior = anteriorDatos
    ? curvaInversion(anteriorDatos.lote, anteriorDatos.gastos, hasta)
    : undefined
  const xs = curvaPropia.map((_, i) => i)

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Inversión por día"
        titulo={`Lo invertido a los ${num(dia)} ${plural(dia, 'día', 'días')}`}
        nota="Lo que habías puesto a esa edad: pollitos y cada gasto con fecha hasta ese día. Elige el día y compáralo con tus otros ciclos."
      />

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Edad del ciclo">
        {opciones.map((d) => (
          <button
            key={d}
            onClick={() => setElegido(d)}
            aria-pressed={dia === d}
            className={clsx(
              'h-11 rounded-full border px-3.5 text-sm font-semibold tnum transition active:scale-95',
              dia === d
                ? 'border-forest-500 bg-forest-50 text-forest-800'
                : 'border-line bg-paper-raised text-ink-soft',
            )}
          >
            {etiquetaOpcion(d)}
          </button>
        ))}
        <label className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-paper-raised pl-3.5 pr-1.5 text-sm text-ink-soft">
          Otro
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={DIA_MAX}
            aria-label="Otro día del ciclo"
            placeholder="día"
            onChange={(e) => {
              const v = Math.round(Number(e.target.value))
              if (e.target.value !== '' && v >= 0 && v <= DIA_MAX) setElegido(v)
            }}
            className="h-8 w-14 rounded-full bg-sunken text-center text-sm font-semibold text-ink tnum outline-none focus:ring-2 focus:ring-forest-100"
          />
        </label>
      </div>

      <Banda className="px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-ink-faint">
              {propio.llego
                ? `Este ciclo · día ${num(propio.hastaDia)} · ${fecha(propio.fecha)}`
                : cerrado
                  ? `Este ciclo cerró el día ${num(propio.diaFinal)}`
                  : `Este ciclo va en el día ${num(propio.diaFinal)}`}
            </div>
            <div className="font-display text-2xl font-semibold leading-none tnum">
              {money(propio.total)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-lg font-semibold leading-none tnum">
              {money(propio.porAve)}
            </div>
            <div className="mt-1 text-xs text-ink-faint">por pollito recibido</div>
          </div>
        </div>
        {!propio.llego && !cerrado && (
          <p className="mt-2 text-xs text-ink-faint">
            Es lo que llevas hoy. A los {num(dia)} días faltan {num(dia - propio.diaFinal)}.
          </p>
        )}

        {propio.partes.length > 0 && (
          <div className="mt-4 space-y-2.5 border-t border-line pt-4">
            {propio.partes.map((p) => (
              <div key={p.categoria}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-soft">
                    {p.categoria === 'aves' ? 'Pollitos y aves' : categoriaLabel(p.categoria)}
                    <span className="ml-2 text-xs text-ink-faint tnum">
                      {num((p.monto / Math.max(1, propio.total)) * 100, 0)}%
                    </span>
                  </span>
                  <span className="font-display font-semibold tnum">{money(p.monto)}</span>
                </div>
                <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-forest-500"
                    style={{ width: `${(p.monto / Math.max(1, propio.total)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Banda>

      {otros.length > 0 ? (
        <>
          <div className="mb-2 mt-5 text-xs font-medium text-ink-faint">
            Tus otros ciclos a los {num(dia)} {plural(dia, 'día', 'días')}
          </div>
          <Banda className="divide-y divide-line">
            {otros.slice(0, 5).map((o) => (
              <div key={o.lote.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{o.lote.nombre}</span>
                    {o.anterior && <Pill tone="neutral">anterior</Pill>}
                  </div>
                  <div className="text-xs text-ink-faint tnum">
                    {num(o.lote.cantidadInicial)} pollitos ·{' '}
                    {o.inversion.llego
                      ? `día ${num(o.inversion.hastaDia)}`
                      : o.lote.estado === 'cerrado'
                        ? `cerró el día ${num(o.inversion.diaFinal)}`
                        : `va en el día ${num(o.inversion.diaFinal)}`}
                  </div>
                </div>
                <div className="shrink-0 text-right tnum">
                  <div className="font-display font-semibold">{money(o.inversion.total)}</div>
                  <div className="text-xs text-ink-faint">
                    {money(o.inversion.porAve)} por pollito
                    {o.difPct != null && Math.abs(o.difPct) >= 1 && (
                      <span
                        className={clsx(
                          'ml-1.5 font-semibold',
                          o.difPct > 0 ? 'text-clay-text' : 'text-forest-600',
                        )}
                      >
                        {o.difPct > 0 ? '▲' : '▼'} {num(Math.abs(o.difPct), 0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Banda>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            ▲ es lo que este ciclo lleva de más por pollito a la misma edad; ▼, lo que lleva de
            menos. El alimento cuenta el día que se compró: un ciclo que compró por adelantado se
            ve más caro al principio.
          </p>

          {anterior && curvaAnterior && (
            <Banda className="mt-3 px-5 py-4">
              <GraficaLineas
                x={xs}
                series={[
                  { datos: curvaAnterior, tono: 'guia', punteada: true, nombre: anterior.lote.nombre },
                  { datos: curvaPropia, nombre: 'Este ciclo' },
                ]}
                alto={170}
                marca={{ x: Math.min(dia, hasta), texto: `día ${dia}` }}
                formatoY={(v) => money(v)}
                etiquetaX={(v) => `d${v}`}
                foco={foco}
                onFoco={setFoco}
                resumen={`Inversión por pollito día a día, este ciclo contra ${anterior.lote.nombre}.`}
              />
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="1" y1="3" x2="17" y2="3" stroke={TINTA.serie} strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  Este ciclo
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="1" y1="3" x2="17" y2="3" stroke={TINTA.guia} strokeWidth="1.5" strokeDasharray="5 4" />
                  </svg>
                  {anterior.lote.nombre}
                </span>
              </div>
              <p className="mt-1 text-center text-xs text-ink-faint tnum">
                {foco != null
                  ? `Día ${foco} · este ciclo ${curvaPropia[foco] != null ? money(curvaPropia[foco]!) : '—'} · anterior ${curvaAnterior[foco] != null ? money(curvaAnterior[foco]!) : '—'} por pollito`
                  : 'Por pollito recibido. Arrastra el dedo para ver cualquier día.'}
              </p>
            </Banda>
          )}
        </>
      ) : (
        ciclos && (
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            Cuando tengas otro ciclo anotado, aquí verás cuánto llevaba invertido a la misma edad.
          </p>
        )
      )}
    </>
  )
}
