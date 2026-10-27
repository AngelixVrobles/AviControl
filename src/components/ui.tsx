import { clsx } from 'clsx'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, SelectHTMLAttributes } from 'react'
import { IconChevron, IconClose } from './icons'
import { useArrastreHoja, usePresencia } from './usePresencia'
import { registrarHoja } from './hojasAbiertas'

// El papel es la superficie, no la tarjeta: una banda a sangre con filete
// arriba y abajo, como el renglón de una hoja de control impresa. Ya no hay
// sombra —lo que dice qué importa es el titular de la sección— y lo que sigue
// siendo caja es lo que de verdad se toca: las tarjetas de ciclo, los botones
// de acción, las hojas que suben desde abajo.
export function Banda({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx('-mx-5 border-y border-line bg-paper-raised', className)}>{children}</div>
  )
}

// El encabezado de la app: una regla, la etiqueta de la sección en versalitas
// y debajo la conclusión, no el nombre del gráfico. La hoja de control impresa
// que el avicultor ya conoce, no un dashboard.
export function Seccion({
  etiqueta,
  titulo,
  nota,
  accion,
  className,
  id,
}: {
  etiqueta: string
  titulo?: ReactNode
  nota?: ReactNode
  accion?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div id={id} className={clsx('border-t border-line pt-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
          {etiqueta}
        </span>
        {accion}
      </div>
      {titulo && (
        <h2 className="mt-1.5 font-display text-xl font-semibold leading-tight">{titulo}</h2>
      )}
      {nota && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{nota}</p>}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft'
  block?: boolean
  // Por qué está gris: un botón apagado que no dice qué falta deja al
  // productor tocándolo sin saber qué hacer.
  motivo?: string
}

export function Button({ variant = 'primary', block, className, children, motivo, ...rest }: BtnProps) {
  const boton = (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
        variant === 'primary' && 'bg-forest-600 text-paper-raised shadow-card hover:bg-forest-700',
        variant === 'soft' && 'bg-forest-50 text-forest-700 hover:bg-forest-100',
        variant === 'ghost' && 'text-ink-soft hover:bg-paper-sunken',
        block && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  )
  if (!motivo || !rest.disabled) return boton
  return (
    <>
      {boton}
      <p className="mt-1.5 text-center text-xs leading-relaxed text-ink-faint">{motivo}</p>
    </>
  )
}

export function DangerButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="w-full rounded-full py-3 text-center text-sm font-semibold text-clay-text transition active:bg-clay/10"
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string
  hint?: string
  // Lo que impide guardar: va en lugar de la ayuda y en otro color.
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-medium text-clay-text">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      )}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-borde bg-paper-raised px-4 py-3 text-ink outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100'

// ComponentProps y no InputHTMLAttributes: en React 19 el ref viaja como prop y
// así llega al <input> de verdad, que es lo que hace falta para devolverle el foco.
export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={clsx(inputBase, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...props} className={clsx(inputBase, 'appearance-none pr-10', props.className)} />
      <IconChevron
        width={18}
        height={18}
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-ink-faint"
      />
    </span>
  )
}

// Para elegir entre dos o tres cosas que se excluyen (sacos o libras, metros o
// pies, Plasson o niples). Alto de dedo, no de cursor: se usa con las manos
// sucias en el galpón.
export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambio,
  etiqueta,
  className,
}: {
  valor: T
  opciones: { id: T; label: string }[]
  onCambio: (v: T) => void
  etiqueta: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={clsx('flex shrink-0 rounded-full bg-paper-sunken p-0.5', className)}
    >
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onCambio(o.id)}
          aria-pressed={valor === o.id}
          className={clsx(
            'h-11 flex-1 rounded-full px-3.5 text-sm font-semibold transition',
            valor === o.id ? 'bg-paper-raised text-ink shadow-card' : 'text-ink-soft',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'engorde' | 'neutral' | 'ok' | 'bad'
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'engorde' && 'bg-forest-50 text-forest-700',
        tone === 'ok' && 'bg-forest-50 text-forest-600',
        tone === 'bad' && 'bg-clay/10 text-clay-text',
        tone === 'neutral' && 'bg-paper-sunken text-ink-soft',
      )}
    >
      {children}
    </span>
  )
}

// Lo que tarda la hoja en bajar al cerrarse.
const SALIDA_HOJA_MS = 240

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const { montado, saliendo } = usePresencia(open, SALIDA_HOJA_MS)
  const { dy, arrastrando, manejadores } = useArrastreHoja(open, onClose)

  // Mientras está abierta, el botón Atrás del teléfono la cierra.
  const cerrar = useRef(onClose)
  useEffect(() => {
    cerrar.current = onClose
  })
  useEffect(() => (open ? registrarHoja(cerrar) : undefined), [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!montado) return null

  // Portal: dentro de una pantalla con animate-rise, el transform residual
  // convertiría al contenedor en containing block del overlay fixed.
  // La que se está yendo ya no cuenta: sin esto, al pasar de una hoja a otra
  // había dos diálogos a la vez para el lector de pantalla.
  return createPortal(
    <div
      className={clsx('fixed inset-0 z-50 flex items-end justify-center', saliendo && 'pointer-events-none')}
      aria-hidden={saliendo || undefined}
      inert={saliendo || undefined}
    >
      <div
        className="animate-aparecer absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-200"
        style={saliendo ? { opacity: 0 } : undefined}
        onClick={onClose}
      />
      {/* La hoja tiene techo y su contenido corre por dentro: antes crecía
          hacia arriba sin límite, lo de arriba quedaba fuera de la pantalla
          y el gesto de bajar para alcanzarlo era el mismo que la cerraba.
          Ahora solo se arrastra desde el asa y el título. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-hoja sheet-max-h relative flex w-full max-w-md flex-col rounded-t-xl3 border-t border-line bg-paper shadow-pop"
        style={{
          transform: saliendo ? 'translateY(100%)' : dy > 0 ? `translateY(${dy}px)` : undefined,
          transition: arrastrando
            ? 'none'
            : saliendo
              ? `transform ${SALIDA_HOJA_MS}ms cubic-bezier(0.4, 0, 1, 1)`
              : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="shrink-0 touch-none px-5 pt-3" {...manejadores}>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="min-w-0 font-display text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-sunken text-ink-soft"
              aria-label="Cerrar"
            >
              <IconClose width={19} height={19} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Las pestañas de una pantalla: la marcada lleva el fondo claro, que se
// desliza de una a otra.
export function Pestanas<T extends string>({
  valor,
  opciones,
  onCambio,
  etiqueta,
  className,
}: {
  valor: T
  opciones: { id: T; label: string }[]
  onCambio: (v: T) => void
  etiqueta: string
  className?: string
}) {
  const n = opciones.length
  const i = Math.max(0, opciones.findIndex((o) => o.id === valor))
  return (
    <div role="tablist" aria-label={etiqueta} className={clsx('relative flex gap-1 rounded-full bg-paper-sunken p-1', className)}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-paper-raised shadow-card transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: `calc((100% - 0.5rem - ${n - 1} * 0.25rem) / ${n})`,
          transform: `translateX(calc(${i} * (100% + 0.25rem)))`,
        }}
      />
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === valor}
          onClick={() => onCambio(o.id)}
          className={clsx(
            'relative flex-1 rounded-full py-3 text-sm font-semibold transition-colors',
            o.id === valor ? 'text-ink' : 'text-ink-soft',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl2 border border-dashed border-line bg-paper-raised/60 px-6 py-12 text-center">
      <div
        aria-hidden
        className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-forest-50 text-forest-600"
      >
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-[26ch] text-sm text-ink-faint">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
