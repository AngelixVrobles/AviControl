import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { escalaY, indicesEtiqueta, interpolar, tramosBanda } from '../lib/escala'
import { num } from '../lib/format'

// SVG necesita el valor, no la clase de Tailwind, así que los tonos de las
// gráficas viven aquí. Cada uno nombra el token del que sale.
const TINTA = {
  serie: '#1E7340', // forest-500: la línea que es tuya
  guia: '#5F6D64', // ink-faint: la referencia contra la que te mides
  aviso: '#A03A16', // clay
  reja: '#EDE9DD', // paper-sunken
  papel: '#FFFEFA', // paper-raised
}

const PAD = { arriba: 16, derecha: 6, abajo: 18, izquierda: 2 }

const numEje = (v: number) => num(v, Number.isInteger(v) ? 0 : 1)

export interface Serie {
  datos: (number | undefined)[]
  tono?: 'serie' | 'guia' | 'aviso'
  nombre?: string
  punteada?: boolean
  conectar?: boolean
  puntos?: boolean
}

function useAncho() {
  const ref = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // La primera medida va a mano: el observer solo avisa de los cambios, y si
    // el navegador retrasa su primer aviso la gráfica se queda sin dibujar.
    setAncho(el.offsetWidth)
    const observador = new ResizeObserver(([entrada]) => setAncho(entrada.contentRect.width))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])
  return [ref, ancho] as const
}

function Lienzo({
  alto,
  resumen,
  children,
}: {
  alto: number
  resumen: string
  children: (ancho: number) => ReactNode
}) {
  const [ref, ancho] = useAncho()
  return (
    <div ref={ref} style={{ height: alto }} role="img" aria-label={resumen}>
      {ancho > 0 && children(ancho)}
    </div>
  )
}

interface Punto {
  x: number
  y: number
}

const ruta = (puntos: Punto[]) =>
  puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')

const rutaCerrada = (arriba: Punto[], abajo: Punto[]) =>
  `${ruta(arriba)}${ruta([...abajo].reverse()).replace('M', 'L')}Z`

function useArrastre(onFoco?: (i: number | undefined) => void) {
  const activo = useRef(false)
  if (!onFoco) return undefined
  return (indiceEn: (e: PointerEvent<SVGSVGElement>) => number) => ({
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      activo.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      onFoco(indiceEn(e))
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
      if (activo.current) onFoco(indiceEn(e))
    },
    onPointerUp: () => {
      activo.current = false
      onFoco(undefined)
    },
    onPointerCancel: () => {
      activo.current = false
      onFoco(undefined)
    },
  })
}

const desplazamiento = (e: PointerEvent<SVGSVGElement>) =>
  e.clientX - e.currentTarget.getBoundingClientRect().left

