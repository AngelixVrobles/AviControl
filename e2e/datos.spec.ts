import { expect, test, type Page } from '@playwright/test'
import { cicloEnCurso, sembrar } from './ayuda'

// Atrás en Android: se entra al ciclo desde Inicio, como en el teléfono, para
// que Atrás tenga a dónde volver dentro de la app.
test('Atrás cierra la hoja abierta en vez de salir del ciclo', async ({ page }) => {
  const id = await cicloEnCurso(page, { nombre: 'Galpón de Atrás', dias: 10 })
  await page.goto('/')
  await page.getByRole('link', { name: /^Galpón de Atrás \d/ }).click()
  await expect(page).toHaveURL(new RegExp(`/lotes/${id}$`))

  await page.getByRole('button', { name: 'Día', exact: true }).click()
  const hoja = page.getByRole('dialog', { name: 'Registro del día' })
  await hoja.getByRole('textbox', { name: 'Mortalidad' }).fill('37')
  await page.goBack()
  await expect(hoja).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`/lotes/${id}$`))

  // Sin hojas abiertas, Atrás vuelve como siempre.
  await page.goBack()
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/)
})

// Las bajas no pueden ser más que las aves que quedan: las vendidas antes ya no
// estaban en el galpón.
test('las bajas del día no pasan de las aves que quedan después de vender', async ({ page }) => {
  // 1,000 pollitos con 2 bajas al día por 9 días: quedan 982.
  const id = await cicloEnCurso(page, { aves: 1000, dias: 10 })
  await sembrar(
    page,
    async ({ db, hoy, sumarDias }, loteId) => {
      await db.ingresos.add({
        loteId: loteId as number,
        tipo: 'aves',
        cantidad: 950,
        pesoLb: 3800,
        monto: 190000,
        fecha: sumarDias(hoy, -1),
        creado: Date.now(),
      })
    },
    id,
  )
  await page.goto(`/lotes/${id}?reg=1`)
  const hoja = page.getByRole('dialog', { name: 'Registro del día' })
  await hoja.getByRole('textbox', { name: 'Mortalidad' }).fill('40')
  await expect(hoja).toContainText('Son más de las 32 aves que hay.')
  await expect(hoja.getByRole('button', { name: /^Guardar día/ })).toBeDisabled()
})

test('al vender y cerrar, un número negativo no deja cerrar el ciclo', async ({ page }) => {
  const id = await cicloEnCurso(page, { aves: 1000, dias: 40 })
  await page.goto(`/lotes/${id}?t=dinero`)
  await page.getByRole('button', { name: 'Vender y cerrar ciclo' }).click()
  const hoja = page.getByRole('dialog')
  await hoja.getByLabel('Peso total (lb)').fill('-2650')
  await hoja.getByLabel('Precio por libra').fill('-55')
  await expect(hoja).toContainText('No puede ser negativo.')
  await expect(hoja).toContainText('Hay un número negativo.')
  const seguir = hoja.getByRole('button', { name: 'Ver el resultado' })
  await expect(seguir).toBeDisabled()
  await hoja.getByLabel('Peso total (lb)').fill('2650')
  await hoja.getByLabel('Precio por libra').fill('55')
  await expect(hoja).not.toContainText('No puede ser negativo.')
  await expect(seguir).toBeEnabled()
})

async function respaldoDe(page: Page, exportado: string): Promise<string> {
  const json = await page.evaluate(async () => {
    const { leerRespaldo } = await import('/src/db/respaldo.ts')
    const { getSettings } = await import('/src/lib/settings.ts')
    return leerRespaldo(getSettings())
  })
  return JSON.stringify({ ...JSON.parse(json), exportado })
}

async function restaurarArchivo(page: Page, nombre: string, contenido: string) {
  const elegir = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click()
  // En Android el respaldo sale como .txt: se abre igual.
  await (await elegir).setFiles({ name: nombre, mimeType: 'text/plain', buffer: Buffer.from(contenido) })
}

