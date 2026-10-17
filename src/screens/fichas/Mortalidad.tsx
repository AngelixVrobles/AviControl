import { useState } from 'react'
import type { Ingreso, Lote, Registro } from '../../db/schema'
import { fecha, num, pct, plural } from '../../lib/format'
import { causasDelCiclo, resumenMortalidad, type CausaDelCiclo } from '../../lib/mortalidad'
import { causaLabel } from '../../lib/labels'
import { computeArranque, tituloArranque } from '../../lib/arranque'
import { TarjetaArranque } from '../../components/Arranque'
import { CALOR_C, calorDelCiclo, type CalorDelCiclo } from '../../lib/calor'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { Banda, Seccion } from '../../components/ui'
import { GraficaBarras } from '../../components/chart'
import { Vacio } from './Vacio'

export function FichaMortalidad({
  lote,
  registros,
  ingresos = [],
  dia,
}: {
  lote: Lote
  registros: Registro[]
  ingresos?: Ingreso[]
  dia: number
}) {
  const [foco, setFoco] = useState<number>()
  const r = resumenMortalidad(lote, registros, ingresos)
  if (!r) return <Vacio texto="Todavía no has registrado ningún día de este ciclo." />

  const arranque = computeArranque(lote, registros, dia)
  const sobreEsperado = r.pct > r.esperadoPct
  const esperados = r.semanas.map((s) => (s.esperadoPct / 100) * lote.cantidadInicial)
  const peor = r.semanas.reduce((p, s, i) => (s.muertes > r.semanas[p].muertes ? i : p), 0)
  const semanaDelPeor = r.peorDia
    ? r.semanas.findIndex((s) => s.semana === Math.floor(Math.max(0, r.peorDia!.dia - 1) / 7) + 1)
    : -1
  const enfocada = foco != null ? r.semanas[foco] : undefined
  const bajasDelPeorDia = r.peorDia ? r.peorDia.muertes + r.peorDia.descartes : 0
  const calor = calorDelCiclo(lote, registros, ingresos)
  const causas = causasDelCiclo(registros)

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
              de {num(lote.cantidadInicial - (lote.muertosLlegada ?? 0))} · quedan {num(r.vivas)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-faint">Mortalidad</div>
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
            {num(r.bajas)} muertas y {num(r.descartes)} descartadas ({pct(r.pctDescarte, 1)} de
            descarte, aparte de la mortalidad)
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
        <Seccion etiqueta="Arranque" titulo={tituloArranque(arranque, dia)} />
        <div className="mt-3">
          <TarjetaArranque a={arranque} dia={dia} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Lo que muere en los primeros siete días viene del pollito y del recibo, no del manejo del resto
          del ciclo. El peso al llegar y los muertos en las cajas se anotan con el lápiz del ciclo.
        </p>
      </div>

      {causas && <Causas causas={causas.causas} sinCausa={causas.sinCausa} />}

      {calor && <Calor c={calor} />}
    </div>
  )
}

// De qué se murió el lote, con lo que se anotó cada día.
function Causas({ causas, sinCausa }: { causas: CausaDelCiclo[]; sinCausa: number }) {
  const primera = causas[0]
  const conCausa = causas.reduce((a, c) => a + c.muertes, 0)
  const cual = causaLabel(primera.causa)!.toLowerCase()
  // «Casi todas» habla de todas las muertes, no solo de las que tienen causa:
  // con 45 de calor anotadas y 300 sin anotar, no se puede decir eso.
  const titulo =
    primera.muertes / (conCausa + sinCausa) >= 0.5
      ? `Casi todas de ${cual}`
      : sinCausa >= conCausa
        ? `Las que anotaste, más que nada de ${cual}`
        : `Más que nada de ${cual}`
  return (
    <div>
      <Seccion
        etiqueta="De qué se murieron"
        titulo={titulo}
        nota={
          sinCausa > 0
            ? `Con la causa anotada en el registro del día. ${num(sinCausa)} ${plural(sinCausa, 'muerte', 'muertes')} sin causa no ${plural(sinCausa, 'cuenta', 'cuentan')} aquí.`
            : 'Con la causa anotada en el registro del día.'
        }
      />
      <Banda className="mt-3 divide-y divide-line">
        {causas.map((c) => (
          <div key={c.causa} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{causaLabel(c.causa)}</span>
              <span className="tnum">
                <span className="font-display text-base font-semibold">{num(c.muertes)}</span>
                <span className="ml-2 text-ink-faint">{pct(c.pct, 0)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
              <div className="h-full rounded-full bg-clay" style={{ width: `${Math.max(2, c.pct)}%` }} />
            </div>
          </div>
        ))}
      </Banda>
    </div>
  )
}

// Los días de calor contra los demás: si en los de calor se muere más, el
// calor está costando aves y vale la pena ventilar antes de la tarde.
function Calor({ c }: { c: CalorDelCiclo }) {
  const compara = c.porMilCalor != null && c.porMilNormal != null
  const cuesta = compara && c.porMilCalor! > c.porMilNormal! * 1.5 && c.porMilCalor! - c.porMilNormal! >= 0.5
  return (
    <div>
      <Seccion
        etiqueta="Calor"
        titulo={
          c.diasCalor === 0
            ? `Ningún día de calor en ${num(c.anotados)} ${plural(c.anotados, 'día anotado', 'días anotados')}`
            : cuesta
              ? 'El calor te está costando aves'
              : `${num(c.diasCalor)} ${plural(c.diasCalor, 'día de calor', 'días de calor')} de ${num(c.anotados)} anotados`
        }
      />
      <Banda className={'mt-3 space-y-2 px-5 py-4 ' + (cuesta ? 'border-l-4 border-l-clay' : '')}>
        {compara && (
          <p className="text-sm leading-relaxed text-ink-soft tnum">
            Los días de calor murieron {num(c.porMilCalor!, 1)} de cada mil aves; los demás,{' '}
            {num(c.porMilNormal!, 1)}.
            {cuesta &&
              ' Abre cortinas y pon los ventiladores antes de que apriete el sol, y corre la comida a las horas frescas.'}
          </p>
        )}
        {c.peor && (
          <p className="text-sm leading-relaxed text-ink-soft tnum">
            El día más caliente fue el {c.peor.dia} ({fecha(c.peor.fecha)}): {num(c.peor.tempC)} °C y{' '}
            {num(c.peor.bajas)} {plural(c.peor.bajas, 'baja', 'bajas')}.
          </p>
        )}
        <p className="text-xs leading-relaxed text-ink-faint">
          Cuenta los días con la temperatura anotada, sin la primera semana. Con el pollo grande, desde{' '}
          {CALOR_C} °C ya es calor.
        </p>
      </Banda>
    </div>
  )
}

function tituloSemanas(peor: { semana: number; muertes: number }, esperado: number) {
  if (peor.muertes <= esperado) return 'Ninguna semana se pasó de lo esperado'
  return `La semana ${peor.semana} fue la peor: ${num(peor.muertes)} ${plural(peor.muertes, 'ave', 'aves')}`
}
