import { money } from '../lib/format'
import { Field, Input, Segmentado } from './ui'

// A quién se le vendió y cómo pagó: el mismo bloque en «Venta» y en «Vender y
// cerrar». En el campo dominicano mucho pollo sale a crédito —el comprador se
// lo lleva y paga después—, y sin anotarlo la venta contaba como dinero en la
// mano.
export function DatosDePago({
  comprador,
  onComprador,
  credito,
  onCredito,
  adelanto,
  onAdelanto,
  total,
  conocidos,
  conAdelanto = true,
}: {
  comprador: string
  onComprador: (v: string) => void
  credito: boolean
  onCredito: (v: boolean) => void
  adelanto: string
  onAdelanto: (v: string) => void
  total: number
  conocidos: string[]
  // Al corregir una venta, los pagos se anotan aparte, en «Anotar un cobro».
  conAdelanto?: boolean
}) {
  const dio = Number(adelanto) || 0
  return (
    <div className="space-y-4">
      <Field label="Comprador" hint="Opcional. Con su nombre sabes a quién cobrarle.">
        <Input
          value={comprador}
          onChange={(e) => onComprador(e.target.value)}
          placeholder="¿A quién le vendiste?"
          list="compradores-conocidos"
          autoComplete="off"
        />
        <datalist id="compradores-conocidos">
          {conocidos.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Cómo pagó</span>
        <Segmentado
          etiqueta="Cómo pagó"
          valor={credito ? 'credito' : 'contado'}
          opciones={[
            { id: 'contado', label: 'Pagó todo' },
            { id: 'credito', label: 'A crédito' },
          ]}
          onCambio={(v) => onCredito(v === 'credito')}
        />
      </div>
      {credito && conAdelanto && (
        <Field
          label="Te dio hoy"
          hint={
            total > 0
              ? dio >= total
                ? 'Es todo: entonces pagó completo.'
                : `Quedan ${money(Math.max(0, total - dio))} por cobrar.`
              : 'Lo que te dio al llevarse el pollo, si te dio algo.'
          }
        >
          <Input
            type="number"
            inputMode="decimal"
            value={adelanto}
            onChange={(e) => onAdelanto(e.target.value)}
            placeholder="0"
          />
        </Field>
      )}
    </div>
  )
}
