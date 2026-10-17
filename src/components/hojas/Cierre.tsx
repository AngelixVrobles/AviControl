import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { db, type Aplicacion, type Gasto, type Ingreso, type Lote, type Registro } from '../../db/schema'
import { Button, Field, Input, Select, Sheet } from '../ui'
import { toast } from '../confirm'
import { gananciaPorSocio } from '../../lib/sociedad'
import { diasEntre, hoyISO, money, num, pct, porLb } from '../../lib/format'
import { useCompradores } from '../../lib/hooks'
import type { LoteMetrics } from '../../lib/metrics'
import { proyectarVenta } from '../../lib/proyeccion'
import { construirContrastes, librasVendidas, snapshotCierre, type RealCiclo } from '../../lib/cierre'
import { errorFechaDelCiclo, pesoObjetivoDe, topeDelCiclo } from '../../lib/lote'
import { retiroEn } from '../../lib/retiro'
import { useEnvio } from '../useEnvio'
import { DatosDePago } from '../Venta'
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
    setComprador('')
    setCredito(false)
    setAdelanto('')
  }, [open, metrics.avesVivas, lote.precioVentaLb])

  const nAves = Number(aves) || 0
  const lbTotal = Number(pesoTotal) || 0
  const precioLb = Number(precio) || 0
  const montoFinal = montoTocado ? Number(monto) || 0 : Math.round(lbTotal * precioLb)
  const dio = Math.min(Number(adelanto) || 0, montoFinal)
  // Si lo que dio al llevarse el pollo cubre todo, no fue a crédito.
  const aCredito = credito && dio < montoFinal
  const pesoPorAve = nAves > 0 && lbTotal > 0 ? lbTotal / nAves : undefined
  const parcial = nAves > 0 && nAves < metrics.avesVivas
  const dia = diasEntre(lote.fechaInicio, fecha)

  const proyeccion = proyectarVenta(
    lote,
    registros,
    gastos,
    metrics,
    pesoObjetivoDe(lote),
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
      { id: 0, tipo: 'aves', cantidad: nAves, pesoLb: lbTotal || undefined, monto: montoFinal, fecha, creado: 0 },
    ],
    metrics.pesoEstimadoLb,
  )
  const avesDelCiclo = metrics.vendidas + nAves
  const real: RealCiclo = {
    diaVenta: dia,
    avesVendidas: avesDelCiclo,
    lbVendidas: Math.round(todas.lbTotal),
    pesoPromedioLb: todas.pesoPromedioLb ?? pesoPorAve,
    precioLogradoLb: todas.precioLogradoLb,
    ingreso: montoFinal,
    ganancia,
    margenPct: ingresoTotal > 0 ? (ganancia / ingresoTotal) * 100 : 0,
    costoPorLb: todas.lbTotal > 0 ? metrics.costos / todas.lbTotal : undefined,
    gananciaPorAve: avesDelCiclo > 0 ? ganancia / avesDelCiclo : 0,
  }
  const contrastes = construirContrastes(snap, real)
  const sobranAves = nAves > metrics.avesVivas
  const listo = nAves > 0 && !sobranAves && montoFinal > 0 && !errorFechaDelCiclo(fecha, lote)
  const motivoCierre = !(nAves > 0)
    ? 'Falta cuántas aves vendiste.'
    : sobranAves
      ? `Solo hay ${num(metrics.avesVivas)} aves en el galpón.`
      : !(montoFinal > 0)
        ? 'Falta el peso y el precio, o el total de la venta.'
        : undefined
  const reparto = gananciaPorSocio([{ socios: lote.socios, ganancia }])

  async function guardar() {
    const quien = recibidoPor !== '' ? Number(recibidoPor) : undefined
    await db.transaction('rw', db.ingresos, db.lotes, async () => {
      await db.ingresos.add({
        loteId: lote.id,
        tipo: 'aves',
        cantidad: nAves,
        pesoLb: lbTotal || undefined,
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

          <Field
            label="Total de la venta"
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

          <DatosDePago
            comprador={comprador}
            onComprador={setComprador}
            credito={credito}
            onCredito={setCredito}
            adelanto={adelanto}
            onAdelanto={setAdelanto}
            total={montoFinal}
            conocidos={conocidos}
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
                ganancia >= 0 ? 'text-forest-600' : 'text-clay-deep',
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
                        s.monto >= 0 ? 'text-forest-600' : 'text-clay-deep',
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
            <Button className="h-14 flex-[2]" disabled={ocupado} onClick={enviar(guardar)}>
              {parcial ? 'Guardar venta' : 'Cerrar ciclo'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
