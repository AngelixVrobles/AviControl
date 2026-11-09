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

// Al empleado se le paga por pollada y no se anotó: el ciclo cerró con RD$1,093
// de ganancia donde, con los RD$15,000 del empleado, hubo una pérdida. Con el
// ciclo cerrado se anota el pago que falta, y también cualquier otro gasto.
test('un ciclo cerrado anota el pago del empleado que faltaba y cualquier gasto', async ({ page }) => {
  const id = await sembrar(page, async ({ db, hoy, sumarDias }) => {
    const inicio = sumarDias(hoy, -44)
    const cierre = sumarDias(hoy, -2)
    const loteId = (await db.lotes.add({
      tipo: 'engorde',
      nombre: 'Pollada cerrada',
      fechaInicio: inicio,
      fechaCierre: cierre,
      cantidadInicial: 1000,
      costoInicial: 40000,
      estado: 'cerrado',
      pesoObjetivoLb: 5.5,
      empleados: { monto: 15000, cada: 'ciclo' },
      creado: Date.now(),
    })) as number
    await db.gastos.add({ loteId, categoria: 'alimento', monto: 150000, fecha: sumarDias(inicio, 5), creado: Date.now() })
    await db.ingresos.add({ loteId, tipo: 'aves', cantidad: 902, pesoLb: 4949, monto: 191093, fecha: cierre, creado: Date.now() })
    return loteId
  })
  await page.goto(`/lotes/${id}?t=dinero`)
  const main = page.getByRole('main')
  await expect(main).toContainText('RD$1,093')
  await expect(main).toContainText('Falta anotar el pago de los empleados: RD$15,000')
  await main.getByRole('button', { name: 'Anotarlo' }).click()
  await expect(main).toContainText('−RD$13,907')
  await expect(main).not.toContainText('Falta anotar el pago de los empleados')

  // Cualquier otro gasto que faltó también se anota, sin reabrir el ciclo.
  await main.getByRole('button', { name: 'Anotar un gasto que faltó' }).click()
  const hoja = page.getByRole('dialog')
  await expect(hoja).toBeVisible()
})

// La pollada anterior vendió al 76 % del Cobb. La que sigue se pesó a los 28
// días un 7 % arriba de la curva: antes se estiraba ese pesaje hasta la venta
// y decía 7.76 lb. Ahora el lote se va pareciendo a lo que logra la granja, el
// peso lleva su rango y la app dice cuántas aves pesar y cuándo para afinarlo.
test('el estimado aprende de las polladas cerradas y dice su margen y cuántas aves pesar', async ({ page }) => {
  const id = await sembrar(page, async ({ db, hoy, sumarDias }) => {
    const i0 = sumarDias(hoy, -100)
    const c0 = sumarDias(i0, 42)
    const cerrada = (await db.lotes.add({
      tipo: 'engorde',
      nombre: 'Pollada de agosto',
      fechaInicio: i0,
      fechaCierre: c0,
      cantidadInicial: 1000,
      costoInicial: 42000,
      estado: 'cerrado',
      pesoObjetivoLb: 5.5,
      creado: Date.now(),
    })) as number
    await db.ingresos.add({ loteId: cerrada, tipo: 'aves', cantidad: 902, pesoLb: 4949, monto: 194900, fecha: c0, creado: Date.now() })
    const inicio = sumarDias(hoy, -30)
    const id = (await db.lotes.add({
      tipo: 'engorde',
      nombre: 'Pollada de octubre',
      fechaInicio: inicio,
      cantidadInicial: 1000,
      costoInicial: 42000,
      estado: 'activo',
      pesoObjetivoLb: 5.5,
      precioVentaLb: 38,
      diaVenta: 42,
      creado: Date.now(),
    })) as number
    const registros = []
    for (let d = 1; d <= 29; d++)
      registros.push({
        loteId: id,
        fecha: sumarDias(inicio, d),
        mortalidad: 1,
        descarte: 0,
        alimentoLb: 40 + d * 9,
        // 3.93 lb es el Cobb del día 28: pesaron un 7 % más.
        ...(d === 28 ? { pesoPromedio: 4.22 } : {}),
        creado: Date.now(),
      })
    await db.registros.bulkAdd(registros)
    return id
  })
  await page.goto(`/lotes/${id}?t=dinero`)
  const main = page.getByRole('main')
  await expect(main).toContainText('Peso al vender')
  await expect(main).toContainText('6.0 lb')
  await expect(main).toContainText('de tu pollada cerrada, que vendió al 76% del peso Cobb')
  await expect(main).toContainText(/Entre 5\.\d y 6\.\d lb, 8 de cada 10 veces/)
  await expect(main).toContainText(/Para afinarlo, pesa \d+ aves .*3 días antes de vender/)
  await expect(main).toContainText('Puede quedar entre')
})
