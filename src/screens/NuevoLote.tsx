import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { db, type Socio } from '../db/schema'
import { Button, Field, Input, Select } from '../components/ui'
import { IconBack, IconClose } from '../components/icons'
import { hoyISO } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { RAZA } from '../lib/labels'

export function NuevoLote() {
  const nav = useNavigate()
  const settings = useSettings()
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [cantidad, setCantidad] = useState('')
  const [costoAve, setCostoAve] = useState('')
  const [precioQuintal, setPrecioQuintal] = useState('')
  const [precioLb, setPrecioLb] = useState('')
  const [enSociedad, setEnSociedad] = useState(false)
  const [socios, setSocios] = useState<Socio[]>([
    { nombre: 'Yo', pct: 50 },
    { nombre: 'Socio', pct: 50 },
  ])
  const [pagoAves, setPagoAves] = useState('')
  const [notas, setNotas] = useState('')

  const cantidadNum = Number(cantidad) || 0
  const valido = cantidadNum > 0 && fechaInicio
  const sumaPct = socios.reduce((a, s) => a + (Number(s.pct) || 0), 0)

  function setSocio(i: number, patch: Partial<Socio>) {
    setSocios((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }

  async function crear() {
    const costoInicial = (Number(costoAve) || 0) * cantidadNum
    const id = await db.lotes.add({
      tipo: 'engorde',
      nombre: nombre.trim() || autoNombre(fechaInicio),
      fechaInicio,
      cantidadInicial: cantidadNum,
      costoInicial,
      estado: 'activo',
      precioQuintal: Number(precioQuintal) > 0 ? Number(precioQuintal) : undefined,
      precioVentaLb: Number(precioLb) > 0 ? Number(precioLb) : undefined,
      socios: enSociedad ? socios.filter((s) => s.nombre.trim()) : undefined,
      costoInicialPagadoPor: enSociedad && pagoAves !== '' ? Number(pagoAves) : undefined,
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
          <p className="text-[13px] text-ink-faint">Pollo de engorde {RAZA}</p>
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
          <Field label="Fecha de inicio">
            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
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
          <Field label="Costo por ave" hint={`En ${settings.moneda}.`}>
            <Input
              type="number"
              inputMode="decimal"
              value={costoAve}
              onChange={(e) => setCostoAve(e.target.value)}
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

        <Field label="Precio de venta por libra" hint="Opcional. Con esto se proyecta la ganancia.">
          <Input
            type="number"
            inputMode="decimal"
            value={precioLb}
            onChange={(e) => setPrecioLb(e.target.value)}
            placeholder="0"
          />
        </Field>

        <div className="rounded-xl2 border border-line bg-paper-raised p-4">
          <button
            onClick={() => setEnSociedad((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="text-left">
              <div className="font-display text-base font-semibold">Llevar en sociedad</div>
              <div className="text-xs text-ink-faint">Reparte gastos y ganancias entre socios.</div>
            </div>
            <span
              className={clsx(
                'relative h-6 w-10 rounded-full transition',
                enSociedad ? 'bg-forest-500' : 'bg-line',
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow-card transition-all',
                  enSociedad ? 'left-[18px]' : 'left-0.5',
                )}
              />
            </span>
          </button>

          {enSociedad && (
            <div className="mt-4 space-y-3">
              {socios.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={s.nombre}
                    onChange={(e) => setSocio(i, { nombre: e.target.value })}
                    placeholder="Nombre"
                    className="flex-1"
                  />
                  <div className="relative w-24">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={String(s.pct)}
                      onChange={(e) => setSocio(i, { pct: Number(e.target.value) || 0 })}
                      className="pr-7 text-center"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                      %
                    </span>
                  </div>
                  {socios.length > 2 && (
                    <button
                      onClick={() => setSocios((p) => p.filter((_, j) => j !== i))}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint active:bg-paper-sunken"
                      aria-label="Quitar socio"
                    >
                      <IconClose width={18} height={18} />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSocios((p) => [...p, { nombre: '', pct: 0 }])}
                  className="text-sm font-medium text-forest-600"
                >
                  + Agregar socio
                </button>
                <span className={clsx('text-xs tnum', sumaPct === 100 ? 'text-ink-faint' : 'text-clay-deep')}>
                  Suma {sumaPct}%
                </span>
              </div>

              {Number(costoAve) > 0 && (
                <Field label="¿Quién pagó las aves?">
                  <Select value={pagoAves} onChange={(e) => setPagoAves(e.target.value)}>
                    <option value="">Común (según %)</option>
                    {socios.map((s, i) => (
                      <option key={i} value={i}>
                        {s.nombre || `Socio ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          )}
        </div>

        <Field label="Notas">
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Proveedor, galpón…" />
        </Field>
      </div>

      <div className="mt-8">
        <Button block disabled={!valido} onClick={crear}>
          Crear ciclo
        </Button>
      </div>
    </div>
  )
}

function autoNombre(fecha: string) {
  return `Lote ${fecha}`
}
