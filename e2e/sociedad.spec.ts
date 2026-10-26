import { expect, test } from '@playwright/test'
import { sembrar } from './ayuda'

// El caso del productor: pagó los RD$100,000 de gastos y cobró unas aves
// vendidas. El socio le debe su mitad de los gastos completa; el dinero de las
// ventas se guarda y se reparte al final de la pollada. Antes la app rebajaba
// lo cobrado de lo que el socio le tenía que dar.
test('lo cobrado de las ventas no se rebaja de lo que el socio debe por los gastos', async ({ page }) => {
  const id = await sembrar(page, async ({ db, hoy, sumarDias }) => {
    const loteId = (await db.lotes.add({
      tipo: 'engorde',
      nombre: 'Pollada con Pedro',
      fechaInicio: sumarDias(hoy, -36),
      cantidadInicial: 1000,
      costoInicial: 0,
      estado: 'activo',
      pesoObjetivoLb: 5.5,
      socios: [
        { nombre: 'Yo', pct: 50 },
        { nombre: 'Pedro', pct: 50 },
      ],
      creado: Date.now(),
    })) as number
    await db.gastos.add({ loteId, categoria: 'alimento', monto: 100000, pagadoPor: 0, fecha: sumarDias(hoy, -30), creado: Date.now() })
    await db.ingresos.add({ loteId, tipo: 'aves', cantidad: 100, pesoLb: 550, monto: 30000, recibidoPor: 0, fecha: hoy, creado: Date.now() })
    return loteId
  })
  await page.goto(`/lotes/${id}?t=dinero`)
  const main = page.getByRole('main')
  await expect(main).toContainText('Pedro te entrega RD$50,000')
  await expect(main).toContainText('no entra en esta cuenta: lo guarda quien lo cobró y se reparte al cerrar el ciclo')
  await expect(main).toContainText('Guardas RD$30,000 de las ventas para repartir al cerrar el ciclo.')

  // Pedro entrega su mitad: quedan parejos con los gastos.
  await page.getByRole('button', { name: 'Ya se entregó' }).click()
  const hoja = page.getByRole('dialog', { name: 'Entrega entre socios' })
  await hoja.getByRole('button', { name: 'Anotar entrega' }).click()
  await expect(hoja).toBeHidden()
  await expect(main).toContainText('Van parejos')
})
