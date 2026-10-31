import { useEffect, useState } from 'react'
import { db, type Aplicacion, type Gasto, type Ingreso, type Lote, type Registro } from '../../db/schema'
import { Button, DangerButton, Field, Input, Select, Sheet } from '../ui'
import { confirmar, toast } from '../confirm'
import { diasEntre, fecha as fechaCorta, hoyISO, money, num, numCorto, plural } from '../../lib/format'
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
import { pesoEstandarLb, RINDE_ARREGLADO_PCT } from '../../lib/standards'
import { Interruptor } from '../Socios'
import { useEnvio } from '../useEnvio'
import { ComoSalioElPollo, DatosDePago, PreciosUsados } from '../Venta'
import { AvesDeLaPesada, BotonPesada, PesadaPorCajas, type FuenteAves } from '../Pesada'
import {
  aEdicion,
  avesPorPeso,
  errorPesada,
  leerPesada,
  librasDePesada,
  POLLOS_POR_CAJA,
  pesadaNueva,
  resumenPesada,
  type PesadaEnEdicion,
} from '../../lib/pesada'
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
  // La pesada por cajas, si se pesó así: las libras salen de ella.
  const [pesada, setPesada] = useState<PesadaEnEdicion | null>(null)
  const [pesadaTocada, setPesadaTocada] = useState(false)
  // De dónde salen las aves: de las cajas, del peso, o escritas a mano. Las
  // que salen de la pesada no pisan las que se escribieron.
  const [avesDe, setAvesDe] = useState<FuenteAves>('cajas')
  // Los pollos por caja que se escribieron no los cambia el comprador.
  const [ppcTocado, setPpcTocado] = useState(false)
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
    setPesada(editar?.pesada ? aEdicion(editar.pesada) : null)
    setPesadaTocada(false)
    setAvesDe(editar ? 'mano' : 'cajas')
    setPpcTocado(!!editar)
  }, [open, editar, lote.precioVentaLb, modo.arreglado])

  // Quien le vende al pollero por cajas sigue igual: si la última venta se pesó
  // así, la hoja abre con la pesada puesta.
  useEffect(() => {
    if (!open || editar || pesadaTocada || !precios?.porCajas) return
    const porCaja = String(precios.pollosPorCaja)
    setPesada((p) => p ?? { ...pesadaNueva(), pollosPorCaja: porCaja })
  }, [open, editar, pesadaTocada, precios?.porCajas, precios?.pollosPorCaja])

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
  const pesadaLeida = pesada ? leerPesada(pesada) : undefined
  const errPesada = pesada ? errorPesada(pesada) : undefined
  const errorPeso = pesada ? undefined : errorNegativo(pesoLb)
  const errorPrecio = errorNegativo(precio)

  const lb = pesadaLeida ? librasDePesada(pesadaLeida) : Number(pesoLb) || 0
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

  // Las aves de la pesada según de dónde se tomen: las cajas por los pollos de
  // cada una, o las libras entre lo que pesa cada pollo. Si falta una, la otra.
  function avesSegun(v: PesadaEnEdicion, fuente: FuenteAves): number | undefined {
    if (fuente === 'mano') return undefined
    const p = leerPesada(v)
    const porCajas = resumenPesada(p).aves
    const porPeso = avesPorPeso(librasDePesada(p), pesoAveVenta)
    return fuente === 'cajas' ? (porCajas ?? porPeso) : (porPeso ?? porCajas)
  }
  function cambiarPesada(v: PesadaEnEdicion, fuente = avesDe) {
    setPesada(v)
    setPesadaTocada(true)
    recalcular(librasDePesada(leerPesada(v)), precioLb)
    const n = avesSegun(v, fuente)
    if (n) setCantidad(String(n))
  }
  function elegirAves(fuente: 'cajas' | 'peso') {
    setAvesDe(fuente)
    const n = pesada ? avesSegun(pesada, fuente) : undefined
    if (n) setCantidad(String(n))
  }
  // Cambiar los pollos por caja es decir que se cuenta por cajas.
  function cambiarPollosPorCaja(t: string) {
    if (!pesada) return
    setPpcTocado(true)
    setAvesDe('cajas')
    cambiarPesada({ ...pesada, pollosPorCaja: t }, 'cajas')
  }
  function abrirPesada() {
    setPesadaTocada(true)
    const porCaja = cajasDel?.pollosPorCaja ?? precios?.pollosPorCaja ?? POLLOS_POR_CAJA
    setPesada({ ...pesadaNueva(), pollosPorCaja: String(porCaja) })
  }
  // Sin la pesada, el peso que dio se queda escrito.
  function quitarPesada() {
    setPesadaTocada(true)
    if (lb > 0) setPesoLb(String(lb))
    setPesada(null)
  }

  // Los precios que ya se usaron vendiendo así, para tocarlos.
  const usados = precios?.recientes[arreglado ? 'arreglado' : 'pie'] ?? []

  // Cada quien paga su precio: al elegir un comprador de antes, en una venta
  // nueva, sale el precio que se le puso la última vez.
  const previo = comprador.trim() ? precios?.porComprador.get(comprador.trim().toLowerCase()) : undefined
  // Sus cajas pesan casi lo mismo cada vez: si hoy salen muy distintas, se nota.
  const cajasDel = comprador.trim() ? precios?.cajasDe.get(comprador.trim().toLowerCase()) : undefined
  const pistaCajas =
    cajasDel?.lbPorCaja != null
      ? `Las cajas de ${comprador.trim()} pesaron ${numCorto(cajasDel.lbPorCaja, 1)} lb cada una la última vez${
          cajasDel.pollosPorCaja ? `, con ${num(cajasDel.pollosPorCaja)} pollos` : ''
        }.`
      : undefined
  function elegirComprador(nombre: string) {
    setComprador(nombre)
    const clave = nombre.trim().toLowerCase()
    // Cada pollero con su costumbre: si suele cargar 13 por caja, sale 13; uno
    // que no se conoce, lo de la granja.
    const porCaja = precios?.cajasDe.get(clave)?.pollosPorCaja ?? precios?.pollosPorCaja ?? POLLOS_POR_CAJA
    if (pesada && !ppcTocado && String(porCaja) !== pesada.pollosPorCaja)
      cambiarPesada({ ...pesada, pollosPorCaja: String(porCaja) })
    if (editar || precioTocado) return
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
  // Lo que pesa cada pollo el día de la venta, por el último pesaje y la curva
  // del lote: con eso salen las aves por el peso. Sin pesajes no se estima.
  const pesoVivoAve =
    metrics.pesoEstimadoLb == null
      ? undefined
      : fecha === hoyISO()
        ? metrics.pesoEstimadoLb
        : pesoEstandarLb(diasEntre(lote.fechaInicio, fecha)) * metrics.factorCurva
  const pesoAveVenta = pesoVivoAve != null && arreglado ? pesoVivoAve * (rinde / 100) : pesoVivoAve
  const resumenP = pesadaLeida ? resumenPesada(pesadaLeida) : undefined
  const porCajasP = resumenP?.aves
  const porPesoP = pesadaLeida ? avesPorPeso(lb, pesoAveVenta) : undefined
  // La cuenta que está puesta: la que se eligió, o la otra si esa falta.
  const avesElegidas: FuenteAves =
    avesDe === 'mano'
      ? 'mano'
      : avesDe === 'cajas'
        ? porCajasP != null
          ? 'cajas'
          : 'peso'
        : porPesoP != null
          ? 'peso'
          : 'cajas'
  const avesDeLaPesada = avesDe !== 'mano' && (avesElegidas === 'cajas' ? porCajasP : porPesoP) != null
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

  // Lo que se guarda de pollos por caja es lo que de verdad llevaron: si las
  // aves salieron del peso o se escribieron, las aves entre las cajas. Así el
  // pollero que sobrecarga queda con su cuenta para la próxima venta.
  function pesadaAGuardar() {
    if (!pesadaLeida || !(pesadaLeida.llenas.length > 0 || pesadaLeida.vacias.length > 0)) return undefined
    const cajas = resumenP?.cajas ?? 0
    const porCaja = cajas > 0 && nAves > 0 ? Math.round(nAves / cajas) : 0
    return avesElegidas !== 'cajas' && porCaja > 0 ? { ...pesadaLeida, pollosPorCaja: porCaja } : pesadaLeida
  }

  async function guardar() {
    const quien = recibidoPor !== '' ? Number(recibidoPor) : undefined
    const datos = {
      loteId: lote.id,
      tipo: 'aves' as const,
      cantidad: nAves,
      pesoLb: pesada ? (lb > 0 ? lb : undefined) : pesoLb ? Number(pesoLb) : undefined,
      precioLb: precioLb > 0 ? precioLb : undefined,
      arreglado: arreglado ? { rindePct: rinde } : undefined,
      pesada: pesadaAGuardar(),
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
            hint={
              avesDeLaPesada
                ? avesElegidas === 'peso'
                  ? 'Salen del peso'
                  : 'Salen de las cajas'
                : !editar && lote.estado === 'activo'
                  ? `Tienes ${num(metrics.avesVivas)} vivas`
                  : undefined
            }
            error={errorAves}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={cantidad}
              onChange={(e) => {
                setCantidad(e.target.value)
                setAvesDe('mano')
              }}
              aria-invalid={!!errorAves}
            />
          </Field>
          <Field
            label={arreglado ? 'Libras arregladas' : 'Peso total (lb)'}
            error={errorPeso}
            hint={pesada ? 'Sale de las cajas' : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={pesada ? (lb > 0 ? String(lb) : '') : pesoLb}
              readOnly={!!pesada}
              onChange={(e) => {
                setPesoLb(e.target.value)
                recalcular(Number(e.target.value) || 0, precioLb)
              }}
              className={pesada ? 'bg-paper-sunken text-ink-soft' : undefined}
            />
          </Field>
          {pesada ? (
            <PesadaPorCajas
              valor={pesada}
              onCambio={(v) => cambiarPesada(v)}
              onQuitar={quitarPesada}
              pista={pistaCajas}
            >
              <AvesDeLaPesada
                cajas={resumenP?.cajas ?? 0}
                pollosPorCaja={pesada.pollosPorCaja}
                onPollosPorCaja={cambiarPollosPorCaja}
                porCajas={porCajasP}
                porPeso={porPesoP}
                netoLb={lb}
                pesoAveLb={pesoAveVenta}
                diasDesdePeso={metrics.diasDesdePeso}
                arreglado={arreglado}
                elegida={avesElegidas}
                onElegir={elegirAves}
              />
            </PesadaPorCajas>
          ) : (
            <BotonPesada onClick={abrirPesada} />
          )}
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
            !!errPesada ||
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
