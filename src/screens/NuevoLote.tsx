import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { db, type Socio } from '../db/schema'
import { Button, Field, Input, Select } from '../components/ui'
import { IconBack } from '../components/icons'
import { EditorSocios } from '../components/Socios'
import { DatosRecibo } from '../components/Recibo'
import { reciboParaGuardar } from '../lib/arranque'
import { useEnvio } from '../components/useEnvio'
import { fecha as fechaCorta, hoyISO, num } from '../lib/format'
import { errorFechaFutura, errorNegativo } from '../lib/lote'
import { useLotes, useSettings } from '../lib/hooks'
import { galponDe, galponLibre } from '../lib/galpones'
import type { Galpon } from '../lib/settings'
import { RAZA } from '../lib/labels'
import { equipoDeLaGranja, resumenEquipo } from '../lib/equipo'
import { sociosParaGuardar } from '../lib/sociedad'
import { diaParaPeso } from '../lib/standards'

export function NuevoLote() {
  const nav = useNavigate()
  const settings = useSettings()
  // Un toque crea un ciclo: con dos seguidos se creaban dos iguales.
  const { ocupado, enviar } = useEnvio()
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [cantidad, setCantidad] = useState('')
  const [costoAve, setCostoAve] = useState('')
  const [precioQuintal, setPrecioQuintal] = useState('')
  const [precioLb, setPrecioLb] = useState('')
  // El de Ajustes es el punto de partida; el ciclo guarda el suyo y se corrige
  // después con el lápiz sin tocar los demás.
  const [pesoVenta, setPesoVenta] = useState(() => String(settings.pesoObjetivoLb))
  const [enSociedad, setEnSociedad] = useState(false)
  const [socios, setSocios] = useState<Socio[]>([
    { nombre: 'Yo', pct: 50 },
    { nombre: 'Socio', pct: 50 },
  ])
  const [pagoAves, setPagoAves] = useState('')
  const [notas, setNotas] = useState('')
  const [incubadora, setIncubadora] = useState('')
  const [pesoLlegada, setPesoLlegada] = useState('')
  const [muertosLlegada, setMuertosLlegada] = useState('')
  // Con varios galpones, el primero que no tiene un ciclo en curso; se elige
  // otro si los pollitos van a otro lado.
  const activos = useLotes('activo')
  const [galponElegido, setGalponElegido] = useState<string>()
  const galpon =
    settings.galpones.find((g) => g.id === galponElegido) ??
    (activos ? galponLibre(settings.galpones, activos) : galponDe(undefined, settings))
  const varios = settings.galpones.length > 1

  const cantidadNum = Math.max(0, Math.round(Number(cantidad) || 0))
  const pesoNum = Number(pesoVenta) || 0
  const pesoQueRige = pesoNum > 0 ? pesoNum : settings.pesoObjetivoLb
  const errorMuertos =
    cantidadNum > 0 && (Number(muertosLlegada) || 0) >= cantidadNum
      ? 'Son más de los pollitos que recibiste.'
      : undefined
  // El calendario del iPhone no respeta el máximo: una fecha que todavía no
  // llega dejaba el ciclo en el día 0, sin poder anotar nada.
  const errorInicio = errorFechaFutura(fechaInicio)
  const errores = {
    costo: errorNegativo(costoAve),
    quintal: errorNegativo(precioQuintal),
    precio: errorNegativo(precioLb),
    peso: errorNegativo(pesoVenta),
  }
  const negativo = Object.values(errores).some(Boolean)
  const valido = cantidadNum > 0 && !errorInicio && !errorMuertos && !negativo
  const motivo = !(cantidadNum > 0)
    ? 'Falta cuántos pollitos recibiste.'
    : errorInicio
      ? 'La fecha de inicio todavía no llega.'
      : negativo
        ? 'Hay un número negativo.'
        : errorMuertos

  async function crear() {
    const costoInicial = Math.max(0, Number(costoAve) || 0) * cantidadNum
    const guardados = enSociedad
      ? sociosParaGuardar(socios, pagoAves !== '' ? Number(pagoAves) : undefined)
      : null
    // Con menos de dos socios no hay sociedad que llevar.
    const reparto = guardados && guardados.socios.length >= 2 ? guardados : null
    const id = await db.lotes.add({
      tipo: 'engorde',
      nombre: nombre.trim() || autoNombre(fechaInicio),
      fechaInicio,
      cantidadInicial: cantidadNum,
      costoInicial,
      estado: 'activo',
      precioQuintal: Number(precioQuintal) > 0 ? Number(precioQuintal) : undefined,
      precioVentaLb: Number(precioLb) > 0 ? Number(precioLb) : undefined,
      pesoObjetivoLb: pesoQueRige,
      socios: reparto?.socios,
      costoInicialPagadoPor: reparto && costoInicial > 0 ? reparto.pagador : undefined,
      galponId: varios ? galpon?.id : undefined,
      ...reciboParaGuardar(incubadora, pesoLlegada, muertosLlegada),
      notas: notas.trim() || undefined,
      creado: Date.now(),
    })
    nav(`/lotes/${id}`, { replace: true })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper px-5 pb-10 safe-t">
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => nav(-1)}
          className="grid h-11 w-11 place-items-center rounded-full bg-paper-sunken"
          aria-label="Volver"
        >
          <IconBack width={22} height={22} />
        </button>
        <div>
          <h1 className="font-display text-xl font-semibold leading-tight">Nuevo ciclo</h1>
          <p className="text-sm text-ink-faint">Pollo de engorde {RAZA}</p>
        </div>
      </header>

      <div className="space-y-5">
        <Field label="Nombre del ciclo" hint="Opcional. Si lo dejas vacío se genera solo.">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={autoNombre(fechaInicio)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de inicio" error={errorInicio}>
            <Input
              type="date"
              value={fechaInicio}
              max={hoyISO()}
              onChange={(e) => setFechaInicio(e.target.value)}
              aria-invalid={!!errorInicio}
            />
          </Field>
          <Field label="Nº de pollitos">
            <Input
              type="number"
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Costo por ave" hint={`En ${settings.moneda}.`} error={errores.costo}>
            <Input
              type="number"
              inputMode="decimal"
              value={costoAve}
              onChange={(e) => setCostoAve(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Precio del quintal" hint="Alimento, 100 lb." error={errores.quintal}>
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
          <Field
            label="Peso de venta"
            hint={`Cobb lo alcanza hacia el día ${diaParaPeso(pesoQueRige)}.`}
            error={errores.peso}
          >
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
          <Field label="Precio por libra" hint="Opcional. Con esto se proyecta la ganancia." error={errores.precio}>
            <Input
              type="number"
              inputMode="decimal"
              value={precioLb}
              onChange={(e) => setPrecioLb(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        {varios && (
          <Field label="Galpón" hint="Donde van a estar los pollitos.">
            <Select value={galpon?.id ?? ''} onChange={(e) => setGalponElegido(e.target.value)}>
              {settings.galpones.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {cantidadNum > 0 && <EquipoNecesario aves={cantidadNum} pesoVentaLb={pesoQueRige} galpon={galpon} />}

        <DatosRecibo
          incubadora={incubadora}
          onIncubadora={setIncubadora}
          pesoG={pesoLlegada}
          onPesoG={setPesoLlegada}
          muertos={muertosLlegada}
          onMuertos={setMuertosLlegada}
          errorMuertos={errorMuertos}
        />

        <EditorSocios
          titulo="Llevar en sociedad"
          nota="Reparte gastos y ganancias entre socios."
          activo={enSociedad}
          onActivo={setEnSociedad}
          socios={socios}
          onSocios={(s) => {
            // Al quitar una fila los de abajo suben: el que pagó ya no sería el mismo.
            if (s.length < socios.length) setPagoAves('')
            setSocios(s)
          }}
        >
          {Number(costoAve) > 0 && (
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
      </div>

      <div className="mt-8">
        <Button block disabled={!valido || ocupado} motivo={motivo} onClick={enviar(crear)}>
          Crear ciclo
        </Button>
      </div>
    </div>
  )
}

// «Ciclo 17-oct»: como dice la app, y con la fecha como se lee aquí. Antes
// salía «Lote 2026-10-17».
function autoNombre(fecha: string) {
  return `Ciclo ${fechaCorta(fecha)}`
}

// Antes de recibir los pollitos: lo que hace falta montar en el galpón para esa
// cantidad, con el equipo que la granja tiene anotado, y si caben.
function EquipoNecesario({
  aves,
  pesoVentaLb,
  galpon,
}: {
  aves: number
  pesoVentaLb: number
  galpon?: Galpon
}) {
  const settings = useSettings()
  const plan = equipoDeLaGranja(aves, pesoVentaLb, diaParaPeso(pesoVentaLb), settings, galpon)
  if (!plan) return null
  const g = plan.galpon
  const cual = settings.galpones.length > 1 && galpon ? galpon.nombre : 'Tu galpón'
  return (
    <div className="rounded-xl2 border border-line bg-paper-raised p-4">
      <div className="text-sm font-medium text-ink-soft">Para {num(aves)} pollitos vas a necesitar</div>
      <p className="mt-1 text-sm leading-relaxed text-ink tnum">{resumenEquipo(plan)}</p>
      {g && (
        <p
          className={clsx(
            'mt-2 text-sm leading-relaxed tnum',
            g.sobrepoblado ? 'font-medium text-clay-text' : 'text-ink-soft',
          )}
        >
          {g.sobrepoblado
            ? `${cual} aguanta ${num(g.avesMaximas)} aves al peso de venta: con ${num(aves)} quedan apretadas.`
            : `${cual} aguanta ${num(g.avesMaximas)} aves al peso de venta.`}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-faint">
        {g
          ? 'El detalle y cómo repartirlos está en la ficha Galpón del ciclo.'
          : `Pon las medidas ${settings.galpones.length > 1 && galpon ? `de ${galpon.nombre}` : 'del galpón'} en Ajustes y te digo si caben.`}
      </p>
    </div>
  )
}
