import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  db,
  type Abono,
  type Aplicacion,
  type CategoriaDeuda,
  type CategoriaGasto,
  type Deuda,
  type Gasto,
  type Ingreso,
  type Lote,
  type Pesaje,
  type Registro,
  type Socio,
  type TipoAplicacion,
} from '../db/schema'
import { Button, DangerButton, Field, Input, Segmentado, Select, Sheet } from './ui'
import { confirmar, toast } from './confirm'
import { CATEGORIAS, categoriaLabel } from '../lib/labels'
import { CATEGORIAS_DEUDA } from '../lib/deudas'
import { diasEntre, fecha as fechaCorta, hoyISO, money, num, numCorto, pct, plural, porLb } from '../lib/format'
import { comprasAlimento } from '../lib/precios'
import { useSettings } from '../lib/hooks'
import { saveSettings } from '../lib/settings'
import { borrarBorrador, guardarBorrador, leerBorrador, pesoSospechoso } from '../lib/borrador'
import type { LoteMetrics } from '../lib/metrics'
import { proyectarVenta } from '../lib/proyeccion'
import { construirContrastes, snapshotCierre, type Contraste, type RealCiclo } from '../lib/cierre'
import { aguaEsperadaL } from '../lib/agua'
import { PRECISION_OBJETIVO_PCT, analizarMuestra, faltanPorPesar, tamanoMuestra } from '../lib/muestreo'
import { LB_POR_QUINTAL, PESO_OBJETIVO_DEFAULT, pesoEstandarLb } from '../lib/standards'
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
  const { unidadAlimento: unidad } = useSettings()
  const [fecha, setFecha] = useState(hoyISO())
  const [mortalidad, setMortalidad] = useState(0)
  const [descarte, setDescarte] = useState(0)
  // En la unidad que el productor eligió (sacos o libras); al guardar pasa a lb.
  const [alimento, setAlimento] = useState('')
  const [aguaL, setAguaL] = useState('')
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
  const ayer = previos.length ? enUnidad(previos[0].alimentoLb, unidad) : undefined
  const chips = useMemo(() => {
    if (!previos.length) return []
    const prom = previos.slice(0, 5).reduce((a, r) => a + r.alimentoLb, 0) / Math.min(5, previos.length)
    const raw = [ayer, redondearChip(prom, unidad), redondearChip(prom * 1.08, unidad)].filter(
      (v): v is number => !!v && v > 0,
    )
    return [...new Set(raw)].slice(0, 3)
  }, [previos, ayer, unidad])

  // Por referencia: la lista y los chips cambian con cada escritura en la base
  // y no deben recargar el formulario mientras la hoja está abierta.
  const registrosRef = useRef(registros)
  const chipsRef = useRef(chips)
  const unidadRef = useRef(unidad)
  useEffect(() => {
    registrosRef.current = registros
    chipsRef.current = chips
    unidadRef.current = unidad
  })

  const cargar = useCallback((r?: Registro) => {
    const valor = r?.alimentoLb ? enUnidad(r.alimentoLb, unidadRef.current) : undefined
    setMortalidad(r?.mortalidad ?? 0)
    setDescarte(r?.descarte ?? 0)
    setAlimento(valor != null ? String(valor) : '')
    setAguaL(r?.aguaL ? String(r.aguaL) : '')
    setFeedOtro(valor != null && !chipsRef.current.includes(valor))
    setPeso(r?.pesoPromedio != null ? String(r.pesoPromedio) : '')
    setSinPesar(!!r && r.pesoPromedio == null)
    setNota(r?.nota ?? '')
    setMasOpciones(!!r?.descarte || !!r?.nota)
  }, [])

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

  // Cambiar de unidad no borra lo escrito: 2.5 sacos pasan a ser 250 lb.
  function cambiarUnidad(nueva: 'qq' | 'lb') {
    if (nueva === unidad) return
    const lb = aLibras(alimento, unidad)
    if (lb > 0) {
      setAlimento(String(enUnidad(lb, nueva)))
      setFeedOtro(true)
    }
    saveSettings({ unidadAlimento: nueva })
  }

  const dia = diasEntre(lote.fechaInicio, fecha)
  const existente = editar ?? registros.find((r) => r.fecha === fecha)
  const alimentoLb = aLibras(alimento, unidad)
  const esperadaL = aguaEsperadaL(alimentoLb)
  const litros = Number(aguaL.replace(',', '.')) || 0
  const desvioAgua = litros > 0 && esperadaL > 0 ? ((litros - esperadaL) / esperadaL) * 100 : undefined

  async function guardar() {
    const datos = {
      loteId: lote.id,
      fecha,
      mortalidad,
      descarte,
      alimentoLb,
      aguaL: Number(aguaL.replace(',', '.')) > 0 ? Number(aguaL.replace(',', '.')) : undefined,
      pesoPromedio: !sinPesar && Number(peso.replace(',', '.')) > 0 ? Number(peso.replace(',', '.')) : undefined,
      nota: nota.trim() || undefined,
    }
    if (existente) await db.registros.update(existente.id, datos)
    else await db.registros.add({ ...datos, creado: Date.now() })
    toast(existente ? `Día ${dia} corregido` : `Día ${dia} anotado`)
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
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Mortalidad (aves)</span>
          <Stepper value={mortalidad} onChange={setMortalidad} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink-soft">Alimento que se dio</span>
            <Segmentado
              etiqueta="Unidad del alimento"
              valor={unidad}
              onCambio={cambiarUnidad}
              opciones={[
                { id: 'qq', label: 'Sacos' },
                { id: 'lb', label: 'Libras' },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((v) => {
              const activo = !feedOtro && Number(alimento) === v
              return (
                <button
                  key={v}
                  onClick={() => {
                    setAlimento(String(v))
                    setFeedOtro(false)
                  }}
                  className={clsx(
                    'h-[52px] flex-1 rounded-xl border px-2 text-center font-display text-lg font-semibold transition',
                    activo ? 'border-2 border-forest-500 bg-forest-50 text-ink' : 'border-line bg-paper-raised text-ink-soft',
                  )}
                >
                  {numCorto(v)}
                  {v === ayer && <span className="block text-xs font-sans font-medium text-ink-faint">ayer</span>}
                </button>
              )
            })}
            {chips.length > 0 && (
              <button
                onClick={() => {
                  setFeedOtro(true)
                  if (chips.includes(Number(alimento))) setAlimento('')
                }}
                className={clsx(
                  'h-[52px] flex-1 rounded-xl border px-2 text-center text-sm font-semibold transition',
                  feedOtro ? 'border-2 border-forest-500 bg-forest-50 text-ink' : 'border-line bg-paper-raised text-ink-soft',
                )}
              >
                Otro
              </button>
            )}
          </div>
          {(feedOtro || chips.length === 0) && (
            <Input
              type="number"
              inputMode="decimal"
              value={alimento}
              onChange={(e) => setAlimento(e.target.value)}
              placeholder={unidad === 'qq' ? 'Sacos de 100 lb (ej. 2.5)' : 'Libras de alimento'}
              className={clsx(chips.length > 0 && 'mt-2')}
              autoFocus={feedOtro}
            />
          )}
          <p className="mt-1 text-xs text-ink-faint tnum">
            {alimentoLb > 0
              ? unidad === 'qq'
                ? `${num(alimentoLb)} lb. Con esto salen la conversión y el consumo por fase.`
                : `${numCorto(alimentoLb / LB_POR_QUINTAL)} sacos de 100 lb. Con esto salen la conversión y el consumo por fase.`
              : 'Sin esto no hay conversión (FCA). Si no lo mides cada día, cuenta los sacos que quedan en la ficha de Alimento.'}
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Agua (litros)</span>
          <Input
            type="number"
            inputMode="decimal"
            value={aguaL}
            onChange={(e) => setAguaL(e.target.value)}
            placeholder={esperadaL > 0 ? `Lo normal hoy: ${num(esperadaL)} L` : 'Litros del día'}
            className="h-14"
          />
          {aguaL && esperadaL > 0 && (
            <p
              className={clsx(
                'mt-1 text-xs',
                desvioAgua != null && Math.abs(desvioAgua) >= 20 ? 'text-clay-text' : 'text-ink-faint',
              )}
            >
              {desvioAgua != null && Math.abs(desvioAgua) >= 20
                ? `${desvioAgua > 0 ? 'Bastante más' : 'Bastante menos'} de lo normal para ${num(alimentoLb)} lb de alimento (${num(esperadaL)} L).`
                : `Para ${num(alimentoLb)} lb de alimento lo normal son ${num(esperadaL)} L.`}
            </p>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Peso promedio (lb/ave)</span>
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
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Descarte (aves)</span>
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

// Libras a la unidad del productor, con dos decimales como mucho: 1.8 sacos.
function enUnidad(lb: number, unidad: 'qq' | 'lb') {
  const v = unidad === 'qq' ? lb / LB_POR_QUINTAL : lb
  return Math.round(v * 100) / 100
}

function aLibras(texto: string, unidad: 'qq' | 'lb') {
  const v = Number(texto.replace(',', '.'))
  if (!(v > 0) || !Number.isFinite(v)) return 0
  return Math.round((unidad === 'qq' ? v * LB_POR_QUINTAL : v) * 10) / 10
}

// Los chips sugeridos van en pasos que se puedan dar: medio saco cuando ya se
// dan varios, décimas cuando el pollito come menos de dos sacos, libras enteras.
function redondearChip(lb: number, unidad: 'qq' | 'lb') {
  if (unidad === 'lb') return Math.round(lb)
  const sacos = lb / LB_POR_QUINTAL
  return sacos >= 2 ? Math.round(sacos * 2) / 2 : Math.round(sacos * 10) / 10
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
      <div className="grid h-14 flex-1 place-items-center rounded-2xl bg-sunken font-display text-2xl font-semibold tnum">
        {value}
      </div>
      <button
        onClick={() => onChange(value + 1)}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest-50 font-display text-2xl font-semibold text-forest-700 transition active:scale-95"
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
  const [recuperados, setRecuperados] = useState(0)
  const entradaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const borrador = leerBorrador(lote.id, editar?.id)
    setFecha(borrador?.fecha ?? editar?.fecha ?? hoyISO())
    setPesos(borrador?.pesos ?? editar?.pesos ?? [])
    setRecuperados(borrador?.pesos.length ?? 0)
    setEntrada('')
  }, [open, editar, lote.id])

  const dia = diasEntre(lote.fechaInicio, fecha)
  const muestra = analizarMuestra(pesos, avesVivas)
  const sugeridas = tamanoMuestra(avesVivas)
  const faltan = muestra ? faltanPorPesar(muestra, avesVivas) : sugeridas
  const stdLb = pesoEstandarLb(dia)
  const valorEntrada = Number(entrada.replace(',', '.'))

  // Cada cambio queda en el teléfono en el mismo momento: si la hoja se cierra
  // con 42 aves pesadas, al abrirla otra vez siguen ahí.
  function cambiar(nuevos: number[], nuevaFecha = fecha) {
    setPesos(nuevos)
    setFecha(nuevaFecha)
    guardarBorrador(lote.id, editar?.id, { fecha: nuevaFecha, pesos: nuevos })
  }

  function agregar() {
    if (!(valorEntrada > 0)) return
    cambiar([...pesos, Math.round(valorEntrada * 100) / 100])
    setEntrada('')
    entradaRef.current?.focus()
  }

  function cerrar() {
    if (pesos.length > 0 && !(editar && mismosPesos(editar.pesos, pesos) && editar.fecha === fecha))
      toast(`Los ${num(pesos.length)} pesos quedan guardados: al abrir el pesaje siguen ahí`)
    onClose()
  }

  async function guardar() {
    if (!muestra) return
    const datos = { loteId: lote.id, fecha, pesos }
    if (editar) await db.pesajes.update(editar.id, datos)
    else await db.pesajes.add({ ...datos, creado: Date.now() })
    borrarBorrador(lote.id, editar?.id)
    toast(`${num(muestra.n)} aves pesadas · promedio ${num(muestra.promedioLb, 2)} lb`)

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
    borrarBorrador(lote.id, editar!.id)
    onClose()
  }

  const ultimo = pesos.length ? pesos[pesos.length - 1] : undefined

  return (
    <Sheet open={open} onClose={cerrar} title={editar ? 'Editar pesaje' : `Pesaje del día ${dia}`}>
      <div className="space-y-4">
        {recuperados > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm text-amber-text">
            <span className="min-w-0">
              Recuperé {num(recuperados)} {plural(recuperados, 'peso', 'pesos')} que no se habían
              guardado.
            </span>
            <button
              onClick={() => {
                cambiar([], editar?.fecha ?? hoyISO())
                setRecuperados(0)
              }}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Empezar de cero
            </button>
          </div>
        )}

        {pesos.length === 0 && (
          <div className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-800">
            Pesa <span className="font-semibold tnum">{num(sugeridas)}</span> aves al azar
            {avesVivas > 0 && (
              <span className="text-forest-700"> ({pct((sugeridas / avesVivas) * 100, 1)} del galpón)</span>
            )}{' '}
            para que el promedio valga para todas. Tómalas de esquinas distintas, no solo las que se
            dejan agarrar.
          </div>
        )}

        {/* Fija arriba mientras la lista crece: el + nunca se va de la pantalla. */}
        <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-paper px-5 pb-3 pt-1">
          <div className="flex gap-2">
            <Input
              ref={entradaRef}
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') agregar()
              }}
              placeholder={`Peso del ave ${pesos.length + 1} (lb)`}
              aria-label={`Peso del ave ${pesos.length + 1} en libras`}
              className="h-14 flex-1 text-lg"
            />
            <button
              onClick={agregar}
              // Que el botón no se robe el foco: así el teclado no se cierra entre
              // un ave y la siguiente.
              onMouseDown={(e) => e.preventDefault()}
              disabled={!(valorEntrada > 0)}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest-600 font-display text-2xl font-semibold text-paper-raised transition active:scale-95 disabled:bg-forest-50 disabled:text-forest-700 disabled:opacity-60"
              aria-label="Añadir peso"
            >
              +
            </button>
          </div>
          <div className="mt-2 flex min-h-[1.75rem] items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-soft tnum">
              {muestra ? (
                <>
                  <span className="font-semibold text-ink">{num(muestra.n)}</span>{' '}
                  {plural(muestra.n, 'ave', 'aves')} · prom.{' '}
                  <span className="font-semibold text-ink">{num(muestra.promedioLb, 2)} lb</span>
                  {faltan === 0 ? ' · ✓ basta' : ` · faltan ${num(faltan)}`}
                </>
              ) : (
                'Escribe el peso y toca +'
              )}
            </span>
            {ultimo != null && (
              <button
                onClick={() => cambiar(pesos.slice(0, -1))}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={`Deshacer el último peso, ${num(ultimo, 2)} libras`}
                className="-mr-2 shrink-0 rounded-full px-2 py-1 text-sm font-semibold text-forest-600 active:bg-paper-sunken"
              >
                Deshacer
              </button>
            )}
          </div>
        </div>

        {pesos.length > 0 && (
          <div>
            <div className="flex flex-wrap gap-2">
              {pesos
                .map((p, i) => ({ p, i }))
                .reverse()
                .map(({ p, i }) => {
                  const raro = pesoSospechoso(p, pesos)
                  return (
                    <button
                      key={i}
                      onClick={() => cambiar(pesos.filter((_, j) => j !== i))}
                      aria-label={`Quitar el ave ${i + 1}: ${num(p, 2)} libras${raro ? ', se sale de lo normal' : ''}`}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-2 text-sm font-semibold tnum transition active:bg-paper-sunken',
                        raro
                          ? 'border-clay-line bg-clay-tint text-clay-text'
                          : i === pesos.length - 1
                            ? 'border-forest-400 bg-forest-50'
                            : 'border-line bg-paper-raised',
                      )}
                    >
                      {num(p, 2)}
                      <IconClose width={14} height={14} className="text-ink-faint" />
                    </button>
                  )
                })}
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              El último va primero. Toca uno para quitarlo
              {pesos.some((p) => pesoSospechoso(p, pesos))
                ? '; los marcados en rojo se salen mucho del resto, revisa si fue un error al escribir.'
                : '.'}
            </p>
          </div>
        )}

        {muestra && (
          <div className="rounded-xl2 border border-line bg-paper-raised p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-ink-faint">Promedio de {num(muestra.n)} aves</div>
                <div className="font-display text-2xl font-semibold leading-none tnum">
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
                <div className="mt-0.5 text-xs text-ink-faint tnum">±{pct(muestra.margenPct, 1)}</div>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  faltan === 0 ? 'bg-forest-500' : 'bg-amber-400',
                )}
                style={{ width: `${Math.min(100, (muestra.n / Math.max(1, muestra.n + faltan)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-soft">
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
                <span className="text-sm text-ink-faint">Peso vivo del galpón</span>
                <span className="text-right">
                  <span className="font-display font-semibold tnum">{num(muestra.biomasaLb)} lb</span>
                  <span className="block text-xs text-ink-faint tnum">
                    entre {num(muestra.biomasaMinLb!)} y {num(muestra.biomasaMaxLb!)} lb
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        <Field label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => cambiar(pesos, e.target.value)} />
        </Field>

        <Button block className="h-14" disabled={!muestra} onClick={guardar}>
          {editar ? 'Guardar cambios' : 'Guardar pesaje'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}

const mismosPesos = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

function Dato({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold leading-none tnum">{valor}</div>
      <div className="mt-1 text-xs text-ink-faint">{label}</div>
      {nota && <div className="text-xs text-ink-soft tnum">{nota}</div>}
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
    toast(`${categoriaLabel(categoria)} · ${money(datos.monto)}`)
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
    toast(`Venta anotada · ${money(datos.monto)}`)
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

export function CierreSheet({
  lote,
  metrics,
  registros,
  gastos,
  open,
  onClose,
}: {
  lote: Lote
  metrics: LoteMetrics
  registros: Registro[]
  gastos: Gasto[]
  open: boolean
  onClose: () => void
}) {
  const [paso, setPaso] = useState(1)
  const [aves, setAves] = useState('')
  const [pesoTotal, setPesoTotal] = useState('')
  const [precio, setPrecio] = useState('')
  const [monto, setMonto] = useState('')
  const [montoTocado, setMontoTocado] = useState(false)
  const [fecha, setFecha] = useState(hoyISO())
  const [recibidoPor, setRecibidoPor] = useState('')

  useEffect(() => {
    if (!open) return
    setPaso(1)
    setAves(String(metrics.avesVivas))
    setPesoTotal('')
    setPrecio(lote.precioVentaLb ? String(lote.precioVentaLb) : '')
    setMonto('')
    setMontoTocado(false)
    setFecha(hoyISO())
    setRecibidoPor('')
  }, [open, metrics.avesVivas, lote.precioVentaLb])

  const nAves = Number(aves) || 0
  const lbTotal = Number(pesoTotal) || 0
  const precioLb = Number(precio) || 0
  const montoFinal = montoTocado ? Number(monto) || 0 : Math.round(lbTotal * precioLb)
  const pesoPorAve = nAves > 0 && lbTotal > 0 ? lbTotal / nAves : undefined
  const parcial = nAves > 0 && nAves < metrics.avesVivas
  const dia = diasEntre(lote.fechaInicio, fecha)

  const proyeccion = proyectarVenta(
    lote,
    registros,
    gastos,
    metrics,
    lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT,
  )
  const snap = snapshotCierre(metrics, proyeccion, dia)

  const ingresoTotal = metrics.ingresos + montoFinal
  const ganancia = ingresoTotal - metrics.costos
  const real: RealCiclo = {
    diaVenta: dia,
    avesVendidas: nAves,
    lbVendidas: lbTotal,
    pesoPromedioLb: pesoPorAve,
    precioLogradoLb: lbTotal > 0 ? montoFinal / lbTotal : undefined,
    ingreso: montoFinal,
    ganancia,
    margenPct: ingresoTotal > 0 ? (ganancia / ingresoTotal) * 100 : 0,
    costoPorLb: lbTotal > 0 ? metrics.costos / lbTotal : undefined,
    gananciaPorAve: nAves > 0 ? ganancia / nAves : 0,
  }
  const contrastes = construirContrastes(snap, real)
  const listo = nAves > 0 && montoFinal > 0

  async function guardar() {
    await db.transaction('rw', db.ingresos, db.lotes, async () => {
      await db.ingresos.add({
        loteId: lote.id,
        tipo: 'aves',
        cantidad: nAves,
        pesoLb: lbTotal || undefined,
        monto: montoFinal,
        fecha,
        recibidoPor: recibidoPor !== '' ? Number(recibidoPor) : undefined,
        creado: Date.now(),
      })
      if (!parcial) {
        await db.lotes.update(lote.id, { estado: 'cerrado', fechaCierre: fecha, cierre: snap })
      }
    })
    toast(parcial ? `${num(nAves)} aves vendidas` : `Ciclo cerrado · ${money(ganancia)}`)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={paso === 1 ? 'Vender y cerrar' : parcial ? 'Confirmar la venta' : 'Cómo salió el ciclo'}
    >
      {paso === 1 ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            Anota lo que salió del galpón. Con esto el ciclo queda cerrado y el reporte se llena
            solo.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Aves vendidas" hint={`Tienes ${num(metrics.avesVivas)} vivas`}>
              <Input
                type="number"
                inputMode="numeric"
                value={aves}
                onChange={(e) => setAves(e.target.value)}
                className="h-14 text-lg"
              />
            </Field>
            <Field label="Peso total (lb)" hint="El del camión">
              <Input
                type="number"
                inputMode="decimal"
                value={pesoTotal}
                onChange={(e) => setPesoTotal(e.target.value)}
                placeholder="0"
                className="h-14 text-lg"
              />
            </Field>
          </div>

          {pesoPorAve != null && (
            <div className="flex items-center justify-between rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-800">
              <span>Peso por ave</span>
              <span className="tnum">
                <span className="font-display text-base font-semibold">{num(pesoPorAve, 2)} lb</span>
                {snap.pesoProyectadoLb != null && (
                  <span className="text-forest-700">
                    {' '}
                    · la app estimaba {num(snap.pesoProyectadoLb, 2)}
                  </span>
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio por libra">
              <Input
                type="number"
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Fecha de venta">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
          </div>

          <Field
            label="Monto recibido"
            hint={montoTocado ? 'Lo escribiste a mano' : 'Sale del peso por el precio; puedes corregirlo'}
          >
            <Input
              type="number"
              inputMode="decimal"
              value={montoTocado ? monto : montoFinal ? String(montoFinal) : ''}
              onChange={(e) => {
                setMontoTocado(true)
                setMonto(e.target.value)
              }}
              placeholder="0"
              className="h-14 text-lg"
            />
          </Field>

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

          {parcial && (
            <p className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
              Quedan {num(metrics.avesVivas - nAves)} aves en el galpón, así que el ciclo sigue
              abierto. Ciérralo cuando salga el resto.
            </p>
          )}

          <Button block className="h-14" disabled={!listo} onClick={() => setPaso(2)}>
            Ver el resultado
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl2 border border-line bg-paper-raised p-4">
            <div className="text-xs text-ink-faint">{ganancia >= 0 ? 'Ganancia' : 'Pérdida'}</div>
            <div
              className={clsx(
                'font-display text-3xl font-semibold leading-none tnum',
                ganancia >= 0 ? 'text-forest-600' : 'text-clay-deep',
              )}
            >
              {money(ganancia)}
            </div>
            <div className="mt-1.5 text-sm text-ink-soft tnum">
              {money(real.gananciaPorAve)} por ave · margen {pct(real.margenPct)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
              <DatoCierre label="Vendiste" valor={`${num(nAves)} aves`} />
              <DatoCierre label="En pie" valor={`${num(lbTotal)} lb`} />
              <DatoCierre
                label="Costo / lb"
                valor={real.costoPorLb != null ? porLb(real.costoPorLb) : '—'}
              />
            </div>
          </div>

          {contrastes.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium text-ink-soft">
                Lo que decía la app contra lo que pasó
              </div>
              <div className="overflow-hidden rounded-xl2 border border-line bg-paper-raised">
                <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs uppercase tracking-wide text-ink-faint">
                  <span>Indicador</span>
                  <span className="flex gap-4">
                    <span className="w-[82px] text-right">Decía</span>
                    <span className="w-[82px] text-right">Real</span>
                  </span>
                </div>
                {contrastes.map((c) => (
                  <FilaContraste key={c.etiqueta} c={c} />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="soft" className="flex-1" onClick={() => setPaso(1)}>
              Atrás
            </Button>
            <Button className="h-14 flex-[2]" onClick={guardar}>
              {parcial ? 'Guardar venta' : 'Cerrar ciclo'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function DatoCierre({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="font-display text-base font-semibold leading-none tnum">{valor}</div>
      <div className="mt-1 text-xs text-ink-faint">{label}</div>
    </div>
  )
}

const valorContraste = (v: number, f: Contraste['formato']) =>
  f === 'dinero' ? money(v, { compact: true }) : f === 'precio' ? porLb(v) : f === 'peso' ? `${num(v, 2)} lb` : num(v)

function FilaContraste({ c }: { c: Contraste }) {
  const dif = c.proyectado !== 0 ? ((c.real - c.proyectado) / Math.abs(c.proyectado)) * 100 : 0
  const notable = Math.abs(dif) >= 2
  const buena = c.mejorSi === 'mayor' ? dif > 0 : c.mejorSi === 'menor' ? dif < 0 : undefined

  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-b-0 text-sm">
      <span className="min-w-0 text-ink-soft">
        {c.etiqueta}
        {notable && buena != null && (
          <span
            className={clsx(
              'ml-1.5 text-xs font-semibold tnum',
              buena ? 'text-forest-600' : 'text-clay-text',
            )}
          >
            {dif > 0 ? '▲' : '▼'} {num(Math.abs(dif), 0)}%
          </span>
        )}
      </span>
      <span className="flex shrink-0 gap-4 tnum">
        <span className="w-[82px] text-right text-ink-faint">{valorContraste(c.proyectado, c.formato)}</span>
        <span className="w-[82px] text-right font-display font-semibold">
          {valorContraste(c.real, c.formato)}
        </span>
      </span>
    </div>
  )
}

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
}: {
  lote: Lote
  open: boolean
  onClose: () => void
  editar?: Aplicacion
  sugerencia?: { nombre: string; fecha: string }
}) {
  const [tipo, setTipo] = useState<TipoAplicacion>('vacuna')
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [via, setVia] = useState('')
  const [dosis, setDosis] = useState('')
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (!open) return
    setTipo(editar?.tipo ?? 'vacuna')
    setNombre(editar?.nombre ?? sugerencia?.nombre ?? '')
    setFecha(editar?.fecha ?? sugerencia?.fecha ?? hoyISO())
    setVia(editar?.via ?? '')
    setDosis(editar?.dosis ?? '')
    setNota(editar?.nota ?? '')
  }, [open, editar, sugerencia])

  const dia = diasEntre(lote.fechaInicio, fecha)

  async function guardar() {
    const datos = {
      loteId: lote.id,
      fecha,
      tipo,
      nombre: nombre.trim(),
      via: via || undefined,
      dosis: dosis.trim() || undefined,
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
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Dosis" hint="Opcional.">
            <Input value={dosis} onChange={(e) => setDosis(e.target.value)} placeholder="1 gota, 1 cc…" />
          </Field>
        </div>

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

        <Button block className="h-14" disabled={!nombre.trim()} onClick={guardar}>
          {editar ? 'Guardar cambios' : 'Anotar aplicación'}
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
      className="flex flex-col items-center gap-2 rounded-xl2 border border-line bg-paper-raised py-3.5 transition active:scale-95"
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
      socios: enSociedad ? socios.filter((s) => s.nombre.trim()) : undefined,
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
              placeholder="0"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde cuándo">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="A quién" hint="Opcional.">
            <Input
              value={acreedor}
              onChange={(e) => setAcreedor(e.target.value)}
              placeholder="Ferretería, banco…"
            />
          </Field>
        </div>

        <RepartoSocios
          activo={enSociedad}
          onActivo={setEnSociedad}
          socios={socios}
          onSocios={setSocios}
        />

        <Button block disabled={!valido} onClick={guardar}>
          {editar ? 'Guardar' : 'Agregar deuda'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar deuda</DangerButton>}
      </div>
    </Sheet>
  )
}

function RepartoSocios({
  activo,
  onActivo,
  socios,
  onSocios,
}: {
  activo: boolean
  onActivo: (v: boolean) => void
  socios: Socio[]
  onSocios: (s: Socio[]) => void
}) {
  const suma = socios.reduce((a, s) => a + (Number(s.pct) || 0), 0)
  const set = (i: number, patch: Partial<Socio>) =>
    onSocios(socios.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <div className="rounded-xl2 border border-line bg-paper-raised p-4">
      <button onClick={() => onActivo(!activo)} className="flex w-full items-center justify-between">
        <div className="text-left">
          <div className="font-display text-base font-semibold">Es en sociedad</div>
          <div className="text-xs text-ink-faint">Reparte lo que falta por pagar.</div>
        </div>
        <span
          className={clsx('relative h-6 w-10 rounded-full transition', activo ? 'bg-forest-500' : 'bg-line')}
        >
          <span
            className={clsx(
              'absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow-card transition-all',
              activo ? 'left-[18px]' : 'left-0.5',
            )}
          />
        </span>
      </button>

      {activo && (
        <div className="mt-4 space-y-3">
          {socios.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={s.nombre}
                onChange={(e) => set(i, { nombre: e.target.value })}
                placeholder="Nombre"
                className="flex-1"
              />
              <div className="relative w-24">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={String(s.pct)}
                  onChange={(e) => set(i, { pct: Number(e.target.value) || 0 })}
                  className="pr-7 text-center"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  %
                </span>
              </div>
              {socios.length > 2 && (
                <button
                  onClick={() => onSocios(socios.filter((_, j) => j !== i))}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint active:bg-paper-sunken"
                  aria-label="Quitar socio"
                >
                  <IconClose width={18} height={18} />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              onClick={() => onSocios([...socios, { nombre: '', pct: 0 }])}
              className="text-sm font-medium text-forest-600"
            >
              + Agregar socio
            </button>
            <span
              className={clsx('text-xs tnum', suma === 100 ? 'text-ink-faint' : 'text-clay-deep')}
            >
              Suma {suma}%
            </span>
          </div>
        </div>
      )}
    </div>
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
              placeholder="0"
            />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
            <div className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-800">
              {quedaria > 0
                ? `Después de este abono quedan ${money(quedaria)} por pagar.`
                : 'Con este abono la deuda queda saldada.'}
            </div>
          ))}

        <Button block disabled={valor <= 0} onClick={guardar}>
          {editar ? 'Guardar' : 'Anotar abono'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar abono</DangerButton>}
      </div>
    </Sheet>
  )
}

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
  const [fecha, setFecha] = useState(hoyISO())
  const [quedan, setQuedan] = useState('')

  useEffect(() => {
    if (!open) return
    setFecha(hoyISO())
    setQuedan('')
  }, [open])

  const compras = comprasAlimento(gastos)
  const sinCantidad = compras.filter((g) => !((g.cantidadQq ?? 0) > 0)).length
  const compradoQq = compras
    .filter((g) => g.fecha <= fecha)
    .reduce((a, g) => a + (g.cantidadQq ?? 0), 0)
  const qq = Number(quedan.replace(',', '.'))
  const valido = quedan.trim() !== '' && Number.isFinite(qq) && qq >= 0
  const dadoQq = compradoQq - qq
  const conteos = [...(lote.conteosAlimento ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const yaContado = conteos.some((c) => c.fecha === fecha)
  const antesDelCiclo = fecha < lote.fechaInicio

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
              placeholder="0"
              className="h-14 text-lg"
              autoFocus
            />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-14" />
          </Field>
        </div>

        {valido && compras.length > 0 && !antesDelCiclo && (
          <div
            className={clsx(
              'rounded-xl px-4 py-3 text-sm leading-relaxed',
              dadoQq >= 0 ? 'bg-forest-50 text-forest-800' : 'border-l-4 border-clay bg-clay-tint text-clay-text',
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
        {antesDelCiclo && (
          <p className="text-sm text-clay-text">La fecha es anterior al inicio del ciclo.</p>
        )}

        <Button block className="h-14" disabled={!valido || antesDelCiclo} onClick={guardar}>
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
                      {numCorto(c.qq, 2)} {c.qq === 1 ? 'saco' : 'sacos'}
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
