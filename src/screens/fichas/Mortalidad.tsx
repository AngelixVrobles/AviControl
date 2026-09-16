import { useState } from 'react'
import type { Lote, Registro } from '../../db/schema'
import { fecha, num, pct, plural } from '../../lib/format'
import { LIMITE_PRIMERA_SEMANA_PCT, resumenMortalidad } from '../../lib/mortalidad'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { Card } from '../../components/ui'
import { GraficaBarras } from '../../components/chart'
import { Vacio } from './Vacio'

export function FichaMortalidad({ lote, registros }: { lote: Lote; registros: Registro[] }) {
  const [foco, setFoco] = useState<number>()
  const r = resumenMortalidad(lote, registros)
  if (!r) return <Vacio texto="Todavía no has registrado ningún día de este ciclo." />

  const arranqueBien = r.primeraSemanaPct <= LIMITE_PRIMERA_SEMANA_PCT
  const sobreEsperado = r.pct > r.esperadoPct
  const barras = r.dias.map((d) => ({ dia: d.dia, bajas: d.muertes + d.descartes }))
  const maxBajas = Math.max(...barras.map((b) => b.bajas), 1)
  const peor = maxBajas > 1 ? barras.findIndex((b) => b.bajas === maxBajas) : undefined
  const enfocada = foco != null ? barras[foco] : undefined

  return (
    <div className="space-y-5">
      <Card tono="elevado" className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-faint">Bajas del ciclo</div>
            <div className="font-display text-2xl font-semibold leading-none tnum">
              <AnimatedNumber value={r.bajas + r.descartes} format={(n) => num(n)} />
            </div>
            <div className="mt-1 text-sm text-ink-soft tnum">
              de {num(lote.cantidadInicial)} · quedan {num(r.vivas)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-faint">Acumulada</div>
            <div
              className={
                'font-display text-xl font-semibold leading-none tnum ' +
                (sobreEsperado ? 'text-clay-deep' : 'text-forest-600')
              }
            >
              {pct(r.pct, 1)}
            </div>
            <div className="mt-0.5 text-xs text-ink-faint tnum">
              {sobreEsperado ? '▲' : '✓'} esperado {pct(r.esperadoPct, 1)}
            </div>
          </div>
        </div>
        {r.descartes > 0 && (
          <div className="mt-3 border-t border-line pt-3 text-sm text-ink-soft tnum">
            {num(r.bajas)} muertas y {num(r.descartes)} descartadas
          </div>
        )}
      </Card>

      <div>
        <h3 className="mb-2 font-display text-base font-semibold">La primera semana</h3>
        <Card className={'p-4 ' + (arranqueBien ? '' : 'border-l-4 border-l-clay')}>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tnum leading-none">
              {num(r.primeraSemana)}
            </span>
            <span className="text-sm text-ink-soft tnum">aves · {pct(r.primeraSemanaPct, 2)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {arranqueBien
              ? `Buen arranque: por debajo del ${LIMITE_PRIMERA_SEMANA_PCT} % que se considera normal. Lo que muere en los primeros siete días viene del pollito y del recibo, no del manejo del resto del ciclo.`
              : `Por encima del ${LIMITE_PRIMERA_SEMANA_PCT} % que se considera normal. La mortalidad de los primeros siete días apunta al pollito o al recibo: temperatura de la cama, acceso a agua y calidad del lote que te vendieron.`}
          </p>
        </Card>
      </div>

      <div>
        <h3 className="mb-2 font-display text-base font-semibold">Bajas día a día</h3>
        <Card className="p-4 pt-5">
          <GraficaBarras
            etiquetas={barras.map((b) => `d${b.dia}`)}
            valores={barras.map((b) => b.bajas)}
            alto={150}
            tono="aviso"
            destacar={peor}
            foco={foco}
            onFoco={setFoco}
            resumen={`Bajas por día, del día ${barras[0]?.dia ?? 0} al ${barras.at(-1)?.dia ?? 0}.`}
          />
          <p className="mt-2 text-xs text-ink-faint tnum">
            {enfocada
              ? `Día ${enfocada.dia} · ${num(enfocada.bajas)} ${plural(enfocada.bajas, 'ave', 'aves')}`
              : r.peorDia
                ? `El peor fue el día ${r.peorDia.dia} (${fecha(r.peorDia.fecha)}) con ${num(r.peorDia.muertes + r.peorDia.descartes)} aves.`
                : 'Arrastra el dedo por la gráfica para ver cualquier día.'}
          </p>
        </Card>
      </div>

      <div>
        <h3 className="mb-2 font-display text-base font-semibold">Por semana</h3>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Sem</th>
                <th className="px-2 py-2.5 text-right font-medium">Bajas</th>
                <th className="px-2 py-2.5 text-right font-medium">% del lote</th>
                <th className="px-4 py-2.5 text-right font-medium">Esperado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tnum">
              {r.semanas.map((s) => {
                const alta = s.pctDelLote > s.esperadoPct + 0.3
                return (
                  <tr key={s.semana}>
                    <td className="px-4 py-2.5 font-display font-semibold">{s.semana}</td>
                    <td className="px-2 py-2.5 text-right text-ink-soft">{num(s.muertes)}</td>
                    <td
                      className={
                        'px-2 py-2.5 text-right font-medium ' +
                        (alta ? 'text-clay-deep' : 'text-ink')
                      }
                    >
                      {alta ? '▲ ' : ''}
                      {pct(s.pctDelLote, 2)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-faint">{pct(s.esperadoPct, 2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
