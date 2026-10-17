import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, type Lote, type Socio } from '../db/schema'
import { borrarCiclo } from '../db/ciclo'
import { enumerar, money, num } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { galponDe } from '../lib/galpones'
import { erroresLote, type LimitesLote } from '../lib/lote'
import { sociosParaGuardar } from '../lib/sociedad'
import { diaParaPeso } from '../lib/standards'
import { confirmar, toast } from './confirm'
import { EditorSocios } from './Socios'
import { useEnvio } from './useEnvio'
import { Button, DangerButton, Field, Input, Select, Sheet } from './ui'

export interface ContenidoCiclo {
  registros: number
  gastos: number
  ventas: number
  pesajes: number
  aplicaciones: number
  entregas: number
}

// Corregir el ciclo después de crearlo —la fecha, los pollitos, lo que
// costaron, el peso al que se piensa vender— o borrarlo con todo lo suyo. Antes
// un error al crearlo obligaba a hacerlo de nuevo, y el ciclo malo se quedaba.
export function EditarLoteSheet({
  lote,
  limites,
  contenido,
  open,
  onClose,
}: {
  lote: Lote
  limites: LimitesLote
  contenido: ContenidoCiclo
  open: boolean
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Corregir el ciclo">
      {/* El formulario nace al abrir la hoja: así toma el ciclo tal como está y
          no se reinicia si algo cambia en la base mientras se escribe. */}
      <FormLote lote={lote} limites={limites} contenido={contenido} onClose={onClose} />
    </Sheet>
  )
}

const aTexto = (v: number | undefined) => (v != null && v > 0 ? String(v) : '')

