// Un localStorage en memoria para las pruebas, que corren en Node sin navegador.
export function memoriaStorage(inicial: Record<string, string> = {}): Storage {
  const datos = new Map(Object.entries(inicial))
  return {
    get length() {
      return datos.size
    },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => void datos.set(k, String(v)),
  }
}
