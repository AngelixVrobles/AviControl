import { expect, test, type Page } from '@playwright/test'
import { cicloEnCurso, sembrar } from './ayuda'

// Un ciclo de 30 días con su pesaje y la compra del alimento con quintales:
// con eso hay proyección, y la ganancia estimada sale.
function cicloConPeso(page: Page, ajustes: Record<string, unknown> = {}, ventaPrevia?: Record<string, unknown>) {
  return sembrar(
    page,
    async ({ db, hoy, sumarDias }, venta) => {
      const inicio = sumarDias(hoy, -30)
      const id = (await db.lotes.add({
        tipo: 'engorde',
        nombre: 'Pollada de octubre',
        fechaInicio: inicio,
        cantidadInicial: 1000,
        costoInicial: 38000,
        estado: 'activo',
        pesoObjetivoLb: 5.5,
        precioVentaLb: 60,
        creado: Date.now(),
      })) as number
      const registros = []
      for (let d = 1; d <= 30; d++)
        registros.push({
          loteId: id,
          fecha: sumarDias(inicio, d),
          mortalidad: 1,
          descarte: 0,
          alimentoLb: 40 + d * 7,
          pesoPromedio: d === 30 ? 3.6 : undefined,
          creado: Date.now(),
        })
      await db.registros.bulkAdd(registros)
      await db.gastos.add({ loteId: id, categoria: 'alimento', monto: 90000, cantidadQq: 45, fecha: inicio, creado: Date.now() })
      if (venta) await db.ingresos.add({ loteId: id, tipo: 'aves', fecha: hoy, creado: Date.now(), ...(venta as object) } as never)
      return id
    },
    ventaPrevia,
    ajustes,
  )
}

// El caso que pidió el productor: la puso a 60 la libra y era a 65.
test('el precio de una venta a crédito se corrige desde «Te deben»', async ({ page }) => {
  const id = await cicloEnCurso(page, { dias: 40 })
  await page.goto(`/lotes/${id}`)
  await page.getByRole('button', { name: 'Venta', exact: true }).click()
  const hoja = page.getByRole('dialog')
  await hoja.getByLabel('Nº de aves').fill('100')
  await hoja.getByLabel('Peso total (lb)').fill('550')
  await hoja.getByLabel('Precio por libra').fill('60')
  await hoja.getByLabel('Comprador').fill('Doña Rosa')
  await hoja.getByRole('button', { name: 'A crédito' }).click()
  await hoja.getByLabel('Te dio hoy').fill('3000')
  await hoja.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(hoja).toBeHidden()

  await page.goto('/cobros')
  const main = page.getByRole('main')
  await expect(main).toContainText('30,000')
  await page.getByRole('button', { name: /Cobrar/ }).first().click()
  const cobro = page.getByRole('dialog', { name: /Cobrar a Doña Rosa/ })
  await expect(cobro).toContainText('550 lb a RD$60')
  await cobro.getByRole('button', { name: /Corregir la venta/ }).click()

  const venta = page.getByRole('dialog', { name: 'Editar venta' })
  await expect(venta.getByLabel('Precio por libra')).toHaveValue('60')
  await venta.getByLabel('Precio por libra').fill('65')
  await expect(venta.getByLabel('Total de la venta')).toHaveValue('35750')
  // Lo que falta sube con el precio: lo que ya dio sigue contando.
  await expect(venta).toContainText('faltan RD$32,750')
  await expect(venta).toContainText('Antes faltaban RD$30,000')
  await venta.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(venta).toBeHidden()
  await expect(main).toContainText('32,750')
  await expect(main).toContainText('vendido RD$35,750')
})

test('la ganancia estimada cuenta los empleados y los gastos que vienen', async ({ page }) => {
  // El número grande se anima al cambiar: sin animación se lee el de verdad.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const id = await cicloConPeso(page)
  await page.goto(`/lotes/${id}?t=dinero`)
  const main = page.getByRole('main')
  await expect(main).toContainText('Ganancia estimada')
  await expect(main).toContainText('Alimento por comprar')
  const ganancia = () => main.getByText(/^Te quedarían$|^Perderías$/).locator('xpath=..').innerText()
  const antes = await ganancia()

  await page.getByRole('button', { name: /Empleados/ }).click()
  const empleados = page.getByRole('dialog', { name: 'Pago de los empleados' })
  await empleados.getByLabel('Les pagas').fill('3500')
  await empleados.getByLabel('Cada cuánto').selectOption('semana')
  await expect(empleados).toContainText('Faltan')
  await empleados.getByRole('button', { name: 'Guardar' }).click()
  await expect(empleados).toBeHidden()
  await expect(main).toContainText('RD$3,500 a la semana')
  await expect.poll(ganancia).not.toBe(antes)

  await page.getByRole('button', { name: /Otro gasto que viene/ }).click()
  const porVenir = page.getByRole('dialog', { name: 'Un gasto que viene' })
  await porVenir.getByRole('button', { name: 'Luz' }).click()
  await porVenir.getByLabel('Cuánto').fill('2500')
  await porVenir.getByRole('button', { name: 'Agregar' }).click()
  await expect(porVenir).toBeHidden()
  await expect(main).toContainText('Por pagar · Gas y luz')
  const conLuz = await ganancia()

  // Al pagarla pasa a los gastos: la ganancia estimada no cambia.
  await page.getByRole('button', { name: /^Luz/ }).click()
  const luz = page.getByRole('dialog', { name: 'Luz' })
  await luz.getByRole('button', { name: /Ya lo pagué/ }).click()
  await expect(luz).toBeHidden()
  await expect(main).not.toContainText('Por pagar · Gas y luz')
  await expect.poll(ganancia).toBe(conLuz)
})

