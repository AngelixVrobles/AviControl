import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { db, type Raza, type Socio, type TipoLote } from '../db/schema'
import { Button, Field, Input, Select } from '../components/ui'
import { IconBack, IconClose, IconEgg, IconScale } from '../components/icons'
import { hoyISO } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { RAZAS } from '../lib/labels'
import { EDAD_INICIAL_DEFAULT, RAZA_DEFAULT } from '../lib/standards'

export function NuevoLote() {
  const nav = useNavigate()
  const settings = useSettings()
  const [tipo, setTipo] = useState<TipoLote>('engorde')
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [cantidad, setCantidad] = useState('')
  const [costoAve, setCostoAve] = useState('')
  const [raza, setRaza] = useState<Raza>(RAZA_DEFAULT)
  const [precioLb, setPrecioLb] = useState('')
  const [edadSemanas, setEdadSemanas] = useState(String(EDAD_INICIAL_DEFAULT))
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
      tipo,
      nombre: nombre.trim() || autoNombre(fechaInicio),
      fechaInicio,
      cantidadInicial: cantidadNum,
      costoInicial,
      estado: 'activo',
      raza: tipo === 'engorde' ? raza : undefined,
      precioVentaLb: tipo === 'engorde' && Number(precioLb) > 0 ? Number(precioLb) : undefined,
      edadInicialSemanas: tipo === 'ponedora' ? Number(edadSemanas) || EDAD_INICIAL_DEFAULT : undefined,
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
        <h1 className="font-display text-xl font-semibold">Nuevo lote</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <TipoBtn
          active={tipo === 'engorde'}
          onClick={() => setTipo('engorde')}
          icon={<IconScale width={24} height={24} />}
          title="Engorde"
          sub="Pollos de carne"
          tone="engorde"
        />
        <TipoBtn
          active={tipo === 'ponedora'}
          onClick={() => setTipo('ponedora')}
          icon={<IconEgg width={24} height={24} />}
          title="Ponedoras"
          sub="Gallinas de huevo"
          tone="ponedora"
        />
      </div>

      <div className="mt-6 space-y-5">
        {tipo === 'engorde' && (
          <Field label="Raza" hint="Define las curvas de peso y consumo de referencia.">
            <div className="flex gap-1 rounded-full bg-paper-sunken p-1">
              {RAZAS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRaza(r.id)}
                  className={clsx(
                    'flex-1 rounded-full py-2.5 text-sm font-semibold transition',
                    raza === r.id ? 'bg-paper-raised text-ink shadow-card' : 'text-ink-faint',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Nombre del lote" hint="Opcional. Si lo dejas vacío se genera solo.">
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
          <Field label={tipo === 'engorde' ? 'Nº de pollitos' : 'Nº de gallinas'}>
            <Input
              type="number"
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        {tipo === 'ponedora' && (
          <Field
            label="Edad al inicio (semanas)"
            hint="Edad de las gallinas cuando llegan. Se usa para comparar tu postura con el estándar."
          >
            <Input
              type="number"
              inputMode="numeric"
              value={edadSemanas}
              onChange={(e) => setEdadSemanas(e.target.value)}
            />
          </Field>
        )}

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
          {tipo === 'engorde' && (
            <Field label="Precio venta / lb" hint="Opcional, para proyectar.">
              <Input
                type="number"
                inputMode="decimal"
                value={precioLb}
                onChange={(e) => setPrecioLb(e.target.value)}
                placeholder="0"
              />
            </Field>
          )}
        </div>

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
          Crear lote
        </Button>
      </div>
    </div>
  )
}

function autoNombre(fecha: string) {
  return `Lote ${fecha}`
}

function TipoBtn({
  active,
  onClick,
  icon,
  title,
  sub,
  tone,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  sub: string
  tone: 'engorde' | 'ponedora'
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl2 border-2 p-4 text-left transition',
        active
          ? tone === 'engorde'
            ? 'border-forest-500 bg-forest-50'
            : 'border-amber-600 bg-amber-400/10'
          : 'border-line bg-paper-raised',
      )}
    >
      <div
        className={clsx(
          'mb-2 grid h-11 w-11 place-items-center rounded-full',
          tone === 'engorde' ? 'bg-forest-100 text-forest-700' : 'bg-amber-400/20 text-amber-700',
        )}
      >
        {icon}
      </div>
      <div className="font-display text-base font-semibold">{title}</div>
      <div className="text-xs text-ink-faint">{sub}</div>
    </button>
  )
}
