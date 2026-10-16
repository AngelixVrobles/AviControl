import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import type { Socio } from '../db/schema'
import { IconClose } from './icons'
import { Input } from './ui'

export function Interruptor({ activo }: { activo: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx('relative h-6 w-10 shrink-0 rounded-full transition', activo ? 'bg-forest-500' : 'bg-line')}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow-card transition-all',
          activo ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </span>
  )
}

// Los socios con su parte: el mismo editor al crear un ciclo, al corregirlo y
// al anotar una deuda. Las primeras `fijas` filas no se pueden quitar: ya hay
// gastos, ventas o abonos a su nombre por el lugar que ocupan en la lista, y
// quitar una corría a los demás.
export function EditorSocios({
  titulo,
  nota,
  activo,
  onActivo,
  socios,
  onSocios,
  fijas = 0,
  children,
}: {
  titulo: string
  nota: string
  activo: boolean
  onActivo: (v: boolean) => void
  socios: Socio[]
  onSocios: (s: Socio[]) => void
  fijas?: number
  children?: ReactNode
}) {
  const suma = socios.reduce((a, s) => a + (Number(s.pct) || 0), 0)
  const set = (i: number, patch: Partial<Socio>) =>
    onSocios(socios.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const sePuedeQuitar = (i: number) => socios.length > 2 && i >= fijas
  const hayQuitables = socios.some((_, i) => sePuedeQuitar(i))

  return (
    <div className="rounded-xl2 border border-line bg-paper-raised p-4">
      <button
        type="button"
        onClick={() => onActivo(!activo)}
        aria-pressed={activo}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="text-left">
          <div className="font-display text-base font-semibold">{titulo}</div>
          <div className="text-xs text-ink-faint">{nota}</div>
        </div>
        <Interruptor activo={activo} />
      </button>

      {activo && (
        <div className="mt-4 space-y-3">
          {socios.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={s.nombre}
                onChange={(e) => set(i, { nombre: e.target.value })}
                placeholder={`Socio ${i + 1}`}
                aria-label={`Nombre del socio ${i + 1}`}
                className="flex-1"
              />
              <div className="relative w-24 shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={String(s.pct)}
                  onChange={(e) => set(i, { pct: Number(e.target.value) || 0 })}
                  aria-label={`Parte del socio ${i + 1}, en %`}
                  className="pr-7 text-center"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  %
                </span>
              </div>
              {sePuedeQuitar(i) ? (
                <button
                  type="button"
                  onClick={() => onSocios(socios.filter((_, j) => j !== i))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-faint active:bg-paper-sunken"
                  aria-label={`Quitar socio ${i + 1}`}
                >
                  <IconClose width={18} height={18} />
                </button>
              ) : (
                hayQuitables && <span aria-hidden className="w-11 shrink-0" />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSocios([...socios, { nombre: '', pct: 0 }])}
              className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-forest-600"
            >
              + Agregar socio
            </button>
            <span className={clsx('text-xs tnum', suma === 100 ? 'text-ink-faint' : 'text-clay-deep')}>
              Suma {suma}%
            </span>
          </div>

          {children}
        </div>
      )}
    </div>
  )
}
