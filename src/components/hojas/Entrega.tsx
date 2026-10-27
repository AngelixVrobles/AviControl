import { useEffect, useState } from 'react'
import { db, type EntregaSocio, type Gasto, type Ingreso, type Lote } from '../../db/schema'
import { Button, DangerButton, Field, Input, Segmentado, Select, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { computeLiquidacion, fraseEntrega, nombreSocio } from '../../lib/sociedad'
import { hoyISO, money } from '../../lib/format'
import type { LoteMetrics } from '../../lib/metrics'
import { errorFechaFutura } from '../../lib/lote'
import { useEnvio } from '../useEnvio'

// Cuando un socio le da al otro lo que lleva de más. Sale propuesta con lo que
// pide la cuenta, pero se puede entregar por partes o corregir el monto.
export function EntregaSheet({
  lote,
  gastos,
  ingresos,
  metrics,
  entregas,
  open,
  onClose,
  editar,
  sugerida,
}: {
  lote: Lote
  gastos: Gasto[]
  ingresos: Ingreso[]
  metrics: LoteMetrics
  entregas: EntregaSocio[]
  open: boolean
  onClose: () => void
  editar?: EntregaSocio
  sugerida?: { de: number; a: number; monto: number }
}) {
  const { ocupado, enviar } = useEnvio(open)
  const socios = lote.socios ?? []
  const nombre = (i: number) => (socios[i] ? nombreSocio(socios[i], i) : `Socio ${i + 1}`)
  const [de, setDe] = useState(0)
  const [a, setA] = useState(1)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (!open) return
    const base = editar ?? sugerida
    setDe(base?.de ?? 0)
    setA(base?.a ?? 1)
    setMonto(base ? String(base.monto) : '')
    setFecha(editar?.fecha ?? hoyISO())
    setNota(editar?.nota ?? '')
  }, [open, editar, sugerida])

  // Nadie se entrega dinero a sí mismo: al elegir a uno, el otro lado salta.
  function elegir(lado: 'de' | 'a', i: number) {
    const otro = socios.findIndex((_, j) => j !== i)
    if (lado === 'de') {
      setDe(i)
      if (a === i) setA(otro)
    } else {
      setA(i)
      if (de === i) setDe(otro)
    }
  }

  const valor = Number(monto) || 0
  const otras = entregas.filter((e) => e.id !== editar?.id)
  const antes = computeLiquidacion(lote, gastos, ingresos, metrics, otras)
  const despues = computeLiquidacion(lote, gastos, ingresos, metrics, [
    ...otras,
    { id: -1, loteId: lote.id, fecha, de, a, monto: valor, creado: 0 },
  ])
  const pendiente = (l: typeof antes) => l?.traspasos.reduce((x, t) => x + t.monto, 0) ?? 0
  const faltaDespues = pendiente(despues)
  const alReves = valor > 0 && faltaDespues > pendiente(antes)
  const sePasa = despues?.traspasos.find((t) => t.deIdx === a && t.aIdx === de)
  const faltaba = antes?.traspasos.find((t) => t.deIdx === de && t.aIdx === a)?.monto ?? 0
  const acuerdo = antes?.acuerdo ?? 'según el acuerdo'
  const frase = (de: string, a: string, monto: number) => {
    const [x, y] = fraseEntrega(de, a)
    return `${x}${money(monto)}${y}`
  }

  async function guardar() {
    const datos = { loteId: lote.id, fecha, de, a, monto: valor, nota: nota.trim() || undefined }
    if (editar) await db.entregas.update(editar.id, datos)
    else await db.entregas.add({ ...datos, creado: Date.now() })
    toast(
      faltaDespues === 0
        ? 'Entrega anotada · quedan parejos'
        : `Entrega anotada · todavía faltan ${money(faltaDespues)}`,
    )
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar entrega', confirmar: 'Eliminar', peligro: true }))) return
    await db.entregas.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar entrega' : 'Entrega entre socios'}>
      <div className="space-y-4">
        {!editar && (
          <p className="text-sm leading-relaxed text-ink-soft">
            El dinero que un socio le da al otro para quedar {acuerdo}. No es gasto ni venta: la
            ganancia del ciclo no cambia, solo quién tiene qué.
          </p>
        )}

        {socios.length === 2 ? (
          <Field label="¿Quién le entrega a quién?">
            <Segmentado
              etiqueta="Quién le entrega a quién"
              valor={String(de)}
              opciones={[
                { id: '0', label: `${nombre(0)} → ${nombre(1)}` },
                { id: '1', label: `${nombre(1)} → ${nombre(0)}` },
              ]}
              onCambio={(v) => elegir('de', Number(v))}
              className="w-full"
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entrega">
              <Select value={de} onChange={(e) => elegir('de', Number(e.target.value))}>
                {socios.map((_, i) => (
                  <option key={i} value={i}>
                    {nombre(i)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Recibe">
              <Select value={a} onChange={(e) => elegir('a', Number(e.target.value))}>
                {socios.map((_, i) => (
                  <option key={i} value={i}>
                    {nombre(i)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuánto">
            <Input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="h-14 text-lg"
            />
          </Field>
          <Field label="Fecha" error={errorFechaFutura(fecha)}>
            <Input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className="h-14"
            />
          </Field>
        </div>

        <Field label="Nota" hint="Opcional. En efectivo, por transferencia…">
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Transferencia" />
        </Field>

        {valor > 0 &&
          despues &&
          (alReves ? (
            <div className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
              Así la cuenta se aleja en vez de acercarse: lo que falta pasaría de{' '}
              {money(pendiente(antes))} a {money(faltaDespues)}. ¿Quién le entrega a quién?
            </div>
          ) : sePasa ? (
            <div className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
              Te pasas por {money(sePasa.monto)}: solo faltaban {money(faltaba)}. Revisa el monto.
            </div>
          ) : faltaDespues === 0 ? (
            <div className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-700">
              Con esta entrega quedan parejos, {acuerdo}.
            </div>
          ) : despues.traspasos.length === 1 &&
            despues.traspasos[0].deIdx === de &&
            despues.traspasos[0].aIdx === a ? (
            <div className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-700">
              Después de esta entrega faltan {money(faltaDespues)} para quedar parejos.
            </div>
          ) : (
            <div className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-700">
              Después de esta entrega todavía:{' '}
              {despues.traspasos.map((t) => frase(t.de, t.a, t.monto)).join('; ')}.
            </div>
          ))}

        <Button
          block
          className="h-14"
          disabled={valor <= 0 || de === a || ocupado || !!errorFechaFutura(fecha)}
          motivo={
            valor <= 0
              ? 'Falta el monto.'
              : de === a
                ? 'Quien entrega y quien recibe no pueden ser el mismo.'
                : undefined
          }
          onClick={enviar(guardar)}
        >
          {editar ? 'Guardar' : 'Anotar entrega'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar entrega</DangerButton>}
      </div>
    </Sheet>
  )
}
