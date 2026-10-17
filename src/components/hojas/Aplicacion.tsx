import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { db, type Aplicacion, type Lote, type TipoAplicacion } from '../../db/schema'
import { Button, DangerButton, Field, Input, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { diasEntre, fecha as fechaCorta, hoyISO } from '../../lib/format'
import { errorFechaDelCiclo, topeDelCiclo } from '../../lib/lote'
import { retiroDe } from '../../lib/retiro'
import { useEnvio } from '../useEnvio'

const VIAS = ['Agua de bebida', 'Ocular', 'Spray', 'Inyectada', 'Oral', 'Alimento']
const TIPOS_APLICACION: { id: TipoAplicacion; label: string }[] = [
  { id: 'vacuna', label: 'Vacuna' },
  { id: 'medicina', label: 'Medicina' },
  { id: 'vitamina', label: 'Vitamina' },
]

export function AplicacionSheet({
  lote,
  open,
  onClose,
  editar,
  sugerencia,
  diaVenta,
}: {
  lote: Lote
  open: boolean
  onClose: () => void
  editar?: Aplicacion
  sugerencia?: { nombre: string; fecha: string }
  /** El día del ciclo en que se piensa vender, para decir si el retiro alcanza. */
  diaVenta?: number
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [tipo, setTipo] = useState<TipoAplicacion>('vacuna')
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [via, setVia] = useState('')
  const [dosis, setDosis] = useState('')
  const [nota, setNota] = useState('')
  const [diasTratamiento, setDiasTratamiento] = useState('')
  const [retiroDias, setRetiroDias] = useState('')

  useEffect(() => {
    if (!open) return
    setTipo(editar?.tipo ?? 'vacuna')
    setNombre(editar?.nombre ?? sugerencia?.nombre ?? '')
    setFecha(editar?.fecha ?? sugerencia?.fecha ?? hoyISO())
    setVia(editar?.via ?? '')
    setDosis(editar?.dosis ?? '')
    setNota(editar?.nota ?? '')
    setDiasTratamiento(editar?.diasTratamiento ? String(editar.diasTratamiento) : '')
    setRetiroDias(editar?.retiroDias ? String(editar.retiroDias) : '')
  }, [open, editar, sugerencia])

  const dia = diasEntre(lote.fechaInicio, fecha)
  const esMedicina = tipo === 'medicina'
  const nDias = Math.round(Number(diasTratamiento) || 0)
  const nRetiro = Math.round(Number(retiroDias) || 0)
  const retiro = esMedicina
    ? retiroDe({ id: 0, loteId: lote.id, fecha, tipo, nombre, diasTratamiento: nDias, retiroDias: nRetiro, creado: 0 })
    : undefined
  const diaLibre = retiro ? diasEntre(lote.fechaInicio, retiro.libreDesde) : undefined

  async function guardar() {
    const datos = {
      loteId: lote.id,
      fecha,
      tipo,
      nombre: nombre.trim(),
      via: via || undefined,
      dosis: dosis.trim() || undefined,
      diasTratamiento: esMedicina && nDias > 1 ? nDias : undefined,
      retiroDias: esMedicina && nRetiro > 0 ? nRetiro : undefined,
      nota: nota.trim() || undefined,
    }
    if (editar) await db.aplicaciones.update(editar.id, datos)
    else await db.aplicaciones.add({ ...datos, creado: Date.now() })
    toast(`${datos.nombre} anotada`)
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar aplicación', confirmar: 'Eliminar', peligro: true }))) return
    await db.aplicaciones.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar aplicación' : `Aplicación del día ${dia}`}>
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Qué aplicaste</span>
          <div className="flex gap-1 rounded-full bg-paper-sunken p-1">
            {TIPOS_APLICACION.map((t) => (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={clsx(
                  'flex-1 rounded-full py-2.5 text-sm font-semibold transition',
                  tipo === t.id ? 'bg-paper-raised text-ink shadow-card' : 'text-ink-faint',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Nombre" hint="Como viene en el frasco.">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Newcastle, Gumboro, enrofloxacina…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" error={errorFechaDelCiclo(fecha, lote)}>
            <Input
              type="date"
              value={fecha}
              min={lote.fechaInicio}
              max={topeDelCiclo(lote)}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          <Field label="Dosis" hint="Opcional.">
            <Input value={dosis} onChange={(e) => setDosis(e.target.value)} placeholder="1 gota, 1 cc…" />
          </Field>
        </div>

        {esMedicina && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Días que se da">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={diasTratamiento}
                  onChange={(e) => setDiasTratamiento(e.target.value)}
                  placeholder="1"
                />
              </Field>
              <Field label="Días de retiro">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={retiroDias}
                  onChange={(e) => setRetiroDias(e.target.value)}
                  placeholder="Ej. 7"
                />
              </Field>
            </div>
            <p
              className={clsx(
                'mt-1 text-xs leading-relaxed tnum',
                retiro && diaVenta != null && diaLibre! > diaVenta ? 'font-medium text-clay-text' : 'text-ink-faint',
              )}
            >
              {retiro
                ? `Se puede vender desde el ${fechaCorta(retiro.libreDesde)}, día ${diaLibre} del ciclo${
                    diaVenta != null && diaLibre! > diaVenta ? `: después del día ${diaVenta}, cuando llegan al peso.` : '.'
                  }`
                : 'El retiro viene en la etiqueta: los días que hay que esperar después de la última dosis para vender.'}
            </p>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Vía</span>
          <div className="flex flex-wrap gap-2">
            {VIAS.map((v) => (
              <button
                key={v}
                onClick={() => setVia(via === v ? '' : v)}
                className={clsx(
                  'rounded-full border px-3 py-2 text-sm font-medium transition',
                  via === v
                    ? 'border-2 border-forest-500 bg-forest-50 text-ink'
                    : 'border-line bg-paper-raised text-ink-soft',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <Field label="Nota">
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Lote del frasco, quién aplicó…" />
        </Field>

        <Button
          block
          className="h-14"
          disabled={!nombre.trim() || ocupado || !!errorFechaDelCiclo(fecha, lote)}
          motivo={!nombre.trim() ? 'Falta el nombre de lo que aplicaste.' : undefined}
          onClick={enviar(guardar)}
        >
          {editar ? 'Guardar cambios' : 'Anotar aplicación'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}
