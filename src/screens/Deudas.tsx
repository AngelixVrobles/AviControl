import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { Abono, Deuda } from '../db/schema'
import { useDeudas, useLotes } from '../lib/hooks'
import { fecha, money, num, pct, plural } from '../lib/format'
import { categoriaDeudaLabel, deudaPorSocio, type EstadoDeuda } from '../lib/deudas'
import { Banda, Button, EmptyState, Seccion } from '../components/ui'
import { AbonoSheet, DeudaSheet } from '../components/sheets'
import { IconBack, IconMoney } from '../components/icons'

export function Deudas() {
  const nav = useNavigate()
  const resumen = useDeudas()
  const lotes = useLotes()
  const [nueva, setNueva] = useState(false)
  const [editar, setEditar] = useState<Deuda>()
  const [abonar, setAbonar] = useState<EstadoDeuda>()
  const [editarAbono, setEditarAbono] = useState<Abono>()

  // La sociedad de una deuda nueva se propone con la del último ciclo que la lleve.
  const sociosSugeridos = lotes?.find((l) => (l.socios?.length ?? 0) >= 2)?.socios

  function abrirAbono(estado: EstadoDeuda, abono?: Abono) {
    setEditarAbono(abono)
    setAbonar(estado)
  }

  return (
    <div>
      <header className="flex items-center gap-3 py-2">
        <button
          onClick={() => nav(-1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-sunken"
          aria-label="Volver"
        >
          <IconBack width={22} height={22} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-tight">Deudas de la empresa</h1>
          <p className="text-sm text-ink-faint">Lo de la granja, no lo de un ciclo</p>
        </div>
      </header>

      {resumen == null ? null : resumen.deudas.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<IconMoney width={28} height={28} />}
            title="Sin deudas anotadas"
            text="El galpón, el equipo o el terreno que todavía estás pagando poco a poco van aquí, no dentro de un ciclo."
            action={<Button onClick={() => setNueva(true)}>Agregar la primera</Button>}
          />
        </div>
      ) : (
        <>
          <Banda className="mt-4 px-5 py-4">
            <div className="text-xs text-ink-faint">Falta por pagar</div>
            <div className="font-display text-3xl font-semibold leading-none tnum text-clay-deep">
              {money(resumen.saldo)}
            </div>
            <div className="mt-1.5 text-sm text-ink-soft tnum">
              de {money(resumen.total)} en {num(resumen.deudas.length)}{' '}
              {plural(resumen.deudas.length, 'deuda', 'deudas')} · abonado{' '}
              {money(resumen.abonado)}
            </div>
            <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-sunken">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-forest-500"
                style={{ width: `${resumen.pagadoPct}%` }}
              />
            </div>
            <div className="mt-1.5 text-right text-xs text-ink-faint tnum">
              {pct(resumen.pagadoPct, 0)} pagado
            </div>
          </Banda>

          <Reparto estados={resumen.deudas} />

          <Seccion
            className="mb-3 mt-8"
            etiqueta="Una por una"
            accion={
              <button
                onClick={() => setNueva(true)}
                className="text-sm font-semibold text-forest-600"
              >
                Agregar →
              </button>
            }
          />
          <div className="space-y-4">
            {resumen.deudas.map((e) => (
              <FichaDeuda
                key={e.deuda.id}
                estado={e}
                onEditar={() => setEditar(e.deuda)}
                onAbonar={(a) => abrirAbono(e, a)}
              />
            ))}
          </div>
        </>
      )}

      <DeudaSheet open={nueva} onClose={() => setNueva(false)} sociosSugeridos={sociosSugeridos} />
      <DeudaSheet
        open={editar != null}
        onClose={() => setEditar(undefined)}
        editar={editar}
        sociosSugeridos={sociosSugeridos}
      />
      {abonar && (
        <AbonoSheet
          deuda={abonar.deuda}
          saldo={abonar.saldo}
          open
          onClose={() => {
            setAbonar(undefined)
            setEditarAbono(undefined)
          }}
          editar={editarAbono}
        />
      )}
    </div>
  )
}

