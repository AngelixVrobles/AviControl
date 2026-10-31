import { useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { num, numCorto } from '../lib/format'
import { cuadranLasAves, errorPesada, leerPesada, resumenPesada, type PesadaEnEdicion } from '../lib/pesada'
import { IconChevron, IconClose } from './icons'
import { Input } from './ui'

// La pesada por cajas, como se anota en el cuaderno: las cajas vacías del
// pollero, pesadas por grupos; las veces que se pesaron llenas; y lo que queda
// de pollo, que es lo que se cobra. Antes había que sacar la cuenta a mano y
// escribir solo el total, y un error al restar no se veía en ningún lado.
export function PesadaPorCajas({
  valor,
  onCambio,
  onQuitar,
  pista,
  children,
}: {
  valor: PesadaEnEdicion
  onCambio: (v: PesadaEnEdicion) => void
  /** Volver a escribir el peso total, sin cajas. */
  onQuitar: () => void
  /** Lo que se sabe de las cajas de este comprador. */
  pista?: string
  /** Lo que va debajo de las libras: en «Venta», las aves que se fueron. */
  children?: ReactNode
}) {
  // La fila recién agregada recibe el dedo: se pesa y se escribe sin buscarla.
  const [nueva, setNueva] = useState<string>()
  const p = leerPesada(valor)
  const r = resumenPesada(p)
  const error = errorPesada(valor)

  const setVacia = (i: number, patch: Partial<PesadaEnEdicion['vacias'][number]>) =>
    onCambio({ ...valor, vacias: valor.vacias.map((g, j) => (j === i ? { ...g, ...patch } : g)) })
  const setLlena = (i: number, t: string) =>
    onCambio({ ...valor, llenas: valor.llenas.map((x, j) => (j === i ? t : x)) })

  return (
    <section aria-label="Pesada por cajas" className="col-span-2 rounded-xl2 border border-line bg-paper-raised p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold">Pesada por cajas</h3>
        <button
          type="button"
          onClick={onQuitar}
          className="-mx-2 -my-3 shrink-0 px-2 py-3 text-sm font-medium text-forest-600"
        >
          Escribir el peso total
        </button>
      </div>
      {pista && <p className="mt-1 text-xs leading-relaxed text-ink-faint">{pista}</p>}

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink-soft">Cajas vacías</span>
          {r.tara > 0 && (
            <span className="text-xs text-ink-faint tnum">
              {r.cajas > 0 ? `${num(r.cajas)} ${r.cajas === 1 ? 'caja' : 'cajas'} · ` : ''}
              {numCorto(r.tara)} lb
              {r.lbPorCaja != null ? ` · ${numCorto(r.lbPorCaja, 1)} c/u` : ''}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {valor.vacias.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative w-[104px] shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={g.cajas}
                  onChange={(e) => setVacia(i, { cajas: e.target.value })}
                  aria-label={`Cajas del grupo ${i + 1}`}
                  autoFocus={nueva === `vacia-${i}`}
                  className="pr-14"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  cajas
                </span>
              </div>
              <div className="relative min-w-0 flex-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={g.lb}
                  onChange={(e) => setVacia(i, { lb: e.target.value })}
                  aria-label={`Libras de las cajas vacías del grupo ${i + 1}`}
                  className="pr-9"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  lb
                </span>
              </div>
              {valor.vacias.length > 1 && (
                <Quitar
                  etiqueta={`Quitar el grupo ${i + 1} de cajas vacías`}
                  onClick={() => onCambio({ ...valor, vacias: valor.vacias.filter((_, j) => j !== i) })}
                />
              )}
            </div>
          ))}
        </div>
        <Agregar
          onClick={() => {
            setNueva(`vacia-${valor.vacias.length}`)
            onCambio({ ...valor, vacias: [...valor.vacias, { cajas: '', lb: '' }] })
          }}
        >
          + Otro grupo de cajas
        </Agregar>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink-soft">Cajas con pollo</span>
          {p.llenas.length > 1 && <span className="text-xs text-ink-faint tnum">{numCorto(r.bruto)} lb</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {valor.llenas.map((t, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="relative min-w-0 flex-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={t}
                  onChange={(e) => setLlena(i, e.target.value)}
                  aria-label={`Pesada ${i + 1} de cajas con pollo, en libras`}
                  autoFocus={nueva === `llena-${i}`}
                  className="pr-9"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  lb
                </span>
              </div>
              {valor.llenas.length > 1 && (
                <Quitar
                  etiqueta={`Quitar la pesada ${i + 1}`}
                  onClick={() => onCambio({ ...valor, llenas: valor.llenas.filter((_, j) => j !== i) })}
                />
              )}
            </div>
          ))}
        </div>
        <Agregar
          onClick={() => {
            setNueva(`llena-${valor.llenas.length}`)
            onCambio({ ...valor, llenas: [...valor.llenas, ''] })
          }}
        >
          + Otra pesada
        </Agregar>
      </div>

      <div className="mt-3 rounded-xl bg-forest-50 px-4 py-3 text-forest-700" aria-live="polite">
        {p.llenas.length ? (
          <>
            <div className="text-sm tnum">
              {numCorto(r.bruto)} lb llenas − {numCorto(r.tara)} lb de cajas
            </div>
            <div className="font-display text-2xl font-semibold leading-tight tnum">
              {numCorto(Math.max(0, r.neto))} lb de pollo
            </div>
          </>
        ) : (
          <div className="text-sm">Falta lo que pesaron las cajas con pollo.</div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-clay-text">
          {error}
        </p>
      )}

      {children}
    </section>
  )
}

export type FuenteAves = 'cajas' | 'peso' | 'mano'

// Cuántas aves se fueron. Casi todas las cajas llevan 10 pollos, pero hay
// polleros que las sobrecargan y no siempre se cuentan: por el peso, con lo que
// pesa hoy cada pollo, sale la otra cuenta, y si no cuadran se dice. El dinero
// no cambia —se cobra por libra—, pero las aves que quedan en el galpón sí.
export function AvesDeLaPesada({
  cajas,
  pollosPorCaja,
  onPollosPorCaja,
  porCajas,
  porPeso,
  netoLb,
  pesoAveLb,
  diasDesdePeso,
  arreglado,
  elegida,
  onElegir,
}: {
  cajas: number
  pollosPorCaja: string
  onPollosPorCaja: (t: string) => void
  porCajas?: number
  porPeso?: number
  netoLb: number
  /** Lo que pesa hoy cada pollo: en pie, o arreglado si se vende así. */
  pesoAveLb?: number
  diasDesdePeso?: number
  arreglado: boolean
  elegida: FuenteAves
  onElegir: (f: 'cajas' | 'peso') => void
}) {
  if (!(cajas > 0) && porPeso == null) return null
  const aviso = cuadranLasAves(porCajas, porPeso)
  const ppc = Number(pollosPorCaja)
  // Los que van por caja según el peso, en entero —«unos 15»—, salvo que
  // redondeado dé lo mismo que se dijo: con 5 por caja, 5.4 no es «unos 5».
  const porCajaPorPeso = porPeso != null && cajas > 0 ? porPeso / cajas : undefined
  const porCajaTexto =
    porCajaPorPeso == null
      ? ''
      : Math.round(porCajaPorPeso) !== ppc
        ? num(Math.round(porCajaPorPeso))
        : numCorto(porCajaPorPeso, 1)
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-soft">Aves que se fueron</span>
        {cajas > 0 && (
          <span className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="w-16 shrink-0">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={pollosPorCaja}
                onChange={(e) => onPollosPorCaja(e.target.value)}
                aria-label="Pollos por caja"
                className="px-2 text-center"
              />
            </span>
            por caja
          </span>
        )}
      </div>
      <div
        role="group"
        aria-label="Cuántas aves se fueron"
        className={clsx('grid gap-2', porCajas != null && porPeso != null ? 'grid-cols-2' : 'grid-cols-1')}
      >
        {porCajas != null && (
          <OpcionAves
            activa={elegida === 'cajas'}
            onClick={() => onElegir('cajas')}
            valor={`${num(porCajas)} aves`}
            nota={`${num(cajas)} cajas de ${num(ppc)}`}
          />
        )}
        {porPeso != null && (
          <OpcionAves
            activa={elegida === 'peso'}
            onClick={() => onElegir('peso')}
            valor={`unas ${num(porPeso)}`}
            nota="por el peso"
          />
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        {porPeso != null && pesoAveLb != null
          ? `Por el peso: ${numCorto(netoLb)} lb entre ${numCorto(pesoAveLb, 2)} lb que pesa ${arreglado ? 'arreglado ' : ''}cada pollo${
              diasDesdePeso != null && diasDesdePeso > 0
                ? `, por el pesaje de hace ${num(diasDesdePeso)} ${diasDesdePeso === 1 ? 'día' : 'días'}`
                : ', por el pesaje de hoy'
            }.`
          : 'Con un pesaje, la app también las saca por el peso, aunque no se cuenten.'}
      </p>
      {aviso === 'mas' && (
        <p className="mt-1 text-xs font-medium text-amber-text">
          Por el peso van unos {porCajaTexto} por caja, no {num(ppc)}: parece que las sobrecargaron.
          {elegida === 'cajas' && ' Si no los contaron, elige «por el peso».'}
        </p>
      )}
      {aviso === 'menos' && (
        <p className="mt-1 text-xs font-medium text-amber-text">
          Por el peso salen menos: puede que alguna caja fuera con menos pollos.
        </p>
      )}
      {elegida === 'mano' && <p className="mt-1 text-xs text-ink-faint">Escribiste las aves a mano.</p>}
    </div>
  )
}

function OpcionAves({
  activa,
  onClick,
  valor,
  nota,
}: {
  activa: boolean
  onClick: () => void
  valor: string
  nota: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={clsx(
        'min-h-14 rounded-xl border px-3 py-2 text-left transition',
        activa ? 'border-2 border-forest-500 bg-forest-50 text-ink' : 'border-line bg-paper-raised text-ink-soft',
      )}
    >
      <span className="block font-display text-lg font-semibold leading-tight tnum">{valor}</span>
      <span className="block text-xs text-ink-faint">{nota}</span>
    </button>
  )
}

/** Para abrir la pesada desde la hoja de venta. */
export function BotonPesada({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="col-span-2 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-borde px-4 py-3 text-left transition active:bg-paper-sunken"
    >
      <span>
        <span className="block text-sm font-semibold text-ink">Pesar por cajas</span>
        <span className="block text-xs text-ink-faint">Las cajas vacías y las llenas: la app resta</span>
      </span>
      <IconChevron width={18} height={18} aria-hidden className="shrink-0 text-ink-faint" />
    </button>
  )
}

function Agregar({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="-mx-2 mt-1 px-2 py-3 text-sm font-medium text-forest-600">
      {children}
    </button>
  )
}

function Quitar({ etiqueta, onClick }: { etiqueta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-ink-faint active:bg-paper-sunken"
    >
      <IconClose width={16} height={16} />
    </button>
  )
}
