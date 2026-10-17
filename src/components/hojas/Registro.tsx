import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { db, type CausaBaja, type Lote, type Registro } from '../../db/schema'
import { Button, DangerButton, Field, Input, Segmentado, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { CAUSAS_BAJA } from '../../lib/labels'
import { diasEntre, hoyISO, num, numCorto } from '../../lib/format'
import { useSettings } from '../../lib/hooks'
import { saveSettings } from '../../lib/settings'
import { aguaEsperadaL } from '../../lib/agua'
import { EDAD_CALOR, CALOR_C, fraseCalor, juicioCalor } from '../../lib/calor'
import { LB_POR_QUINTAL, tempRecomendadaC } from '../../lib/standards'
import { errorFechaDelCiclo, topeDelCiclo } from '../../lib/lote'
import { useEnvio } from '../useEnvio'

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
  const { ocupado, enviar } = useEnvio(open)
  const { unidadAlimento: unidad } = useSettings()
  const [fecha, setFecha] = useState(hoyISO())
  const [mortalidad, setMortalidad] = useState(0)
  const [descarte, setDescarte] = useState(0)
  const [causa, setCausa] = useState<CausaBaja>()
  // En la unidad que el productor eligió (sacos o libras); al guardar pasa a lb.
  const [alimento, setAlimento] = useState('')
  const [aguaL, setAguaL] = useState('')
  const [tempMax, setTempMax] = useState('')
  const [humedad, setHumedad] = useState('')
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

  // De qué día vienen los números que hay en la hoja: si se cargaron de otro
  // día anotado, al pasar a un día vacío no se pueden quedar como si fueran suyos.
  const cargadoDe = useRef<string | undefined>(undefined)

  const cargar = useCallback((r?: Registro) => {
    cargadoDe.current = r?.fecha
    const valor = r?.alimentoLb ? enUnidad(r.alimentoLb, unidadRef.current) : undefined
    setMortalidad(r?.mortalidad ?? 0)
    setCausa(r?.causa)
    setDescarte(r?.descarte ?? 0)
    setAlimento(valor != null ? String(valor) : '')
    setAguaL(r?.aguaL ? String(r.aguaL) : '')
    setTempMax(r?.tempMaxC ? String(r.tempMaxC) : '')
    setHumedad(r?.humedadPct ? String(r.humedadPct) : '')
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

  // Corrigiendo un día, cambiarle la fecha lo mueve con sus números: antes se
  // vaciaba todo y al guardar quedaba en cero. En un día nuevo, si la fecha ya
  // está anotada se trae para corregirla; si no, lo escrito se queda, salvo
  // que viniera de otro día.
  function cambiarFecha(f: string) {
    setFecha(f)
    if (editar) return
    const r = registros.find((x) => x.fecha === f)
    if (r) cargar(r)
    else if (cargadoDe.current) cargar(undefined)
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
  const errorFecha =
    errorFechaDelCiclo(fecha, lote) ??
    (editar && registros.some((r) => r.fecha === fecha && r.id !== editar.id)
      ? 'Ese día ya tiene su registro: tócalo en el historial para corregirlo.'
      : undefined)
  const alimentoLb = aLibras(alimento, unidad)
  const esperadaL = aguaEsperadaL(alimentoLb)
  const litros = Number(aguaL.replace(',', '.')) || 0
  const desvioAgua = litros > 0 && esperadaL > 0 ? ((litros - esperadaL) / esperadaL) * 100 : undefined
  // Las bajas del día no pueden ser más que las aves que hay (al corregir, las
  // de este día ya están descontadas y vuelven a contar).
  const avesDisponibles =
    lote.cantidadInicial -
    (lote.muertosLlegada ?? 0) -
    registros.reduce((a, r) => a + (r.id === existente?.id ? 0 : (r.mortalidad ?? 0) + (r.descarte ?? 0)), 0)
  const errorBajas =
    mortalidad + descarte > Math.max(0, avesDisponibles)
      ? `Son más de las ${num(Math.max(0, avesDisponibles))} aves que hay.`
      : undefined
  const tempNum = Number(tempMax.replace(',', '.'))
  const humedadNum = Number(humedad.replace(',', '.'))
  // Lo que no puede ser dentro de un galpón es un error al escribir: 330 por 33.
  const tempValida = tempNum >= 5 && tempNum <= 50
  const humedadValida = humedadNum > 0 && humedadNum <= 100
  const calor = tempValida ? juicioCalor(tempNum, dia, humedadValida ? humedadNum : undefined) : undefined

  async function guardar() {
    const datos = {
      loteId: lote.id,
      fecha,
      mortalidad,
      descarte,
      alimentoLb,
      aguaL: Number(aguaL.replace(',', '.')) > 0 ? Number(aguaL.replace(',', '.')) : undefined,
      tempMaxC: tempValida ? tempNum : undefined,
      humedadPct: humedadValida ? humedadNum : undefined,
      pesoPromedio: !sinPesar && Number(peso.replace(',', '.')) > 0 ? Number(peso.replace(',', '.')) : undefined,
      causa: mortalidad > 0 ? causa : undefined,
      nota: nota.trim() || undefined,
    }
    // Guardar desde aquí completa el día: si lo había creado un pesaje, deja de
    // ser «solo peso». Un día nuevo se busca otra vez dentro de la transacción:
    // si ya existe —anotado desde otra pantalla o por un pesaje— se corrige en
    // vez de quedar dos veces.
    if (editar) await db.registros.update(editar.id, { ...datos, soloPeso: undefined })
    else
      await db.transaction('rw', db.registros, async () => {
        const ya = await db.registros
          .where('loteId')
          .equals(lote.id)
          .filter((r) => r.fecha === fecha)
          .first()
        if (ya) await db.registros.update(ya.id, { ...datos, soloPeso: undefined })
        else await db.registros.add({ ...datos, creado: Date.now() })
      })
    toast(existente && !existente.soloPeso ? `Día ${dia} corregido` : `Día ${dia} anotado`)
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
          error={errorFecha}
          hint={
            existente?.soloPeso
              ? 'Este día solo tiene el peso del pesaje: completa las bajas y el alimento.'
              : existente && !editar
                ? 'Este día ya estaba anotado: lo estás corrigiendo.'
                : undefined
          }
        >
          <Input
            type="date"
            value={fecha}
            min={lote.fechaInicio}
            max={topeDelCiclo(lote)}
            onChange={(e) => cambiarFecha(e.target.value)}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Mortalidad (aves)</span>
          <Stepper value={mortalidad} onChange={setMortalidad} etiqueta="Mortalidad" />
          {mortalidad > 0 && (
            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-medium text-ink-faint">
                ¿De qué {mortalidad === 1 ? 'murió' : 'murió la mayoría'}? Opcional
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="De qué murieron">
                {CAUSAS_BAJA.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={causa === c.id}
                    onClick={() => setCausa(causa === c.id ? undefined : c.id)}
                    className={clsx(
                      'h-11 rounded-full border px-3.5 text-sm font-semibold transition',
                      causa === c.id
                        ? 'border-2 border-forest-500 bg-forest-50 text-ink'
                        : 'border-line bg-paper-raised text-ink-soft',
                    )}
                  >
                    {c.corto}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          <div className="flex flex-wrap gap-2" role="group" aria-label="Alimento que se dio">
            {chips.map((v) => {
              const activo = !feedOtro && Number(alimento) === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setAlimento(String(v))
                    setFeedOtro(false)
                  }}
                  aria-pressed={activo}
                  aria-label={`${numCorto(v)} ${unidad === 'qq' ? 'sacos' : 'libras'}${v === ayer ? ', lo de ayer' : ''}`}
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
                type="button"
                onClick={() => {
                  setFeedOtro(true)
                  if (chips.includes(Number(alimento))) setAlimento('')
                }}
                aria-pressed={feedOtro}
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
              aria-label={unidad === 'qq' ? 'Alimento que se dio, en sacos' : 'Alimento que se dio, en libras'}
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Agua (litros)</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            value={aguaL}
            onChange={(e) => setAguaL(e.target.value)}
            placeholder="Litros del día"
            className="h-14"
          />
          {/* Lo normal va a la vista, no como ejemplo dentro de la casilla: el
              ejemplo se borra al escribir y al sol casi no se leía. */}
          {!aguaL && esperadaL > 0 && (
            <span className="mt-1 block text-xs text-ink-faint tnum">
              Para {num(alimentoLb)} lb de alimento lo normal son unos {num(esperadaL)} L.
            </span>
          )}
          {aguaL && esperadaL > 0 && (
            <span
              className={clsx(
                'mt-1 block text-xs',
                desvioAgua != null && Math.abs(desvioAgua) >= 20 ? 'text-clay-text' : 'text-ink-faint',
              )}
            >
              {desvioAgua != null && Math.abs(desvioAgua) >= 20
                ? `${desvioAgua > 0 ? 'Bastante más' : 'Bastante menos'} de lo normal para ${num(alimentoLb)} lb de alimento (${num(esperadaL)} L).`
                : `Para ${num(alimentoLb)} lb de alimento lo normal son ${num(esperadaL)} L.`}
            </span>
          )}
        </label>

        <div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Temperatura máxima</span>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  placeholder="Opcional"
                  aria-invalid={tempMax !== '' && !tempValida}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  °C
                </span>
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Humedad</span>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={humedad}
                  onChange={(e) => setHumedad(e.target.value)}
                  placeholder="Opcional"
                  aria-invalid={humedad !== '' && !humedadValida}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  %
                </span>
              </div>
            </label>
          </div>
          <p
            className={clsx(
              'mt-1 text-xs leading-relaxed',
              calor && calor.nivel !== 'bien' ? 'font-medium text-clay-text' : 'text-ink-faint',
            )}
          >
            {tempMax !== '' && !tempValida
              ? 'Esa temperatura no puede ser dentro del galpón: revísala.'
              : humedad !== '' && !humedadValida
                ? 'La humedad va de 1 a 100 %.'
                : calor
                  ? fraseCalor(calor)
                  : `La más alta del día dentro del galpón. A los ${dia} días piden unos ${tempRecomendadaC(dia)} °C${dia >= EDAD_CALOR ? `, y sobre ${CALOR_C} °C el pollo grande sufre` : ''}.`}
          </p>
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
                min={0}
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="Ej. 4.2"
                aria-label="Peso promedio, en libras por ave"
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
              <Stepper value={descarte} onChange={setDescarte} etiqueta="Descarte" />
            </div>
            <Field label="Nota">
              <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
            </Field>
          </div>
        ) : (
          <button
            onClick={() => setMasOpciones(true)}
            className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-forest-600"
          >
            Descarte y nota →
          </button>
        )}

        <Button
          block
          className="h-14"
          disabled={
            ocupado ||
            !!errorFecha ||
            !!errorBajas ||
            (tempMax !== '' && !tempValida) ||
            (humedad !== '' && !humedadValida)
          }
          motivo={errorBajas}
          onClick={enviar(guardar)}
        >
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

// Con un golpe de calor de 80 muertos, tocar el + ochenta veces no se aguanta:
// el número del medio también se escribe.
function Stepper({ value, onChange, etiqueta }: { value: number; onChange: (v: number) => void; etiqueta: string }) {
  // Mientras se escribe se muestra lo escrito, aunque esté vacío; al salir,
  // vuelve el número.
  const [texto, setTexto] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-line bg-paper-raised font-display text-2xl font-semibold text-ink-soft transition active:scale-95 disabled:opacity-40"
        aria-label={`${etiqueta}: una menos`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={etiqueta}
        value={texto ?? String(value)}
        onFocus={(e) => {
          setTexto(String(value))
          e.target.select()
        }}
        onChange={(e) => {
          const limpio = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 6)
          setTexto(limpio)
          onChange(limpio === '' ? 0 : Number(limpio))
        }}
        onBlur={() => setTexto(null)}
        className="h-14 w-full min-w-0 flex-1 rounded-2xl border border-borde bg-paper-raised text-center font-display text-2xl font-semibold tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest-50 font-display text-2xl font-semibold text-forest-700 transition active:scale-95"
        aria-label={`${etiqueta}: una más`}
      >
        +
      </button>
    </div>
  )
}
