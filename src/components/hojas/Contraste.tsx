import { clsx } from 'clsx'
import { money, num, porLb } from '../../lib/format'
import type { Contraste } from '../../lib/cierre'

export function DatoCierre({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="font-display text-base font-semibold leading-none tnum">{valor}</div>
      <div className="mt-1 text-xs text-ink-faint">{label}</div>
    </div>
  )
}

const valorContraste = (v: number, f: Contraste['formato']) =>
  f === 'dinero' ? money(v, { compact: true }) : f === 'precio' ? porLb(v) : f === 'peso' ? `${num(v, 2)} lb` : num(v)

export function FilaContraste({ c }: { c: Contraste }) {
  const dif = c.proyectado !== 0 ? ((c.real - c.proyectado) / Math.abs(c.proyectado)) * 100 : 0
  const notable = Math.abs(dif) >= 2
  const buena = c.mejorSi === 'mayor' ? dif > 0 : c.mejorSi === 'menor' ? dif < 0 : undefined

  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-b-0 text-sm">
      <span className="min-w-0 text-ink-soft">
        {c.etiqueta}
        {notable && buena != null && (
          <span
            className={clsx(
              'ml-1.5 text-xs font-semibold tnum',
              buena ? 'text-forest-600' : 'text-clay-text',
            )}
          >
            {dif > 0 ? '▲' : '▼'} {num(Math.abs(dif), 0)}%
          </span>
        )}
      </span>
      <span className="flex shrink-0 gap-4 tnum">
        <span className="w-[82px] text-right text-ink-faint">{valorContraste(c.proyectado, c.formato)}</span>
        <span className="w-[82px] text-right font-display font-semibold">
          {valorContraste(c.real, c.formato)}
        </span>
      </span>
    </div>
  )
}
