import { useId } from 'react'
import { useIncubadoras } from '../lib/hooks'
import { Field, Input } from './ui'

// Lo del día que llegan los pollitos: de dónde vienen, cuánto pesan y cuántos
// vinieron muertos en las cajas. Con eso se juzga el arranque y se comparan las
// incubadoras entre ciclos.
export function DatosRecibo({
  incubadora,
  onIncubadora,
  pesoG,
  onPesoG,
  muertos,
  onMuertos,
  errorMuertos,
}: {
  incubadora: string
  onIncubadora: (v: string) => void
  pesoG: string
  onPesoG: (v: string) => void
  muertos: string
  onMuertos: (v: string) => void
  errorMuertos?: string
}) {
  const conocidas = useIncubadoras()
  const lista = useId()
  return (
    <div className="space-y-4 rounded-xl2 border border-line bg-paper-raised p-4">
      <div>
        <div className="font-display text-base font-semibold">El recibo</div>
        <p className="text-xs leading-relaxed text-ink-faint">
          Opcional. Con esto se juzga el arranque y se comparan las incubadoras.
        </p>
      </div>
      <Field label="Incubadora">
        <Input
          value={incubadora}
          onChange={(e) => onIncubadora(e.target.value)}
          placeholder="De dónde vienen los pollitos"
          list={conocidas.length ? lista : undefined}
          autoComplete="off"
        />
      </Field>
      {conocidas.length > 0 && (
        <datalist id={lista}>
          {conocidas.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Peso al llegar" hint="Promedio de 10 o 20, de varias cajas.">
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              value={pesoG}
              onChange={(e) => onPesoG(e.target.value)}
              placeholder="40"
              className="pr-9"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
              g
            </span>
          </div>
        </Field>
        <Field label="Llegaron muertos" hint="En las cajas, al abrirlas." error={errorMuertos}>
          <Input
            type="number"
            inputMode="numeric"
            value={muertos}
            onChange={(e) => onMuertos(e.target.value)}
            aria-invalid={!!errorMuertos}
          />
        </Field>
      </div>
    </div>
  )
}