// Restaurar reemplaza todo: antes de hacerlo se dice de cuándo es el respaldo,
// con su año, y lo que había se puede recuperar.
test('restaurar dice de cuándo es el respaldo y deja volver a lo de antes', async ({ page }) => {
  await cicloEnCurso(page, { nombre: 'El del respaldo', dias: 5 })
  const respaldo = await respaldoDe(page, '2026-09-12T15:00:00.000Z')
  await page.evaluate(async () => {
    const { db } = await import('/src/db/schema.ts')
    await Promise.all(db.tables.map((t) => t.clear()))
  })
  await cicloEnCurso(page, { nombre: 'El de ahora', dias: 3 })

  await page.goto('/ajustes')
  await restaurarArchivo(page, 'avicontrol-respaldo-2026-09-12.json.txt', respaldo)
  const confirmar = page.getByRole('dialog', { name: 'Restaurar respaldo' })
  await expect(confirmar).toContainText('El respaldo del 12 de septiembre de 2026 trae 1 ciclo y 4 registros.')
  await expect(confirmar).toContainText('Reemplaza lo que hay ahora (1 ciclo y 2 registros)')
  await confirmar.getByRole('button', { name: 'Restaurar' }).click()
  await expect(confirmar).toBeHidden()

  const volver = page.getByRole('button', { name: /Volver a eso/ })
  await expect(volver).toContainText('Antes de restaurar había 1 ciclo y 2 registros')
  await page.goto('/')
  await expect(page.getByRole('main')).toContainText('El del respaldo')
  await expect(page.getByRole('main')).not.toContainText('El de ahora')

  await page.goto('/ajustes')
  await page.getByRole('button', { name: /Volver a eso/ }).click()
  const deshacer = page.getByRole('dialog', { name: 'Volver a lo de antes' })
  await deshacer.getByRole('button', { name: 'Volver', exact: true }).click()
  await expect(deshacer).toBeHidden()
  await page.goto('/')
  await expect(page.getByRole('main')).toContainText('El de ahora')
  await expect(page.getByRole('main')).not.toContainText('El del respaldo')
})

// Borrar el ciclo que pasó alimento no se lleva los sacos del otro: siguen en su
// almacén como una compra. Borrar el que lo recibió se los devuelve al que lo dio.
test('borrar un ciclo con alimento pasado deja los sacos donde están', async ({ page }) => {
  const r = await sembrar(page, async ({ db, hoy, sumarDias }) => {
    const { pasarAlimento } = await import('/src/db/traspaso.ts')
    const { borrarCiclo } = await import('/src/db/ciclo.ts')
    const ciclo = (nombre: string, dias: number, estado: 'activo' | 'cerrado') =>
      db.lotes.add({
        tipo: 'engorde',
        nombre,
        fechaInicio: sumarDias(hoy, -dias),
        cantidadInicial: 1000,
        costoInicial: 38000,
        estado,
        fechaCierre: estado === 'cerrado' ? sumarDias(hoy, -2) : undefined,
        creado: Date.now(),
      }) as Promise<number>
    const a = await ciclo('El que cerró', 45, 'cerrado')
    const b = await ciclo('El que sigue', 3, 'activo')
    const c = await ciclo('El de al lado', 3, 'activo')
    await pasarAlimento({ desde: { id: a, nombre: 'El que cerró' }, hacia: { id: b, nombre: 'El que sigue' }, qq: 10, monto: 20000, fecha: hoy })
    await pasarAlimento({ desde: { id: b, nombre: 'El que sigue' }, hacia: { id: c, nombre: 'El de al lado' }, qq: 4, monto: 8000, fecha: hoy })
    const deB = async () =>
      (await db.gastos.where('loteId').equals(b).toArray())
        .map((g) => ({ qq: g.cantidadQq, monto: g.monto, traspaso: !!g.traspaso }))
        .sort((x, y) => (y.qq ?? 0) - (x.qq ?? 0))
    await borrarCiclo(a)
    const sinA = await deB()
    await borrarCiclo(c)
    const sinC = await deB()
    return { sinA, sinC, quedan: await db.gastos.count() }
  })
  // Sin A, los 10 qq de B quedan como una compra, y lo que pasó a C sigue pasado.
  expect(r.sinA).toEqual([
    { qq: 10, monto: 20000, traspaso: false },
    { qq: -4, monto: -8000, traspaso: true },
  ])
  // Sin C, los 4 qq vuelven a B: ya no hay mitad que diga que salieron.
  expect(r.sinC).toEqual([{ qq: 10, monto: 20000, traspaso: false }])
  expect(r.quedan).toBe(1)
})
