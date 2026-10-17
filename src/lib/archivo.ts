// Sacar un archivo del teléfono: el respaldo, el reporte en imagen, el ciclo
// para el socio, la hoja de Excel.

export type ComoSeGuardo = 'compartido' | 'descargado' | 'cancelado'

// En el teléfono el archivo sale por el menú de compartir —Guardar en Archivos,
// WhatsApp, Drive—: con la app instalada en el iPhone, una descarga podía no
// guardar nada. En la computadora, o si el teléfono no deja compartir ese tipo
// de archivo (Android no comparte .json), se descarga.
export async function entregarArchivo(archivo: File): Promise<ComoSeGuardo> {
  const tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (tactil && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: archivo.name })
      return 'compartido'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // Cualquier otro fallo (el toque ya caducó, el sistema no quiso): se descarga.
    }
  }
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = archivo.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Soltarlo al instante podía cortar la descarga en Safari antes de empezar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'descargado'
}

// En el iPhone, una descarga desde la app instalada puede no llegar a ninguna
// parte; en Android y en la computadora queda en Descargas.
export function descargaSegura(): boolean {
  if (typeof navigator === 'undefined') return true
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return !ios
}

// Elegir un archivo del teléfono. En el iPhone, un selector que no está en la
// página puede no entregar el archivo elegido: se pone en la página, sin
// verse, y se quita al elegir o al cancelar.
export function elegirArchivo(accept: string, alElegir: (f: File) => void) {
  document.getElementById('elegir-archivo')?.remove()
  const input = document.createElement('input')
  input.id = 'elegir-archivo'
  input.type = 'file'
  input.accept = accept
  input.setAttribute('aria-hidden', 'true')
  input.tabIndex = -1
  Object.assign(input.style, { position: 'fixed', top: '0', left: '0', width: '1px', height: '1px', opacity: '0' })
  input.addEventListener('change', () => {
    const f = input.files?.[0]
    input.remove()
    if (f) alElegir(f)
  })
  input.addEventListener('cancel', () => input.remove())
  document.body.appendChild(input)
  input.click()
}

// Un nombre de archivo que sirve en cualquier teléfono: sin acentos, sin
// barras ni puntos medios. «Galpón 1 · octubre» → «galpon-1-octubre».
export function nombreArchivo(texto: string): string {
  const limpio = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return limpio || 'ciclo'
}
