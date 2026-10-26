import { clsx } from 'clsx'
import { money } from '../lib/format'
import { precioCorto } from '../lib/venta'
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
  pistaComprador,
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
  /** Lo que se sabe del comprador: el precio que se le puso la última vez. */
  pistaComprador?: string
}) {
  const dio = Number(adelanto) || 0
  return (
    <div className="space-y-4">
      <Field label="Comprador" hint={pistaComprador ?? 'Opcional. Con su nombre sabes a quién cobrarle.'}>
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

// Cómo salió el pollo de esta venta: en pie, al pollero, o arreglado, por
// libra limpia. Cambia qué libras se anotan y a qué precio.
export function ComoSalioElPollo({
  arreglado,
  onCambio,
}: {
  arreglado: boolean
  onCambio: (v: boolean) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">Cómo salió el pollo</span>
      <Segmentado
        etiqueta="Cómo salió el pollo"
        valor={arreglado ? 'arreglado' : 'pie'}
        opciones={[
          { id: 'pie', label: 'En pie' },
          { id: 'arreglado', label: 'Arreglado' },
        ]}
        onCambio={(v) => onCambio(v === 'arreglado')}
      />
    </div>
  )
}

// Los precios que se han usado, para tocarlos en vez de escribirlos: a cada
// quien se le vende a su precio, 55, 60, 65.
export function PreciosUsados({
  precios,
  actual,
  onElegir,
}: {
  precios: number[]
  actual: number
  onElegir: (p: number) => void
}) {
  if (!precios.length) return null
  return (
    <div role="group" aria-label="Precios que has usado" className="flex flex-wrap gap-2">
      {precios.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onElegir(p)}
          aria-pressed={p === actual}
          className={clsx(
            'h-11 min-w-[64px] rounded-full border px-3.5 text-sm font-semibold tnum transition',
            p === actual
              ? 'border-forest-400 bg-forest-50 text-forest-700'
              : 'border-line bg-paper-raised text-ink-soft',
          )}
        >
          {precioCorto(p)}
        </button>
      ))}
    </div>
  )
}
