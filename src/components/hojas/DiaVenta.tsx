import { useEffect, useState } from 'react'
import { db, type Lote } from '../../db/schema'
import { Button, Field, Input, Segmentado, Sheet } from '../ui'
import { toast } from '../confirm'
import { fecha, num, sumarDias } from '../../lib/format'
import { useSettings } from '../../lib/hooks'
import { errorDiaVenta, pesoObjetivoDe } from '../../lib/lote'
import { saveSettings } from '../../lib/settings'
import { Interruptor } from '../Socios'
import { useEnvio } from '../useEnvio'

// El día en que se piensa vender. Sin él, la app vende cuando lleguen al peso
// de venta; con él, la ganancia estimada, el alimento que falta y el pago de los
// empleados van hasta ese día. Cada quien vende a su edad: a los 35 días, a los
// 42, cuando el comprador los pide.
export function DiaVentaSheet({
  lote,
  diaHoy,
  open,
  onClose,
}: {
  lote: Lote
  diaHoy: number
  open: boolean
  onClose: () => void
}) {
  const settings = useSettings()
  const { ocupado, enviar } = useEnvio(open)
  const [fijo, setFijo] = useState(false)
  const [dia, setDia] = useState('')
  const [paraTodos, setParaTodos] = useState(false)

  useEffect(() => {
    if (!open) return
    const actual = lote.diaVenta ?? settings.diaVenta
    setFijo(actual != null && actual > 0)
    setDia(actual != null && actual > 0 ? String(actual) : '')
    setParaTodos(false)
  }, [open, lote.diaVenta, settings.diaVenta])

  const n = Number(dia) || 0
  const error = fijo && dia !== '' ? errorDiaVenta(n) : undefined
  const peso = pesoObjetivoDe(lote)

  async function guardar() {
    const valor = fijo && n > 0 ? n : undefined
    // Por peso, con un día en Ajustes, el ciclo guarda 0: así no toma el de Ajustes.
    const delCiclo = valor ?? (settings.diaVenta && !paraTodos ? 0 : undefined)
    await db.lotes.update(lote.id, { diaVenta: delCiclo })
    if (paraTodos) saveSettings({ diaVenta: valor })
    toast(valor ? `Se vende el día ${num(valor)}` : `Se vende cuando lleguen a ${num(peso, 1)} lb`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="¿Qué día vendes?">
      <div className="space-y-4">
        <Segmentado
          etiqueta="Cuándo se vende"
          valor={fijo ? 'dia' : 'peso'}
          opciones={[
            { id: 'peso', label: `Al llegar a ${num(peso, 1)} lb` },
            { id: 'dia', label: 'Un día fijo' },
          ]}
          onCambio={(v) => setFijo(v === 'dia')}
        />
        {fijo ? (
          <Field
            label="Día de venta"
            error={error}
            hint={
              n > 0 && !error
                ? `El ${fecha(sumarDias(lote.fechaInicio, n))}. Hoy es el día ${num(diaHoy)}.`
                : `Hoy es el día ${num(diaHoy)}.`
            }
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              placeholder="42"
              aria-invalid={!!error}
            />
          </Field>
        ) : (
          <p className="text-sm leading-relaxed text-ink-soft">
            El día sale de los pesajes: cuando las aves lleguen a {num(peso, 1)} lb. El peso de venta se
            cambia con el lápiz del ciclo.
          </p>
        )}
        <p className="text-sm leading-relaxed text-ink-soft">
          Hasta ese día se cuentan el alimento que falta, el pago de los empleados y la ganancia estimada.
        </p>
        <button
          type="button"
          onClick={() => setParaTodos((v) => !v)}
          aria-pressed={paraTodos}
          className="flex w-full items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 text-left"
        >
          <div className="text-sm">
            <div className="font-medium">Hacerlo igual en los ciclos nuevos</div>
            <div className="text-ink-faint">Queda en Ajustes; cada ciclo lo puede cambiar.</div>
          </div>
          <Interruptor activo={paraTodos} />
        </button>
        <Button
          block
          disabled={ocupado || !!error || (fijo && !(n > 0))}
          motivo={fijo && !(n > 0) ? 'Falta el día.' : undefined}
          onClick={enviar(guardar)}
        >
          Guardar
        </Button>
      </div>
    </Sheet>
  )
}
