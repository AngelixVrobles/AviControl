import { beforeEach, describe, expect, it } from 'vitest'
import { getSettings, reemplazarSettings, saveSettings } from './settings'

// En las pruebas no hay navegador: un localStorage de mentira basta.
const almacen = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => void almacen.set(k, v),
    removeItem: (k: string) => void almacen.delete(k),
  },
  window: { dispatchEvent: () => true },
})

describe('ajustes', () => {
  beforeEach(() => almacen.clear())

  // Quitar la última vacuna devolvía las tres de fábrica con sus avisos.
  it('el plan sanitario se puede dejar vacío', () => {
    saveSettings({ planSanitario: [] })
    expect(getSettings().planSanitario).toEqual([])
  })

  it('sin plan guardado, el de fábrica', () => {
    expect(getSettings().planSanitario.length).toBeGreaterThan(0)
  })

  it('las medidas sueltas de antes pasan al Galpón 1 y no se vuelven a escribir', () => {
    almacen.set('avicontrol.settings', JSON.stringify({ galponLargoM: 50, galponAnchoM: 10 }))
    expect(getSettings().galpones[0]).toMatchObject({ largoM: 50, anchoM: 10 })
    saveSettings({ granja: 'El Sol' })
    expect(almacen.get('avicontrol.settings')).not.toContain('galponLargoM')
  })

  // Restaurar mezclaba: el precio de mercado del teléfono viejo sobrevivía.
  it('restaurar reemplaza los ajustes, no los mezcla', () => {
    saveSettings({ precioMercadoLb: 60, granja: 'Vieja' })
    reemplazarSettings({ granja: 'Nueva', pesoObjetivoLb: 6.2 })
    const s = getSettings()
    expect(s.granja).toBe('Nueva')
    expect(s.pesoObjetivoLb).toBe(6.2)
    expect(s.precioMercadoLb).toBeUndefined()
  })
})
