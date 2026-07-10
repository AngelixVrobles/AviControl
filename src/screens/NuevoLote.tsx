import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { db, type TipoLote } from '../db/schema'
import { Button, Field, Input } from '../components/ui'
import { IconBack, IconEgg, IconScale } from '../components/icons'
import { hoyISO } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { EDAD_INICIAL_DEFAULT } from '../lib/standards'

export function NuevoLote() {
  const nav = useNavigate()
  const settings = useSettings()
  const [tipo, setTipo] = useState<TipoLote>('engorde')
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [cantidad, setCantidad] = useState('')
  const [costoAve, setCostoAve] = useState('')
  const [edadSemanas, setEdadSemanas] = useState(String(EDAD_INICIAL_DEFAULT))
  const [notas, setNotas] = useState('')

  const cantidadNum = Number(cantidad) || 0
  const valido = cantidadNum > 0 && fechaInicio

  async function crear() {
    const costoInicial = (Number(costoAve) || 0) * cantidadNum
    const id = await db.lotes.add({
      tipo,
      nombre: nombre.trim() || autoNombre(fechaInicio),
      fechaInicio,
      cantidadInicial: cantidadNum,
      costoInicial,
      estado: 'activo',
      edadInicialSemanas: tipo === 'ponedora' ? Number(edadSemanas) || EDAD_INICIAL_DEFAULT : undefined,
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

        <Field label="Costo por ave" hint={`En ${settings.moneda}. El costo total se calcula solo.`}>
          <Input
            type="number"
            inputMode="decimal"
            value={costoAve}
            onChange={(e) => setCostoAve(e.target.value)}
            placeholder="0"
          />
        </Field>

        <Field label="Notas">
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Raza, proveedor, galpón…" />
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
