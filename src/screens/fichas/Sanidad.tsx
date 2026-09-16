import { useState } from 'react'
import type { Aplicacion, Gasto, Lote } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { fecha, money, num } from '../../lib/format'
import { agendaSanitaria, type EventoSanitario } from '../../lib/sanidad'
import { useSettings } from '../../lib/hooks'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { Button, Banda, Pill, Seccion } from '../../components/ui'
import { AplicacionSheet } from '../../components/sheets'
import { sumarDias } from '../../lib/format'

export function FichaSanidad({
  lote,
  metrics,
  gastos,
  aplicaciones,
}: {
  lote: Lote
  metrics: LoteMetrics
  gastos: Gasto[]
  aplicaciones: Aplicacion[]
}) {
  const settings = useSettings()
  const [abierta, setAbierta] = useState(false)
  const [editar, setEditar] = useState<Aplicacion>()
  const [sugerencia, setSugerencia] = useState<{ nombre: string; fecha: string }>()

  const agenda = agendaSanitaria(lote, metrics.dias, settings.planSanitario, aplicaciones)
  const gastoSanitario = gastos
    .filter((g) => g.categoria === 'medicina')
    .reduce((a, g) => a + g.monto, 0)
  const aplicadas = agenda.filter((e) => e.estado === 'aplicado' || e.estado === 'extra').length
  const pendientes = agenda.filter((e) => e.estado === 'atrasado')

  function anotar(e?: EventoSanitario) {
    setEditar(e?.aplicacion)
    setSugerencia(
      e && !e.aplicacion
        ? { nombre: e.nombre, fecha: sumarDias(lote.fechaInicio, e.diaPlan ?? metrics.dias) }
        : undefined,
    )
    setAbierta(true)
  }

  return (
    <div className="space-y-5">
      <Banda className="px-5 py-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-faint">Aplicaciones anotadas</div>
            <div className="font-display text-2xl font-semibold leading-none tnum">
              <AnimatedNumber value={aplicadas} format={(n) => num(n)} />
            </div>
            {pendientes.length > 0 && (
              <div className="mt-1 text-sm text-clay-text">
                {num(pendientes.length)} del plan sin anotar
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-faint">Medicina y vacunas</div>
            <div className="font-display text-xl font-semibold leading-none tnum">
              {money(gastoSanitario)}
            </div>
            {metrics.cantidadInicial > 0 && (
              <div className="mt-0.5 text-xs text-ink-faint tnum">
                {money(gastoSanitario / metrics.cantidadInicial)} por ave
              </div>
            )}
          </div>
        </div>
      </Banda>

      <div>
        <Seccion
          className="mb-3"
          etiqueta="Agenda del ciclo"
          accion={
            <button onClick={() => anotar()} className="text-sm font-semibold text-forest-600">
              Anotar →
            </button>
          }
        />
        <Banda className="divide-y divide-line">
          {agenda.map((e, i) => (
            <button
              key={`${e.nombre}-${i}`}
              onClick={() => anotar(e)}
              className="flex w-full items-center justify-between px-5 py-3 text-left transition active:bg-paper-sunken"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {e.nombre}
                  {e.estado === 'extra' && <Pill tone="neutral">Fuera del plan</Pill>}
                </div>
                <div className="text-xs text-ink-faint tnum">
                  {e.aplicacion
                    ? `Día ${e.dia} · ${fecha(e.aplicacion.fecha)}${e.aplicacion.via ? ` · ${e.aplicacion.via.toLowerCase()}` : ''}`
                    : `Plan: día ${e.diaPlan}${e.fechaPlan ? ` · ${fecha(e.fechaPlan)}` : ''}`}
                </div>
                {e.aplicacion?.dosis && (
                  <div className="text-xs text-ink-soft">Dosis: {e.aplicacion.dosis}</div>
                )}
              </div>
              <EstadoSanitario estado={e.estado} />
            </button>
          ))}
        </Banda>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          El plan sale de Ajustes y lo puedes cambiar según lo que diga tu veterinario. Toca
          cualquier línea para anotar lo que aplicaste de verdad.
        </p>
      </div>

      <Button block variant="soft" onClick={() => anotar()}>
        Anotar una aplicación
      </Button>

      <AplicacionSheet
        lote={lote}
        open={abierta}
        onClose={() => setAbierta(false)}
        editar={editar}
        sugerencia={sugerencia}
      />
    </div>
  )
}

function EstadoSanitario({ estado }: { estado: EventoSanitario['estado'] }) {
  if (estado === 'aplicado' || estado === 'extra')
    return <span className="shrink-0 pl-3 text-sm font-semibold text-forest-600">✓ aplicada</span>
  if (estado === 'atrasado')
    return <span className="shrink-0 pl-3 text-sm font-semibold text-clay-text">sin anotar</span>
  return <span className="shrink-0 pl-3 text-sm text-ink-faint">pendiente</span>
}
