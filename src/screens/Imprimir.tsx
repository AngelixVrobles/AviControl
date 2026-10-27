import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLoteData, useModoVenta, useSettings } from '../lib/hooks'
import { proyectarVenta } from '../lib/proyeccion'
import { pesoObjetivoDe } from '../lib/lote'
import { fecha, hoyISO, money, num, pct, porLb } from '../lib/format'
import { categoriaLabel, RAZA } from '../lib/labels'
import { agruparGastos } from '../lib/metrics'
import { pendienteDe } from '../lib/cobros'
import { retiroDe } from '../lib/retiro'
import { semanasDelCiclo } from '../lib/exportar'
import { nombreSocio } from '../lib/sociedad'
import { galponInicial, nombreDeGalpon } from '../lib/galpones'
import { avesPorGalpon, repartido } from '../lib/reparto'
import { LB_POR_QUINTAL } from '../lib/standards'
import { Button } from '../components/ui'
import { IconBack } from '../components/icons'
import { useVolver } from '../components/useVolver'

// El reporte del ciclo en una hoja para imprimir o guardar en PDF: lo que pide
// el banco, el contador o el socio que no usa la app. En el teléfono, «Imprimir»
// abre la vista previa, y desde ahí se guarda como PDF o se comparte.
export function Imprimir() {
  const { id } = useParams()
  const nav = useNavigate()
  const volver = useVolver(id ? `/lotes/${id}` : '/lotes')
  const data = useLoteData(id ? Number(id) : undefined)
  const settings = useSettings()
  const modo = useModoVenta()
  const [sinVista, setSinVista] = useState(false)

  // Con la app instalada en el iPhone, imprimir a veces no hace nada. Si la
  // vista previa no se abrió, se ofrece abrir el reporte en el navegador, donde
  // sí se imprime o se guarda en PDF.
  function imprimir() {
    let abrio = false
    const marcar = () => {
      abrio = true
    }
    window.addEventListener('beforeprint', marcar)
    window.print()
    window.setTimeout(() => {
      window.removeEventListener('beforeprint', marcar)
      setSinVista(!abrio)
    }, 1500)
  }

  if (data === undefined) return <div className="pt-10 text-center text-ink-faint">Cargando…</div>
  if (data === null)
    return (
      <div className="pt-10 text-center">
        <p className="text-ink-faint">Este ciclo no existe.</p>
        <Button variant="soft" className="mt-4" onClick={() => nav('/lotes')}>
          Volver a los ciclos
        </Button>
      </div>
    )

  const { lote, registros, gastos, ingresos, aplicaciones, metrics: m } = data
  const hasta = lote.fechaCierre ?? hoyISO()
  const cerrado = lote.estado === 'cerrado'
  // Con el ciclo en curso lo vendido es solo una parte: lo que va no es una
  // pérdida, es lo que falta por vender. Va lo que se espera ganar al vender,
  // como en la pestaña Dinero; antes salía «Vendido menos invertido» con un
  // número negativo que el banco o el socio leían como pérdida.
  const proyeccion = cerrado
    ? null
    : proyectarVenta(lote, registros, gastos, m, pesoObjetivoDe(lote), modo)
  const resultado: [string, string][] = cerrado
    ? [[m.ganancia >= 0 ? 'Ganancia' : 'Pérdida', money(m.ganancia)]]
    : proyeccion?.gananciaProyectada != null
      ? [
          [
            proyeccion.gananciaProyectada >= 0 ? 'Ganancia estimada al vender' : 'Pérdida estimada al vender',
            money(proyeccion.gananciaProyectada),
          ],
        ]
      : []
  const costos = [
    ...(lote.costoInicial > 0 ? [{ categoria: 'Pollitos', total: lote.costoInicial }] : []),
    ...agruparGastos(gastos).map((g) => ({ categoria: categoriaLabel(g.categoria), total: g.total })),
  ]
  const totalCostos = costos.reduce((a, c) => a + c.total, 0)
  const semanas = semanasDelCiclo(lote, registros)
  const ventas = [...ingresos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const socios = lote.socios && lote.socios.length >= 2 ? lote.socios : undefined
  // La pollada repartida: lo que se pasó de un galpón a otro y, en curso, lo
  // que hay hoy en cada uno.
  const enVarios = repartido(lote) && !lote.compartido
  const enCasas =
    enVarios && !cerrado ? avesPorGalpon(lote, galponInicial(lote, settings), registros, ingresos, hasta) : []
  const totalPct = socios?.reduce((a, s) => a + (s.pct || 0), 0) ?? 0

  const kpis: [string, string][] = [
    ['Pollitos recibidos', num(lote.cantidadInicial)],
    ...(lote.muertosLlegada ? [['Llegaron muertos', num(lote.muertosLlegada)] as [string, string]] : []),
    ...(lote.pesoLlegadaG ? [['Peso al llegar', `${num(lote.pesoLlegadaG)} g`] as [string, string]] : []),
    [cerrado ? 'Aves vendidas' : 'Aves en el galpón', num(cerrado ? m.vendidas : m.avesVivas)],
    ['Mortalidad', pct(m.mortalidadPct)],
    ['Peso promedio', m.pesoFinalLb != null ? `${num(m.pesoFinalLb, 2)} lb` : '—'],
    ['Conversión (FCA)', m.fca != null ? num(m.fca, 2) : '—'],
    ['Alimento', `${num(m.alimentoTotalLb / LB_POR_QUINTAL, 1)} qq`],
    [cerrado ? 'Costos' : 'Invertido hasta hoy', money(m.costos)],
    [cerrado ? 'Ventas' : 'Vendido hasta hoy', money(m.ingresos)],
    ...resultado,
    ['Costo por libra', m.costoPorLb != null ? porLb(m.costoPorLb) : '—'],
    ...(m.porCobrar > 0 ? [['Por cobrar', money(m.porCobrar)] as [string, string]] : []),
  ]

  return (
    <div className="impresion mx-auto min-h-dvh max-w-3xl bg-white px-6 pb-12 text-ink safe-t print:max-w-none print:px-0 print:pb-0">
      <div className="sticky top-0 z-10 -mx-6 mb-6 flex items-center gap-3 border-b border-line bg-white/95 px-6 py-3 backdrop-blur print:hidden">
        <button
          onClick={volver}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-sunken"
          aria-label="Volver"
        >
          <IconBack width={22} height={22} />
        </button>
        <p className="min-w-0 flex-1 text-sm leading-snug text-ink-soft">
          En la vista previa elige «Guardar como PDF» o compártelo.
        </p>
        <Button onClick={imprimir}>Imprimir</Button>
      </div>

      {sinVista && (
        <div className="mb-6 rounded-xl2 border border-amber-line bg-amber-tint p-4 text-sm leading-relaxed text-amber-text print:hidden">
          <p>
            La vista previa no se abrió: con la app instalada en el iPhone a veces pasa. Ábrelo en el navegador y
            ahí toca Compartir → Imprimir, o «Guardar en Archivos» para el PDF.
          </p>
          <Button variant="soft" className="mt-3" onClick={() => window.open(window.location.href, '_blank')}>
            Abrir en el navegador
          </Button>
        </div>
      )}

      <header className="border-b-2 border-ink pb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Reporte del ciclo</div>
        <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">{lote.nombre}</h1>
        <p className="mt-1 text-sm text-ink-soft tnum">
          {lote.compartido?.de ?? settings.granja} · {RAZA} · del {fecha(lote.fechaInicio)} al {fecha(hasta)} · día{' '}
          {m.dias}
          {cerrado ? ' · cerrado' : ' · en curso'}
          {lote.incubadora ? ` · pollitos de ${lote.incubadora}` : ''}
        </p>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 print:grid-cols-4">
        {kpis.map(([label, valor]) => (
          <div key={label} className="break-inside-avoid">
            <div className="font-display text-xl font-semibold leading-none tnum">{valor}</div>
            <div className="mt-1 text-xs text-ink-soft">{label}</div>
          </div>
        ))}
      </section>

      {socios && (
        <Bloque titulo="Reparto entre socios">
          <Tabla
            columnas={['Socio', 'Parte', cerrado ? 'Ganancia' : 'Le toca poner']}
            filas={socios.map((s, i) => {
              const parte = totalPct > 0 ? (s.pct || 0) / totalPct : 1 / socios.length
              return [nombreSocio(s, i), pct(parte * 100, 0), money(parte * (cerrado ? m.ganancia : m.costos))]
            })}
          />
        </Bloque>
      )}

      {costos.length > 0 && (
        <Bloque titulo="Costos">
          <Tabla
            columnas={['Concepto', 'Monto', 'Del total']}
            filas={[
              ...costos.map((c) => [c.categoria, money(c.total), pct((c.total / totalCostos) * 100, 0)]),
              ['Total', money(totalCostos), ''],
            ]}
            total
          />
        </Bloque>
      )}

      {ventas.length > 0 && (
        <Bloque titulo="Ventas">
          <Tabla
            columnas={['Fecha', 'Comprador', 'Aves', 'Libras', 'Monto', 'Falta']}
            texto={2}
            filas={ventas.map((i) => [
              fecha(i.fecha),
              i.comprador ?? i.descripcion ?? '—',
              i.cantidad ? num(i.cantidad) : '—',
              i.pesoLb ? `${num(i.pesoLb)}${i.arreglado ? ' arr.' : ''}` : '—',
              money(i.monto),
              pendienteDe(i) >= 1 ? money(pendienteDe(i)) : '—',
            ])}
          />
        </Bloque>
      )}

      {enVarios && (
        <Bloque titulo="Galpones">
          <Tabla
            columnas={['Fecha', 'Salen de', 'Van a', 'Aves']}
            texto={3}
            filas={(lote.movimientos ?? []).map((mv) => [
              fecha(mv.fecha),
              nombreDeGalpon(mv.de, settings),
              nombreDeGalpon(mv.a, settings),
              num(mv.aves),
            ])}
          />
          {enCasas.length > 0 && (
            <div className="mt-3">
              <Tabla
                columnas={['Hoy en cada galpón', 'Aves']}
                filas={enCasas.map((c) => [nombreDeGalpon(c.galponId, settings), num(c.aves)])}
              />
            </div>
          )}
        </Bloque>
      )}

      {semanas.length > 0 && (
        <Bloque titulo="Semana a semana">
          <Tabla
            columnas={['Semana', 'Bajas', 'Del lote', 'Alimento', 'Peso']}
            filas={semanas.map((s) => [
              `Semana ${s.semana}`,
              num(s.bajas),
              pct(s.pctLote, 2),
              s.alimentoLb > 0 ? `${num(s.alimentoLb / LB_POR_QUINTAL, 1)} qq` : '—',
              s.pesoLb != null ? `${num(s.pesoLb, 2)} lb` : '—',
            ])}
          />
        </Bloque>
      )}

      {aplicaciones.length > 0 && (
        <Bloque titulo="Vacunas y medicinas">
          <Tabla
            columnas={['Fecha', 'Nombre', 'Vía', 'Retiro']}
            texto={4}
            filas={aplicaciones.map((a) => {
              const r = retiroDe(a)
              return [
                fecha(a.fecha),
                a.nombre,
                a.via ?? '—',
                r ? `${num(r.dias)} días · desde el ${fecha(r.libreDesde)}` : '—',
              ]
            })}
          />
        </Bloque>
      )}

      <footer className="mt-10 border-t border-line pt-3 text-xs text-ink-faint">
        Hecho con AviControl el {fecha(hoyISO())}.
      </footer>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-2 font-display text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

// Las primeras `texto` columnas son palabras y van a la izquierda; las cifras, a
// la derecha para que se lean en columna.
function Tabla({
  columnas,
  filas,
  total,
  texto = 1,
}: {
  columnas: string[]
  filas: string[][]
  total?: boolean
  texto?: number
}) {
  // En el teléfono una tabla ancha se desliza dentro de su caja en vez de
  // ensanchar la página; en papel cabe entera.
  return (
    <div className="-mx-6 overflow-x-auto px-6 print:mx-0 print:overflow-visible print:px-0">
    <table className="w-full border-collapse whitespace-nowrap text-sm tnum">
      <thead>
        <tr className="border-b border-ink">
          {columnas.map((c, i) => (
            <th key={c} className={'py-1.5 pr-3 font-semibold last:pr-0 ' + (i < texto ? 'text-left' : 'text-right')}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, r) => (
          <tr
            key={r}
            className={
              'break-inside-avoid border-b border-line ' + (total && r === filas.length - 1 ? 'font-semibold' : '')
            }
          >
            {f.map((v, i) => (
              <td key={i} className={'py-1.5 pr-3 last:pr-0 ' + (i < texto ? 'text-left' : 'text-right')}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
