export function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl2 border border-dashed border-line bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-faint">
      {texto}
    </p>
  )
}
