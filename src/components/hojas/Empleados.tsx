import { useEffect, useState } from 'react'
import { db, type CadaPago, type Gasto, type Lote } from '../../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from '../ui'
import { toast } from '../confirm'
import { money, num } from '../../lib/format'
import { CADA_PAGO, fraseDelPago, pagoEmpleados } from '../../lib/porPagar'
import { useEnvio } from '../useEnvio'

// Lo que se les paga a los empleados del ciclo. No es un gasto todavía: sirve
// para estimar lo que falta por pagarles hasta la venta. Lo que se les va
// pagando se anota como gasto de mano de obra, y se descuenta de aquí.
export function EmpleadosSheet({
  lote,
  gastos,
  diaVenta,
  aves,
  open,
  onClose,
}: {
  lote: Lote
  gastos: Gasto[]
  /** El día en que se piensa vender: hasta ahí se les paga. */
  diaVenta: number
  /** Las aves que van a salir del ciclo, para el pago por pollo. */
  aves: number
  open: boolean
  onClose: () => void
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [monto, setMonto] = useState('')
  const [cada, setCada] = useState<CadaPago>('semana')
  // Si ya había un pago al abrir: «Quitar» no desaparece mientras la hoja se cierra.
  const [habia, setHabia] = useState(false)

  useEffect(() => {
    if (!open) return
    setMonto(lote.empleados ? String(lote.empleados.monto) : '')
    setCada(lote.empleados?.cada ?? 'semana')
    setHabia(!!lote.empleados)
  }, [open, lote.empleados])

  const valor = Math.max(0, Number(monto) || 0)
  const calculo = pagoEmpleados({ monto: valor, cada }, gastos, { diaVenta, aves })

  async function guardar() {
    await db.lotes.update(lote.id, { empleados: { monto: valor, cada } })
    toast(`Empleados · ${money(valor)} ${fraseDelPago(cada)}`)
    onClose()
  }

  async function quitar() {
    await db.lotes.update(lote.id, { empleados: undefined })
    toast('Se quitó el pago de los empleados')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Pago de los empleados">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Para saber cuánto falta por pagarles hasta la venta. Si son varios, pon lo de todos
          juntos; si alguno atiende también otro ciclo, solo la parte de este.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Les pagas">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Cada cuánto">
            <Select value={cada} onChange={(e) => setCada(e.target.value as CadaPago)}>
              {CADA_PAGO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {calculo && (
          <div className="rounded-xl bg-paper-sunken px-4 py-3 text-sm leading-relaxed text-ink-soft tnum">
            {cada === 'ciclo'
              ? `Por la pollada son ${money(calculo.total)}.`
              : cada === 'ave'
                ? `Por ${num(aves)} pollos son ${money(calculo.total)}.`
                : `Hasta el día ${num(diaVenta)}, cuando se vende, son ${money(calculo.total)}.`}{' '}
            {calculo.anotado > 0 && `Ya anotaste ${money(calculo.anotado)} en mano de obra. `}
            <span className="font-semibold text-ink">Faltan {money(calculo.falta)}.</span>
          </div>
        )}
        <p className="text-xs leading-relaxed text-ink-faint">
          Lo que les vayas pagando, anótalo como gasto de mano de obra: se descuenta de lo que falta.
        </p>

        <Button
          block
          disabled={!(valor > 0) || ocupado}
          motivo={!(valor > 0) ? 'Falta cuánto les pagas.' : undefined}
          onClick={enviar(guardar)}
        >
          Guardar
        </Button>
        {habia && <DangerButton onClick={quitar}>Quitar el pago</DangerButton>}
      </div>
    </Sheet>
  )
}
