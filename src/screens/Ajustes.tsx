import { useRef } from 'react'
import { db, type Gasto, type Ingreso, type Lote, type Registro } from '../db/schema'
import { saveSettings, type Settings } from '../lib/settings'
import { useSettings } from '../lib/hooks'
import { Button, Card, DangerButton, Field, Input } from '../components/ui'

const KG_A_LB = 2.20462

interface Respaldo {
  version?: number
  settings?: Partial<Settings>
  lotes?: Lote[]
  registros?: Registro[]
  gastos?: Gasto[]
  ingresos?: Ingreso[]
}

// Los respaldos anteriores a la migración a libras traen alimentoKg/pesoKg.
function migrarUnidades(data: Respaldo) {
  for (const r of data.registros ?? []) {
    const viejo = r as Registro & { alimentoKg?: number }
    if (viejo.alimentoKg != null) {
      r.alimentoLb = Math.round(viejo.alimentoKg * KG_A_LB * 10) / 10
      if (r.pesoPromedio != null) r.pesoPromedio = Math.round(r.pesoPromedio * KG_A_LB * 100) / 100
      delete viejo.alimentoKg
    }
    r.alimentoLb ??= 0
  }
  for (const i of data.ingresos ?? []) {
    const viejo = i as Ingreso & { pesoKg?: number }
    if (viejo.pesoKg != null) {
      i.pesoLb = Math.round(viejo.pesoKg * KG_A_LB * 10) / 10
      delete viejo.pesoKg
    }
  }
}

export function Ajustes() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)

  async function exportar() {
    const [lotes, registros, gastos, ingresos] = await Promise.all([
      db.lotes.toArray(),
      db.registros.toArray(),
      db.gastos.toArray(),
      db.ingresos.toArray(),
    ])
    const blob = new Blob(
      [JSON.stringify({ version: 1, settings: s, lotes, registros, gastos, ingresos }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `avicontrol-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importar(file: File) {
    let data: Respaldo
    try {
      data = JSON.parse(await file.text())
    } catch {
      alert('El archivo no se pudo leer como respaldo. ¿Es el .json que exportó AviControl?')
      return
    }
    const listas = [data?.lotes, data?.registros, data?.gastos, data?.ingresos]
    if (!data || typeof data !== 'object' || !listas.every(Array.isArray)) {
      alert('El archivo no tiene el formato de un respaldo de AviControl.')
      return
    }
    if (!confirm('Esto reemplazará todos los datos actuales por los del respaldo. ¿Continuar?')) return
    migrarUnidades(data)
    try {
      await db.transaction('rw', db.lotes, db.registros, db.gastos, db.ingresos, async () => {
        await Promise.all([db.lotes.clear(), db.registros.clear(), db.gastos.clear(), db.ingresos.clear()])
        await db.lotes.bulkAdd(data.lotes!)
        await db.registros.bulkAdd(data.registros!)
        await db.gastos.bulkAdd(data.gastos!)
        await db.ingresos.bulkAdd(data.ingresos!)
      })
    } catch {
      alert('No se pudo restaurar el respaldo. Tus datos actuales no cambiaron.')
      return
    }
    if (data.settings) saveSettings(data.settings)
    alert('Respaldo restaurado.')
  }

  async function borrarTodo() {
    if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return
    await db.transaction('rw', db.lotes, db.registros, db.gastos, db.ingresos, async () => {
      await Promise.all([db.lotes.clear(), db.registros.clear(), db.gastos.clear(), db.ingresos.clear()])
    })
    alert('Datos borrados.')
  }

  return (
    <div className="animate-rise pt-3">
      <h1 className="font-display text-[26px] font-semibold">Ajustes</h1>

      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Granja</h2>
      <Card className="space-y-4 p-4">
        <Field label="Nombre de la granja">
          <Input defaultValue={s.granja} onBlur={(e) => saveSettings({ granja: e.target.value.trim() || 'Mi granja' })} />
        </Field>
        <Field label="Moneda" hint="Símbolo que verás en los montos (ej. RD$, $, Q, S/).">
          <Input defaultValue={s.moneda} onBlur={(e) => saveSettings({ moneda: e.target.value.trim() || 'RD$' })} />
        </Field>
      </Card>

      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Datos</h2>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-ink-faint">
          Todo se guarda solo en este dispositivo. Exporta un respaldo para no perderlo si cambias de teléfono.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="soft" onClick={exportar}>
            Exportar
          </Button>
          <Button variant="soft" onClick={() => fileRef.current?.click()}>
            Importar
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) importar(file)
          }}
        />
        <DangerButton onClick={borrarTodo}>Borrar todos los datos</DangerButton>
      </Card>

      <p className="mt-8 text-center text-xs text-ink-faint">AviControl · v1.0 · datos locales</p>
    </div>
  )
}
