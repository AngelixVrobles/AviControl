import { describe, expect, it } from 'vitest'
import { nombresCortos } from './labels'

describe('nombresCortos', () => {
  it('quita lo que todos los ciclos tienen igual', () => {
    expect(nombresCortos(['Pollada de junio', 'Lote de julio', 'Pollada de agosto'])).toEqual(['junio', 'julio', 'agosto'])
    expect(nombresCortos(['Galpón 1 enero', 'Galpón 1 marzo'])).toEqual(['enero', 'marzo'])
    expect(nombresCortos(['Lote 3', 'Lote 4'])).toEqual(['3', '4'])
  })

  it('si alguno no cabe, no recorta a ciegas', () => {
    expect(nombresCortos(['Pollada de septiembre grande', 'Pollada de octubre'])).toBeUndefined()
  })
})
