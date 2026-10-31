import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { db, type Aplicacion, type Gasto, type Ingreso, type Lote, type Registro } from '../../db/schema'
import { Button, Field, Input, Select, Sheet } from '../ui'
import { toast } from '../confirm'
import { gananciaPorSocio } from '../../lib/sociedad'
import { diasEntre, hoyISO, money, num, numCorto, pct, porLb } from '../../lib/format'
import { useCompradores, useModoVenta, usePreciosDeVenta, useSettings } from '../../lib/hooks'
import type { LoteMetrics } from '../../lib/metrics'
import { proyectarVenta } from '../../lib/proyeccion'
import { construirContrastes, librasVendidas, snapshotCierre, type RealCiclo } from '../../lib/cierre'
import { errorFechaDelCiclo, errorNegativo, pesoObjetivoDe, topeDelCiclo } from '../../lib/lote'
import { retiroEn } from '../../lib/retiro'
import { RINDE_ARREGLADO_PCT } from '../../lib/standards'
import { precioCorto, precioSugerido, rindeValido } from '../../lib/venta'
import { useEnvio } from '../useEnvio'
import { ComoSalioElPollo, DatosDePago, PreciosUsados } from '../Venta'
import { BotonPesada, PesadaPorCajas } from '../Pesada'
import {
  errorPesada,
  leerPesada,
  librasDePesada,
  pesadaNueva,
  resumenPesada,
  type PesadaEnEdicion,
} from '../../lib/pesada'
import { AvisoRetiro } from './AvisoRetiro'
import { DatoCierre, FilaContraste } from './Contraste'

