import { describe, expect, it } from 'vitest'
import { nombreArchivo } from './archivo'

describe('nombreArchivo', () => {
  it('sin acentos, barras ni puntos medios', () => {
    expect(nombreArchivo('Galpón 1 · octubre')).toBe('galpon-1-octubre')
    expect(nombreArchivo('Lote 2026/10 — Ñame')).toBe('lote-2026-10-name')
  })

  it('nunca queda vacío', () => {
    expect(nombreArchivo('···')).toBe('ciclo')
  })
})
