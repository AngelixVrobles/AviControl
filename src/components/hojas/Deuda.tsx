import { useEffect, useState } from 'react'
import { db, type Abono, type CategoriaDeuda, type Deuda, type Socio } from '../../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { CATEGORIAS_DEUDA } from '../../lib/deudas'
import { sociosParaGuardar } from '../../lib/sociedad'
import { hoyISO, money } from '../../lib/format'
import { errorFechaFutura } from '../../lib/lote'
import { EditorSocios } from '../Socios'
import { useEnvio } from '../useEnvio'

export function DeudaSheet({
  open,
  onClose,
  editar,
  sociosSugeridos,
}: {
  open: boolean
  onClose: () => void
  editar?: Deuda
  sociosSugeridos?: Socio[]
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaDeuda>('estructura')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [acreedor, setAcreedor] = useState('')
  const [enSociedad, setEnSociedad] = useState(false)
  const [socios, setSocios] = useState<Socio[]>([])

  useEffect(() => {
    if (!open) return
    setConcepto(editar?.concepto ?? '')
    setCategoria(editar?.categoria ?? 'estructura')
    setMonto(editar ? String(editar.monto) : '')
    setFecha(editar?.fecha ?? hoyISO())
    setAcreedor(editar?.acreedor ?? '')
    const base = editar?.socios ?? sociosSugeridos ?? [
      { nombre: 'Yo', pct: 50 },
      { nombre: 'Socio', pct: 50 },
    ]
    setEnSociedad((editar?.socios?.length ?? 0) >= 2 || (!editar && (sociosSugeridos?.length ?? 0) >= 2))
    setSocios(base.map((s) => ({ ...s })))
  }, [open, editar, sociosSugeridos])

  const valido = concepto.trim() !== '' && Number(monto) > 0

  async function guardar() {
    const datos = {
      concepto: concepto.trim(),
      categoria,
      monto: Number(monto) || 0,
      fecha,
      acreedor: acreedor.trim() || undefined,
      // Los abonos guardan quién pagó por su lugar en la lista: los socios que
      // ya estaban se quedan donde estaban.
      socios: enSociedad
        ? sociosParaGuardar(socios, undefined, editar?.socios?.length ?? 0).socios
        : undefined,
    }
    if (editar) await db.deudas.update(editar.id, datos)
    else await db.deudas.add({ ...datos, creado: Date.now() })
    toast(`${datos.concepto} · ${money(datos.monto)}`)
    onClose()
  }

  async function eliminar() {
    if (
      !(await confirmar({
        titulo: 'Eliminar deuda',
        mensaje: 'Se borran también los abonos que le anotaste.',
        confirmar: 'Eliminar',
        peligro: true,
      }))
    )
      return
    await db.transaction('rw', db.deudas, db.abonos, async () => {
      await db.abonos.where('deudaId').equals(editar!.id).delete()
      await db.deudas.delete(editar!.id)
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar deuda' : 'Nueva deuda'}>
      <div className="space-y-4">
        <Field label="Qué es" hint="Galpón 2, planta eléctrica, el terreno…">
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Galpón 2"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <Select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaDeuda)}
            >
              {CATEGORIAS_DEUDA.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cuánto se debe">
            <Input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde cuándo" error={errorFechaFutura(fecha)}>
            <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="A quién" hint="Opcional.">
            <Input
              value={acreedor}
              onChange={(e) => setAcreedor(e.target.value)}
              placeholder="Ferretería, banco…"
            />
          </Field>
        </div>

        <EditorSocios
          titulo="Es en sociedad"
          nota="Reparte lo que falta por pagar."
          activo={enSociedad}
          onActivo={setEnSociedad}
          socios={socios}
          onSocios={setSocios}
          fijas={editar?.socios?.length ?? 0}
        />

        <Button
          block
          disabled={!valido || ocupado || !!errorFechaFutura(fecha)}
          motivo={!valido ? 'Falta el concepto o el monto.' : undefined}
          onClick={enviar(guardar)}
        >
          {editar ? 'Guardar' : 'Agregar deuda'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar deuda</DangerButton>}
      </div>
    </Sheet>
  )
}

export function AbonoSheet({
  deuda,
  saldo,
  open,
  onClose,
  editar,
}: {
  deuda: Deuda
  saldo: number
  open: boolean
  onClose: () => void
  editar?: Abono
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [pagadoPor, setPagadoPor] = useState('')
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (!open) return
    setMonto(editar ? String(editar.monto) : '')
    setFecha(editar?.fecha ?? hoyISO())
    setPagadoPor(editar?.pagadoPor != null ? String(editar.pagadoPor) : '')
    setNota(editar?.nota ?? '')
  }, [open, editar])

  const valor = Number(monto) || 0
  const falta = saldo + (editar?.monto ?? 0)
  const quedaria = Math.max(0, falta - valor)
  const sobra = valor - falta

  async function guardar() {
    const datos = {
      deudaId: deuda.id,
      monto: valor,
      fecha,
      pagadoPor: pagadoPor !== '' ? Number(pagadoPor) : undefined,
      nota: nota.trim() || undefined,
    }
    if (editar) await db.abonos.update(editar.id, datos)
    else await db.abonos.add({ ...datos, creado: Date.now() })
    toast(
      quedaria > 0
        ? `Abonaste ${money(valor)} · quedan ${money(quedaria)}`
        : `${deuda.concepto} quedó saldada`,
    )
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar abono', confirmar: 'Eliminar', peligro: true }))) return
    await db.abonos.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar abono' : `Abonar a ${deuda.concepto}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuánto abonas" hint={`Faltan ${money(falta)}.`}>
            <Input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </Field>
          <Field label="Fecha" error={errorFechaFutura(fecha)}>
            <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>

        {(deuda.socios?.length ?? 0) >= 2 && (
          <Field label="¿Quién lo puso?">
            <Select value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)}>
              <option value="">De la caja común (según %)</option>
              {deuda.socios!.map((s, i) => (
                <option key={i} value={i}>
                  {s.nombre || `Socio ${i + 1}`}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Nota" hint="Opcional. De dónde salió, número de recibo…">
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Del ciclo de agosto" />
        </Field>

        {valor > 0 &&
          (sobra > 0 ? (
            <div className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
              Te pasas por {money(sobra)}: solo faltaban {money(falta)}. Revisa el monto.
            </div>
          ) : (
            <div className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-700">
              {quedaria > 0
                ? `Después de este abono quedan ${money(quedaria)} por pagar.`
                : 'Con este abono la deuda queda saldada.'}
            </div>
          ))}

        <Button
          block
          disabled={valor <= 0 || ocupado || !!errorFechaFutura(fecha)}
          motivo={valor <= 0 ? 'Falta el monto del abono.' : undefined}
          onClick={enviar(guardar)}
        >
          {editar ? 'Guardar' : 'Anotar abono'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar abono</DangerButton>}
      </div>
    </Sheet>
  )
}
