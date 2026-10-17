import { clsx } from 'clsx'

export function ActionButton({
  label,
  icon,
  onClick,
  tone = 'neutral',
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  tone?: 'neutral' | 'green' | 'amber'
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl2 border border-line bg-paper-raised py-3.5 transition active:scale-95"
    >
      <span
        className={clsx(
          'grid h-10 w-10 place-items-center rounded-full',
          tone === 'green' && 'bg-forest-50 text-forest-600',
          tone === 'amber' && 'bg-amber-400/15 text-amber-600',
          tone === 'neutral' && 'bg-paper-sunken text-ink-soft',
        )}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-ink-soft">{label}</span>
    </button>
  )
}
