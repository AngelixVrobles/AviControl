import { useState } from 'react'
import type { Aplicacion, Gasto, Lote } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { fecha, hoyISO, money, num } from '../../lib/format'
import { retiroDe, retiroEn } from '../../lib/retiro'
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
  soloVer = false,
}: {
  lote: Lote
  metrics: LoteMetrics
  gastos: Gasto[]
  aplicaciones: Aplicacion[]
  soloVer?: boolean
}) {
  const settings = useSettings()
  const [abierta, setAbierta] = useState(false)
  const [editar, setEditar] = useState<Aplicacion>()
  const [sugerencia, setSugerencia] = useState<{ nombre: string; fecha: string }>()

  // De un ciclo compartido se ve lo que se aplicó: el plan de esta granja no es
  // el de quien lo lleva.
  const agenda = agendaSanitaria(lote, metrics.dias, settings.planSanitario, aplicaciones).filter(
    (e) => !soloVer || e.aplicacion,
  )
  const gastoSanitario = gastos
    .filter((g) => g.categoria === 'medicina')
    .reduce((a, g) => a + g.monto, 0)
  const aplicadas = agenda.filter((e) => e.estado === 'aplicado' || e.estado === 'extra').length
  const pendientes = agenda.filter((e) => e.estado === 'atrasado')
  const hoy = hoyISO()
  const enRetiro = retiroEn(aplicaciones, hoy)

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

      {enRetiro && (
        <div className="rounded-xl2 border-l-4 border-clay bg-clay-tint px-4 py-3 text-sm leading-relaxed text-clay-text">
          <div className="font-display text-base font-semibold">En retiro de {enRetiro.nombre}</div>
          No vendas antes del {fecha(enRetiro.libreDesde)}: son {num(enRetiro.dias)} días después de la
          última dosis, el {fecha(enRetiro.ultimaDosis)}.
        </div>
      )}

      <div>
        <Seccion
          className="mb-3"
          etiqueta="Agenda del ciclo"
          accion={
            !soloVer && (
              <button
                onClick={() => anotar()}
                className="-mx-2 -my-3 px-2 py-3 text-sm font-semibold text-forest-600"
              >
                Anotar →
              </button>
            )
          }
        />
        <Banda className="divide-y divide-line">
          {agenda.length === 0 && (
            <p className="px-5 py-4 text-sm text-ink-faint">No se ha anotado ninguna vacuna ni medicina.</p>
          )}
          {agenda.map((e, i) => (
            <button
              key={`${e.nombre}-${i}`}
              disabled={soloVer}
              onClick={() => anotar(e)}
              className="flex w-full items-center justify-between px-5 py-3 text-left transition active:bg-paper-sunken disabled:active:bg-transparent"
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
                {e.aplicacion && (e.aplicacion.dosis || (e.aplicacion.diasTratamiento ?? 1) > 1) && (
                  <div className="text-xs text-ink-soft">
                    {[
                      e.aplicacion.dosis && `Dosis: ${e.aplicacion.dosis}`,
                      (e.aplicacion.diasTratamiento ?? 1) > 1 && `Por ${num(e.aplicacion.diasTratamiento!)} días`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
                {e.aplicacion && <LineaRetiro aplicacion={e.aplicacion} hoy={hoy} />}
              </div>
              <EstadoSanitario estado={e.estado} />
            </button>
          ))}
        </Banda>
        {!soloVer && (
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            El plan sale de Ajustes y lo puedes cambiar según lo que diga tu veterinario. Toca
            cualquier línea para anotar lo que aplicaste de verdad.
          </p>
        )}
      </div>

      {!soloVer && (
        <Button block variant="soft" onClick={() => anotar()}>
          Anotar una aplicación
        </Button>
      )}

      <AplicacionSheet
        lote={lote}
        open={abierta}
        onClose={() => setAbierta(false)}
        editar={editar}
        sugerencia={sugerencia}
        diaVenta={metrics.diaObjetivo}
      />
    </div>
  )
}

function LineaRetiro({ aplicacion, hoy }: { aplicacion: Aplicacion; hoy: string }) {
  const r = retiroDe(aplicacion)
  if (!r) return null
  const activo = hoy < r.libreDesde
  return (
    <div className={'text-xs tnum ' + (activo ? 'font-medium text-clay-text' : 'text-ink-faint')}>
      Retiro de {num(r.dias)} días ·{' '}
      {activo ? `se vende desde el ${fecha(r.libreDesde)}` : 'cumplido'}
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
