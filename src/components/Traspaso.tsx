import { useEffect, useRef, useState } from 'react'
import type { Lote } from '../db/schema'
import { pasarAlimento } from '../db/traspaso'
import { Button, Field, Input, Select, Sheet } from './ui'
import { toast } from './confirm'
import { useEnvio } from './useEnvio'
import { fecha as fechaCorta, hoyISO, money, num } from '../lib/format'
import { errorFechaDelCiclo } from '../lib/lote'
import { esYo, mismosSocios, nombreSocio } from '../lib/sociedad'

// El alimento que sobró en el almacén al cerrar, al ciclo que sigue: con su
// costo, para que el que cierra no cargue con sacos que no se comió y el que
// sigue los tenga en su existencia.
export function TraspasoAlimentoSheet({
  lote,
  destinos,
  sobranQq,
  precioQq,
  open,
  onClose,
}: {
  lote: Lote
  /** Los ciclos que pueden recibirlo: los que están en curso. */
  destinos: Lote[]
  sobranQq: number
  precioQq?: number
  open: boolean
  onClose: () => void
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [destinoId, setDestinoId] = useState('')
  const [qq, setQq] = useState('')
  const [monto, setMonto] = useState('')
  const [montoTocado, setMontoTocado] = useState(false)
  const [fecha, setFecha] = useState(hoyISO())
  const [seLoQueda, setSeLoQueda] = useState('')
  const [loPone, setLoPone] = useState('')

  const destino = destinos.find((d) => String(d.id) === destinoId) ?? destinos[0]
  const sociosDesde = lote.socios && lote.socios.length >= 2 ? lote.socios : undefined
  const sociosHacia = destino?.socios && destino.socios.length >= 2 ? destino.socios : undefined
  const iguales = !destino || mismosSocios(lote.socios, destino.socios)

  // Por referencia: lo que llega de la base mientras la hoja está abierta no
  // vuelve a llenar lo que se está escribiendo.
  const datos = useRef({ sobranQq, destinos, cierre: lote.fechaCierre, lote, destino })
  useEffect(() => {
    datos.current = { sobranQq, destinos, cierre: lote.fechaCierre, lote, destino }
  })

  useEffect(() => {
    if (!open) return
    const { sobranQq, destinos, cierre } = datos.current
    setDestinoId('')
    setQq(sobranQq > 0 ? String(Math.round(sobranQq * 10) / 10) : '')
    setMonto('')
    setMontoTocado(false)
    // El día en que el otro ciclo los recibe: cuando llegaron sus pollitos, si
    // fue después del cierre de este; si no, hoy.
    const hoy = hoyISO()
    const primero = destinos[0]
    setFecha(primero && primero.fechaInicio > (cierre ?? hoy) ? primero.fechaInicio : hoy)
  }, [open])

  // De quién es el alimento cuando los socios no son los mismos. Si el ciclo
  // que lo recibe es tuyo solo, se lo queda «Yo»; si el que lo pasa era tuyo
  // solo, lo pone «Yo». Si no se sabe, todos según su parte.
  useEffect(() => {
    if (!open) return
    const { lote, destino } = datos.current
    const yo = (socios?: { nombre: string }[]) => socios?.findIndex((s) => esYo(s.nombre)) ?? -1
    const desdeYo = yo(lote.socios)
    const haciaYo = yo(destino?.socios)
    const sinSocios = (socios?: unknown[]) => !socios || socios.length < 2
    setSeLoQueda(sinSocios(destino?.socios) && desdeYo >= 0 ? String(desdeYo) : '')
    setLoPone(sinSocios(lote.socios) && haciaYo >= 0 ? String(haciaYo) : '')
  }, [open, destino?.id])

  const nQq = Math.max(0, Number(qq.replace(',', '.')) || 0)
  const montoAuto = precioQq ? Math.round(nQq * precioQq) : 0
  const total = montoTocado ? Math.max(0, Number(monto) || 0) : montoAuto
  // No se pasa más de lo que sobró: 50 qq que no existían le bajaban los
  // costos al ciclo cerrado y le daban una conversión de 1.04.
  const tope = Math.round(sobranQq * 10) / 10
  const errorQq = nQq > tope + 0.05 ? `Por las cuentas sobran ${num(tope, 1)} qq: no se puede pasar más.` : undefined
  // Pasa después del cierre: los sacos que sobraron se cuentan al cerrar.
  const errorFecha =
    lote.fechaCierre && fecha < lote.fechaCierre
      ? `Es antes del cierre de ${lote.nombre} (${fechaCorta(lote.fechaCierre)}).`
      : destino
        ? errorFechaDelCiclo(fecha, destino)
        : undefined
  const motivo = !destino
    ? 'No hay otro ciclo en curso.'
    : !(nQq > 0)
      ? 'Pon cuántos quintales pasan.'
      : (errorQq ?? (!(total > 0) ? 'Pon lo que valen.' : errorFecha))

  async function guardar() {
    await pasarAlimento({
      desde: lote,
      hacia: destino!,
      qq: nQq,
      monto: total,
      fecha,
      seLoQueda: !iguales && sociosDesde && seLoQueda !== '' ? Number(seLoQueda) : undefined,
      loPone: !iguales && sociosHacia && loPone !== '' ? Number(loPone) : undefined,
    })
    toast(`${num(nQq, 1)} qq pasaron a ${destino!.nombre}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Pasar el alimento que sobró">
      <div className="space-y-4">
        {destinos.length === 0 ? (
          <p className="rounded-xl bg-paper-sunken px-4 py-3 text-sm leading-relaxed text-ink-soft">
            Primero crea el ciclo que sigue. Después pasas el alimento desde aquí, con su costo.
          </p>
        ) : (
          <>
            <Field label="Al ciclo">
              <Select value={destino ? String(destino.id) : ''} onChange={(e) => setDestinoId(e.target.value)}>
                {destinos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre} · desde el {fechaCorta(d.fechaInicio)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Quintales"
                error={errorQq}
                hint={sobranQq > 0 ? `Por las cuentas sobran ${num(sobranQq, 1)}` : undefined}
              >
                <Input type="number" inputMode="decimal" min={0} value={qq} onChange={(e) => setQq(e.target.value)} placeholder="0" />
              </Field>
              <Field
                label="Lo que valen"
                hint={montoTocado ? 'Lo escribiste a mano' : precioQq ? `A ${money(precioQq)} el quintal` : 'Lo que pagaste por ellos'}
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={montoTocado ? monto : montoAuto ? String(montoAuto) : ''}
                  onChange={(e) => {
                    setMontoTocado(true)
                    setMonto(e.target.value)
                  }}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field label="Fecha" error={errorFecha}>
              <Input
                type="date"
                value={fecha}
                min={lote.fechaCierre}
                max={hoyISO()}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Field>
            {!iguales && (sociosDesde || sociosHacia) && (
              <div className="space-y-3 rounded-xl2 border border-line bg-paper-raised p-4">
                <p className="text-sm leading-relaxed text-ink-soft">
                  Los socios no son los mismos en los dos ciclos: di de quién es el alimento, para que la cuenta de
                  cada uno salga bien.
                </p>
                {sociosDesde && (
                  <Field label={`En ${lote.nombre}, ¿quién se queda con él?`}>
                    <Select value={seLoQueda} onChange={(e) => setSeLoQueda(e.target.value)}>
                      <option value="">Todos, según su parte</option>
                      {sociosDesde.map((s, i) => (
                        <option key={i} value={i}>
                          {nombreSocio(s, i)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {sociosHacia && destino && (
                  <Field label={`En ${destino.nombre}, ¿quién lo pone?`}>
                    <Select value={loPone} onChange={(e) => setLoPone(e.target.value)}>
                      <option value="">Todos, según su parte</option>
                      {sociosHacia.map((s, i) => (
                        <option key={i} value={i}>
                          {nombreSocio(s, i)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            )}
            <p className="text-sm leading-relaxed text-ink-soft">
              {lote.nombre} deja de cargar con {money(total)} y {destino?.nombre} los tiene en su almacén como una
              compra. Se deshace tocando el gasto en cualquiera de los dos.
            </p>
          </>
        )}
        <Button block disabled={!!motivo || ocupado} motivo={motivo} onClick={enviar(guardar)}>
          Pasar el alimento
        </Button>
      </div>
    </Sheet>
  )
}
