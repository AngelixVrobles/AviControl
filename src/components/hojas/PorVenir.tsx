import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { db, type CategoriaGasto, type GastoPorVenir, type Lote } from '../../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { CATEGORIAS } from '../../lib/labels'
import { hoyISO, money } from '../../lib/format'
import { useEnvio } from '../useEnvio'

// Los de cada ciclo, para tocarlos en vez de escribirlos.
const COMUNES: { concepto: string; categoria: CategoriaGasto }[] = [
  { concepto: 'Luz', categoria: 'energia' },
  { concepto: 'Gas', categoria: 'energia' },
  { concepto: 'Transporte', categoria: 'transporte' },
  { concepto: 'Medicina', categoria: 'medicina' },
  { concepto: 'Cama', categoria: 'cama' },
  { concepto: 'Fundas y hielo', categoria: 'arreglo' },
]

// El alimento que falta ya lo calcula la proyección y los pollitos ya se
// pagaron: ponerlos aquí los contaba dos veces.
const CATEGORIAS_POR_VENIR = CATEGORIAS.filter((c) => c.id !== 'alimento' && c.id !== 'aves')

// Un gasto que ya se sabe que viene antes de vender: la luz del mes, el camión
// que lleva el pollo, las fundas. Entra en la ganancia estimada hasta que se
// paga; con «Ya lo pagué» pasa a los gastos del ciclo y sale de aquí, para no
// contarlo dos veces.
export function PorVenirSheet({
  lote,
  indice,
  open,
  onClose,
}: {
  lote: Lote
  /** El que se corrige; sin él, uno nuevo. */
  indice?: number
  open: boolean
  onClose: () => void
}) {
  const { ocupado, enviar } = useEnvio(open)
  // El que se corrige queda fijo mientras la hoja está abierta y mientras se
  // cierra: al pagarlo o quitarlo, la lista se corre y en su lugar quedaba otro.
  const [editar, setEditar] = useState<GastoPorVenir>()
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaGasto>('otros')
  const lista = useRef(lote.gastosPorVenir)
  useEffect(() => {
    lista.current = lote.gastosPorVenir
  })

  useEffect(() => {
    if (!open) return
    const item = indice != null ? lista.current?.[indice] : undefined
    setEditar(item)
    setConcepto(item?.concepto ?? '')
    setMonto(item ? String(item.monto) : '')
    setCategoria(item?.categoria ?? 'otros')
  }, [open, indice])

  const valor = Math.max(0, Number(monto) || 0)
  const nombre = concepto.trim()
  const otros = (lote.gastosPorVenir ?? []).filter((_, i) => i !== indice)

  async function guardar() {
    const item = { concepto: nombre, monto: valor, categoria }
    const lista = [...(lote.gastosPorVenir ?? [])]
    if (editar && indice != null) lista[indice] = item
    else lista.push(item)
    await db.lotes.update(lote.id, { gastosPorVenir: lista })
    toast(`${nombre} · ${money(valor)} por pagar`)
    onClose()
  }

  async function pagado() {
    await db.transaction('rw', db.lotes, db.gastos, async () => {
      await db.gastos.add({
        loteId: lote.id,
        categoria,
        monto: valor,
        fecha: hoyISO(),
        descripcion: nombre,
        creado: Date.now(),
      })
      await db.lotes.update(lote.id, { gastosPorVenir: otros.length ? otros : undefined })
    })
    toast(`${nombre} pasó a los gastos · ${money(valor)}`)
    onClose()
  }

  async function quitar() {
    const ok = await confirmar({
      titulo: 'Quitar',
      mensaje: `${editar?.concepto ?? 'Este gasto'} ya no cuenta en la ganancia estimada.`,
      confirmar: 'Quitar',
      peligro: true,
    })
    if (!ok) return
    await db.lotes.update(lote.id, { gastosPorVenir: otros.length ? otros : undefined })
    onClose()
  }

  const motivo = !nombre ? 'Falta qué es.' : !(valor > 0) ? 'Falta cuánto es.' : undefined

  return (
    <Sheet open={open} onClose={onClose} title={editar ? editar.concepto : 'Un gasto que viene'}>
      <div className="space-y-4">
        {!editar && (
          <>
            <p className="text-sm leading-relaxed text-ink-soft">
              Lo que ya sabes que vas a pagar antes de vender. Entra en la ganancia estimada hasta que
              lo pagues.
            </p>
            <div role="group" aria-label="Los de siempre" className="flex flex-wrap gap-2">
              {COMUNES.map((c) => (
                <button
                  key={c.concepto}
                  type="button"
                  onClick={() => {
                    setConcepto(c.concepto)
                    setCategoria(c.categoria)
                  }}
                  aria-pressed={concepto === c.concepto}
                  className={clsx(
                    'h-11 rounded-full border px-4 text-sm font-semibold transition',
                    concepto === c.concepto
                      ? 'border-forest-400 bg-forest-50 text-forest-700'
                      : 'border-line bg-paper-raised text-ink-soft',
                  )}
                >
                  {c.concepto}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qué es">
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Luz, camión…" />
          </Field>
          <Field label="Cuánto">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Categoría" hint="La que tendrá cuando pase a los gastos.">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}>
            {CATEGORIAS_POR_VENIR.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Button block disabled={!!motivo || ocupado} motivo={motivo} onClick={enviar(guardar)}>
          {editar ? 'Guardar cambios' : 'Agregar'}
        </Button>
        {editar && (
          <>
            <Button block variant="soft" disabled={!!motivo || ocupado} onClick={enviar(pagado)}>
              Ya lo pagué: pasarlo a los gastos de hoy
            </Button>
            <DangerButton onClick={quitar}>Quitar</DangerButton>
          </>
        )}
      </div>
    </Sheet>
  )
}