function Reparto({ estados }: { estados: EstadoDeuda[] }) {
  const partes = deudaPorSocio(estados)
  if (partes.length < 2) return null

  return (
    <>
      <Seccion className="mb-3 mt-8" etiqueta="Cómo va cada socio" />
      <Banda className="divide-y divide-line">
        {partes.map((s) => (
          <div key={s.nombre} className="px-5 py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{s.nombre}</span>
              <span className="font-display text-lg font-semibold tnum">{money(s.leFalta)}</span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between text-xs text-ink-faint tnum">
              <span>
                ha puesto {money(s.haPuesto)} de {money(s.leToca)}
              </span>
              <span>le falta</span>
            </div>
            {Math.abs(s.ajuste) >= 1 && (
              <div
                className={clsx(
                  'mt-1 text-xs font-medium tnum',
                  s.ajuste > 0 ? 'text-forest-600' : 'text-clay-deep',
                )}
              >
                {s.ajuste > 0
                  ? `Va ${money(s.ajuste)} adelantado sobre lo abonado hasta hoy`
                  : `Va ${money(-s.ajuste)} atrasado sobre lo abonado hasta hoy`}
              </div>
            )}
          </div>
        ))}
      </Banda>
    </>
  )
}

function FichaDeuda({
  estado,
  onEditar,
  onAbonar,
}: {
  estado: EstadoDeuda
  onEditar: () => void
  onAbonar: (abono?: Abono) => void
}) {
  const [abierta, setAbierta] = useState(false)
  const { deuda, abonado, saldo, pagadoPct, abonos } = estado
  const saldada = saldo <= 0

  return (
    <Banda className="px-5 py-4">
      <button onClick={onEditar} className="w-full text-left">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-base font-semibold">{deuda.concepto}</div>
            <div className="text-xs text-ink-faint">
              {categoriaDeudaLabel(deuda.categoria)}
              {deuda.acreedor ? ` · ${deuda.acreedor}` : ''} · desde {fecha(deuda.fecha)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={clsx(
                'font-display text-xl font-semibold leading-none tnum',
                saldada ? 'text-forest-600' : 'text-ink',
              )}
            >
              {saldada ? 'Saldada' : money(saldo)}
            </div>
            {!saldada && <div className="mt-0.5 text-xs text-ink-faint">falta</div>}
          </div>
        </div>
      </button>

      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-forest-500"
          style={{ width: `${pagadoPct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-xs text-ink-faint tnum">
        <span>
          {money(abonado)} de {money(deuda.monto)}
        </span>
        <span>{pct(pagadoPct, 0)}</span>
      </div>

      {estado.socios.length >= 2 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-soft tnum">
          {estado.socios.map((s) => (
            <span key={s.nombre}>
              {s.nombre}: le falta <span className="font-semibold">{money(s.leFalta)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        {!saldada && (
          <Button variant="soft" className="flex-1" onClick={() => onAbonar()}>
            Abonar
          </Button>
        )}
        {abonos.length > 0 && (
          <button
            onClick={() => setAbierta((v) => !v)}
            className="shrink-0 text-sm font-semibold text-forest-600"
          >
            {abierta ? 'Ocultar' : `${num(abonos.length)} ${plural(abonos.length, 'abono', 'abonos')}`}
          </button>
        )}
      </div>

      {abierta && (
        <div className="mt-3 divide-y divide-line border-t border-line">
          {[...abonos].reverse().map((a) => (
            <button
              key={a.id}
              onClick={() => onAbonar(a)}
              className="flex w-full items-baseline justify-between py-2.5 text-left text-sm"
            >
              <span className="min-w-0">
                <span className="tnum">{fecha(a.fecha)}</span>
                {a.pagadoPor != null && deuda.socios?.[a.pagadoPor] && (
                  <span className="text-ink-faint"> · {deuda.socios[a.pagadoPor].nombre}</span>
                )}
                {a.nota && <span className="block text-xs text-ink-faint">{a.nota}</span>}
              </span>
              <span className="shrink-0 font-semibold tnum">{money(a.monto)}</span>
            </button>
          ))}
        </div>
      )}
    </Banda>
  )
}
