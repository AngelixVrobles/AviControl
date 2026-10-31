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

// Como se anota en el cuaderno: las cajas del pollero se pesan vacías por
// grupos y después llenas, y se cobra la diferencia. Los números son los de una
// venta de verdad: 503 + 534 llenas, menos 2 grupos de 6 cajas de 94 lb.
test('la venta al pollero se pesa por cajas, como en el cuaderno', async ({ page }) => {
  const id = await cicloEnCurso(page, { dias: 40 })
  await page.goto(`/lotes/${id}`)
  await page.getByRole('button', { name: 'Venta', exact: true }).click()
  const hoja = page.getByRole('dialog')
  await hoja.getByRole('button', { name: /Pesar por cajas/ }).click()
  await hoja.getByLabel('Cajas del grupo 1').fill('6')
  await hoja.getByLabel('Libras de las cajas vacías del grupo 1').fill('94')
  await hoja.getByRole('button', { name: '+ Otro grupo de cajas' }).click()
  await hoja.getByLabel('Cajas del grupo 2').fill('6')
  await hoja.getByLabel('Libras de las cajas vacías del grupo 2').fill('94')
  await hoja.getByLabel('Pesada 1 de cajas con pollo, en libras').fill('503')
  await hoja.getByRole('button', { name: '+ Otra pesada' }).click()
  await hoja.getByLabel('Pesada 2 de cajas con pollo, en libras').fill('534')
  await expect(hoja.getByRole('region', { name: 'Pesada por cajas' })).toContainText('849 lb de pollo')
  await expect(hoja.getByLabel('Peso total (lb)')).toHaveValue('849')
  // 12 cajas de 10 pollos: salen las aves.
  await hoja.getByLabel('Pollos por caja').fill('10')
  await expect(hoja.getByLabel('Nº de aves')).toHaveValue('120')
  await hoja.getByLabel('Precio por libra').fill('38')
  await expect(hoja.getByLabel('Total de la venta')).toHaveValue('32262')
  await hoja.getByLabel('Comprador').fill('Rafa')
  await hoja.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(hoja).toBeHidden()

  // La venta dice sus cajas, y al corregirla la pesada sigue ahí.
  await page.goto(`/lotes/${id}?t=dinero`)
  await expect(page.getByRole('main')).toContainText('12 cajas')
  await page.getByRole('button', { name: /Rafa/ }).click()
  const corregir = page.getByRole('dialog')
  await expect(corregir.getByLabel('Libras de las cajas vacías del grupo 2')).toHaveValue('94')
  await expect(corregir.getByLabel('Pesada 2 de cajas con pollo, en libras')).toHaveValue('534')
  await corregir.getByRole('button', { name: 'Cerrar' }).click()

  // La próxima venta abre con la pesada, y recuerda las cajas del pollero.
  await page.getByRole('button', { name: 'Venta', exact: true }).click()
  const otra = page.getByRole('dialog')
  await expect(otra.getByRole('region', { name: 'Pesada por cajas' })).toBeVisible()
  await otra.getByLabel('Comprador').fill('Rafa')
  await expect(otra).toContainText('Las cajas de Rafa pesaron 15.7 lb cada una la última vez, con 10 pollos.')
})
