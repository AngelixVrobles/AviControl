import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { db, type CategoriaGasto, type Gasto, type Ingreso, type Lote, type Registro } from '../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from './ui'
import { CATEGORIAS } from '../lib/labels'
import { hoyISO } from '../lib/format'

export function RegistroSheet({
  lote,
  open,
  onClose,
  editar,
}: {
  lote: Lote
  open: boolean
  onClose: () => void
  editar?: Registro
}) {
  const engorde = lote.tipo === 'engorde'
  const [fecha, setFecha] = useState(hoyISO())
  const [mortalidad, setMortalidad] = useState('')
  const [descarte, setDescarte] = useState('')
  const [alimentoLb, setAlimentoLb] = useState('')
  const [peso, setPeso] = useState('')
  const [huevos, setHuevos] = useState('')
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (!open) return
    setFecha(editar?.fecha ?? hoyISO())
    setMortalidad(editar?.mortalidad ? String(editar.mortalidad) : '')
    setDescarte(editar?.descarte ? String(editar.descarte) : '')
    setAlimentoLb(editar?.alimentoLb ? String(editar.alimentoLb) : '')
    setPeso(editar?.pesoPromedio != null ? String(editar.pesoPromedio) : '')
    setHuevos(editar?.huevos != null ? String(editar.huevos) : '')
    setNota(editar?.nota ?? '')
  }, [open, editar])

  async function guardar() {
    const datos = {
      loteId: lote.id,
      fecha,
      mortalidad: Number(mortalidad) || 0,
      descarte: Number(descarte) || 0,
      alimentoLb: Number(alimentoLb) || 0,
      pesoPromedio: engorde && peso ? Number(peso) : undefined,
      huevos: !engorde && huevos ? Number(huevos) : undefined,
      nota: nota.trim() || undefined,
    }
    if (editar) await db.registros.update(editar.id, datos)
    else await db.registros.add({ ...datos, creado: Date.now() })
    onClose()
  }

  async function eliminar() {
    if (!confirm('¿Eliminar este registro?')) return
    await db.registros.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar registro' : 'Registro del día'}>
      <div className="space-y-4">
        <Field label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mortalidad (aves)">
            <Input
              type="number"
              inputMode="numeric"
              value={mortalidad}
              onChange={(e) => setMortalidad(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Descarte (aves)" hint="Aves retiradas del lote.">
            <Input
              type="number"
              inputMode="numeric"
              value={descarte}
              onChange={(e) => setDescarte(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Alimento (lb)">
          <Input
            type="number"
            inputMode="decimal"
            value={alimentoLb}
            onChange={(e) => setAlimentoLb(e.target.value)}
            placeholder="0"
          />
        </Field>
        {engorde ? (
          <Field label="Peso promedio (lb/ave)" hint="Muestrea unas aves y anota el promedio.">
            <Input
              type="number"
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="Ej. 4.2"
            />
          </Field>
        ) : (
          <Field label="Huevos recogidos">
            <Input
              type="number"
              inputMode="numeric"
              value={huevos}
              onChange={(e) => setHuevos(e.target.value)}
              placeholder="0"
            />
          </Field>
        )}
        <Field label="Nota">
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
        </Field>
        <Button block onClick={guardar}>
          {editar ? 'Guardar cambios' : 'Guardar registro'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}

export function GastoSheet({
  lote,
  open,
  onClose,
  editar,
}: {
  lote: Lote
  open: boolean
  onClose: () => void
  editar?: Gasto
}) {
  const [categoria, setCategoria] = useState<CategoriaGasto>('alimento')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    if (!open) return
    setCategoria(editar?.categoria ?? 'alimento')
    setMonto(editar ? String(editar.monto) : '')
    setFecha(editar?.fecha ?? hoyISO())
    setDescripcion(editar?.descripcion ?? '')
  }, [open, editar])

  async function guardar() {
    const datos = {
      loteId: lote.id,
      categoria,
      monto: Number(monto) || 0,
      fecha,
      descripcion: descripcion.trim() || undefined,
    }
    if (editar) await db.gastos.update(editar.id, datos)
    else await db.gastos.add({ ...datos, creado: Date.now() })
    onClose()
  }

  async function eliminar() {
    if (!confirm('¿Eliminar este gasto?')) return
    await db.gastos.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar gasto' : 'Registrar gasto'}>
      <div className="space-y-4">
        <Field label="Categoría">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <Input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>
        <Field label="Descripción">
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
          />
        </Field>
        <Button block disabled={!(Number(monto) > 0)} onClick={guardar}>
          {editar ? 'Guardar cambios' : 'Guardar gasto'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}

export function IngresoSheet({
  lote,
  open,
  onClose,
  editar,
}: {
  lote: Lote
  open: boolean
  onClose: () => void
  editar?: Ingreso
}) {
  const engorde = lote.tipo === 'engorde'
  const [tipoVenta, setTipoVenta] = useState<'huevos' | 'aves'>('huevos')
  const [cantidad, setCantidad] = useState('')
  const [pesoLb, setPesoLb] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())

  const tipo = engorde ? 'aves' : tipoVenta

  useEffect(() => {
    if (!open) return
    setTipoVenta(editar?.tipo === 'aves' ? 'aves' : 'huevos')
    setCantidad(editar ? String(editar.cantidad) : '')
    setPesoLb(editar?.pesoLb != null ? String(editar.pesoLb) : '')
    setMonto(editar ? String(editar.monto) : '')
    setFecha(editar?.fecha ?? hoyISO())
  }, [open, editar])

  async function guardar() {
    const datos = {
      loteId: lote.id,
      tipo,
      cantidad: Number(cantidad) || 0,
      pesoLb: engorde && pesoLb ? Number(pesoLb) : undefined,
      monto: Number(monto) || 0,
      fecha,
    }
    if (editar) await db.ingresos.update(editar.id, datos)
    else await db.ingresos.add({ ...datos, creado: Date.now() })
    onClose()
  }

  async function eliminar() {
    if (!confirm('¿Eliminar esta venta?')) return
    await db.ingresos.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editar ? 'Editar venta' : engorde ? 'Registrar venta de aves' : 'Registrar venta'}
    >
      <div className="space-y-4">
        {!engorde && (
          <div className="flex gap-1 rounded-full bg-paper-sunken p-1">
            {(['huevos', 'aves'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipoVenta(t)}
                className={clsx(
                  'flex-1 rounded-full py-2.5 text-sm font-semibold transition',
                  tipoVenta === t ? 'bg-paper-raised text-ink shadow-card' : 'text-ink-faint',
                )}
              >
                {t === 'huevos' ? 'Huevos' : 'Gallinas'}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={tipo === 'huevos' ? 'Nº de huevos' : engorde ? 'Nº de aves' : 'Nº de gallinas'}>
            <Input
              type="number"
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
            />
          </Field>
          {engorde && (
            <Field label="Peso total (lb)">
              <Input
                type="number"
                inputMode="decimal"
                value={pesoLb}
                onChange={(e) => setPesoLb(e.target.value)}
                placeholder="0"
              />
            </Field>
          )}
          <Field label="Monto recibido">
            <Input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>
        <Button block disabled={!(Number(monto) > 0)} onClick={guardar}>
          {editar ? 'Guardar cambios' : 'Guardar venta'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}

export function ActionButton({
  label,
  icon,
  onClick,
  tone = 'neutral',
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  tone?: 'neutral' | 'green' | 'amber'
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl2 border border-line bg-paper-raised py-3.5 shadow-card transition active:scale-95"
    >
      <span
        className={clsx(
          'grid h-10 w-10 place-items-center rounded-full',
          tone === 'green' && 'bg-forest-50 text-forest-600',
          tone === 'amber' && 'bg-amber-400/15 text-amber-600',
          tone === 'neutral' && 'bg-paper-sunken text-ink-soft',
        )}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-ink-soft">{label}</span>
    </button>
  )
}