test('vendiendo arreglado, las cuentas van por libra arreglada y cada comprador trae su precio', async ({ page }) => {
  const id = await cicloConPeso(
    page,
    { venta: 'arreglado', rindePct: 75, costoArregloAve: 10, precioMercadoLb: 32 },
    { cantidad: 4, pesoLb: 14, monto: 910, precioLb: 65, comprador: 'Marta', arreglado: { rindePct: 75 } },
  )
  await page.goto(`/lotes/${id}?t=dinero`)
  const main = page.getByRole('main')
  await expect(main).toContainText('Precio mínimo por libra arreglada')
  await expect(main).toContainText('lb arregladas a RD$60')
  await expect(main).toContainText('Arreglar los pollos')
  await expect(main).toContainText('En pie, el pollero tendría que pagarte')

  await page.getByRole('button', { name: 'Venta', exact: true }).click()
  const hoja = page.getByRole('dialog')
  await expect(hoja.getByRole('button', { name: 'Arreglado' })).toHaveAttribute('aria-pressed', 'true')
  await expect(hoja.getByLabel('Libras arregladas')).toBeVisible()
  await expect(hoja.getByLabel('Precio por libra')).toHaveValue('60')
  // Marta paga a 65: al escribir su nombre sale su precio.
  await hoja.getByLabel('Comprador').fill('Marta')
  await expect(hoja.getByLabel('Precio por libra')).toHaveValue('65')
  await expect(hoja).toContainText('La última vez le vendiste a RD$65 la libra arreglada.')
  await hoja.getByLabel('Nº de aves').fill('3')
  await hoja.getByLabel('Libras arregladas').fill('12')
  await expect(hoja.getByLabel('Total de la venta')).toHaveValue('780')
  // A otro se le vende a otro precio: se toca el que ya se usó o se escribe.
  await hoja.getByRole('button', { name: 'RD$65' }).click()
  await hoja.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(hoja).toBeHidden()
  await expect(main).toContainText('12 lb arregladas')
})

test('«Cómo vendes» dice si conviene arreglarlo o venderlo en pie', async ({ page }) => {
  const id = await cicloConPeso(page, { precioMercadoLb: 32 })
  await page.goto(`/lotes/${id}?t=dinero`)
  await page.getByRole('button', { name: /Por vender/ }).click()
  const hoja = page.getByRole('dialog', { name: 'Cómo vendes el pollo' })
  await hoja.getByRole('button', { name: 'Arreglado' }).click()
  await hoja.getByLabel('Tu precio por libra arreglada').fill('44')
  await expect(hoja).toContainText('Por debajo de RD$42.67 la libra arreglada, te deja más venderlo en pie.')
  await hoja.getByLabel('Tu precio por libra arreglada').fill('60')
  await expect(hoja).toContainText('Arreglarlas te deja')
  await hoja.getByRole('button', { name: 'Guardar' }).click()
  await expect(hoja).toBeHidden()
  await expect(page.getByRole('main')).toContainText('Precio mínimo por libra arreglada')
})

// Antes el ciclo se acababa a los 35 días para todos, y el alimento que falta y
// el pago de los empleados se contaban hasta ahí aunque se vendiera a los 42.
test('el día de venta se cambia y la ganancia estimada va hasta ese día', async ({ page }) => {
  const id = await cicloConPeso(page)
  await page.goto(`/lotes/${id}?t=dinero`)
  const main = page.getByRole('main')
  await expect(main).toContainText('cuando lleguen a 5.5 lb')

  await page.getByRole('button', { name: 'Cambiar el día' }).click()
  const hoja = page.getByRole('dialog', { name: '¿Qué día vendes?' })
  await hoja.getByRole('button', { name: 'Un día fijo' }).click()
  await hoja.getByLabel('Día de venta').fill('95')
  await expect(hoja).toContainText('Pon un día entre 1 y 90.')
  await hoja.getByLabel('Día de venta').fill('42')
  await expect(hoja).toContainText('Hoy es el día 30.')
  await hoja.getByRole('button', { name: /Hacerlo igual en los ciclos nuevos/ }).click()
  await hoja.getByRole('button', { name: 'Guardar' }).click()
  await expect(hoja).toBeHidden()
  await expect(main).toContainText('día 42')
  await expect(main).not.toContainText('cuando lleguen a')

  // Queda en Ajustes para los ciclos que vienen.
  await page.goto('/ajustes')
  await expect(page.getByLabel('Día de venta, en días')).toHaveValue('42')
})
