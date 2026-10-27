import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { db, type Lote, type Pesaje } from '../../db/schema'
import { Button, DangerButton, Field, Input, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { diasEntre, hoyISO, num, pct, plural } from '../../lib/format'
import { borrarBorrador, guardarBorrador, leerBorrador, pesoSospechoso } from '../../lib/borrador'
import { PRECISION_OBJETIVO_PCT, analizarMuestra, faltanPorPesar, tamanoMuestra } from '../../lib/muestreo'
import { pesoEstandarLb } from '../../lib/standards'
import { errorFechaDelCiclo, topeDelCiclo } from '../../lib/lote'
import { IconClose } from '../icons'
import { useEnvio } from '../useEnvio'

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
  const { ocupado, enviar } = useEnvio(open)
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
    const redondo = (lb: number) => Math.round(lb * 100) / 100
    // El muestreo manda el peso del día: de ahí salen la curva, el FCA y la
    // proyección de venta. El pesaje y el peso del día van juntos: o se guardan
    // los dos o ninguno.
    const pesoPromedio = redondo(muestra.promedioLb)
    await db.transaction('rw', db.pesajes, db.registros, async () => {
      if (editar) await db.pesajes.update(editar.id, datos)
      else await db.pesajes.add({ ...datos, creado: Date.now() })

      // Un pesaje que se mueve de día se lleva su peso: antes el día viejo se
      // quedaba con él y quedaban dos pesos. Solo si el peso de ese día es el
      // de este pesaje y no hay otro pesaje ese día.
      if (editar && editar.fecha !== fecha) {
        const antes = analizarMuestra(editar.pesos)
        const viejo = await db.registros
          .where('loteId')
          .equals(lote.id)
          .filter((r) => r.fecha === editar.fecha)
          .first()
        const otro = await db.pesajes
          .where('loteId')
          .equals(lote.id)
          .filter((p) => p.fecha === editar.fecha && p.id !== editar.id)
          .first()
        if (viejo && !otro && antes && viejo.pesoPromedio != null && Math.abs(viejo.pesoPromedio - redondo(antes.promedioLb)) < 0.006) {
          if (viejo.soloPeso) await db.registros.delete(viejo.id)
          else await db.registros.update(viejo.id, { pesoPromedio: undefined })
        }
      }

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
          soloPeso: true,
          creado: Date.now(),
        })
    })
    borrarBorrador(lote.id, editar?.id)
    toast(`${num(muestra.n)} aves pesadas · promedio ${num(muestra.promedioLb, 2)} lb`)
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
          <div className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-700">
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
                className="-my-2 -mr-3 shrink-0 rounded-full px-3 py-2.5 text-sm font-semibold text-forest-600 active:bg-paper-sunken"
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
                        'inline-flex h-11 items-center gap-1.5 rounded-full border pl-3.5 pr-2.5 text-sm font-semibold tnum transition active:bg-paper-sunken',
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
                        : 'text-clay-text',
                  )}
                >
                  ± {num(muestra.margenLb, 2)} lb
                </div>
                <div className="mt-0.5 text-xs text-ink-faint tnum">±{pct(muestra.margenPct, 1)}</div>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-sunken">
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

        <Field label="Fecha" error={errorFechaDelCiclo(fecha, lote)}>
          <Input
            type="date"
            value={fecha}
            min={lote.fechaInicio}
            max={topeDelCiclo(lote)}
            onChange={(e) => cambiar(pesos, e.target.value)}
          />
        </Field>

        <Button
          block
          className="h-14"
          disabled={!muestra || ocupado || !!errorFechaDelCiclo(fecha, lote)}
          motivo={!muestra ? 'Anota al menos un peso.' : undefined}
          onClick={enviar(guardar)}
        >
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
