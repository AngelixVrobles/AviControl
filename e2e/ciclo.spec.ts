import { expect, test } from '@playwright/test'
import { cicloEnCurso } from './ayuda'

test('crear un ciclo y anotar el primer día escribiendo las bajas', async ({ page }) => {
  await page.goto('/lotes/nuevo')
  await page.getByLabel('Nº de pollitos').fill('1000')
  await page.getByRole('button', { name: 'Crear ciclo' }).click()
  await expect(page).toHaveURL(/\/lotes\/\d+$/)

  await page.getByRole('button', { name: 'Día', exact: true }).click()
  const hoja = page.getByRole('dialog')
  const bajas = hoja.getByRole('textbox', { name: 'Mortalidad' })
  await bajas.fill('12')
  await hoja.getByRole('button', { name: 'Calor' }).click()
  await hoja.getByRole('button', { name: /^Guardar día/ }).click()
  await expect(hoja).toBeHidden()
  await expect(page.getByRole('main')).toContainText('12 bajas')
})

test('dos toques seguidos en Guardar anotan el día una sola vez', async ({ page }) => {
  const id = await cicloEnCurso(page, { dias: 5 })
  await page.goto(`/lotes/${id}?reg=1`)
  const hoja = page.getByRole('dialog')
  await hoja.getByRole('textbox', { name: 'Mortalidad' }).fill('3')
  await hoja.getByRole('button', { name: /^Guardar día/ }).dblclick()
  await expect(hoja).toBeHidden()
  const hoy = await page.evaluate(async () => {
    const { db } = await import('/src/db/schema.ts')
    const { hoyISO } = await import('/src/lib/format.ts')
    return db.registros.where('fecha').equals(hoyISO()).count()
  })
  expect(hoy).toBe(1)
})

test('con dos ciclos, Registrar pregunta en cuál, y Volver no da vueltas', async ({ page }) => {
  await cicloEnCurso(page, { nombre: 'Galpón A' })
  const b = await cicloEnCurso(page, { nombre: 'Galpón B' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Registrar día' }).click()
  const elegir = page.getByRole('dialog', { name: '¿En cuál ciclo anotas?' })
  await elegir.getByRole('button', { name: /Galpón B/ }).click()
  await expect(page).toHaveURL(new RegExp(`/lotes/${b}`))
  await expect(page.getByRole('dialog', { name: 'Registro del día' })).toBeVisible()
  await page.keyboard.press('Escape')

  // De la ficha se vuelve al ciclo, y del ciclo a Inicio: antes «Volver»
  // regresaba a la ficha y daba vueltas entre las dos.
  await page.getByRole('link', { name: /Alimento/ }).first().click()
  await expect(page).toHaveURL(/\/ficha\/alimento$/)
  await page.getByRole('button', { name: 'Volver al ciclo' }).click()
  await expect(page).toHaveURL(new RegExp(`/lotes/${b}`))
  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/)
})
