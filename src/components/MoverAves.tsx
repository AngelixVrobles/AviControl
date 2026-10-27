import { useEffect, useRef, useState } from 'react'
import { db, type Ingreso, type Lote, type Registro } from '../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from './ui'
import { confirmar, toast } from './confirm'
import { useEnvio } from './useEnvio'
import { useSettings } from '../lib/hooks'
import { saveSettings, type Galpon } from '../lib/settings'
import { diasEntre, fecha as fechaCorta, hoyISO, num, plural } from '../lib/format'
import { deMedida } from '../lib/equipo'
import { galponInicial, nombreDeGalpon, nuevoGalpon } from '../lib/galpones'
import { avesPorGalpon, caben, fraseMovimiento, movimientosSinAves } from '../lib/reparto'
import { errorFechaDelCiclo, topeDelCiclo } from '../lib/lote'

const NUEVO = 'nuevo'

// Pasar aves de un galpón a otro sin sacarlas del ciclo: llegaron 1,000
// pollitos a un galpón donde de grandes no caben, y 350 se pasan a otro. Sigue
// siendo la misma pollada, con las mismas cuentas.
export function MoverAvesSheet({
  lote,
  registros,
  ingresos,
  open,
  onClose,
  editar,
}: {
  lote: Lote
  registros: Registro[]
  ingresos: Ingreso[]
  open: boolean
  onClose: () => void
  /** El número del movimiento que se corrige. */
  editar?: number
}) {
  const settings = useSettings()
  const { ocupado, enviar } = useEnvio(open)
  const [fecha, setFecha] = useState(hoyISO())
  const [de, setDe] = useState('')
  const [a, setA] = useState('')
  const [aves, setAves] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [largo, setLargo] = useState('')
  const [ancho, setAncho] = useState('')

  const inicial = galponInicial(lote, settings)
  const corrigiendo = editar != null ? lote.movimientos?.[editar] : undefined
  // Las aves de cada galpón ese día, sin el movimiento que se corrige.
  const enCasas = avesPorGalpon(lote, inicial, registros, ingresos, fecha, { sin: editar })
  const sugerido = nuevoGalpon([...settings.galpones, ...settings.galponesQuitados])

  // Por referencia: la base cambia mientras la hoja está abierta, y eso no
  // debe volver a llenar lo que se está escribiendo.
  const datos = useRef({ lote, registros, ingresos, settings })
  useEffect(() => {
    datos.current = { lote, registros, ingresos, settings }
  })

  useEffect(() => {
    if (!open) return
    const { lote, registros, ingresos, settings } = datos.current
    const m = editar != null ? lote.movimientos?.[editar] : undefined
    const hoy = hoyISO()
    const casas = avesPorGalpon(lote, galponInicial(lote, settings), registros, ingresos, m?.fecha ?? hoy, {
      sin: editar,
    })
    // De donde hay más aves, al primer galpón donde no hay ninguna de este ciclo.
    const desde = m?.de ?? [...casas].sort((x, y) => y.aves - x.aves)[0]?.galponId ?? galponInicial(lote, settings)
    const libre = settings.galpones.find((g) => g.id !== desde && !casas.some((c) => c.galponId === g.id))
    const otro = settings.galpones.find((g) => g.id !== desde)
    setFecha(m?.fecha ?? hoy)
    setDe(desde)
    setA(m?.a ?? libre?.id ?? otro?.id ?? NUEVO)
    setAves(m ? String(m.aves) : '')
    setNombreNuevo('')
    setLargo('')
    setAncho('')
  }, [open, editar])

  const hay = enCasas.find((c) => c.galponId === de)?.aves ?? 0
  const n = Math.max(0, Math.round(Number(aves) || 0))
  const galponDe = settings.galpones.find((g) => g.id === de)
  const galponA = a === NUEVO ? undefined : settings.galpones.find((g) => g.id === a)
  const tope = caben(hay, lote, settings, galponDe)
  const sobran = tope != null && hay > tope ? hay - tope : 0
  const yaEnDestino = enCasas.find((c) => c.galponId === a)?.aves ?? 0
  const u = settings.unidadMedida
  const medida = (t: string) => {
    const v = Number(t.replace(',', '.'))
    return v > 0 ? deMedida(v, u) : undefined
  }
  const nuevo: Galpon | undefined =
    a === NUEVO
      ? { ...sugerido, nombre: nombreNuevo.trim() || sugerido.nombre, largoM: medida(largo), anchoM: medida(ancho) }
      : undefined
  const topeDestino = caben(yaEnDestino + n, lote, settings, nuevo ?? galponA)

  const errorFecha = errorFechaDelCiclo(fecha, lote)
  const errorAves =
    aves === ''
      ? undefined
      : n <= 0
        ? 'Pon cuántas aves pasaste.'
        : n > hay
          ? `En ${nombreDeGalpon(de, settings)} había ${num(hay)} ${plural(hay, 'ave', 'aves')} ese día.`
          : undefined
  // La lista como quedaría: los movimientos que vienen después tienen que
  // seguir teniendo sus aves. Al corregir uno de antes, el de después se
  // quedaba sin aves que pasar y nadie lo decía.
  const mov = { fecha, de, a: nuevo?.id ?? a, aves: n }
  const listaNueva = [...(lote.movimientos ?? [])]
  if (editar != null) listaNueva[editar] = mov
  else listaNueva.push(mov)
  listaNueva.sort((x, y) => x.fecha.localeCompare(y.fecha))
  const roto =
    de && a && n > 0
      ? movimientosSinAves(lote, inicial, registros, ingresos, listaNueva).find((x) => x.movimiento !== mov)
      : undefined
  const motivo = !de
    ? 'Falta de qué galpón salen.'
    : !a || a === de
      ? 'Elige a qué galpón van.'
      : !(n > 0)
        ? 'Falta cuántas aves pasaste.'
        : (errorAves ??
          errorFecha ??
          (roto
            ? `Así, el del ${fechaCorta(roto.movimiento.fecha)} (${fraseMovimiento(roto.movimiento, settings)}) se queda sin aves: allí habría ${num(roto.habia)}. Corrígelo primero.`
            : undefined))

  async function guardar() {
    if (nuevo) saveSettings({ galpones: [...settings.galpones, nuevo] })
    // El galpón donde llegaron queda fijo: si no, al cambiar el orden de los
    // galpones en Ajustes, la pollada «llegaría» a otro.
    await db.lotes.update(lote.id, { movimientos: listaNueva, galponId: lote.galponId ?? inicial })
    toast(`${num(n)} ${plural(n, 'ave pasó', 'aves pasaron')} a ${nuevo?.nombre ?? nombreDeGalpon(mov.a, settings)}`)
    onClose()
  }

  async function eliminar() {
    const m = corrigiendo!
    // Uno del que dependen otros no se borra solo: los de después se quedaban
    // sin aves que pasar.
    const depende = movimientosSinAves(
      lote,
      inicial,
      registros,
      ingresos,
      (lote.movimientos ?? []).filter((_, i) => i !== editar),
    )[0]
    if (depende) {
      await confirmar({
        titulo: 'Primero el de después',
        mensaje: `El movimiento del ${fechaCorta(depende.movimiento.fecha)} (${fraseMovimiento(depende.movimiento, settings)}) pasa aves que llegaron con este. Corrígelo o bórralo primero.`,
        confirmar: 'Entendido',
      })
      return
    }
    const ok = await confirmar({
      titulo: 'Borrar el movimiento',
      mensaje: `Las ${num(m.aves)} aves vuelven a contar en ${nombreDeGalpon(m.de, settings)}.`,
      confirmar: 'Borrar',
      peligro: true,
    })
    if (!ok) return
    const lista = (lote.movimientos ?? []).filter((_, i) => i !== editar)
    await db.lotes.update(lote.id, { movimientos: lista.length ? lista : undefined })
    onClose()
  }

  const dia = diasEntre(lote.fechaInicio, fecha)

  return (
    <Sheet open={open} onClose={onClose} title={corrigiendo ? 'Corregir el movimiento' : 'Pasar aves a otro galpón'}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Siguen siendo de este ciclo: las bajas y las ventas se reparten entre los galpones según las aves de cada
          uno.
        </p>

        <Field label="Fecha" error={errorFecha} hint={errorFecha ? undefined : `Día ${num(dia)} del ciclo`}>
          <Input
            type="date"
            value={fecha}
            min={lote.fechaInicio}
            max={topeDelCiclo(lote)}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Salen de">
            <Select
              value={de}
              onChange={(e) => {
                const nuevoDe = e.target.value
                setDe(nuevoDe)
                if (a === nuevoDe) setA(settings.galpones.find((g) => g.id !== nuevoDe)?.id ?? NUEVO)
              }}
            >
              {enCasas.map((c) => (
                <option key={c.galponId} value={c.galponId}>
                  {nombreDeGalpon(c.galponId, settings)} · {num(c.aves)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Van a">
            <Select value={a} onChange={(e) => setA(e.target.value)}>
              {settings.galpones
                .filter((g) => g.id !== de)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              <option value={NUEVO}>Otro galpón…</option>
            </Select>
          </Field>
        </div>

        {a === NUEVO && (
          <div className="space-y-3 rounded-xl2 border border-line bg-paper-raised p-4">
            <Field label="Nombre del galpón">
              <Input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder={sugerido.nombre} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Largo en ${u === 'pies' ? 'pies' : 'metros'}`}>
                <Input type="number" inputMode="decimal" min={0} value={largo} onChange={(e) => setLargo(e.target.value)} placeholder="Opcional" />
              </Field>
              <Field label={`Ancho en ${u === 'pies' ? 'pies' : 'metros'}`}>
                <Input type="number" inputMode="decimal" min={0} value={ancho} onChange={(e) => setAncho(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
            <p className="text-xs text-ink-faint">Queda en Ajustes con los demás galpones.</p>
          </div>
        )}

        <Field
          label="Aves que se pasaron"
          error={errorAves}
          hint={`En ${nombreDeGalpon(de, settings)} había ${num(hay)} ese día.`}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={aves}
            onChange={(e) => setAves(e.target.value)}
            aria-invalid={!!errorAves}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {sobran > 0 && (
            <button
              type="button"
              onClick={() => setAves(String(sobran))}
              className="h-11 rounded-full border border-amber-line bg-amber-tint px-4 text-sm font-semibold text-amber-text"
            >
              Las que no caben: {num(sobran)}
            </button>
          )}
          {hay > 1 && (
            <button
              type="button"
              onClick={() => setAves(String(Math.floor(hay / 2)))}
              className="h-11 rounded-full border border-line bg-paper-raised px-4 text-sm font-semibold text-ink-soft"
            >
              La mitad: {num(Math.floor(hay / 2))}
            </button>
          )}
        </div>
        {tope != null && (
          <p className="text-sm leading-relaxed text-ink-soft tnum">
            {nombreDeGalpon(de, settings)} aguanta {num(tope)} aves al peso de venta
            {sobran > 0 ? `: con ${num(hay)} le sobran ${num(sobran)}.` : '.'}
            {topeDestino != null && n > 0
              ? ` ${nuevo?.nombre ?? galponA?.nombre} aguanta ${num(topeDestino)}${yaEnDestino + n > topeDestino ? `: con ${num(yaEnDestino + n)} quedan apretadas.` : '.'}`
              : ''}
          </p>
        )}

        <Button block disabled={!!motivo || ocupado} motivo={motivo} onClick={enviar(guardar)}>
          {corrigiendo ? 'Guardar cambios' : n > 0 ? `Pasar ${num(n)} ${plural(n, 'ave', 'aves')}` : 'Pasar las aves'}
        </Button>
        {corrigiendo && <DangerButton onClick={eliminar}>Borrar el movimiento</DangerButton>}
        {corrigiendo && (
          <p className="text-center text-xs text-ink-faint">Anotado el {fechaCorta(corrigiendo.fecha)}.</p>
        )}
      </div>
    </Sheet>
  )
}
