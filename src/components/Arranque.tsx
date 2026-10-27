import { clsx } from 'clsx'
import {
  FACTOR_7_BUENO,
  FACTOR_7_MALO,
  LIMITE_DOA_PCT,
  type Arranque,
} from '../lib/arranque'
import { LIMITE_PRIMERA_SEMANA_PCT } from '../lib/mortalidad'
import { num, pct } from '../lib/format'
import { Banda } from './ui'

// Un pollito de menos de esto viene de reproductoras jóvenes: arranca más lento.
const PESO_LIVIANO_G = 36

type Tono = 'bien' | 'aviso' | 'mal' | undefined

function Fila({ label, valor, nota, tono }: { label: string; valor: string; nota?: string; tono?: Tono }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right">
        <span
          className={clsx(
            'font-display font-semibold tnum',
            tono === 'mal' && 'text-clay-text',
            tono === 'aviso' && 'text-amber-text',
            tono === 'bien' && 'text-forest-600',
          )}
        >
          {valor}
        </span>
        {nota && <span className="block text-xs text-ink-faint">{nota}</span>}
      </span>
    </div>
  )
}

// La primera semana con lo que dice del pollito y del recibo. Lo que se pasa
// de lo normal sale en rojo, con lo que hay que hacer.
export function TarjetaArranque({ a, dia }: { a: Arranque; dia: number }) {
  const mortalidadMal = a.pct7 > LIMITE_PRIMERA_SEMANA_PCT
  const doaMal = a.doaPct > LIMITE_DOA_PCT
  const liviano = a.pesoLlegadaG != null && a.pesoLlegadaG < PESO_LIVIANO_G
  const factorTono: Tono =
    a.factor7 == null ? undefined : a.factor7 >= FACTOR_7_BUENO ? 'bien' : a.factor7 >= FACTOR_7_MALO ? 'aviso' : 'mal'
  const problemas = [
    doaMal && `llegaron muertos ${pct(a.doaPct, 1)}, sobre el ${pct(LIMITE_DOA_PCT, 1)}`,
    mortalidadMal && a.completa && `murió ${pct(a.pct7, 1)} la primera semana`,
    factorTono === 'mal' && 'crecieron poco desde que llegaron',
  ].filter((x): x is string => !!x)

  return (
    <Banda className={clsx('divide-y divide-line', problemas.length > 0 && 'border-l-4 border-l-clay')}>
      {a.incubadora && <Fila label="Incubadora" valor={a.incubadora} />}
      {a.muertosLlegada > 0 && (
        <Fila
          label="Llegaron muertos"
          valor={`${num(a.muertosLlegada)} · ${pct(a.doaPct, 2)}`}
          nota={doaMal ? `Sobre ${pct(LIMITE_DOA_PCT, 1)}: reclámalo a la incubadora` : 'En las cajas, no cuentan como tuyos'}
          tono={doaMal ? 'mal' : undefined}
        />
      )}
      {a.pesoLlegadaG != null && (
        <Fila
          label="Peso al llegar"
          valor={`${num(a.pesoLlegadaG)} g`}
          nota={liviano ? 'Liviano: de reproductoras jóvenes, arranca más lento' : undefined}
          tono={liviano ? 'aviso' : undefined}
        />
      )}
      <Fila
        label={a.completa ? 'Bajas de la primera semana' : `Bajas hasta el día ${Math.max(0, Math.min(dia, 7))}`}
        valor={`${num(a.bajas7)} · ${pct(a.pct7, 2)}`}
        nota={`Lo normal: hasta ${pct(LIMITE_PRIMERA_SEMANA_PCT, 0)} en siete días`}
        tono={mortalidadMal ? 'mal' : a.completa ? 'bien' : undefined}
      />
      {a.peso7G != null ? (
        <Fila
          label={`Peso al día ${a.diaPeso7}`}
          valor={a.factor7 != null ? `${num(a.peso7G)} g · ${num(a.factor7, 1)} veces` : `${num(a.peso7G)} g`}
          nota={
            a.factor7 != null
              ? `Lo bueno es ${num(FACTOR_7_BUENO, 1)} veces el de llegada o más · Cobb ${num(a.peso7CobbG)} g`
              : `Cobb ${num(a.peso7CobbG)} g. Con el peso al llegar se ve cuánto crecieron.`
          }
          tono={factorTono}
        />
      ) : (
        a.completa &&
        dia <= 10 && (
          <p className="px-5 py-3 text-xs leading-relaxed text-ink-faint">
            Pesa unas aves entre el día 6 y el 8: a esa edad deben pesar {num(FACTOR_7_BUENO, 1)} veces lo que
            pesaron al llegar.
          </p>
        )
      )}
      {problemas.length > 0 && (
        <p className="px-5 py-3 text-sm leading-relaxed text-clay-text">
          {capitalizar(problemas.join(', y '))}. Eso apunta al pollito o al recibo: temperatura de la cama,
          agua y comida a mano desde la primera hora, y la calidad del lote que te vendieron.
        </p>
      )}
    </Banda>
  )
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