function FormLote({
  lote,
  limites,
  contenido,
  onClose,
}: {
  lote: Lote
  limites: LimitesLote
  contenido: ContenidoCiclo
  onClose: () => void
}) {
  const nav = useNavigate()
  const settings = useSettings()
  // El formulario nace con la hoja abierta: un guardado por cada vez que se abre.
  const { ocupado, enviar } = useEnvio()
  const sociosAntes = lote.socios?.length ?? 0
  const [nombre, setNombre] = useState(lote.nombre)
  const [fechaInicio, setFechaInicio] = useState(lote.fechaInicio)
  const [cantidad, setCantidad] = useState(String(lote.cantidadInicial))
  const [costo, setCosto] = useState(aTexto(lote.costoInicial))
  const [precioQuintal, setPrecioQuintal] = useState(aTexto(lote.precioQuintal))
  const [precioLb, setPrecioLb] = useState(aTexto(lote.precioVentaLb))
  const [pesoVenta, setPesoVenta] = useState(aTexto(lote.pesoObjetivoLb))
  const [enSociedad, setEnSociedad] = useState(sociosAntes >= 2)
  const [socios, setSocios] = useState<Socio[]>(
    sociosAntes >= 2
      ? lote.socios!.map((s) => ({ ...s }))
      : [
          { nombre: 'Yo', pct: 50 },
          { nombre: 'Socio', pct: 50 },
        ],
  )
  const [pagoAves, setPagoAves] = useState(
    lote.costoInicialPagadoPor != null ? String(lote.costoInicialPagadoPor) : '',
  )
  const [notas, setNotas] = useState(lote.notas ?? '')
  const varios = settings.galpones.length > 1
  const [galponId, setGalponId] = useState(() => galponDe(lote, settings)?.id ?? '')

  const cantidadNum = Number(cantidad) || 0
  const costoNum = Number(costo) || 0
  const pesoNum = Number(pesoVenta) || 0
  const errores = erroresLote({ fechaInicio, cantidad: cantidadNum }, limites)
  const valido = !errores.fechaInicio && !errores.cantidad
  const pesoQueRige = pesoNum > 0 ? pesoNum : settings.pesoObjetivoLb

  async function guardar() {
    const guardados = enSociedad
      ? sociosParaGuardar(socios, pagoAves !== '' ? Number(pagoAves) : undefined, sociosAntes)
      : null
    // Con menos de dos socios no hay sociedad que llevar.
    const reparto = guardados && guardados.socios.length >= 2 ? guardados : null
    await db.lotes.update(lote.id, {
      nombre: nombre.trim() || lote.nombre,
      fechaInicio,
      cantidadInicial: cantidadNum,
      costoInicial: costoNum,
      precioQuintal: Number(precioQuintal) > 0 ? Number(precioQuintal) : undefined,
      precioVentaLb: Number(precioLb) > 0 ? Number(precioLb) : undefined,
      pesoObjetivoLb: pesoNum > 0 ? pesoNum : undefined,
      socios: reparto?.socios,
      costoInicialPagadoPor: reparto && costoNum > 0 ? reparto.pagador : undefined,
      galponId: varios ? galponId || undefined : lote.galponId,
      notas: notas.trim() || undefined,
    })
    toast('Ciclo corregido.')
    onClose()
  }

  async function borrar() {
    const partes = [
      [contenido.registros, 'día anotado', 'días anotados'],
      [contenido.gastos, 'gasto', 'gastos'],
      [contenido.ventas, 'venta', 'ventas'],
      [contenido.pesajes, 'pesaje', 'pesajes'],
      [contenido.aplicaciones, 'vacuna o medicina', 'vacunas y medicinas'],
      [contenido.entregas, 'entrega entre socios', 'entregas entre socios'],
    ] as const
    const lista = enumerar(partes)
    const con = lista ? ` con ${lista}` : ''
    const ok = await confirmar({
      titulo: `Borrar ${lote.nombre}`,
      mensaje: `Se borra el ciclo${con}. No se puede deshacer: si lo quieres guardar, haz antes un respaldo en Ajustes. Las deudas de la granja no se tocan.`,
      confirmar: 'Borrar el ciclo',
      peligro: true,
    })
    if (!ok) return
    try {
      await borrarCiclo(lote.id)
    } catch {
      toast('No se pudo borrar. El ciclo sigue como estaba.')
      return
    }
    toast('Ciclo borrado.')
    nav('/lotes', { replace: true })
  }

  return (
    <div className="space-y-5">
      <Field label="Nombre del ciclo">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={lote.nombre} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de inicio" error={errores.fechaInicio}>
          <Input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            aria-invalid={!!errores.fechaInicio}
          />
        </Field>
        <Field label="Nº de pollitos" error={errores.cantidad}>
          <Input
            type="number"
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            aria-invalid={!!errores.cantidad}
            placeholder="0"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Lo que costaron"
          hint={
            costoNum > 0 && cantidadNum > 0
              ? `${money(costoNum / cantidadNum, { decimales: 2 })} por pollito`
              : `Todos los pollitos, en ${settings.moneda}.`
          }
        >
          <Input
            type="number"
            inputMode="decimal"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Precio del quintal" hint="Alimento, 100 lb.">
          <Input
            type="number"
            inputMode="decimal"
            value={precioQuintal}
            onChange={(e) => setPrecioQuintal(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Peso de venta" hint={`Cobb lo alcanza hacia el día ${diaParaPeso(pesoQueRige)}.`}>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              value={pesoVenta}
              onChange={(e) => setPesoVenta(e.target.value)}
              placeholder={num(settings.pesoObjetivoLb, 1)}
              className="pr-10"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
              lb
            </span>
          </div>
        </Field>
        <Field label="Precio por libra" hint="Al que piensas vender.">
          <Input
            type="number"
            inputMode="decimal"
            value={precioLb}
            onChange={(e) => setPrecioLb(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>
      {!(pesoNum > 0) && (
        <p className="-mt-3 text-xs text-ink-faint">
          Vacío, el ciclo usa el peso de Ajustes ({num(settings.pesoObjetivoLb, 1)} lb).
        </p>
      )}

      {varios && (
        <Field label="Galpón">
          <Select value={galponId} onChange={(e) => setGalponId(e.target.value)}>
            {settings.galpones.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <EditorSocios
        titulo="Llevar en sociedad"
        nota={
          sociosAntes >= 2
            ? 'Los socios que ya tienen gastos o ventas no se quitan; se les cambia el nombre o la parte.'
            : 'Reparte gastos y ganancias entre socios.'
        }
        activo={enSociedad}
        onActivo={setEnSociedad}
        socios={socios}
        onSocios={(s) => {
          // Al quitar una fila los de abajo suben: el que pagó ya no sería el mismo.
          if (s.length < socios.length) setPagoAves('')
          setSocios(s)
        }}
        fijas={sociosAntes}
      >
        {costoNum > 0 && (
          <Field label="¿Quién pagó las aves?">
            <Select value={pagoAves} onChange={(e) => setPagoAves(e.target.value)}>
              <option value="">Común (según %)</option>
              {socios.map((s, i) => (
                <option key={i} value={i}>
                  {s.nombre.trim() || `Socio ${i + 1}`}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </EditorSocios>

      <Field label="Notas">
        <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Proveedor, galpón…" />
      </Field>

      <div className="space-y-2 pt-1">
        <Button block disabled={!valido || ocupado} onClick={enviar(guardar)}>
          Guardar cambios
        </Button>
        <DangerButton onClick={borrar}>Borrar este ciclo</DangerButton>
      </div>
    </div>
  )
}
