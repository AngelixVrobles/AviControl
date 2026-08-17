import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  db,
  type CategoriaGasto,
  type Gasto,
  type Ingreso,
  type Lote,
  type Pesaje,
  type Registro,
} from '../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from './ui'
import { confirmar } from './confirm'
import { CATEGORIAS } from '../lib/labels'
import { diasEntre, hoyISO, money, num, pct, porLb } from '../lib/format'
import { PRECISION_OBJETIVO_PCT, analizarMuestra, faltanPorPesar, tamanoMuestra } from '../lib/muestreo'
import { LB_POR_QUINTAL, pesoEstandarLb } from '../lib/standards'
import { IconClose } from './icons'

export function RegistroSheet({
  lote,
  open,
  onClose,
  editar,
  registros = [],
}: {
  lote: Lote
  open: boolean
  onClose: () => void
  editar?: Registro
  registros?: Registro[]
}) {
  const [fecha, setFecha] = useState(hoyISO())
  const [mortalidad, setMortalidad] = useState(0)
  const [descarte, setDescarte] = useState(0)
  const [alimentoLb, setAlimentoLb] = useState('')
  const [feedOtro, setFeedOtro] = useState(false)
  const [peso, setPeso] = useState('')
  const [sinPesar, setSinPesar] = useState(false)
  const [nota, setNota] = useState('')
  const [masOpciones, setMasOpciones] = useState(false)

  const previos = useMemo(
    () =>
      registros
        .filter((r) => r.alimentoLb > 0 && r.id !== editar?.id)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [registros, editar],
  )
  const ayer = previos[0]?.alimentoLb
  const chips = useMemo(() => {
    if (!previos.length) return []
    const prom = previos.slice(0, 5).reduce((a, r) => a + r.alimentoLb, 0) / Math.min(5, previos.length)
    const raw = [ayer, Math.round(prom), Math.round(prom * 1.08)].filter((v): v is number => !!v)
    return [...new Set(raw)].slice(0, 3)
  }, [previos, ayer])

  const cargar = useCallback(
    (r?: Registro) => {
      setMortalidad(r?.mortalidad ?? 0)
      setDescarte(r?.descarte ?? 0)
      setAlimentoLb(r?.alimentoLb ? String(r.alimentoLb) : '')
      setFeedOtro(!!r?.alimentoLb && !chips.includes(r.alimentoLb))
      setPeso(r?.pesoPromedio != null ? String(r.pesoPromedio) : '')
      setSinPesar(!!r && r.pesoPromedio == null)
      setNota(r?.nota ?? '')
      setMasOpciones(!!r?.descarte || !!r?.nota)
    },
    [chips],
  )

  // Por referencia: la lista cambia con cada escritura en la base y no debe
  // recargar el formulario mientras la hoja está abierta.
  const registrosRef = useRef(registros)
  useEffect(() => {
    registrosRef.current = registros
  })

  // Un día no puede tener dos registros: si ya está anotado, la hoja lo trae y
  // lo corrige. Duplicarlo sumaba el alimento dos veces, y de ahí salían mal el
  // FCA, el costo por libra y la existencia del galpón.
  useEffect(() => {
    if (!open) return
    const f = editar?.fecha ?? hoyISO()
    setFecha(f)
    cargar(editar ?? registrosRef.current.find((r) => r.fecha === f))
  }, [open, editar, cargar])

  function cambiarFecha(f: string) {
    setFecha(f)
    cargar(registros.find((r) => r.fecha === f))
  }

  const dia = diasEntre(lote.fechaInicio, fecha)
  const existente = editar ?? registros.find((r) => r.fecha === fecha)

  async function guardar() {
    const datos = {
      loteId: lote.id,
      fecha,
      mortalidad,
      descarte,
      alimentoLb: Number(alimentoLb) || 0,
      pesoPromedio: !sinPesar && peso ? Number(peso) : undefined,
      nota: nota.trim() || undefined,
    }
    if (existente) await db.registros.update(existente.id, datos)
    else await db.registros.add({ ...datos, creado: Date.now() })
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar registro', mensaje: 'Se borrará este día del ciclo.', confirmar: 'Eliminar', peligro: true }))) return
    await db.registros.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar registro' : 'Registro del día'}>
      <div className="space-y-5">
        <Field
          label="Fecha"
          hint={existente && !editar ? 'Este día ya estaba anotado: lo estás corrigiendo.' : undefined}
        >
          <Input type="date" value={fecha} onChange={(e) => cambiarFecha(e.target.value)} />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Mortalidad (aves)</span>
          <Stepper value={mortalidad} onChange={setMortalidad} />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Alimento (lb)</span>
          <div className="flex flex-wrap gap-2">
            {chips.map((v) => {
              const activo = !feedOtro && Number(alimentoLb) === v
              return (
                <button
                  key={v}
                  onClick={() => {
                    setAlimentoLb(String(v))
                    setFeedOtro(false)
                  }}
                  className={clsx(
                    'h-[52px] flex-1 rounded-xl border px-2 text-center font-display text-lg font-semibold transition',
                    activo ? 'border-2 border-green-action bg-green-tint text-ink' : 'border-line bg-paper-raised text-ink-soft',
                  )}
                >
                  {num(v)}
                  {v === ayer && <span className="block text-[10px] font-sans font-medium text-ink-faint">ayer</span>}
                </button>
              )
            })}
            <button
              onClick={() => {
                setFeedOtro(true)
                if (chips.includes(Number(alimentoLb))) setAlimentoLb('')
              }}
              className={clsx(
                'h-[52px] flex-1 rounded-xl border px-2 text-center text-sm font-semibold transition',
                feedOtro ? 'border-2 border-green-action bg-green-tint text-ink' : 'border-line bg-paper-raised text-ink-soft',
              )}
            >
              Otro
            </button>
          </div>
          {(feedOtro || chips.length === 0) && (
            <Input
              type="number"
              inputMode="decimal"
              value={alimentoLb}
              onChange={(e) => setAlimentoLb(e.target.value)}
              placeholder="Libras de alimento"
              className="mt-2"
              autoFocus={feedOtro}
            />
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Peso promedio (lb/ave)</span>
          {sinPesar ? (
            <button
              onClick={() => setSinPesar(false)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-line bg-sunken text-sm font-semibold text-ink-soft"
            >
              Sin pesar hoy · tocar para anotar
            </button>
          ) : (
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="Ej. 4.2"
                className="h-14 flex-1"
              />
              <button
                onClick={() => {
                  setSinPesar(true)
                  setPeso('')
                }}
                className="h-14 shrink-0 rounded-xl border border-line bg-sunken px-4 text-sm font-semibold text-ink-soft"
              >
                Sin pesar
              </button>
            </div>
          )}
        </div>

        {masOpciones ? (
          <div className="space-y-4 border-t border-line pt-4">
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Descarte (aves)</span>
              <Stepper value={descarte} onChange={setDescarte} />
            </div>
            <Field label="Nota">
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
            </Field>
          </div>
        ) : (
          <button
            onClick={() => setMasOpciones(true)}
            className="text-sm font-medium text-forest-600"
          >
            Descarte y nota →
          </button>
        )}

        <Button block className="h-14" onClick={guardar}>
          {editar ? 'Guardar cambios' : `Guardar día ${dia}`}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-line bg-paper-raised font-display text-2xl font-semibold text-ink-soft transition active:scale-95 disabled:opacity-40"
        aria-label="Restar"
      >
        −
      </button>
      <div className="grid h-14 flex-1 place-items-center rounded-2xl bg-sunken font-display text-[26px] font-semibold tnum">
        {value}
      </div>
      <button
        onClick={() => onChange(value + 1)}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green-tint font-display text-2xl font-semibold text-forest-700 transition active:scale-95"
        aria-label="Sumar"
      >
        +
      </button>
    </div>
  )
}

export function PesajeSheet({
  lote,
  avesVivas,
  open,
  onClose,
  editar,
}: {
  lote: Lote
  avesVivas: number
  open: boolean
  onClose: () => void
  editar?: Pesaje
}) {
  const [fecha, setFecha] = useState(hoyISO())
  const [pesos, setPesos] = useState<number[]>([])
  const [entrada, setEntrada] = useState('')

  useEffect(() => {
    if (!open) return
    setFecha(editar?.fecha ?? hoyISO())
    setPesos(editar?.pesos ?? [])
    setEntrada('')
  }, [open, editar])

  const dia = diasEntre(lote.fechaInicio, fecha)
  const muestra = analizarMuestra(pesos, avesVivas)
  const sugeridas = tamanoMuestra(avesVivas)
  const faltan = muestra ? faltanPorPesar(muestra, avesVivas) : sugeridas
  const stdLb = pesoEstandarLb(dia)

  function agregar() {
    const v = Number(entrada.replace(',', '.'))
    if (!(v > 0)) return
    setPesos((p) => [...p, Math.round(v * 100) / 100])
    setEntrada('')
  }

  async function guardar() {
    if (!muestra) return
    const datos = { loteId: lote.id, fecha, pesos }
    if (editar) await db.pesajes.update(editar.id, datos)
    else await db.pesajes.add({ ...datos, creado: Date.now() })

    // El muestreo manda el peso del día: de ahí salen la curva, el FCA y la
    // proyección de venta.
    const pesoPromedio = Math.round(muestra.promedioLb * 100) / 100
    const registro = await db.registros
      .where('loteId')
      .equals(lote.id)
      .filter((r) => r.fecha === fecha)
      .first()
    if (registro) await db.registros.update(registro.id, { pesoPromedio })
    else
      await db.registros.add({
        loteId: lote.id,
        fecha,
        mortalidad: 0,
        descarte: 0,
        alimentoLb: 0,
        pesoPromedio,
        creado: Date.now(),
      })
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar pesaje', mensaje: 'El peso que quedó anotado en el día no se borra.', confirmar: 'Eliminar', peligro: true }))) return
    await db.pesajes.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar pesaje' : `Pesaje del día ${dia}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-green-tint px-4 py-3 text-[13px] leading-relaxed text-forest-darkest">
          Pesa <span className="font-semibold tnum">{num(sugeridas)}</span> aves al azar
          {avesVivas > 0 && (
            <span className="text-forest-700"> ({pct((sugeridas / avesVivas) * 100, 1)} del galpón)</span>
          )}{' '}
          para que el promedio valga para todas. Tómalas de esquinas distintas, no solo las que se
          dejan agarrar.
        </div>

        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') agregar()
            }}
            placeholder={`Peso del ave ${pesos.length + 1} (lb)`}
            className="h-14 flex-1 text-lg"
          />
          <button
            onClick={agregar}
            disabled={!(Number(entrada.replace(',', '.')) > 0)}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green-tint font-display text-2xl font-semibold text-forest-700 transition active:scale-95 disabled:opacity-40"
            aria-label="Añadir peso"
          >
            +
          </button>
        </div>

        {pesos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pesos.map((p, i) => (
              <button
                key={i}
                onClick={() => setPesos((prev) => prev.filter((_, j) => j !== i))}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-raised py-1.5 pl-3 pr-2 text-sm font-semibold tnum transition active:bg-paper-sunken"
              >
                {num(p, 2)}
                <IconClose width={14} height={14} className="text-ink-faint" />
              </button>
            ))}
          </div>
        )}

        {muestra && (
          <div className="rounded-xl2 border border-line bg-paper-raised p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-ink-faint">Promedio de {num(muestra.n)} aves</div>
                <div className="font-display text-[30px] font-semibold leading-none tnum">
                  {num(muestra.promedioLb, 2)} lb
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-faint">Margen de error</div>
                <div
                  className={clsx(
                    'font-display text-lg font-semibold leading-none tnum',
                    muestra.precision === 'alta'
                      ? 'text-forest-600'
                      : muestra.precision === 'media'
                        ? 'text-ink'
                        : 'text-clay-deep',
                  )}
                >
                  ± {num(muestra.margenLb, 2)} lb
                </div>
                <div className="mt-0.5 text-[11px] text-ink-faint tnum">±{pct(muestra.margenPct, 1)}</div>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  faltan === 0 ? 'bg-green-action' : 'bg-amber-400',
                )}
                style={{ width: `${Math.min(100, (muestra.n / Math.max(1, muestra.n + faltan)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-soft">
              {faltan === 0
                ? `Muestra suficiente: el promedio real del galpón está dentro de ±${PRECISION_OBJETIVO_PCT}%.`
                : `Pesa ${num(faltan)} aves más para bajar el margen a ±${PRECISION_OBJETIVO_PCT}%.`}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
              <Dato label="Uniformidad" valor={pct(muestra.uniformidadPct, 0)} nota={muestra.uniformidad} />
              <Dato label="Desparejo (CV)" valor={pct(muestra.cvPct, 1)} nota={`${num(muestra.minLb, 2)}–${num(muestra.maxLb, 2)} lb`} />
              <Dato
                label={`Cobb día ${dia}`}
                valor={pct((muestra.promedioLb / stdLb) * 100, 0)}
                nota={`ideal ${num(stdLb, 2)} lb`}
              />
            </div>

            {muestra.biomasaLb != null && (
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-[13px] text-ink-faint">Peso vivo del galpón</span>
                <span className="text-right">
                  <span className="font-display font-semibold tnum">{num(muestra.biomasaLb)} lb</span>
                  <span className="block text-[11px] text-ink-faint tnum">
                    entre {num(muestra.biomasaMinLb!)} y {num(muestra.biomasaMaxLb!)} lb
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        <Field label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>

        <Button block className="h-14" disabled={!muestra} onClick={guardar}>
          {editar ? 'Guardar cambios' : 'Guardar pesaje'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}

function Dato({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div>
      <div className="font-display text-[17px] font-semibold leading-none tnum">{valor}</div>
      <div className="mt-1 text-[11px] text-ink-faint">{label}</div>
      {nota && <div className="text-[11px] text-ink-soft tnum">{nota}</div>}
    </div>
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
  const [quintales, setQuintales] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [descripcion, setDescripcion] = useState('')
  const [pagadoPor, setPagadoPor] = useState('')

  useEffect(() => {
    if (!open) return
    setCategoria(editar?.categoria ?? 'alimento')
    setMonto(editar ? String(editar.monto) : '')
    setQuintales(editar?.cantidadQq != null ? String(editar.cantidadQq) : '')
    setFecha(editar?.fecha ?? hoyISO())
    setDescripcion(editar?.descripcion ?? '')
    setPagadoPor(editar?.pagadoPor != null ? String(editar.pagadoPor) : '')
  }, [open, editar])

  const qq = Number(quintales) || 0
  const precioQq = qq > 0 && Number(monto) > 0 ? Number(monto) / qq : 0

  async function guardar() {
    const datos = {
      loteId: lote.id,
      categoria,
      monto: Number(monto) || 0,
      fecha,
      descripcion: descripcion.trim() || undefined,
      cantidadQq: categoria === 'alimento' && qq > 0 ? qq : undefined,
      pagadoPor: pagadoPor !== '' ? Number(pagadoPor) : undefined,
    }
    if (editar) await db.gastos.update(editar.id, datos)
    else await db.gastos.add({ ...datos, creado: Date.now() })
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar gasto', confirmar: 'Eliminar', peligro: true }))) return
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
              placeholder="0"
            />
          </Field>
        )}
        <Field label="Descripción">
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
          />
        </Field>
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
  const [cantidad, setCantidad] = useState('')
  const [pesoLb, setPesoLb] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [recibidoPor, setRecibidoPor] = useState('')

  useEffect(() => {
    if (!open) return
    setCantidad(editar ? String(editar.cantidad) : '')
    setPesoLb(editar?.pesoLb != null ? String(editar.pesoLb) : '')
    setMonto(editar ? String(editar.monto) : '')
    setFecha(editar?.fecha ?? hoyISO())
    setRecibidoPor(editar?.recibidoPor != null ? String(editar.recibidoPor) : '')
  }, [open, editar])

  async function guardar() {
    const datos = {
      loteId: lote.id,
      tipo: 'aves' as const,
      cantidad: Number(cantidad) || 0,
      pesoLb: pesoLb ? Number(pesoLb) : undefined,
      monto: Number(monto) || 0,
      fecha,
      recibidoPor: recibidoPor !== '' ? Number(recibidoPor) : undefined,
    }
    if (editar) await db.ingresos.update(editar.id, datos)
    else await db.ingresos.add({ ...datos, creado: Date.now() })
    onClose()
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: 'Eliminar venta', confirmar: 'Eliminar', peligro: true }))) return
    await db.ingresos.delete(editar!.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar venta' : 'Registrar venta de aves'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nº de aves">
            <Input
              type="number"
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Peso total (lb)">
            <Input
              type="number"
              inputMode="decimal"
              value={pesoLb}
              onChange={(e) => setPesoLb(e.target.value)}
              placeholder="0"
            />
          </Field>
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
        {lote.socios && lote.socios.length >= 2 && (
          <Field label="¿Quién recibió el dinero?">
            <Select value={recibidoPor} onChange={(e) => setRecibidoPor(e.target.value)}>
              <option value="">Común (según %)</option>
              {lote.socios.map((s, i) => (
                <option key={i} value={i}>
                  {s.nombre || `Socio ${i + 1}`}
                </option>
              ))}
            </Select>
          </Field>
        )}
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