export function GraficaLineas({
  x,
  series,
  alto = 180,
  banda,
  formatoY = numEje,
  etiquetaX = String,
  marca,
  foco,
  onFoco,
  resumen,
}: {
  x: number[]
  series: Serie[]
  alto?: number
  banda?: 'signo' | 'neutro'
  formatoY?: (v: number) => string
  etiquetaX?: (v: number) => string
  marca?: { x: number; texto?: string }
  foco?: number
  onFoco?: (i: number | undefined) => void
  resumen: string
}) {
  const arrastre = useArrastre(onFoco)
  const valores = series.flatMap((s) => s.datos).filter((v): v is number => v != null)
  if (x.length === 0 || valores.length === 0) return null

  const escala = escalaY(Math.min(...valores), Math.max(...valores))
  const x0 = Math.min(...x)
  const x1 = Math.max(...x)

  return (
    <Lienzo alto={alto} resumen={resumen}>
      {(ancho) => {
        const anchoPlot = Math.max(1, ancho - PAD.izquierda - PAD.derecha)
        const altoPlot = Math.max(1, alto - PAD.arriba - PAD.abajo)
        const ex = (v: number) =>
          PAD.izquierda + (x1 === x0 ? anchoPlot / 2 : ((v - x0) / (x1 - x0)) * anchoPlot)
        const ey = (v: number) =>
          PAD.arriba + (1 - (v - escala.desde) / (escala.hasta - escala.desde)) * altoPlot

        const indiceEn = (e: PointerEvent<SVGSVGElement>) => {
          const px = desplazamiento(e)
          return x.reduce(
            (mejor, v, i) => (Math.abs(ex(v) - px) < Math.abs(ex(x[mejor]) - px) ? i : mejor),
            0,
          )
        }

        const paraBanda = (s: Serie) => (s.conectar ? interpolar(x, s.datos) : s.datos)
        const tramos =
          banda && series.length >= 2
            ? tramosBanda(x, paraBanda(series[1]), paraBanda(series[0]))
            : []

        return (
          <svg
            width={ancho}
            height={alto}
            style={{ touchAction: 'pan-y' }}
            {...arrastre?.(indiceEn)}
          >
            {tramos.map((t, i) => (
              <path
                key={i}
                className="animate-aparecer"
                d={rutaCerrada(
                  t.puntos.map((p) => ({ x: ex(p.x), y: ey(p.a) })),
                  t.puntos.map((p) => ({ x: ex(p.x), y: ey(p.b) })),
                )}
                fill={banda === 'neutro' ? TINTA.guia : t.signo === 1 ? TINTA.serie : TINTA.aviso}
                fillOpacity={banda === 'neutro' ? 0.12 : 0.14}
              />
            ))}

            {escala.marcas.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.izquierda}
                  x2={ancho - PAD.derecha}
                  y1={ey(v)}
                  y2={ey(v)}
                  stroke={v === 0 ? TINTA.guia : TINTA.reja}
                  strokeOpacity={v === 0 ? 0.45 : 1}
                />
                {ey(v) < alto - PAD.abajo - 11 && (
                  <text x={PAD.izquierda} y={ey(v) - 4} fontSize={10} fill={TINTA.guia}>
                    {formatoY(v)}
                  </text>
                )}
              </g>
            ))}

            {marca && (
              <>
                <line
                  x1={ex(marca.x)}
                  x2={ex(marca.x)}
                  y1={PAD.arriba - 8}
                  y2={alto - PAD.abajo}
                  stroke={TINTA.serie}
                  strokeDasharray="3 3"
                  strokeOpacity={0.7}
                />
                {marca.texto && (
                  <text
                    x={Math.min(ex(marca.x) + 5, ancho - 4)}
                    y={PAD.arriba - 8}
                    fontSize={10}
                    fontWeight={600}
                    fill={TINTA.serie}
                    textAnchor={ex(marca.x) > ancho * 0.7 ? 'end' : 'start'}
                  >
                    {marca.texto}
                  </text>
                )}
              </>
            )}

            {series.map((s, i) => (
              <Trazos key={i} serie={s} x={x} ex={ex} ey={ey} />
            ))}

            {indicesEtiqueta(x.length, 5).map((i) => (
              <text
                key={i}
                x={Math.min(Math.max(ex(x[i]), 10), ancho - 10)}
                y={alto - 4}
                fontSize={10}
                fill={TINTA.guia}
                textAnchor="middle"
              >
                {etiquetaX(x[i])}
              </text>
            ))}

            {foco != null && x[foco] != null && (
              <g>
                <line
                  x1={ex(x[foco])}
                  x2={ex(x[foco])}
                  y1={PAD.arriba - 8}
                  y2={alto - PAD.abajo}
                  stroke={TINTA.guia}
                  strokeOpacity={0.5}
                />
                {series.map((s, i) =>
                  s.datos[foco] == null ? null : (
                    <circle
                      key={i}
                      cx={ex(x[foco])}
                      cy={ey(s.datos[foco]!)}
                      r={4}
                      fill={TINTA[s.tono ?? 'serie']}
                      stroke={TINTA.papel}
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            )}
          </svg>
        )
      }}
    </Lienzo>
  )
}

function Trazos({
  serie,
  x,
  ex,
  ey,
}: {
  serie: Serie
  x: number[]
  ex: (v: number) => number
  ey: (v: number) => number
}) {
  const tono = TINTA[serie.tono ?? 'serie']
  const tramos: Punto[][] = [[]]
  x.forEach((vx, i) => {
    const v = serie.datos[i]
    if (v == null) {
      if (!serie.conectar && tramos.at(-1)!.length) tramos.push([])
      return
    }
    tramos.at(-1)!.push({ x: ex(vx), y: ey(v) })
  })

  return (
    <g>
      {tramos
        .filter((t) => t.length > 1)
        .map((t, i) => (
          <path
            key={i}
            className={serie.punteada ? 'animate-aparecer' : 'animate-trazo'}
            d={ruta(t)}
            fill="none"
            stroke={tono}
            strokeWidth={serie.punteada ? 1.5 : 2.5}
            strokeDasharray={serie.punteada ? '5 4' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={serie.punteada ? undefined : 1}
          />
        ))}
      {serie.puntos &&
        tramos.flat().map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={tono} />)}
    </g>
  )
}

