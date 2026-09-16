import { useState } from 'react'
import type { Lote, Registro } from '../../db/schema'
import { fecha, num, pct, plural } from '../../lib/format'
import { LIMITE_PRIMERA_SEMANA_PCT, resumenMortalidad } from '../../lib/mortalidad'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { Banda, Seccion } from '../../components/ui'
import { GraficaBarras } from '../../components/chart'
import { Vacio } from './Vacio'

export function FichaMortalidad({ lote, registros }: { lote: Lote; registros: Registro[] }) {
  const [foco, setFoco] = useState<number>()
  const r = resumenMortalidad(lote, registros)
  if (!r) return <Vacio texto="Todavía no has registrado ningún día de este ciclo." />

  const arranqueBien = r.primeraSemanaPct <= LIMITE_PRIMERA_SEMANA_PCT
  const sobreEsperado = r.pct > r.esperadoPct
  const esperados = r.semanas.map((s) => (s.esperadoPct / 100) * lote.cantidadInicial)
  const peor = r.semanas.reduce((p, s, i) => (s.muertes > r.semanas[p].muertes ? i : p), 0)
  const semanaDelPeor = r.peorDia
    ? r.semanas.findIndex((s) => s.semana === Math.floor(Math.max(0, r.peorDia!.dia - 1) / 7) + 1)
    : -1
  const enfocada = foco != null ? r.semanas[foco] : undefined
  const bajasDelPeorDia = r.peorDia ? r.peorDia.muertes + r.peorDia.descartes : 0

  return (
    <div className="space-y-6">
      <Banda className="px-5 py-4">
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
      </Banda>

      <div>
        <Seccion
          etiqueta="Semana a semana"
          titulo={tituloSemanas(r.semanas[peor], esperados[peor])}
        />
        <Banda className="mt-3 px-5 py-4 pt-5">
          <GraficaBarras
            etiquetas={r.semanas.map((s) => `S${s.semana}`)}
            valores={r.semanas.map((s) => s.muertes)}
            esperados={esperados}
            alto={170}
            tono="aviso"
            destacar={peor}
            nota={
              semanaDelPeor >= 0 && bajasDelPeorDia > 2
                ? { indice: semanaDelPeor, texto: `${num(bajasDelPeorDia)} el día ${r.peorDia!.dia}` }
                : undefined
            }
            foco={foco}
            onFoco={setFoco}
            resumen={`Bajas por semana contra lo esperado, ${r.semanas.length} semanas.`}
          />
          <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-ink-faint tnum">
            {enfocada
              ? `Semana ${enfocada.semana} · ${num(enfocada.muertes)} ${plural(enfocada.muertes, 'ave', 'aves')} · ${pct(enfocada.pctDelLote, 2)} del lote · esperado ${pct(enfocada.esperadoPct, 2)}`
              : r.peorDia
                ? `El peor día fue el ${r.peorDia.dia} (${fecha(r.peorDia.fecha)}). Toca cualquier semana para ver sus números.`
                : 'Toca cualquier semana para ver sus números.'}
          </p>
        </Banda>
      </div>

      <div>
        <Seccion
          etiqueta="Arranque"
          titulo={
            arranqueBien
              ? `Buen arranque: ${pct(r.primeraSemanaPct, 2)} en los primeros siete días`
              : `El arranque se pasó: ${pct(r.primeraSemanaPct, 2)} en los primeros siete días`
          }
        />
        <Banda className={'mt-3 px-5 py-4 ' + (arranqueBien ? '' : 'border-l-4 border-l-clay')}>
          <p className="text-sm leading-relaxed text-ink-soft">
            {arranqueBien
              ? `${num(r.primeraSemana)} aves, por debajo del ${LIMITE_PRIMERA_SEMANA_PCT} % que se considera normal. Lo que muere en los primeros siete días viene del pollito y del recibo, no del manejo del resto del ciclo.`
              : `${num(r.primeraSemana)} aves, por encima del ${LIMITE_PRIMERA_SEMANA_PCT} % que se considera normal. La mortalidad de los primeros siete días apunta al pollito o al recibo: temperatura de la cama, acceso a agua y calidad del lote que te vendieron.`}
          </p>
        </Banda>
      </div>
    </div>
  )
}

function tituloSemanas(peor: { semana: number; muertes: number }, esperado: number) {
  if (peor.muertes <= esperado) return 'Ninguna semana se pasó de lo esperado'
  return `La semana ${peor.semana} fue la peor: ${num(peor.muertes)} ${plural(peor.muertes, 'ave', 'aves')}`
}
