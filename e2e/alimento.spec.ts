import { expect, test } from '@playwright/test'
import { sembrar } from './ayuda'

// Como lo lleva el productor: cada compra con el nombre del saco, y el
// alimento de cada día sale del que se compró, en su orden.
test('la compra dice el tipo por el nombre y el día sabe qué alimento se da', async ({ page }) => {
  const id = await sembrar(page, async ({ db, hoy, sumarDias }) => {
    const inicio = sumarDias(hoy, -20)
    const id = (await db.lotes.add({
      tipo: 'engorde',
      nombre: 'Pollada de septiembre',
      fechaInicio: inicio,
      cantidadInicial: 1000,
      costoInicial: 38000,
      estado: 'activo',
      pesoObjetivoLb: 5.5,
      precioVentaLb: 60,
      creado: Date.now(),
    })) as number
    const registros = []
    for (let d = 1; d < 20; d++)
      registros.push({ loteId: id, fecha: sumarDias(inicio, d), mortalidad: 1, descarte: 0, alimentoLb: 50 + d * 12, creado: Date.now() })
    await db.registros.bulkAdd(registros)
    // Sin el tipo anotado: la app lo saca del nombre.
    await db.gastos.bulkAdd([
      { loteId: id, categoria: 'alimento', descripcion: 'PREINICIO POLLO', cantidadQq: 3, monto: 5955, fecha: inicio, creado: Date.now() },
      { loteId: id, categoria: 'alimento', descripcion: 'MEGA BROILER INICIADOR', cantidadQq: 18, monto: 25722, fecha: sumarDias(inicio, 6), creado: Date.now() },
    ])
    return id
  })

  // Del 1 al 19 se dieron 3,230 lb: el pre-inicio (300) y el iniciador (1,800)
  // ya se acabaron, y lo que se compra ahora es crecimiento.
  await page.goto(`/lotes/${id}`)
  await page.getByRole('button', { name: 'Gasto', exact: true }).click()
  const compra = page.getByRole('dialog')
  await compra.getByLabel('Categoría').selectOption('alimento')
  await compra.getByLabel('Nombre del alimento').fill('MEGA BROILER CRECIMIENTO')
  const tipos = compra.getByRole('group', { name: 'Tipo de alimento' })
  await expect(tipos.getByRole('button', { name: 'Crecimiento' })).toHaveAttribute('aria-pressed', 'true')
  await expect(compra).toContainText('Lo saqué del nombre')
  await compra.getByLabel('Monto').fill('28690')
  await compra.getByLabel('Quintales comprados').fill('19')
  await compra.getByRole('button', { name: 'Guardar gasto' }).click()
  await expect(compra).toBeHidden()

  // Hoy dice qué se está dando y cuánto queda de ese.
  await expect(page.getByRole('main')).toContainText('Le estás dando')
  await expect(page.getByRole('main')).toContainText('MEGA BROILER CRECIMIENTO')

  // El registro del día lo propone, y se puede cambiar.
  await page.getByRole('button', { name: 'Día', exact: true }).click()
  const dia = page.getByRole('dialog')
  await expect(dia).toContainText('Le das MEGA BROILER CRECIMIENTO')
  await dia.getByRole('button', { name: 'Cambiar' }).click()
  await expect(
    dia.getByRole('group', { name: 'Qué alimento le diste' }).getByRole('button', { name: /Crecimiento/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await dia.getByRole('button', { name: 'Listo' }).click()
  await dia.getByRole('button', { name: 'Cerrar' }).click()

  // La ficha lo junta por tipo, con el nombre de cada compra.
  await page.goto(`/lotes/${id}/ficha/alimento`)
  const ficha = page.getByRole('main')
  await expect(ficha).toContainText('Alimento por tipo')
  for (const nombre of ['PREINICIO POLLO', 'MEGA BROILER INICIADOR', 'MEGA BROILER CRECIMIENTO'])
    await expect(ficha).toContainText(nombre)

  // La compra quedó con su tipo.
  const guardada = await page.evaluate(async () => {
    const { db } = await import('/src/db/schema.ts')
    return (await db.gastos.toArray()).find((g) => g.descripcion === 'MEGA BROILER CRECIMIENTO')?.fase
  })
  expect(guardada).toBe('crecimiento')
})
