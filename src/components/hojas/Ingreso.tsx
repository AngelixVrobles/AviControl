import { useEffect, useState } from 'react'
import { db, type Aplicacion, type Gasto, type Ingreso, type Lote, type Registro } from '../../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { diasEntre, fecha as fechaCorta, hoyISO, money, num, plural } from '../../lib/format'
import { useCompradores, useModoVenta, usePreciosDeVenta, useSettings } from '../../lib/hooks'
import { cobradoDe, pendienteDe } from '../../lib/cobros'
import type { LoteMetrics } from '../../lib/metrics'
import { proyectarVenta } from '../../lib/proyeccion'
import { snapshotCierre } from '../../lib/cierre'
import { errorFechaDelCiclo, errorNegativo, pesoObjetivoDe } from '../../lib/lote'
import { retiroEn } from '../../lib/retiro'
import { galponInicial, nombreDeGalpon } from '../../lib/galpones'
import { avesPorGalpon, repartido } from '../../lib/reparto'
import { precioCorto, precioDe, precioSugerido, rindeValido } from '../../lib/venta'
import { RINDE_ARREGLADO_PCT } from '../../lib/standards'
import { Interruptor } from '../Socios'
import { useEnvio } from '../useEnvio'
import { ComoSalioElPollo, DatosDePago, PreciosUsados } from '../Venta'
import { AvisoRetiro } from './AvisoRetiro'

