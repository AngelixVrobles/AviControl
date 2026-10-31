import { expect, test, type Page } from '@playwright/test'
import { sembrar } from './ayuda'

// Al pollero se le vende por libras y las aves no se cuentan: 10 por caja.
// Una pollada de 200 con 10 muertas: salieron 190. Toño se llevó 12 cajas
// (849 lb) y Nenel 4 cajas sobrecargadas (387 lb): a 10 por caja son 160, y la
// app cree que quedan 30. Por las libras, Toño se llevó 131 y Nenel 59.
function pollada(page: Page, ventas: { comprador: string; cantidad: number; pesoLb: number }[]) {
  return sembrar(
    page,
    async ({ db, hoy, sumarDias }, arg) => {
      const ventas = arg as { comprador: string; cantidad: number; pesoLb: number }[]
      const inicio = sumarDias(hoy, -40)
      const id = (await db.lotes.add({
        tipo: 'engorde',
        nombre: 'Pollada de octubre',
        fechaInicio: inicio,
        cantidadInicial: 200,
        costoInicial: 7600,
        estado: 'activo',
        pesoObjetivoLb: 5.5,
        precioVentaLb: 38,
        creado: Date.now(),
      })) as number
      const registros = []
      for (let d = 1; d < 40; d++)
        registros.push({
          loteId: id,
          fecha: sumarDias(inicio, d),
          mortalidad: d <= 10 ? 1 : 0,
          descarte: 0,
          alimentoLb: 20 + d * 3,
          creado: Date.now(),
        })
      await db.registros.bulkAdd(registros)
      for (const v of ventas)
        await db.ingresos.add({
          loteId: id,
          tipo: 'aves',
          fecha: hoy,
          precioLb: 38,
          monto: v.pesoLb * 38,
          avesEstimadas: true,
          pesada: { vacias: [{ cajas: v.cantidad / 10, lb: v.cantidad * 1.55 }], llenas: [v.pesoLb + v.cantidad * 1.55], pollosPorCaja: 10 },
          creado: Date.now(),
          ...v,
        })
      return id
    },
    ventas,
  )
}

test('con la última venta se acaban los pollos, y las aves se cuadran por las libras', async ({ page }) => {
  const id = await pollada(page, [{ comprador: 'Toño', cantidad: 120, pesoLb: 849 }])
  await page.goto(`/lotes/${id}`)
  await page.getByRole('button', { name: 'Venta', exact: true }).click()
  const hoja = page.getByRole('dialog')
  // La última venta se pesó por cajas: esta abre igual.
  await hoja.getByLabel('Comprador').fill('Nenel')
  await hoja.getByLabel('Cajas del grupo 1').fill('4')
  await hoja.getByLabel('Libras de las cajas vacías del grupo 1').fill('62')
  await hoja.getByLabel('Pesada 1 de cajas con pollo, en libras').fill('233')
  await hoja.getByRole('button', { name: '+ Otra pesada' }).click()
  await hoja.getByLabel('Pesada 2 de cajas con pollo, en libras').fill('216')
  await expect(hoja.getByLabel('Nº de aves')).toHaveValue('40')

  // Por las cuentas quedarían 30, pero en el galpón ya no queda ninguno.
  const seAcaban = hoja.getByRole('button', { name: /Con esta venta se acaban los pollos/ })
  await expect(seAcaban).toContainText('quedarían 30')
  await seAcaban.click()
  await hoja.getByRole('button', { name: 'Guardar y cerrar el ciclo' }).click()
  await expect(hoja).toBeHidden()

  await page.getByRole('tab', { name: 'Dinero' }).click()
  const main = page.getByRole('main')
  await expect(main).toContainText('unas 131 aves')
  await expect(main).toContainText('unas 59 aves')
  await expect(page.getByRole('button', { name: 'Reabrir ciclo' })).toBeVisible()
})

test('si ya salió el último pollo, «Ya no quedan pollos» cuadra las ventas y cierra el ciclo', async ({ page }) => {
  const id = await pollada(page, [
    { comprador: 'Toño', cantidad: 120, pesoLb: 849 },
    { comprador: 'Nenel', cantidad: 40, pesoLb: 387 },
  ])
  await page.goto(`/lotes/${id}`)
  await page.getByRole('tab', { name: 'Dinero' }).click()
  const main = page.getByRole('main')
  await expect(main).toContainText('unas 120 aves')
  await page.getByRole('button', { name: 'Ya no quedan pollos' }).first().click()

  const hoja = page.getByRole('dialog')
  await expect(hoja).toContainText('quedan 30 pollos')
  await expect(hoja.getByLabel('De 120 a 131 aves')).toBeVisible()
  await expect(hoja.getByLabel('De 40 a 59 aves')).toBeVisible()
  await expect(hoja).toContainText('Salieron 190 pollos en ventas')
  await hoja.getByRole('button', { name: 'Cuadrar y cerrar el ciclo' }).click()
  await expect(hoja).toBeHidden()

  await expect(main).toContainText('unas 131 aves')
  await expect(main).toContainText('unas 59 aves')
  await expect(page.getByRole('button', { name: 'Reabrir ciclo' })).toBeVisible()
})
