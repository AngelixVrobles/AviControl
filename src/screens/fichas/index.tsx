import { useNavigate, useParams } from 'react-router-dom'
import { useLoteData, useSettings } from '../../lib/hooks'
import { Button } from '../../components/ui'
import { IconBack } from '../../components/icons'
import { FichaAlimento } from './Alimento'
import { FichaGalpon } from './Galpon'
import { FichaGastos } from './Gastos'
import { FichaMortalidad } from './Mortalidad'
import { FichaSanidad } from './Sanidad'

export const FICHAS = {
  aves: { titulo: 'Aves', sub: 'Semana a semana contra lo esperado' },
  alimento: { titulo: 'Alimento', sub: 'Lo que diste contra lo que tocaba' },
  sanidad: { titulo: 'Sanidad', sub: 'Plan de vacunas y lo que aplicaste' },
  gastos: { titulo: 'Gastos', sub: 'Cada peso, por categoría' },
  galpon: { titulo: 'Galpón', sub: 'Espacio, comederos y bebederos' },
} as const

export type TipoFicha = keyof typeof FICHAS

export function Ficha() {
  const { id, tipo } = useParams()
  const nav = useNavigate()
  const data = useLoteData(id ? Number(id) : undefined)
  const settings = useSettings()
  const ficha = FICHAS[tipo as TipoFicha]

  if (!ficha)
    return (
      <div className="pt-10 text-center">
        <p className="text-ink-faint">Esa ficha no existe.</p>
        <Button variant="soft" className="mt-4" onClick={() => nav(`/lotes/${id}`)}>
          Volver al ciclo
        </Button>
      </div>
    )

  if (data === undefined) return <div className="pt-10 text-center text-ink-faint">Cargando…</div>
  if (data === null)
    return (
      <div className="pt-10 text-center">
        <p className="text-ink-faint">Este ciclo no existe.</p>
        <Button variant="soft" className="mt-4" onClick={() => nav('/lotes')}>
          Volver a ciclos
        </Button>
      </div>
    )

  const { lote, registros, gastos, aplicaciones, metrics } = data

  return (
    <div className="animate-rise">
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => nav(`/lotes/${lote.id}`)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-sunken"
          aria-label="Volver al ciclo"
        >
          <IconBack width={22} height={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold leading-tight">{ficha.titulo}</h1>
          <p className="truncate text-sm text-ink-soft">
            {lote.nombre} · día {metrics.dias}
          </p>
        </div>
      </header>

      <p className="mb-5 text-sm text-ink-faint">{ficha.sub}</p>

      {tipo === 'aves' && <FichaMortalidad lote={lote} registros={registros} />}
      {tipo === 'alimento' && (
        <FichaAlimento lote={lote} registros={registros} gastos={gastos} metrics={metrics} />
      )}
      {tipo === 'sanidad' && (
        <FichaSanidad lote={lote} metrics={metrics} gastos={gastos} aplicaciones={aplicaciones} />
      )}
      {tipo === 'gastos' && <FichaGastos lote={lote} gastos={gastos} metrics={metrics} />}
      {tipo === 'galpon' && <FichaGalpon lote={lote} metrics={metrics} settings={settings} />}
    </div>
  )
}
