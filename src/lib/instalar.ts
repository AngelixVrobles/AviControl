import { esIos } from './archivo'

// Instalar la app en el teléfono. En el iPhone, Safari borra los datos de una
// página que no se abre en siete días —un vacío sanitario basta—, y la app
// instalada guarda los suyos aparte. En Android, Chrome ofrece instalarla.

interface PedidoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pedido: PedidoInstalar | undefined
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())

export function iniciarInstalacion() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pedido = e as PedidoInstalar
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    pedido = undefined
    avisar()
  })
}

/** La app ya está instalada y abierta desde su ícono. */
export const instalada = () =>
  typeof window !== 'undefined' &&
  ((navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches))

/** Cómo se instala aquí: en el iPhone a mano; en Android con el botón de Chrome. */
export const comoInstalar = (): 'ios' | 'boton' | undefined =>
  instalada() ? undefined : esIos() ? 'ios' : pedido ? 'boton' : undefined

export async function instalar() {
  const p = pedido
  if (!p) return
  await p.prompt()
  await p.userChoice.catch(() => undefined)
  pedido = undefined
  avisar()
}

export function suscribirInstalacion(f: () => void): () => void {
  oyentes.add(f)
  return () => {
    oyentes.delete(f)
  }
}

const KEY = 'avicontrol.instalar'
const DIAS_SIN_INSISTIR = 7

/** «Ahora no» calla el aviso una semana. */
export function avisoCallado(hoy = Date.now()): boolean {
  try {
    const hasta = Number(localStorage.getItem(KEY))
    return Number.isFinite(hasta) && hasta > hoy
  } catch {
    return false
  }
}

export function callarAviso(hoy = Date.now()) {
  try {
    localStorage.setItem(KEY, String(hoy + DIAS_SIN_INSISTIR * 86_400_000))
  } catch {
    // Sin almacenamiento sale otra vez la próxima vez: no pasa nada.
  }
}