export function CierreSheet({
  lote,
  metrics,
  registros,
  gastos,
  ingresos = [],
  open,
  onClose,
  aplicaciones = [],
}: {
  lote: Lote
  metrics: LoteMetrics
  registros: Registro[]
  gastos: Gasto[]
  ingresos?: Ingreso[]
  open: boolean
  onClose: () => void
  aplicaciones?: Aplicacion[]
}) {
  const { ocupado, enviar } = useEnvio(open)
  const [paso, setPaso] = useState(1)
  const [aves, setAves] = useState('')
  const [pesoTotal, setPesoTotal] = useState('')
  const [precio, setPrecio] = useState('')
  const [monto, setMonto] = useState('')
  const [montoTocado, setMontoTocado] = useState(false)
  const [fecha, setFecha] = useState(hoyISO())
  const [recibidoPor, setRecibidoPor] = useState('')
  const conocidos = useCompradores()
  const [comprador, setComprador] = useState('')
  const [credito, setCredito] = useState(false)
  const [adelanto, setAdelanto] = useState('')
  const [arreglado, setArreglado] = useState(false)
  const [precioTocado, setPrecioTocado] = useState(false)
  // El comprador cuyo precio se puso solo, como en «Venta».
  const [deComprador, setDeComprador] = useState<string>()
  // La pesada por cajas, como en «Venta».
  const [pesada, setPesada] = useState<PesadaEnEdicion | null>(null)
  const [pesadaTocada, setPesadaTocada] = useState(false)
  const settings = useSettings()
  const modo = useModoVenta()
  const precios = usePreciosDeVenta()

  useEffect(() => {
    if (!open) return
    setPaso(1)
    setArreglado(modo.arreglado)
    setPrecioTocado(false)
    setDeComprador(undefined)
    setAves(String(metrics.avesVivas))
    setPesoTotal('')
    setPrecio(lote.precioVentaLb ? String(lote.precioVentaLb) : '')
    setMonto('')
    setMontoTocado(false)
    setFecha(hoyISO())
    setRecibidoPor('')
    setComprador('')
    setCredito(false)
    setAdelanto('')
    setPesada(null)
    setPesadaTocada(false)
  }, [open, metrics.avesVivas, lote.precioVentaLb, modo.arreglado])

  useEffect(() => {
    if (!open || pesadaTocada || !precios?.porCajas) return
    setPesada((p) => p ?? pesadaNueva())
  }, [open, pesadaTocada, precios?.porCajas])

  // Aves enteras y nada negativo: con −2,650 lb a −55 salía un total de
  // +145,750 y el ciclo se cerraba con ese peso.
  const nAves = Math.round(Number(aves) || 0)
  const pesadaLeida = pesada ? leerPesada(pesada) : undefined
  const errPesada = pesada ? errorPesada(pesada) : undefined
  const lbTotal = pesadaLeida ? librasDePesada(pesadaLeida) : Number(pesoTotal) || 0
  const precioLb = Number(precio) || 0
  const negativos = {
    aves: errorNegativo(aves),
    peso: pesada ? undefined : errorNegativo(pesoTotal),
    precio: errorNegativo(precio),
    monto: montoTocado ? errorNegativo(monto) : undefined,
  }
  const hayNegativos = Object.values(negativos).some(Boolean)
  const montoFinal = montoTocado ? Number(monto) || 0 : Math.round(lbTotal * precioLb)
  const dio = Math.min(Number(adelanto) || 0, montoFinal)
  // Si lo que dio al llevarse el pollo cubre todo, no fue a crédito.
  const aCredito = credito && dio < montoFinal
  const rinde = rindeValido(settings.rindePct) ? settings.rindePct : RINDE_ARREGLADO_PCT
  const pesoPorAve = nAves > 0 && lbTotal > 0 ? lbTotal / nAves : undefined
  // Arreglado, lo que pesaban vivas: es el que se compara con los pesajes.
  const pesoEnPieAve = pesoPorAve != null && arreglado ? pesoPorAve / (rinde / 100) : pesoPorAve

  const previo = comprador.trim() ? precios?.porComprador.get(comprador.trim().toLowerCase()) : undefined
  const cajasDel = comprador.trim() ? precios?.cajasDe.get(comprador.trim().toLowerCase()) : undefined
  const pistaCajas =
    cajasDel?.lbPorCaja != null
      ? `Las cajas de ${comprador.trim()} pesaron ${numCorto(cajasDel.lbPorCaja, 1)} lb cada una la última vez.`
      : undefined
  function elegirComprador(nombre: string) {
    setComprador(nombre)
    if (precioTocado) return
    const clave = nombre.trim().toLowerCase()
    const suyo = precios?.porComprador.get(clave)
    if (suyo) {
      setDeComprador(clave)
      setArreglado(suyo.arreglado)
      setPrecio(String(suyo.precio))
    } else if (deComprador) {
      setDeComprador(undefined)
      setArreglado(modo.arreglado)
      const p = precioSugerido(modo.arreglado, { precios, lote, settings })
      setPrecio(p ? String(p) : '')
    }
  }
  function cambiarComoSalio(v: boolean) {
    setArreglado(v)
    if (precioTocado) return
    const p = precioSugerido(v, { precios, lote, settings })
    setPrecio(p ? String(p) : '')
  }
  const parcial = nAves > 0 && nAves < metrics.avesVivas
  const dia = diasEntre(lote.fechaInicio, fecha)

  const proyeccion = proyectarVenta(
    lote,
    registros,
    gastos,
    metrics,
    pesoObjetivoDe(lote),
    modo,
  )
  // Si el ciclo ya se cerró una vez, lo que la app proyectaba entonces se queda.
  const snap = lote.cierre ?? snapshotCierre(metrics, proyeccion, dia)

  const ingresoTotal = metrics.ingresos + montoFinal
  const ganancia = ingresoTotal - metrics.costos
  // Cómo salió todo el ciclo, con las ventas de antes: el costo de todo el
  // ciclo entre las libras de esta venta sola daba RD$85 la libra donde eran 35.
  const todas = librasVendidas(
    [
      ...ingresos.filter((i) => i.tipo === 'aves'),
      {
        id: 0,
        tipo: 'aves',
        cantidad: nAves,
        pesoLb: lbTotal || undefined,
        monto: montoFinal,
        fecha,
        arreglado: arreglado ? { rindePct: rinde } : undefined,
        creado: 0,
      },
    ],
    metrics.pesoEstimadoLb,
  )
  const avesDelCiclo = metrics.vendidas + nAves
  const real: RealCiclo = {
    diaVenta: dia,
    avesVendidas: avesDelCiclo,
    lbVendidas: Math.round(todas.lbTotal),
    pesoPromedioLb: todas.pesoPromedioLb ?? pesoEnPieAve,
    precioLogradoLb: todas.precioLogradoLb,
    arreglado: todas.arreglado,
    pesoArregladoLb: todas.pesoArregladoLb,
    ingreso: montoFinal,
    ganancia,
    margenPct: ingresoTotal > 0 ? (ganancia / ingresoTotal) * 100 : 0,
    costoPorLb: todas.lbTotal > 0 ? metrics.costos / todas.lbTotal : undefined,
    gananciaPorAve: avesDelCiclo > 0 ? ganancia / avesDelCiclo : 0,
  }
  const contrastes = construirContrastes(snap, real)
  const sobranAves = nAves > metrics.avesVivas
  const listo =
    nAves > 0 && !sobranAves && montoFinal > 0 && !hayNegativos && !errPesada && !errorFechaDelCiclo(fecha, lote)
  const motivoCierre = hayNegativos
    ? 'Hay un número negativo.'
    : errPesada
      ? errPesada
    : !(nAves > 0)
      ? 'Falta cuántas aves vendiste.'
      : sobranAves
        ? `Solo hay ${num(metrics.avesVivas)} aves en el galpón.`
        : !(montoFinal > 0)
          ? 'Falta el peso y el precio, o el total de la venta.'
          : undefined
  const reparto = gananciaPorSocio([{ socios: lote.socios, ganancia }])

  // Aquí las aves se saben: lo que llevó cada caja queda como la cuenta de ese
  // pollero para la próxima venta.
  function pesadaAGuardar() {
    if (!pesadaLeida || !(pesadaLeida.llenas.length > 0 || pesadaLeida.vacias.length > 0)) return undefined
    const cajas = resumenPesada(pesadaLeida).cajas
    const porCaja = cajas > 0 && nAves > 0 ? Math.round(nAves / cajas) : 0
    return porCaja > 0 ? { ...pesadaLeida, pollosPorCaja: porCaja } : pesadaLeida
  }

  async function guardar() {
    const quien = recibidoPor !== '' ? Number(recibidoPor) : undefined
    await db.transaction('rw', db.ingresos, db.lotes, async () => {
      await db.ingresos.add({
        loteId: lote.id,
        tipo: 'aves',
        cantidad: nAves,
        pesoLb: lbTotal || undefined,
        precioLb: precioLb > 0 ? precioLb : undefined,
        arreglado: arreglado ? { rindePct: rinde } : undefined,
        pesada: pesadaAGuardar(),
        monto: montoFinal,
        fecha,
        comprador: comprador.trim() || undefined,
        credito: aCredito || undefined,
        recibidoPor: aCredito ? undefined : quien,
        cobros: aCredito ? (dio > 0 ? [{ fecha, monto: dio, recibidoPor: quien }] : []) : undefined,
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

          <ComoSalioElPollo arreglado={arreglado} onCambio={cambiarComoSalio} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Aves vendidas" hint={`Tienes ${num(metrics.avesVivas)} vivas`} error={negativos.aves}>
              <Input
                type="number"
                inputMode="numeric"
                value={aves}
                onChange={(e) => setAves(e.target.value)}
                className="h-14 text-lg"
              />
            </Field>
            <Field
              label={arreglado ? 'Libras arregladas' : 'Peso total (lb)'}
              hint={pesada ? 'Sale de las cajas' : arreglado ? 'Lo que pesaron limpios' : 'El del camión'}
              error={negativos.peso}
            >
              <Input
                type="number"
                inputMode="decimal"
                value={pesada ? (lbTotal > 0 ? String(lbTotal) : '') : pesoTotal}
                readOnly={!!pesada}
                onChange={(e) => setPesoTotal(e.target.value)}
                className={pesada ? 'h-14 bg-paper-sunken text-lg text-ink-soft' : 'h-14 text-lg'}
              />
            </Field>
          </div>

          {pesada ? (
            <PesadaPorCajas
              valor={pesada}
              onCambio={(v) => {
                setPesada(v)
                setPesadaTocada(true)
              }}
              onQuitar={() => {
                setPesadaTocada(true)
                if (lbTotal > 0) setPesoTotal(String(lbTotal))
                setPesada(null)
              }}
              pista={pistaCajas}
            />
          ) : (
            <BotonPesada
              onClick={() => {
                setPesadaTocada(true)
                setPesada(pesadaNueva())
              }}
            />
          )}

          {pesoPorAve != null && pesoEnPieAve != null && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-700">
              <span>{arreglado ? 'Arreglado, por ave' : 'Peso por ave'}</span>
              <span className="text-right tnum">
                <span className="font-display text-base font-semibold">{num(pesoPorAve, 2)} lb</span>
                {arreglado && (
                  <span className="block text-xs text-forest-700">
                    en pie {num(pesoEnPieAve, 2)} lb, al {num(rinde)}% de rinde
                  </span>
                )}
                {snap.pesoProyectadoLb != null && (
                  <span className={clsx('text-forest-700', arreglado && 'block text-xs')}>
                    {arreglado ? '' : ' · '}la app estimaba {num(snap.pesoProyectadoLb, 2)}
                    {arreglado ? ' en pie' : ''}
                  </span>
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio por libra" error={negativos.precio}>
              <Input
                type="number"
                inputMode="decimal"
                value={precio}
                onChange={(e) => {
                  setPrecio(e.target.value)
                  setPrecioTocado(true)
                }}
              />
            </Field>
            <Field label="Fecha de venta" error={errorFechaDelCiclo(fecha, lote)}>
              <Input
                type="date"
                value={fecha}
                min={lote.fechaInicio}
                max={topeDelCiclo(lote)}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Field>
          </div>

          <PreciosUsados
            precios={precios?.recientes[arreglado ? 'arreglado' : 'pie'] ?? []}
            actual={precioLb}
            onElegir={(p) => {
              setPrecioTocado(true)
              setPrecio(String(p))
            }}
          />

          <Field
            label="Total de la venta"
            hint={montoTocado ? 'Lo escribiste a mano' : 'Sale del peso por el precio; puedes corregirlo'}
            error={negativos.monto}
          >
            <Input
              type="number"
              inputMode="decimal"
              value={montoTocado ? monto : montoFinal ? String(montoFinal) : ''}
              onChange={(e) => {
                setMontoTocado(true)
                setMonto(e.target.value)
              }}
              className="h-14 text-lg"
            />
          </Field>

          <DatosDePago
            comprador={comprador}
            onComprador={elegirComprador}
            credito={credito}
            onCredito={setCredito}
            adelanto={adelanto}
            onAdelanto={setAdelanto}
            total={montoFinal}
            conocidos={conocidos}
            pistaComprador={
              previo
                ? `La última vez le vendiste a ${precioCorto(previo.precio)} la libra${previo.arreglado ? ' arreglada' : ' en pie'}.`
                : undefined
            }
          />

          {lote.socios && lote.socios.length >= 2 && (!aCredito || dio > 0) && (
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

          {parcial && (
            <p className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
              Quedan {num(metrics.avesVivas - nAves)} aves en el galpón, así que el ciclo sigue
              abierto. Ciérralo cuando salga el resto.
            </p>
          )}

          <AvisoRetiro retiro={retiroEn(aplicaciones, fecha)} fecha={fecha} />

          <Button block className="h-14" disabled={!listo} motivo={motivoCierre} onClick={() => setPaso(2)}>
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
                ganancia >= 0 ? 'text-forest-600' : 'text-clay-text',
              )}
            >
              {money(ganancia)}
            </div>
            <div className="mt-1.5 text-sm text-ink-soft tnum">
              {money(real.gananciaPorAve)} por ave · margen {pct(real.margenPct)}
            </div>
            {reparto.socios.length > 0 && (
              <div className="mt-3 divide-y divide-line border-t border-line">
                {reparto.socios.map((s) => (
                  <div key={s.nombre} className="flex items-baseline justify-between py-2">
                    <span className="text-sm">
                      {s.nombre} <span className="text-ink-faint tnum">{pct(s.pct, 0)}</span>
                    </span>
                    <span
                      className={clsx(
                        'font-display text-base font-semibold tnum',
                        s.monto >= 0 ? 'text-forest-600' : 'text-clay-text',
                      )}
                    >
                      {money(s.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
              <DatoCierre label="Vendiste" valor={`${num(nAves)} aves`} />
              <DatoCierre label={arreglado ? 'Arreglado' : 'En pie'} valor={`${num(lbTotal)} lb`} />
              <DatoCierre
                label="Costo por lb"
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
            <Button className="h-14 flex-[2]" disabled={ocupado} onClick={enviar(guardar)}>
              {parcial ? 'Guardar venta' : 'Cerrar ciclo'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