export function IngresoSheet({
  lote,
  metrics,
  registros,
  gastos,
  open,
  onClose,
  editar,
  onCobrar,
  aplicaciones = [],
  ingresos = [],
}: {
  lote: Lote
  metrics: LoteMetrics
  registros: Registro[]
  gastos: Gasto[]
  ingresos?: Ingreso[]
  open: boolean
  onClose: () => void
  editar?: Ingreso
  onCobrar?: (i: Ingreso) => void
  aplicaciones?: Aplicacion[]
}) {
  const { ocupado, enviar } = useEnvio(open)
  const conocidos = useCompradores()
  const [comprador, setComprador] = useState('')
  const [credito, setCredito] = useState(false)
  const [adelanto, setAdelanto] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [pesoLb, setPesoLb] = useState('')
  const [precio, setPrecio] = useState('')
  const [monto, setMonto] = useState('')
  // El pollo se vende por libra: el total sale del peso por el precio. Si se
  // escribe a mano —el comprador redondeó— se queda lo escrito. Al corregir una
  // venta queda el total guardado, hasta que se cambie el peso o el precio.
  const [modoTotal, setModoTotal] = useState<'auto' | 'mano' | 'guardado'>('auto')
  const [fecha, setFecha] = useState(hoyISO())
  const [recibidoPor, setRecibidoPor] = useState('')
  const [cerrar, setCerrar] = useState(true)
  const [galponVenta, setGalponVenta] = useState('')
  // Arreglado, las libras son las del pollo limpio y el precio el de esa libra.
  const [arreglado, setArreglado] = useState(false)
  // Un precio escrito o tocado no lo cambia el comprador que se elija después.
  const [precioTocado, setPrecioTocado] = useState(false)
  // El comprador cuyo precio se puso solo: si se sigue escribiendo y ya no es
  // él («Ana» → «Ana María»), vuelve el precio de siempre.
  const [deComprador, setDeComprador] = useState<string>()
  const settings = useSettings()
  const modo = useModoVenta()
  const precios = usePreciosDeVenta()

  useEffect(() => {
    if (!open) return
    setArreglado(editar ? !!editar.arreglado : modo.arreglado)
    setPrecioTocado(false)
    setDeComprador(undefined)
    setCantidad(editar ? String(editar.cantidad) : '')
    setPesoLb(editar?.pesoLb != null ? String(editar.pesoLb) : '')
    const inicial = editar ? precioDe(editar) : lote.precioVentaLb
    setPrecio(inicial ? String(inicial) : '')
    setMonto(editar ? String(editar.monto) : '')
    setModoTotal(editar ? 'guardado' : 'auto')
    setFecha(editar?.fecha ?? hoyISO())
    setRecibidoPor(editar?.recibidoPor != null ? String(editar.recibidoPor) : '')
    setCerrar(true)
    setComprador(editar?.comprador ?? '')
    setCredito(!!editar?.credito)
    setAdelanto('')
    setGalponVenta(editar?.galponId ?? '')
  }, [open, editar, lote.precioVentaLb, modo.arreglado])

  // Con la pollada repartida, de qué galpón salen: vendidas las 350 del galpón
  // 2, ese galpón queda vacío y el espacio del otro sigue igual. Sin decirlo,
  // la venta se reparte entre los dos.
  const otrasVentas = ingresos.filter((i) => i.id !== editar?.id)
  const casasEseDia = repartido(lote)
    ? avesPorGalpon(lote, galponInicial(lote, settings), registros, otrasVentas, fecha)
    : []

  // Vender con «Venta» las aves que quedan dejaba el ciclo abierto con el
  // galpón vacío, pidiendo el registro del día. Si esta venta se lleva las
  // últimas, se cierra con ella, como en «Vender y cerrar».
  const nAves = Math.round(Number(cantidad) || 0)
  const vendeTodo =
    !editar && lote.estado === 'activo' && metrics.avesVivas > 0 && nAves >= metrics.avesVivas
  // No se venden aves que no hay, ni menos de cero: una venta de −200 aves
  // «creaba» aves en el galpón. Al corregir, las de esta venta vuelven a contar.
  const maxAves = metrics.avesVivas + (editar?.tipo === 'aves' ? editar.cantidad : 0)
  const errorAves =
    cantidad === ''
      ? undefined
      : nAves < 0
        ? 'No puede ser negativo.'
        : lote.estado === 'activo' && nAves > maxAves
          ? `Solo hay ${num(maxAves)} ${plural(maxAves, 'ave', 'aves')} en el galpón.`
          : undefined
  const errorPeso = errorNegativo(pesoLb)
  const errorPrecio = errorNegativo(precio)

  const lb = Number(pesoLb) || 0
  const precioLb = Number(precio) || 0
  const totalAuto = lb > 0 && precioLb > 0 ? Math.round(lb * precioLb) : 0
  const total = modoTotal === 'auto' ? totalAuto : Number(monto) || 0
  // Cambiar el peso o el precio de una venta guardada vuelve a sacar el total,
  // si hay con qué: en una venta sin precio, poner el peso no borra el total.
  const recalcular = (nuevoLb: number, nuevoPrecio: number) =>
    setModoTotal((m) => (m === 'guardado' && nuevoLb > 0 && nuevoPrecio > 0 ? 'auto' : m))
  const ponerPrecio = (p: number) => {
    setPrecio(String(p))
    recalcular(lb, p)
  }

  // Los precios que ya se usaron vendiendo así, para tocarlos.
  const usados = precios?.recientes[arreglado ? 'arreglado' : 'pie'] ?? []

  // Cada quien paga su precio: al elegir un comprador de antes, en una venta
  // nueva, sale el precio que se le puso la última vez.
  const previo = comprador.trim() ? precios?.porComprador.get(comprador.trim().toLowerCase()) : undefined
  function elegirComprador(nombre: string) {
    setComprador(nombre)
    if (editar || precioTocado) return
    const clave = nombre.trim().toLowerCase()
    const suyo = precios?.porComprador.get(clave)
    if (suyo) {
      setDeComprador(clave)
      setArreglado(suyo.arreglado)
      ponerPrecio(suyo.precio)
    } else if (deComprador) {
      setDeComprador(undefined)
      setArreglado(modo.arreglado)
      const p = precioSugerido(modo.arreglado, { precios, lote, settings })
      setPrecio(p ? String(p) : '')
    }
  }
  function cambiarComoSalio(v: boolean) {
    setArreglado(v)
    if (editar || precioTocado) return
    const p = precioSugerido(v, { precios, lote, settings })
    setPrecio(p ? String(p) : '')
  }
  // El rinde con que se guarda: el de la venta, si ya era arreglada; si no, el
  // de la granja.
  const rinde =
    editar?.arreglado?.rindePct ?? (rindeValido(settings.rindePct) ? settings.rindePct : RINDE_ARREGLADO_PCT)
  const dio = Math.min(Number(adelanto) || 0, total)
  // Si lo que dio al llevarse el pollo cubre todo, no fue a crédito.
  const aCredito = credito && (!!editar || dio < total)
  // Lo ya cobrado de una venta a crédito no se puede deshacer bajando el total.
  // Al volver a crédito una venta que se pasó a contado, sus cobros vuelven a contar.
  const yaCobrado = aCredito && editar ? (editar.cobros ?? []).reduce((a, c) => a + c.monto, 0) : 0
  const errorTotal =
    aCredito && yaCobrado > total + 0.5
      ? `Ya te pagó ${money(yaCobrado)}: el total no puede ser menos. Quita el cobro de más.`
      : undefined
  // Lo que queda debiendo con el total de ahora: al subirle el precio de 60 a
  // 65, sube lo que falta.
  const faltaAhora = Math.max(0, total - yaCobrado)

  async function guardar() {
    const quien = recibidoPor !== '' ? Number(recibidoPor) : undefined
    const datos = {
      loteId: lote.id,
      tipo: 'aves' as const,
      cantidad: nAves,
      pesoLb: pesoLb ? Number(pesoLb) : undefined,
      precioLb: precioLb > 0 ? precioLb : undefined,
      arreglado: arreglado ? { rindePct: rinde } : undefined,
      monto: total,
      fecha,
      comprador: comprador.trim() || undefined,
      galponId: casasEseDia.length > 1 && galponVenta ? galponVenta : undefined,
      credito: aCredito || undefined,
      // A crédito, el dinero entra con los cobros, cada uno a quien lo recibió.
      recibidoPor: aCredito ? undefined : quien,
      // Al pasarla a «Pagó todo» los cobros se guardan igual: no cuentan mientras
      // es de contado, y si vuelve a crédito están ahí. Antes se borraban, y con
      // ellos quién recibió cada pago.
      cobros: aCredito
        ? editar
          ? (editar.cobros ?? [])
          : dio > 0
            ? [{ fecha, monto: dio, recibidoPor: quien }]
            : []
        : editar?.cobros,
    }
    if (editar) {
      // Si la corrección deja aves en un ciclo cerrado, el ciclo se reabre: no
      // puede quedar cerrado con aves vivas en el galpón.
      const quedan = metrics.avesVivas + (editar.tipo === 'aves' ? editar.cantidad : 0) - nAves
      const reabre = lote.estado === 'cerrado' && quedan > 0
      // La venta que cerró el ciclo manda en la fecha de cierre: al corregirle
      // la fecha, el cierre se mueve con ella. Antes se quedaba atrás, y los
      // días del ciclo y el IEP salían mal.
      const nuevoCierre = [...otrasVentas.filter((i) => i.tipo === 'aves').map((i) => i.fecha), fecha]
        .sort()
        .at(-1)!
      const mueveCierre =
        lote.estado === 'cerrado' &&
        !reabre &&
        !!lote.fechaCierre &&
        (editar.fecha === lote.fechaCierre || fecha > lote.fechaCierre) &&
        nuevoCierre !== lote.fechaCierre
      await db.transaction('rw', db.ingresos, db.lotes, async () => {
        await db.ingresos.update(editar.id, datos)
        if (reabre) await db.lotes.update(lote.id, { estado: 'activo', fechaCierre: undefined })
        else if (mueveCierre)
          await db.lotes.update(lote.id, {
            fechaCierre: nuevoCierre,
            cierre: lote.cierre ? { ...lote.cierre, diaVenta: diasEntre(lote.fechaInicio, nuevoCierre) } : undefined,
          })
      })
      toast(
        reabre
          ? `Venta corregida · el ciclo se reabrió con ${num(quedan)} aves`
          : mueveCierre
            ? `Venta corregida · el ciclo cerró el ${fechaCorta(nuevoCierre)}`
            : aCredito
              ? `Venta corregida · ${faltaAhora >= 1 ? `faltan ${money(faltaAhora)}` : 'ya pagó todo'}`
              : `Venta corregida · ${money(datos.monto)}`,
      )
    } else if (vendeTodo && cerrar) {
      // Lo que la app proyectaba se guarda antes de que la venta deje el galpón
      // vacío: después ya no hay forma de reconstruirlo. Si el ciclo ya se había
      // cerrado una vez, se queda lo de entonces: tomado con 50 aves, decía que
      // el pollo costaba RD$690 la libra.
      const proyeccion = proyectarVenta(lote, registros, gastos, metrics, pesoObjetivoDe(lote), modo)
      const cierre = lote.cierre ?? snapshotCierre(metrics, proyeccion, diasEntre(lote.fechaInicio, fecha))
      await db.transaction('rw', db.ingresos, db.lotes, async () => {
        await db.ingresos.add({ ...datos, creado: Date.now() })
        await db.lotes.update(lote.id, { estado: 'cerrado', fechaCierre: fecha, cierre })
      })
      toast(`Ciclo cerrado · ${money(metrics.ingresos + datos.monto - metrics.costos)}`)
    } else {
      await db.ingresos.add({ ...datos, creado: Date.now() })
      toast(
        aCredito
          ? `Venta a crédito · faltan ${money(total - dio)} por cobrar`
          : `Venta anotada · ${money(datos.monto)}`,
      )
    }
    onClose()
  }

  async function eliminar() {
    const venta = editar!
    // Borrar la venta que se llevó las últimas aves deja aves en el galpón: el
    // ciclo se reabre con ellas. Antes quedaba cerrado con 950 aves vivas, y
    // Inicio decía que no había ciclos en curso.
    const quedan = metrics.avesVivas + (venta.tipo === 'aves' ? venta.cantidad : 0)
    const reabre = lote.estado === 'cerrado' && venta.tipo === 'aves' && quedan > 0
    const ok = await confirmar({
      titulo: 'Eliminar venta',
      mensaje: reabre
        ? `Se borra la venta y el ciclo se reabre con ${num(quedan)} aves en el galpón.`
        : 'Se borra esta venta.',
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    await db.transaction('rw', db.ingresos, db.lotes, async () => {
      await db.ingresos.delete(venta.id)
      if (reabre) await db.lotes.update(lote.id, { estado: 'activo', fechaCierre: undefined })
    })
    if (reabre) toast(`El ciclo se reabrió con ${num(quedan)} aves`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editar ? 'Editar venta' : 'Registrar venta de aves'}>
      <div className="space-y-4">
        <ComoSalioElPollo arreglado={arreglado} onCambio={cambiarComoSalio} />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Nº de aves"
            hint={!editar && lote.estado === 'activo' ? `Tienes ${num(metrics.avesVivas)} vivas` : undefined}
            error={errorAves}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              aria-invalid={!!errorAves}
            />
          </Field>
          <Field label={arreglado ? 'Libras arregladas' : 'Peso total (lb)'} error={errorPeso}>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={pesoLb}
              onChange={(e) => {
                setPesoLb(e.target.value)
                recalcular(Number(e.target.value) || 0, precioLb)
              }}
            />
          </Field>
          <Field label="Precio por libra" error={errorPrecio}>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={precio}
              onChange={(e) => {
                setPrecio(e.target.value)
                setPrecioTocado(true)
                recalcular(lb, Number(e.target.value) || 0)
              }}
            />
          </Field>
          <Field
            label="Total de la venta"
            error={errorTotal}
            hint={
              modoTotal === 'mano'
                ? 'Lo escribiste a mano'
                : modoTotal === 'auto' && totalAuto > 0
                  ? 'Peso por precio; puedes corregirlo'
                  : undefined
            }
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={modoTotal === 'auto' ? (totalAuto ? String(totalAuto) : '') : monto}
              onChange={(e) => {
                setModoTotal('mano')
                setMonto(e.target.value)
              }}
              aria-invalid={!!errorTotal}
            />
          </Field>
          {usados.length > 0 && (
            <div className="col-span-2 -mt-1">
              <PreciosUsados
                precios={usados}
                actual={precioLb}
                onElegir={(p) => {
                  setPrecioTocado(true)
                  ponerPrecio(p)
                }}
              />
            </div>
          )}
          <Field
            label="Fecha"
            className="col-span-2"
            error={errorFechaDelCiclo(fecha, { fechaInicio: lote.fechaInicio })}
          >
            <Input
              type="date"
              value={fecha}
              min={lote.fechaInicio}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
        </div>
        {casasEseDia.length > 1 && (
          <Field label="¿De qué galpón salen?">
            <Select value={galponVenta} onChange={(e) => setGalponVenta(e.target.value)}>
              <option value="">De todos (se reparte)</option>
              {casasEseDia.map((c) => (
                <option key={c.galponId} value={c.galponId}>
                  {nombreDeGalpon(c.galponId, settings)} · {num(c.aves)} aves
                </option>
              ))}
            </Select>
          </Field>
        )}
        <DatosDePago
          comprador={comprador}
          credito={credito}
          onCredito={setCredito}
          adelanto={adelanto}
          onAdelanto={setAdelanto}
          total={total}
          conocidos={conocidos}
          conAdelanto={!editar}
          onComprador={elegirComprador}
          pistaComprador={
            previo && !editar
              ? `La última vez le vendiste a ${precioCorto(previo.precio)} la libra${previo.arreglado ? ' arreglada' : ' en pie'}.`
              : undefined
          }
        />
        {editar?.credito && credito && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-paper-sunken px-4 py-3 text-sm tnum">
            <span className="text-ink-soft">
              Cobrado {money(cobradoDe(editar))}
              {faltaAhora >= 1 ? ` · faltan ${money(faltaAhora)}` : ' · ya pagó todo'}
              {Math.abs(total - editar.monto) >= 1 && total > 0 && (
                <span className="block text-xs text-ink-faint">
                  Antes faltaban {money(pendienteDe(editar))}
                </span>
              )}
            </span>
            {onCobrar && (
              <button
                type="button"
                onClick={() => onCobrar(editar)}
                className="-mx-2 -my-3 shrink-0 px-2 py-3 font-semibold text-forest-600"
              >
                {pendienteDe(editar) > 0 ? 'Anotar un cobro' : 'Ver los cobros'}
              </button>
            )}
          </div>
        )}
        {lote.socios && lote.socios.length >= 2 && (!aCredito || (!editar && dio > 0)) && (
          <Field label={aCredito ? '¿Quién recibió lo que dio?' : '¿Quién recibió el dinero?'}>
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
        <AvisoRetiro retiro={retiroEn(aplicaciones, fecha)} fecha={fecha} />
        {vendeTodo && (
          <button
            type="button"
            onClick={() => setCerrar((v) => !v)}
            aria-pressed={cerrar}
            className="flex w-full items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 text-left"
          >
            <div>
              <div className="font-display text-base font-semibold">Cerrar el ciclo con esta venta</div>
              <div className="text-xs text-ink-faint">
                Salen las últimas {num(metrics.avesVivas)} aves. Si te falta un gasto, lo anotas
                después de reabrirlo.
              </div>
            </div>
            <Interruptor activo={cerrar} />
          </button>
        )}
        <Button
          block
          disabled={
            !(nAves > 0) ||
            !(total > 0) ||
            ocupado ||
            !!errorAves ||
            !!errorPeso ||
            !!errorPrecio ||
            !!errorTotal ||
            !!errorFechaDelCiclo(fecha, { fechaInicio: lote.fechaInicio })
          }
          motivo={
            !(nAves > 0)
              ? 'Falta cuántas aves vendiste.'
              : !(total > 0)
                ? 'Falta el peso y el precio, o el total de la venta.'
                : undefined
          }
          onClick={enviar(guardar)}
        >
          {editar ? 'Guardar cambios' : vendeTodo && cerrar ? 'Guardar y cerrar el ciclo' : 'Guardar venta'}
        </Button>
        {editar && <DangerButton onClick={eliminar}>Eliminar</DangerButton>}
      </div>
    </Sheet>
  )
}