export function GraficaBarras({
  etiquetas,
  valores,
  alto = 160,
  tono = 'serie',
  destacar,
  formatoValor,
  foco,
  onFoco,
  anchoMax = 56,
  resumen,
}: {
  etiquetas: string[]
  valores: number[]
  alto?: number
  tono?: 'serie' | 'aviso'
  destacar?: number
  formatoValor?: (v: number) => string
  foco?: number
  onFoco?: (i: number | undefined) => void
  anchoMax?: number
  resumen: string
}) {
  const arrastre = useArrastre(onFoco)
  if (valores.length === 0) return null

  // Las barras siempre arrancan en cero; con los valores escritos encima la
  // reja sobra y el tope se pega al dato más alto.
  const tope = Math.max(...valores, 1)
  const escala = formatoValor ? { hasta: tope, marcas: [] as number[] } : escalaY(0, tope)
  const padArriba = formatoValor ? 24 : PAD.arriba

  return (
    <Lienzo alto={alto} resumen={resumen}>
      {(ancho) => {
        const anchoPlot = Math.max(1, ancho - PAD.izquierda - PAD.derecha)
        const altoPlot = Math.max(1, alto - padArriba - PAD.abajo)
        const carril = anchoPlot / valores.length
        const anchoBarra = Math.min(anchoMax, Math.max(2, carril * 0.72))
        const ex = (i: number) => PAD.izquierda + carril * (i + 0.5)
        const ey = (v: number) => padArriba + (1 - v / escala.hasta) * altoPlot

        const indiceEn = (e: PointerEvent<SVGSVGElement>) =>
          Math.min(
            valores.length - 1,
            Math.max(0, Math.floor((desplazamiento(e) - PAD.izquierda) / carril)),
          )

        return (
          <svg
            width={ancho}
            height={alto}
            style={{ touchAction: 'pan-y' }}
            {...arrastre?.(indiceEn)}
          >
            {escala.marcas.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.izquierda}
                  x2={ancho - PAD.derecha}
                  y1={ey(v)}
                  y2={ey(v)}
                  stroke={TINTA.reja}
                />
                {v > 0 && (
                  <text x={PAD.izquierda} y={ey(v) - 4} fontSize={10} fill={TINTA.guia}>
                    {numEje(v)}
                  </text>
                )}
              </g>
            ))}

            {valores.map((v, i) => {
              const y = ey(v)
              const viva = destacar === i || foco === i
              const atenuar = (destacar != null || foco != null) && !viva
              return (
                <path
                  key={i}
                  className="animate-crecer"
                  style={{ animationDelay: `${Math.min(i * 18, 360)}ms` }}
                  d={barra(
                    ex(i) - anchoBarra / 2,
                    y,
                    anchoBarra,
                    Math.max(v > 0 ? 2 : 0, alto - PAD.abajo - y),
                    Math.min(6, anchoBarra / 4),
                  )}
                  fill={TINTA[tono]}
                  fillOpacity={atenuar ? 0.45 : 1}
                />
              )
            })}

            {formatoValor &&
              valores.map((v, i) => (
                <text
                  key={i}
                  x={ex(i)}
                  y={ey(v) - 7}
                  fontSize={13}
                  fontWeight={600}
                  fill={TINTA.guia}
                  textAnchor="middle"
                >
                  {formatoValor(v)}
                </text>
              ))}

            {indicesEtiqueta(etiquetas.length, 5).map((i) => (
              <text
                key={i}
                x={ex(i)}
                y={alto - 4}
                fontSize={valores.length <= 6 ? 12 : 10}
                fill={TINTA.guia}
                textAnchor="middle"
              >
                {etiquetas[i]}
              </text>
            ))}
          </svg>
        )
      }}
    </Lienzo>
  )
}

function barra(x: number, y: number, ancho: number, alto: number, radio: number) {
  const r = Math.min(radio, ancho / 2, alto)
  return `M${x},${y + alto}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + ancho - r},${y}Q${x + ancho},${y} ${x + ancho},${y + r}L${x + ancho},${y + alto}Z`
}

export function Leyenda({ series }: { series: Serie[] }) {
  return (
    <div className="mt-2.5 flex items-center justify-center gap-5 text-xs text-ink-faint">
      {series
        .filter((s) => s.nombre)
        .map((s) => {
          const tono = TINTA[s.tono ?? 'serie']
          return (
            <span key={s.nombre} className="flex items-center gap-1.5">
              <span
                className="w-5"
                style={
                  s.punteada
                    ? { borderTop: `1.5px dashed ${tono}` }
                    : { height: 2, borderRadius: 2, background: tono }
                }
              />
              {s.nombre}
            </span>
          )
        })}
    </div>
  )
}
