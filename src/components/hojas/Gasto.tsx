import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CategoriaGasto, type Gasto, type Lote } from '../../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { CATEGORIAS, categoriaLabel } from '../../lib/labels'
import { fecha as fechaCorta, hoyISO, money, num, porLb } from '../../lib/format'
import { LB_POR_QUINTAL } from '../../lib/standards'
import { errorFechaFutura } from '../../lib/lote'
import { useEnvio } from '../useEnvio'
import { deshacerTraspaso } from '../../db/traspaso'
import { aprenderPreciosAlimento } from '../../db/alimento'
import { FASES, faseDeNombre, nombreFase } from '../../lib/alimentos'
import type { FaseId } from '../../lib/standards'

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
  const { ocupado, enviar } = useEnvio(open)
  const [categoria, setCategoria] = useState<CategoriaGasto>('alimento')
  const [monto, setMonto] = useState('')
  const [quintales, setQuintales] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [descripcion, setDescripcion] = useState('')
  const [pagadoPor, setPagadoPor] = useState('')
  // El tipo de alimento sale del nombre mientras no se elija a mano.
  const [fase, setFase] = useState<FaseId>()
  const [faseTocada, setFaseTocada] = useState(false)
  // Los nombres que ya se usaron, para no escribirlos otra vez.
  const nombres = useLiveQuery(async () => {
    const compras = await db.gastos.where('categoria').equals('alimento').reverse().sortBy('fecha')
    const vistos = new Map<string, string>()
    for (const g of compras) {
      const n = g.descripcion?.trim()
      if (n && !g.traspaso && !vistos.has(n.toLowerCase())) vistos.set(n.toLowerCase(), n)
    }
    return [...vistos.values()].slice(0, 12)
  }, [])

  useEffect(() => {
    if (!open) return
    setCategoria(editar?.categoria ?? 'alimento')
    setMonto(editar ? String(editar.monto) : '')
    setQuintales(editar?.cantidadQq != null ? String(editar.cantidadQq) : '')
    setFecha(editar?.fecha ?? hoyISO())
    setDescripcion(editar?.descripcion ?? '')
    setPagadoPor(editar?.pagadoPor != null ? String(editar.pagadoPor) : '')
    setFase(editar?.fase)
    setFaseTocada(!!editar?.fase)
  }, [open, editar])

  const faseElegida = faseTocada ? fase : faseDeNombre(descripcion)

  const qq = Math.max(0, Number(quintales) || 0)
  const precioQq = qq > 0 && Number(monto) > 0 ? Number(monto) / qq : 0

  async function guardar() {
    const datos = {
      loteId: lote.id,
      categoria,
      monto: Number(monto) || 0,
      fecha,
      descripcion: descripcion.trim() || undefined,
      cantidadQq: categoria === 'alimento' && qq > 0 ? qq : undefined,
      fase: categoria === 'alimento' ? faseElegida : undefined,
      pagadoPor: pagadoPor !== '' ? Number(pagadoPor) : undefined,
    }
    if (editar) await db.gastos.update(editar.id, datos)
    else await db.gastos.add({ ...datos, creado: Date.now() })
    if (categoria === 'alimento') aprenderPreciosAlimento().catch(() => {})
    toast(`${categoriaLabel(categoria)} · ${money(datos.monto)}`)
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar gasto', confirmar: 'Eliminar', peligro: true }))) return
    await db.gastos.delete(editar!.id)
    onClose()
  }

  // El alimento que se pasó entre ciclos no se edita suelto: son dos gastos que
  // van juntos, y cambiar uno solo descuadraba los dos ciclos.
  async function deshacer() {
    const g = editar!
    const ok = await confirmar({
      titulo: 'Deshacer el traspaso',
      mensaje: `Se borra en los dos ciclos: ${num(Math.abs(g.cantidadQq ?? 0), 1)} qq por ${money(Math.abs(g.monto))}.`,
      confirmar: 'Deshacer',
      peligro: true,
    })
    if (!ok) return
    await deshacerTraspaso(g)
    onClose()
  }

  if (editar?.traspaso)
    return (
      <Sheet open={open} onClose={onClose} title="Alimento entre ciclos">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-soft tnum">
            {editar.descripcion}: {num(Math.abs(editar.cantidadQq ?? 0), 1)} qq por {money(Math.abs(editar.monto))}, el{' '}
            {fechaCorta(editar.fecha)}.{' '}
            {editar.monto < 0
              ? 'Este ciclo dejó de cargar con ese alimento.'
              : 'Entró a este ciclo como una compra.'}
          </p>
          <DangerButton onClick={deshacer}>Deshacer el traspaso</DangerButton>
        </div>
      </Sheet>
    )

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
        {categoria === 'alimento' && (
          <>
            <Field label="Nombre del alimento" hint="Como dice el saco. Con el nombre, la app sabe qué alimento das cada día.">
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej.: Mega Broiler Crecimiento"
                list="nombres-alimento"
                autoCapitalize="words"
              />
              <datalist id="nombres-alimento">
                {(nombres ?? []).map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Tipo de alimento</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de alimento">
                {FASES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={faseElegida === f}
                    onClick={() => {
                      setFase(f)
                      setFaseTocada(true)
                    }}
                    className={clsx(
                      'h-11 rounded-xl border px-3 text-sm font-semibold transition',
                      faseElegida === f
                        ? 'border-2 border-forest-500 bg-forest-50 text-ink'
                        : 'border-line bg-paper-raised text-ink-soft',
                    )}
                  >
                    {nombreFase(f)}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-xs text-ink-faint">
                {faseElegida
                  ? faseTocada
                    ? 'Los sacos se dan en este orden: se acaba uno y sigue el próximo.'
                    : 'Lo saqué del nombre. Si no es, toca el que es.'
                  : 'Toca cuál es: con eso las cuentas usan el precio de este alimento.'}
              </span>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
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

        {categoria === 'alimento' && (
          <Field
            label="Quintales comprados"
            hint={
              precioQq > 0
                ? `Te sale a ${money(precioQq)} el quintal · ${porLb(precioQq / LB_POR_QUINTAL)} la libra`
                : 'Con esto la app lleva la existencia y el precio real de tu alimento.'
            }
          >
            <Input
              type="number"
              inputMode="decimal"
              value={quintales}
              onChange={(e) => setQuintales(e.target.value)}
            />
          </Field>
        )}
        {categoria !== 'alimento' && (
          <Field label="Descripción">
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional"
            />
          </Field>
        )}
        {lote.socios && lote.socios.length >= 2 && (
          <Field label="¿Quién pagó?">
            <Select value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)}>
              <option value="">Común (según %)</option>
              {lote.socios.map((s, i) => (
                <option key={i} value={i}>
                  {s.nombre || `Socio ${i + 1}`}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Button
          block
          disabled={!(Number(monto) > 0) || ocupado || !!errorFechaFutura(fecha)}
          motivo={!(Number(monto) > 0) ? 'Falta el monto.' : undefined}
          onClick={enviar(guardar)}
        >
          {editar ? 'Guardar cambios' : 'Guardar gasto'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}
