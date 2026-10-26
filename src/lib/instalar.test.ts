import { afterEach, describe, expect, it, vi } from 'vitest'
import { avisoCallado, callarAviso, comoInstalar, iniciarInstalacion, instalar } from './instalar'
import { memoriaStorage } from '../test/storage'

afterEach(() => vi.unstubAllGlobals())

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'

function telefono(userAgent: string, { abiertaComoApp = false } = {}) {
  vi.stubGlobal('navigator', { userAgent, platform: 'Linux armv8l', maxTouchPoints: 5 })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: abiertaComoApp && q === '(display-mode: standalone)' }))
}

describe('comoInstalar', () => {
  it('en el iPhone se explica a mano: Safari no tiene botón', () => {
    telefono(IPHONE)
    vi.stubGlobal('window', new EventTarget())
    expect(comoInstalar()).toBe('ios')
  })

  it('abierta desde el ícono no se ofrece', () => {
    telefono(IPHONE, { abiertaComoApp: true })
    vi.stubGlobal('window', new EventTarget())
    expect(comoInstalar()).toBeUndefined()
  })

  // Chrome avisa cuando se puede instalar; sin ese aviso, un botón no haría nada.
  it('en Android, solo cuando Chrome lo ofrece, y una vez', async () => {
    telefono(ANDROID)
    const ventana = new EventTarget()
    vi.stubGlobal('window', ventana)
    iniciarInstalacion()
    expect(comoInstalar()).toBeUndefined()

    const prompt = vi.fn(async () => {})
    ventana.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt'), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      }),
    )
    expect(comoInstalar()).toBe('boton')

    await instalar()
    expect(prompt).toHaveBeenCalledOnce()
    expect(comoInstalar()).toBeUndefined()
  })
})

describe('«Ahora no»', () => {
  it('calla el aviso una semana', () => {
    vi.stubGlobal('localStorage', memoriaStorage())
    const hoy = Date.UTC(2026, 9, 26)
    expect(avisoCallado(hoy)).toBe(false)
    callarAviso(hoy)
    expect(avisoCallado(hoy + 6 * 86_400_000)).toBe(true)
    expect(avisoCallado(hoy + 8 * 86_400_000)).toBe(false)
  })

  it('sin almacenamiento el aviso sigue saliendo', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => callarAviso()).not.toThrow()
    expect(avisoCallado()).toBe(false)
  })
})
