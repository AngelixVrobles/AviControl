import { ultimosPrecios } from '../lib/alimentos'
import { getSettings, saveSettings } from '../lib/settings'
import { db } from './schema'

// Lo último que se pagó por cada tipo de alimento en la granja, para estimar lo
// que falta de un tipo que el ciclo todavía no compra. Se aprende al abrir la
// app y cada vez que se guarda una compra de alimento.
export async function aprenderPreciosAlimento() {
  const compras = await db.gastos.where('categoria').equals('alimento').toArray()
  const aprendidos = ultimosPrecios(compras)
  const ya = getSettings().preciosAlimento
  const nuevos = { ...ya, ...aprendidos }
  if (JSON.stringify(nuevos) !== JSON.stringify(ya)) saveSettings({ preciosAlimento: nuevos })
}
