// Curvas de referencia: Ross 308 as-hatched (peso vivo) y ponedora marrón
// comercial tipo Hy-Line Brown (% de postura por semana de edad).

const ROSS_308_LB: [number, number][] = [
  [0, 0.09],
  [7, 0.45],
  [14, 1.19],
  [21, 2.26],
  [28, 3.56],
  [35, 4.97],
  [42, 6.4],
  [49, 7.73],
  [56, 8.93],
]

const POSTURA_PCT: [number, number][] = [
  [18, 10],
  [19, 35],
  [20, 60],
  [21, 80],
  [22, 90],
  [24, 95],
  [30, 96],
  [40, 94],
  [50, 91],
  [60, 87],
  [70, 82],
  [80, 76],
  [90, 70],
]

function interpolar(tabla: [number, number][], x: number): number {
  if (x <= tabla[0][0]) return tabla[0][1]
  const last = tabla[tabla.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < tabla.length; i++) {
    const [x1, y1] = tabla[i - 1]
    const [x2, y2] = tabla[i]
    if (x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)
  }
  return last[1]
}

export const pesoEstandarLb = (dia: number) => interpolar(ROSS_308_LB, dia)

export const posturaEstandarPct = (semanaEdad: number) => interpolar(POSTURA_PCT, semanaEdad)

export const EDAD_INICIAL_DEFAULT = 18
