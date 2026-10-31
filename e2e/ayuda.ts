import type { Page } from '@playwright/test'

type Base = {
  db: typeof import('../src/db/schema').db
  hoy: string
  sumarDias: (fecha: string, dias: number) => string
}

/**
 * Llena la base desde la página con los módulos de la app: más rápido y más
 * claro que anotar cada día a mano. La función corre dentro de la página, así
 * que solo puede usar lo que recibe.
 */
export async function sembrar<T>(
  page: Page,
  fn: (b: Base, arg: unknown) => Promise<T>,
  arg?: unknown,
  ajustes: Record<string, unknown> = {},
): Promise<T> {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  return page.evaluate(
    async ({ src, arg, ajustes }) => {
      const { db } = await import('/src/db/schema.ts')
      const { hoyISO, sumarDias } = await import('/src/lib/format.ts')
      // Con el respaldo al día y lo nuevo ya visto, Inicio no muestra avisos que
      // no son de la prueba.
      localStorage.setItem('avicontrol.settings', JSON.stringify({ ultimoRespaldo: hoyISO(), ...ajustes }))
      localStorage.setItem('avicontrol.novedades', '1.15')
      // El aviso de instalar la app tampoco: el teléfono de prueba es un iPhone.
      localStorage.setItem('avicontrol.instalar', String(Date.now() + 30 * 86_400_000))
      const f = new Function(`return ${src}`)()
      return f({ db, hoy: hoyISO(), sumarDias }, arg)
    },
    { src: fn.toString(), arg, ajustes },
  )
}

/** Un ciclo en curso con `dias` días anotados. */
export function cicloEnCurso(
  page: Page,
  { nombre = 'Ciclo de prueba', aves = 1000, dias = 20, galponId }: { nombre?: string; aves?: number; dias?: number; galponId?: string } = {},
  ajustes?: Record<string, unknown>,
) {
  return sembrar(
    page,
    async ({ db, hoy, sumarDias }, a) => {
      const { nombre, aves, dias, galponId } = a as { nombre: string; aves: number; dias: number; galponId?: string }
      const inicio = sumarDias(hoy, -dias)
      const id = (await db.lotes.add({
        tipo: 'engorde',
        nombre,
        fechaInicio: inicio,
        cantidadInicial: aves,
        costoInicial: aves * 38,
        estado: 'activo',
        pesoObjetivoLb: 5.5,
        precioVentaLb: 55,
        galponId,
        creado: Date.now(),
      })) as number
      const registros = []
      for (let d = 1; d < dias; d++)
        registros.push({ loteId: id, fecha: sumarDias(inicio, d), mortalidad: 2, descarte: 0, alimentoLb: 50 + d * 12, creado: Date.now() })
      await db.registros.bulkAdd(registros)
      return id
    },
    { nombre, aves, dias, galponId },
    ajustes,
  )
}
