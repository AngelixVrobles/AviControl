import { useEffect, useState } from 'react'
import { db, type Ingreso, type Lote } from '../../db/schema'
import { Button, Field, Input, Select, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { nombreSocio } from '../../lib/sociedad'
import { fecha as fechaCorta, hoyISO, money, numCorto } from '../../lib/format'
import { cobradoDe, nombreComprador, pendienteDe } from '../../lib/cobros'
import { precioCorto, precioDe } from '../../lib/venta'
import { errorFechaFutura } from '../../lib/lote'
import { IconClose } from '../icons'
import { useEnvio } from '../useEnvio'

// Un pago de una venta a crédito. Se llega desde la venta («Anotar un cobro»)
// o desde «Te deben»; trae lo que falta como monto, que es lo más común. Si la
// venta quedó mal —el precio era 65 y se puso 60—, `onCorregir` la abre.
export function CobroSheet({
  ingreso,
  lote,
  open,
  onClose,
  onCorregir,
}: {
  ingreso?: Ingreso
  lote?: Lote
  open: boolean
  onClose: () => void
  onCorregir?: () => void
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [recibidoPor, setRecibidoPor] = useState('')
  const [nota, setNota] = useState('')
  const pendiente = ingreso ? pendienteDe(ingreso) : 0

  useEffect(() => {
    if (!open) return
    // Vacío: lleno con todo lo que falta, un toque a «Guardar» saldaba la
    // venta aunque el comprador diera menos, y ese cobro ya no se podía quitar.
    setMonto('')
    setFecha(hoyISO())
    setRecibidoPor('')
    setNota('')
    // Lo que falta solo cambia al guardar un cobro, y entonces la hoja se cierra.
  }, [open, ingreso?.id, pendiente])

  if (!ingreso) return <Sheet open={open} onClose={onClose} title="Cobrar">{null}</Sheet>

  const valor = Number(monto) || 0
  const socios = lote?.socios && lote.socios.length >= 2 ? lote.socios : undefined
  const errorFecha =
    errorFechaFutura(fecha) ??
    (fecha < ingreso.fecha ? `Es antes de la venta (${fechaCorta(ingreso.fecha)}).` : undefined)
  const deMas = valor > pendiente + 0.5
  const quedaria = Math.max(0, pendiente - valor)
  const quien = nombreComprador(ingreso)
  const precio = precioDe(ingreso)

  async function guardar() {
    if (!ingreso) return false
    const cobro = {
      fecha,
      monto: valor,
      recibidoPor: recibidoPor !== '' ? Number(recibidoPor) : undefined,
      nota: nota.trim() || undefined,
    }
    await db.ingresos.update(ingreso.id, { cobros: [...(ingreso.cobros ?? []), cobro] })
    toast(quedaria >= 1 ? `Cobraste ${money(valor)} · faltan ${money(quedaria)}` : `${quien} ya pagó todo`)
    onClose()
  }

  async function quitar(i: number) {
    if (!ingreso) return
    const c = (ingreso.cobros ?? [])[i]
    if (
      !(await confirmar({
        titulo: 'Quitar cobro',
        mensaje: `Se quita el cobro de ${money(c.monto)} del ${fechaCorta(c.fecha)}.`,
        confirmar: 'Quitar',
        peligro: true,
      }))
    )
      return
    await db.ingresos.update(ingreso.id, {
      cobros: (ingreso.cobros ?? []).filter((_, j) => j !== i),
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Cobrar a ${quien}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-paper-sunken px-4 py-3 text-sm text-ink-soft tnum">
          <div>
            Venta del {fechaCorta(ingreso.fecha)}
            {lote ? ` · ${lote.nombre}` : ''} · {money(ingreso.monto)}
          </div>
          {ingreso.pesoLb != null && ingreso.pesoLb > 0 && precio != null && (
            <div>
              {numCorto(ingreso.pesoLb, 1)} lb{ingreso.arreglado ? ' arregladas' : ''} a {precioCorto(precio)}
            </div>
          )}
          <div className="mt-0.5 font-semibold text-ink">
            Cobrado {money(cobradoDe(ingreso))} · faltan {money(pendiente)}
          </div>
        </div>
        {onCorregir && (
          <button
            type="button"
            onClick={onCorregir}
            className="-mt-2 h-11 w-full rounded-xl text-sm font-semibold text-forest-600 active:bg-paper-sunken"
          >
            Corregir la venta: el precio, las libras o el total
          </button>
        )}

        {(ingreso.cobros ?? []).length > 0 && (
          <div className="divide-y divide-line rounded-xl border border-line">
            {(ingreso.cobros ?? []).map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1 pl-4 pr-1 text-sm tnum">
                <span className="text-ink-soft">
                  {fechaCorta(c.fecha)}
                  {socios && c.recibidoPor != null && socios[c.recibidoPor]
                    ? ` · ${nombreSocio(socios[c.recibidoPor], c.recibidoPor)}`
                    : ''}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold">{money(c.monto)}</span>
                  <button
                    type="button"
                    onClick={() => quitar(i)}
                    className="grid h-11 w-11 place-items-center rounded-full text-ink-faint active:bg-paper-sunken"
                    aria-label={`Quitar el cobro de ${money(c.monto)} del ${fechaCorta(c.fecha)}`}
                  >
                    <IconClose width={16} height={16} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {pendiente < 1 ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Esta venta ya está pagada. Si un cobro quedó mal anotado, quítalo con la x y anótalo de
            nuevo.
          </p>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Cuánto te dio"
            error={deMas ? `Solo faltan ${money(pendiente)}.` : undefined}
            hint={valor > 0 && !deMas ? (quedaria >= 1 ? `Quedarían ${money(quedaria)}.` : 'Con esto paga todo.') : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Fecha" error={errorFecha}>
            <Input
              type="date"
              value={fecha}
              min={ingreso.fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => setMonto(String(Math.round(pendiente * 100) / 100))}
          className="-mt-2 rounded-full border border-line bg-paper-raised px-3 py-2 text-sm font-medium text-ink-soft tnum"
        >
          Todo lo que falta: {money(pendiente)}
        </button>
        {socios && (
          <Field label="¿Quién lo recibió?">
            <Select value={recibidoPor} onChange={(e) => setRecibidoPor(e.target.value)}>
              <option value="">Común (según %)</option>
              {socios.map((s, i) => (
                <option key={i} value={i}>
                  {nombreSocio(s, i)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Nota">
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
        </Field>
        <Button
          block
          className="h-14"
          disabled={!(valor > 0) || deMas || !!errorFecha || ocupado}
          motivo={!(valor > 0) ? 'Falta cuánto te dio.' : undefined}
          onClick={enviar(guardar)}
        >
          Guardar cobro
        </Button>
        </>
        )}
      </div>
    </Sheet>
  )
}
