import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { cicloEnCurso } from './ayuda'

test('el ciclo que se manda a un socio se abre en su teléfono y solo se mira', async ({ page, browser }) => {
  const id = await cicloEnCurso(page, { nombre: 'Ciclo con Pedro' }, { granja: 'Granja El Sol' })
  await page.goto(`/lotes/${id}?t=dinero`)
  // En la computadora de pruebas no hay menú de compartir: el archivo se baja.
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Mandar el ciclo a un socio' }).click(),
  ])
  const archivo = await descarga.path()
  expect(JSON.parse(await readFile(archivo, 'utf8')).tipo).toBe('avicontrol-ciclo')

  // El teléfono del socio, con su propia base.
  const socio = await browser.newPage()
  await socio.goto('/ajustes')
  const [selector] = await Promise.all([
    socio.waitForEvent('filechooser'),
    socio.getByRole('button', { name: 'Abrir un ciclo que te mandaron' }).click(),
  ])
  await selector.setFiles(archivo)
  await socio.getByRole('dialog').getByRole('button', { name: 'Abrir', exact: true }).click()
  await expect(socio).toHaveURL(/\/lotes\/\d+/)
  const main = socio.getByRole('main')
  await expect(main).toContainText('Ciclo con Pedro')
  await expect(main).toContainText('de Granja El Sol')
  // Se mira y no se toca: no hay botones para anotar.
  await expect(socio.getByRole('button', { name: 'Día', exact: true })).toHaveCount(0)
  await socio.close()
})
