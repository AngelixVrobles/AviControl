import { expect, test } from '@playwright/test'
import { cicloEnCurso } from './ayuda'

// El caso que pidió el productor: 1,000 pollitos en un galpón de 8.6 × 8.6 m
// que de grandes no caben, y 350 que se pasan a otro galpón en la misma pollada.
test('pasar aves a otro galpón deja la pollada repartida y quita el aviso de espacio', async ({ page }) => {
  const id = await cicloEnCurso(page, { aves: 1000, dias: 21, galponId: 'g1' }, {
    galpones: [{ id: 'g1', nombre: 'Galpón 1', largoM: 8.6, anchoM: 8.6 }],
  })
  await page.goto(`/lotes/${id}`)
  await expect(page.getByRole('main')).toContainText('aguanta 813 aves al peso de venta')

  await page.getByRole('link', { name: /Galpón/ }).first().click()
  await page.getByRole('button', { name: 'Pasar aves a otro galpón' }).first().click()
  const hoja = page.getByRole('dialog')
  // El otro galpón todavía no está en Ajustes: se crea aquí mismo.
  await hoja.getByLabel('Nombre del galpón').fill('Galpón de atrás')
  await hoja.getByLabel('Largo en metros').fill('8')
  await hoja.getByLabel('Ancho en metros').fill('6')
  await hoja.getByLabel('Aves que se pasaron').fill('350')
  await hoja.getByRole('button', { name: 'Pasar 350 aves' }).click()
  await expect(hoja).toBeHidden()

  const main = page.getByRole('main')
  await expect(main).toContainText('Repartidas en Galpón 1 y Galpón de atrás')
  await page.getByRole('tab', { name: 'Galpón de atrás' }).click()
  await expect(main).toContainText('Para las 350 aves que tienes hoy en Galpón de atrás')

  await page.getByRole('button', { name: 'Volver al ciclo' }).click()
  await expect(main).toContainText('Galpón 1 y Galpón de atrás')
  await expect(main).not.toContainText('aguanta 813 aves')
})
