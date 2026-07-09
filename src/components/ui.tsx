import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { IconChevron, IconClose } from './icons'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx('rounded-xl2 border border-line bg-paper-raised shadow-card', className)}>
      {children}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft'
  block?: boolean
}

export function Button({ variant = 'primary', block, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
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
}

export function DangerButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="w-full rounded-full py-3 text-center text-sm font-semibold text-clay-deep transition active:bg-clay/10"
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-line bg-paper-raised px-4 py-3 text-ink outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
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

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'engorde' | 'ponedora' | 'neutral' | 'ok' | 'bad'
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'engorde' && 'bg-forest-50 text-forest-700',
        tone === 'ponedora' && 'bg-amber-400/15 text-amber-700',
        tone === 'ok' && 'bg-forest-50 text-forest-600',
        tone === 'bad' && 'bg-clay/10 text-clay-deep',
        tone === 'neutral' && 'bg-paper-sunken text-ink-soft',
      )}
    >
      {children}
    </span>
  )
}

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

  // Portal: dentro de una pantalla con animate-rise, el transform residual
  // convertiría al contenedor en containing block del overlay fixed.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-md rounded-t-xl3 border-t border-line bg-paper px-5 pb-8 pt-3 shadow-pop safe-b"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="grid h-11 w-11 place-items-center rounded-full bg-paper-sunken text-ink-soft"
                aria-label="Cerrar"
              >
                <IconClose width={19} height={19} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
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
