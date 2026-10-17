import { expect, test } from '@playwright/test'
import { cicloEnCurso } from './ayuda'

test('una venta a crédito sale del peso por el precio, y se cobra en Te deben', async ({ page }) => {
  const id = await cicloEnCurso(page, { dias: 40 })
  await page.goto(`/lotes/${id}`)
  await page.getByRole('button', { name: 'Venta', exact: true }).click()
  const hoja = page.getByRole('dialog')
  await hoja.getByLabel('Nº de aves').fill('100')
  await hoja.getByLabel('Peso total (lb)').fill('550')
  // El precio del ciclo viene puesto: 550 lb a RD$55.
  await expect(hoja.getByLabel('Total de la venta')).toHaveValue('30250')
  await hoja.getByLabel('Comprador').fill('Don Pedro')
  await hoja.getByRole('button', { name: 'A crédito' }).click()
  await hoja.getByLabel('Te dio hoy').fill('10000')
  await hoja.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(hoja).toBeHidden()

  await page.goto('/cobros')
  await expect(page.getByRole('main')).toContainText('Don Pedro')
  await expect(page.getByRole('main')).toContainText('20,250')
  await page.getByRole('button', { name: /Cobrar/ }).first().click()
  const cobro = page.getByRole('dialog')
  await cobro.getByRole('button', { name: /Todo lo que falta/ }).click()
  await cobro.getByRole('button', { name: /^Guardar/ }).click()
  await expect(page.getByRole('main')).toContainText('Nadie te debe')
})
