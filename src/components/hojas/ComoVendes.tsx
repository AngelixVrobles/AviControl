import { useEffect, useState } from 'react'
import { db, type Ingreso, type Lote } from '../../db/schema'
import { Button, Field, Input, Segmentado, Sheet } from '../ui'
import { toast } from '../confirm'
import { money, num } from '../../lib/format'
import { usePreciosDeVenta, useSettings } from '../../lib/hooks'
import type { LoteMetrics } from '../../lib/metrics'
import type { Proyeccion } from '../../lib/proyeccion'
import { saveSettings } from '../../lib/settings'
import { arregladoContraPie, precioCorto, precioPromedio, rindeValido } from '../../lib/venta'
import { PreciosUsados } from '../Venta'
import { useEnvio } from '../useEnvio'

const redondo = (n: number) => Math.round(n * 100) / 100

// Cómo se vende el pollo y a cómo: de ahí sale lo que entra en la ganancia
// estimada. En pie, al pollero, por libra viva; arreglado —matado y limpio—,
// por libra limpia, a cada quien su precio. Cómo se vende, el rinde y lo que
// cuesta arreglarlo son de la granja y quedan en Ajustes; el precio es el de
// este ciclo.
export function ComoVendesSheet({
  lote,
  metrics,
  ingresos,
  proyeccion,
  open,
  onClose,
}: {
  lote: Lote
  metrics: LoteMetrics
  ingresos: Ingreso[]
  proyeccion: Proyeccion | null
  open: boolean
  onClose: () => void
}) {
  const settings = useSettings()
  const precios = usePreciosDeVenta()
  const { ocupado, enviar } = useEnvio(open)
  const [arreglado, setArreglado] = useState(false)
  const [rinde, setRinde] = useState('')
  const [costo, setCosto] = useState('')
  const [precio, setPrecio] = useState('')
  const [precioPie, setPrecioPie] = useState('')

  useEffect(() => {
    if (!open) return
    setArreglado(settings.venta === 'arreglado')
    setRinde(String(settings.rindePct))
    setCosto(settings.costoArregloAve ? String(settings.costoArregloAve) : '')
    setPrecio(lote.precioVentaLb ? String(lote.precioVentaLb) : '')
    setPrecioPie(settings.precioMercadoLb ? String(settings.precioMercadoLb) : '')
  }, [open, settings, lote.precioVentaLb])

  const rindeN = Number(rinde) || 0
  const costoN = Math.max(0, Number(costo) || 0)
  const precioN = Math.max(0, Number(precio) || 0)
  const precioPieN = Math.max(0, Number(precioPie) || 0)
  const promedio = precioPromedio(ingresos, arreglado)
  const errorRinde = arreglado && !rindeValido(rindeN) ? 'Va de 50 a 95 %.' : undefined

  // Al cambiar cómo se vende, el precio que había ya no es de esa libra: se
  // propone el de las ventas que salieron así.
  function cambiar(v: boolean) {
    setArreglado(v)
    if ((settings.venta === 'arreglado') === v && lote.precioVentaLb) {
      setPrecio(String(lote.precioVentaLb))
      return
    }
    const p =
      precioPromedio(ingresos, v) ??
      precios?.recientes[v ? 'arreglado' : 'pie'][0] ??
      (v ? undefined : settings.precioMercadoLb)
    setPrecio(p ? String(redondo(p)) : '')
  }

  // ¿Conviene arreglarlo? Con las aves que faltan por vender, al peso de venta.
  const contra =
    arreglado && precioN > 0 && precioPieN > 0 && rindeValido(rindeN) && proyeccion && proyeccion.avesAlVender > 0
      ? arregladoContraPie(proyeccion.avesAlVender, proyeccion.pesoVentaLb, precioN, precioPieN, {
          arreglado: true,
          rinde: rindeN / 100,
          costoAve: costoN,
        })
      : undefined
  const diferencia = contra ? contra.arreglado - contra.enPie : 0

  async function guardar() {
    saveSettings({
      venta: arreglado ? 'arreglado' : 'pie',
      ...(arreglado
        ? { rindePct: rindeN, costoArregloAve: costoN, precioMercadoLb: precioPieN || settings.precioMercadoLb }
        : {}),
    })
    await db.lotes.update(lote.id, { precioVentaLb: precioN > 0 ? precioN : undefined })
    toast(
      precioN > 0
        ? `A ${precioCorto(precioN)} la libra ${arreglado ? 'arreglada' : 'en pie'}`
        : arreglado
          ? 'Vendes el pollo arreglado'
          : 'Vendes el pollo en pie',
    )
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Cómo vendes el pollo">
      <div className="space-y-4">
        <Segmentado
          etiqueta="Cómo vendes el pollo"
          valor={arreglado ? 'arreglado' : 'pie'}
          opciones={[
            { id: 'pie', label: 'En pie' },
            { id: 'arreglado', label: 'Arreglado' },
          ]}
          onCambio={(v) => cambiar(v === 'arreglado')}
        />
        <p className="text-sm leading-relaxed text-ink-soft">
          {arreglado
            ? 'Matado y limpio, por libra arreglada: menos libras a mejor precio. Vale para todos tus ciclos.'
            : 'Vivo, al pollero o a la granja, por libra en pie. Vale para todos tus ciclos.'}
        </p>

        {arreglado && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rinde (%)" error={errorRinde} hint={errorRinde ? undefined : 'De 100 lb en pie, las que quedan limpias'}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={50}
                  max={95}
                  value={rinde}
                  onChange={(e) => setRinde(e.target.value)}
                  aria-invalid={!!errorRinde}
                />
              </Field>
              <Field label="Arreglar cada pollo" hint="Gas, fundas, hielo">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
            {metrics.rindeObservadoPct != null && Math.round(metrics.rindeObservadoPct) !== rindeN ? (
              <button
                type="button"
                onClick={() => setRinde(String(Math.round(metrics.rindeObservadoPct!)))}
                className="-mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-paper-raised px-4 py-3 text-left text-sm"
              >
                <span className="text-ink-soft">
                  Con tus pesajes y lo que pesaron tus ventas, este ciclo rinde{' '}
                  <span className="font-semibold text-ink tnum">{num(metrics.rindeObservadoPct)} %</span>.
                </span>
                <span className="shrink-0 font-semibold text-forest-600">Usar</span>
              </button>
            ) : (
              <p className="-mt-1 text-xs leading-relaxed text-ink-faint">
                Con el menudo adentro rinde como 75 %; sin el pellejo o sin el menudo, menos. Si lo
                arreglan ustedes mismos, en «Arreglar cada pollo» va solo lo que se compra.
              </p>
            )}
          </>
        )}

        <Field
          label={arreglado ? 'Tu precio por libra arreglada' : 'Tu precio por libra en pie'}
          hint="El de este ciclo: con él se estima lo que falta por vender."
        >
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0"
          />
        </Field>
        {promedio != null && (
          <button
            type="button"
            onClick={() => setPrecio(String(redondo(promedio)))}
            className="-mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-paper-raised px-4 py-3 text-left text-sm"
          >
            <span className="text-ink-soft">
              Tus ventas {arreglado ? 'arregladas ' : ''}de este ciclo salen a{' '}
              <span className="font-semibold text-ink tnum">{precioCorto(redondo(promedio))}</span> la libra, con lo
              que pagó cada quien.
            </span>
            <span className="shrink-0 font-semibold text-forest-600">Usar</span>
          </button>
        )}
        <PreciosUsados
          precios={precios?.recientes[arreglado ? 'arreglado' : 'pie'] ?? []}
          actual={precioN}
          onElegir={(p) => setPrecio(String(p))}
        />

        {arreglado && (
          <Field label="Lo que paga el pollero en pie" hint="Para ver si te conviene arreglarlo.">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={precioPie}
              onChange={(e) => setPrecioPie(e.target.value)}
              placeholder="0"
            />
          </Field>
        )}
        {contra && proyeccion && (
          <div className="rounded-xl bg-paper-sunken px-4 py-3 text-sm leading-relaxed text-ink-soft tnum">
            <div>
              Las {num(proyeccion.avesAlVender)} aves que faltan, en pie a {precioCorto(precioPieN)}:{' '}
              {money(contra.enPie)}. Arregladas a {precioCorto(precioN)}
              {costoN > 0 ? `, menos ${precioCorto(costoN)} por arreglar cada una` : ''}: {money(contra.arreglado)}.
            </div>
            <div className="mt-1 font-semibold text-ink">
              {diferencia >= 0
                ? `Arreglarlas te deja ${money(diferencia)} más.`
                : `Arreglarlas te deja ${money(-diferencia)} menos: a ese precio conviene venderlas en pie.`}
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              Por debajo de {precioCorto(redondo(contra.precioIgualLb))} la libra arreglada, te deja más
              venderlo en pie.
            </div>
          </div>
        )}

        <Button block disabled={!!errorRinde || ocupado} onClick={enviar(guardar)}>
          Guardar
        </Button>
      </div>
    </Sheet>
  )
}
