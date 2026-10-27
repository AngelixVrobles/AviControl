import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { db, type Gasto, type Lote } from '../../db/schema'
import { Button, Field, Input, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { diasEntre, fecha as fechaCorta, hoyISO, num, numCorto } from '../../lib/format'
import { comprasAlimento } from '../../lib/precios'
import { LB_POR_QUINTAL } from '../../lib/standards'
import { errorFechaDelCiclo, topeDelCiclo } from '../../lib/lote'
import { IconClose } from '../icons'
import { useEnvio } from '../useEnvio'

// Contar los sacos que quedan es como se lleva el alimento en la mayoría de las
// granjas: nadie pesa lo que echa cada día, pero los sacos del almacén sí se
// cuentan. Con las compras anotadas en quintales, lo que falta es lo que se dio.
export function ConteoSheet({
  lote,
  gastos,
  open,
  onClose,
}: {
  lote: Lote
  gastos: Gasto[]
  open: boolean
  onClose: () => void
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [fecha, setFecha] = useState(hoyISO())
  const [quedan, setQuedan] = useState('')

  useEffect(() => {
    if (!open) return
    setFecha(hoyISO())
    setQuedan('')
  }, [open])

  const compras = comprasAlimento(gastos)
  const sinCantidad = compras.filter((g) => !g.cantidadQq).length
  const compradoQq = compras
    .filter((g) => g.fecha <= fecha)
    .reduce((a, g) => a + (g.cantidadQq ?? 0), 0)
  const qq = Number(quedan.replace(',', '.'))
  const valido = quedan.trim() !== '' && Number.isFinite(qq) && qq >= 0
  const dadoQq = compradoQq - qq
  const conteos = [...(lote.conteosAlimento ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const yaContado = conteos.some((c) => c.fecha === fecha)
  const errorFecha = errorFechaDelCiclo(fecha, lote)

  async function guardar() {
    const resto = (lote.conteosAlimento ?? []).filter((c) => c.fecha !== fecha)
    await db.lotes.update(lote.id, {
      conteosAlimento: [...resto, { fecha, qq: Math.round(qq * 100) / 100 }],
    })
    toast(
      dadoQq >= 0
        ? `Conteo guardado · se han dado ${numCorto(dadoQq, 1)} qq en el ciclo`
        : 'Conteo guardado · no cuadra con las compras',
    )
    onClose()
  }

  async function quitar(f: string) {
    if (!(await confirmar({ titulo: 'Quitar conteo', mensaje: `Se borra el conteo del ${fechaCorta(f)}.`, confirmar: 'Quitar', peligro: true }))) return
    await db.lotes.update(lote.id, {
      conteosAlimento: (lote.conteosAlimento ?? []).filter((c) => c.fecha !== f),
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Contar sacos">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Cuenta los sacos de alimento que quedan en el galpón y en el almacén. Los empezados cuentan
          por lo que tienen: medio saco es 0.5.
        </p>

        {compras.length === 0 ? (
          <p className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
            Primero anota las compras de alimento con sus quintales (Gasto → Alimento). Lo que
            compraste menos lo que queda es lo que se dio.
          </p>
        ) : sinCantidad > 0 ? (
          <p className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
            {sinCantidad === 1 ? 'Una compra' : `${num(sinCantidad)} compras`} de alimento no{' '}
            {sinCantidad === 1 ? 'tiene' : 'tienen'} los quintales anotados. El conteo se guarda,
            pero no cuenta hasta que los anotes en la ficha de Gastos.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sacos que quedan">
            <Input
              type="number"
              inputMode="decimal"
              value={quedan}
              onChange={(e) => setQuedan(e.target.value)}
              className="h-14 text-lg"
              autoFocus
            />
          </Field>
          <Field label="Fecha" error={errorFecha}>
            <Input
              type="date"
              value={fecha}
              min={lote.fechaInicio}
              max={topeDelCiclo(lote)}
              onChange={(e) => setFecha(e.target.value)}
              className="h-14"
            />
          </Field>
        </div>

        {valido && compras.length > 0 && !errorFecha && (
          <div
            className={clsx(
              'rounded-xl px-4 py-3 text-sm leading-relaxed',
              dadoQq >= 0 ? 'bg-forest-50 text-forest-700' : 'border-l-4 border-clay bg-clay-tint text-clay-text',
            )}
          >
            {dadoQq >= 0 ? (
              <>
                Compraste <span className="font-semibold tnum">{numCorto(compradoQq, 1)} qq</span>{' '}
                hasta ese día. Si quedan {numCorto(qq, 1)}, se han dado{' '}
                <span className="font-semibold tnum">{numCorto(dadoQq, 1)} qq</span> ({num(dadoQq * LB_POR_QUINTAL)} lb)
                desde que empezó el ciclo. Lo que no anotaste día por día se reparte con la curva
                de consumo.
              </>
            ) : (
              <>
                Quedan más sacos de los {numCorto(compradoQq, 1)} qq que anotaste como comprados
                hasta ese día. ¿Falta anotar una compra o le pusiste otra fecha?
              </>
            )}
          </div>
        )}

        <Button
          block
          className="h-14"
          disabled={!valido || !!errorFecha || ocupado}
          motivo={!valido ? 'Falta cuántos sacos quedan.' : undefined}
          onClick={enviar(guardar)}
        >
          {yaContado ? `Corregir el conteo del ${fechaCorta(fecha)}` : 'Guardar conteo'}
        </Button>

        {conteos.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-ink-soft">Conteos de este ciclo</div>
            <div className="divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-paper-raised">
              {conteos.map((c) => (
                <div key={c.fecha} className="flex items-center justify-between gap-3 py-1.5 pl-4 pr-1.5 text-sm">
                  <span>
                    {fechaCorta(c.fecha)}
                    <span className="ml-2 text-ink-faint tnum">día {diasEntre(lote.fechaInicio, c.fecha)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-display font-semibold tnum">
                      {numCorto(c.qq, 2)} qq
                    </span>
                    <button
                      onClick={() => quitar(c.fecha)}
                      className="grid h-11 w-11 place-items-center rounded-full text-ink-faint active:bg-paper-sunken"
                      aria-label={`Quitar el conteo del ${fechaCorta(c.fecha)}`}
                    >
                      <IconClose width={16} height={16} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
