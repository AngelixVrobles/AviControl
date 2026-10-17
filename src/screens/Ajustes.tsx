import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type Abono,
  type Aplicacion,
  type Deuda,
  type EntregaSocio,
  type Gasto,
  type Ingreso,
  type Lote,
  type Pesaje,
  type Registro,
} from '../db/schema'
import { leerGalpones, saveSettings, type Galpon, type Settings } from '../lib/settings'
import { useLotes, useSettings } from '../lib/hooks'
import { enumerar, fecha, num } from '../lib/format'
import { galponDe, nuevoGalpon } from '../lib/galpones'
import { borrarTodo as borrarTodoDeLaBase } from '../db/ciclo'
import { borrarBorradoresDe } from '../lib/borrador'
import { diasSinRespaldo } from '../lib/respaldo'
import { VERSION_RESPALDO } from '../db/respaldo'
import { useRespaldo } from '../components/useRespaldo'
import type { HitoSanitario } from '../lib/standards'
import { RAZA } from '../lib/labels'
import { Banda, DangerButton, Field, Input, Segmentado, Seccion } from '../components/ui'
import { MedidasGalpon } from './fichas/Galpon'
import { IconClose } from '../components/icons'
import { confirmar, toast } from '../components/confirm'

const KG_A_LB = 2.20462

interface Respaldo {
  version?: number
  settings?: Partial<Settings>
  lotes?: Lote[]
  registros?: Registro[]
  gastos?: Gasto[]
  ingresos?: Ingreso[]
  pesajes?: Pesaje[]
  aplicaciones?: Aplicacion[]
  deudas?: Deuda[]
  abonos?: Abono[]
  entregas?: EntregaSocio[]
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
  const { respaldar } = useRespaldo()
  const conteos = useLiveQuery(async () => {
    const [ciclos, registros, gastos, ventas, pesajes, aplicaciones, entregas, deudas, abonos] =
      await Promise.all([
        db.lotes.count(),
        db.registros.count(),
        db.gastos.count(),
        db.ingresos.count(),
        db.pesajes.count(),
        db.aplicaciones.count(),
        db.entregas.count(),
        db.deudas.count(),
        db.abonos.count(),
      ])
    return { ciclos, registros, gastos, ventas, pesajes, aplicaciones, entregas, deudas, abonos }
  }, [])

  async function importar(file: File) {
    let data: Respaldo
    try {
      data = JSON.parse(await file.text())
    } catch {
      toast('El archivo no se pudo leer. ¿Es el .json que exportó AviControl?')
      return
    }
    const listas = [data?.lotes, data?.registros, data?.gastos, data?.ingresos]
    if (!data || typeof data !== 'object' || !listas.every(Array.isArray)) {
      toast('El archivo no tiene el formato de un respaldo de AviControl.')
      return
    }
    if ((data.version ?? 1) > VERSION_RESPALDO) {
      toast('Ese respaldo es de una versión más nueva de la app. Actualiza AviControl primero.')
      return
    }

    const fechas = (data.lotes ?? []).map((l) => l.fechaInicio).sort()
    const trae = `${resumen(data.lotes)}, ${num(data.registros!.length)} registros${
      fechas.length ? ` · ${fecha(fechas[0])}` : ''
    }`
    const hay = `${num(conteos?.ciclos ?? 0)} ciclos y ${num(conteos?.registros ?? 0)} registros`
    if (
      !(await confirmar({
        titulo: 'Restaurar respaldo',
        mensaje: `El archivo trae ${trae}. Reemplazará lo que hay ahora (${hay}). No se puede deshacer.`,
        confirmar: 'Restaurar',
      }))
    )
      return

    migrarUnidades(data)
    try {
      await db.transaction(
        'rw',
        [
          db.lotes,
          db.registros,
          db.gastos,
          db.ingresos,
          db.pesajes,
          db.aplicaciones,
          db.deudas,
          db.abonos,
          db.entregas,
        ],
        async () => {
          await Promise.all([
            db.lotes.clear(),
            db.registros.clear(),
            db.gastos.clear(),
            db.ingresos.clear(),
            db.pesajes.clear(),
            db.aplicaciones.clear(),
            db.deudas.clear(),
            db.abonos.clear(),
            db.entregas.clear(),
          ])
          await db.lotes.bulkAdd(data.lotes!)
          await db.registros.bulkAdd(data.registros!)
          await db.gastos.bulkAdd(data.gastos!)
          await db.ingresos.bulkAdd(data.ingresos!)
          await db.pesajes.bulkAdd(data.pesajes ?? [])
          await db.aplicaciones.bulkAdd(data.aplicaciones ?? [])
          await db.deudas.bulkAdd(data.deudas ?? [])
          await db.abonos.bulkAdd(data.abonos ?? [])
          await db.entregas.bulkAdd(data.entregas ?? [])
        },
      )
    } catch {
      toast('No se pudo restaurar. Tus datos actuales no cambiaron.')
      return
    }
    // Los pesajes a medias eran de los ciclos de antes: con los del respaldo
    // aparecerían como si fueran suyos.
    borrarBorradoresDe()
    // Un respaldo de antes de los galpones trae las medidas sueltas: pasan a
    // ser las del primer galpón en vez de perderse.
    if (data.settings) saveSettings({ ...data.settings, galpones: leerGalpones(data.settings) })
    toast('Respaldo restaurado.')
  }

  function pickFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = () => {
      const f = input.files?.[0]
      if (f) importar(f)
    }
    input.click()
  }

  async function borrarTodo() {
    if (
      !(await confirmar({
        titulo: 'Borrar todos los datos',
        mensaje: queSeBorra(conteos),
        confirmar: 'Borrar todo',
        peligro: true,
      }))
    )
      return
    try {
      await borrarTodoDeLaBase()
    } catch {
      toast('No se pudo borrar. Tus datos siguen como estaban.')
      return
    }
    toast('Datos borrados.')
  }

  return (
    <div className="animate-rise pt-3">
      <h1 className="font-display text-2xl font-semibold">Ajustes</h1>

      <AvisoRespaldo ultimo={s.ultimoRespaldo} onRespaldar={respaldar} onRestaurar={pickFile} />

      <Seccion className="mb-3 mt-8" etiqueta="Producción" />
      <Banda className="divide-y divide-line">
        <FilaEstatica label="Raza que usas" valor={RAZA} sub="Define pesos y consumo esperados" />
        <FilaNumero
          label="Peso objetivo de venta"
          sub="El de cada ciclo nuevo y el de los que no tienen el suyo"
          unidad="lb"
          value={s.pesoObjetivoLb}
          onSave={(v) => saveSettings({ pesoObjetivoLb: v || 5.5 })}
        />
        <FilaNumero
          label="Precio de mercado"
          sub="Para estimar la venta antes de vender"
          unidad={`${s.moneda}/lb`}
          value={s.precioMercadoLb}
          onSave={(v) => saveSettings({ precioMercadoLb: v || undefined })}
        />
        <FilaNumero
          label="Aves por metro²"
          sub="Cuántas caben en tu galpón"
          value={s.avesPorM2}
          onSave={(v) => saveSettings({ avesPorM2: v || 11 })}
        />
      </Banda>

      <PlanSanitario plan={s.planSanitario} />

      <Seccion className="mb-3 mt-8" etiqueta="Granja" />
      <Banda className="space-y-4 px-5 py-4">
        <Field label="Nombre de la granja">
          <Input defaultValue={s.granja} onBlur={(e) => saveSettings({ granja: e.target.value.trim() || 'Mi granja' })} />
        </Field>
        <Field label="Moneda" hint="Símbolo que verás en los montos (ej. RD$, $, Q, S/).">
          <Input defaultValue={s.moneda} onBlur={(e) => saveSettings({ moneda: e.target.value.trim() || 'RD$' })} />
        </Field>
      </Banda>

      <Seccion
        className="mb-3 mt-8"
        etiqueta={s.galpones.length > 1 ? 'Galpones y equipo' : 'Galpón y equipo'}
        nota="Con esto la app dice cuántos bebederos y comederos hacen falta, cuántas aves caben y cómo repartirlos. Si tienes más de un galpón, cada ciclo dice en cuál está."
      />
      <Banda className="space-y-4 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Medidas en</span>
          <Segmentado
            etiqueta="Unidad de las medidas"
            valor={s.unidadMedida}
            onCambio={(v) => saveSettings({ unidadMedida: v })}
            opciones={[
              { id: 'm', label: 'Metros' },
              { id: 'pies', label: 'Pies' },
            ]}
            className="w-48"
          />
        </div>
        <Galpones settings={s} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Bebederos</span>
          <Segmentado
            etiqueta="Tipo de bebedero"
            valor={s.bebedero}
            onCambio={(v) => saveSettings({ bebedero: v })}
            opciones={[
              { id: 'plasson', label: 'Plasson' },
              { id: 'niple', label: 'Niples' },
            ]}
            className="w-48"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Comederos</span>
          <Segmentado
            etiqueta="Tipo de comedero"
            valor={s.comedero}
            onCambio={(v) => saveSettings({ comedero: v })}
            opciones={[
              { id: 'tolva', label: 'Tolva' },
              { id: 'plato', label: 'Platos' },
            ]}
            className="w-48"
          />
        </div>
      </Banda>

      <Seccion className="mb-3 mt-8 text-clay-deep" etiqueta="Zona de peligro" />
      <Banda className="space-y-3 px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-soft">{queSeBorra(conteos)}</p>
        <DangerButton onClick={borrarTodo}>Borrar todo</DangerButton>
      </Banda>

      <p className="mt-8 text-center text-sm text-ink-soft">AviControl · v{__APP_VERSION__} · datos locales</p>
    </div>
  )
}

// Lo que se va con «Borrar todo», con su cuenta y sin lo que está en cero: el
// mismo texto encima del botón y en la confirmación. Antes los dos nombraban
// solo ciclos, registros, gastos y ventas.
function queSeBorra(c?: Record<
  'ciclos' | 'registros' | 'gastos' | 'ventas' | 'pesajes' | 'aplicaciones' | 'entregas' | 'deudas' | 'abonos',
  number
>): string {
  const aviso = 'Los ajustes de la granja se quedan. No se puede deshacer y no hay copia en internet.'
  // Mientras se cuentan los datos no se sabe qué hay: el aviso general.
  if (!c) return `Borra todos los ciclos con lo anotado en ellos y las deudas de la granja. ${aviso}`
  const lista = enumerar([
    [c.ciclos, 'ciclo', 'ciclos'],
    [c.registros, 'registro diario', 'registros diarios'],
    [c.gastos, 'gasto', 'gastos'],
    [c.ventas, 'venta', 'ventas'],
    [c.pesajes, 'pesaje', 'pesajes'],
    [c.aplicaciones, 'vacuna o medicina', 'vacunas y medicinas'],
    [c.entregas, 'entrega entre socios', 'entregas entre socios'],
    [c.deudas, 'deuda de la granja', 'deudas de la granja'],
    [c.abonos, 'abono', 'abonos'],
  ])
  return lista ? `Borra ${lista}. ${aviso}` : 'Todavía no hay nada anotado.'
}

function resumen(lotes?: Lote[]) {
  const n = lotes?.length ?? 0
  return `${num(n)} ${n === 1 ? 'ciclo' : 'ciclos'}`
}

function AvisoRespaldo({
  ultimo,
  onRespaldar,
  onRestaurar,
}: {
  ultimo: string | null
  onRespaldar: () => void
  onRestaurar: () => void
}) {
  const dias = diasSinRespaldo(ultimo)
  return (
    <div className="mt-5 rounded-xl2 border border-amber-line border-l-4 border-l-amber bg-amber-tint p-4">
      <div className="font-display text-base font-semibold text-amber-text">
        Tus datos viven solo en este teléfono
      </div>
      <p className="mt-1 text-sm leading-relaxed text-amber-text">
        Si lo pierdes o lo cambias, se pierde todo. No hay copia en internet: guarda el respaldo
        fuera del teléfono, en WhatsApp, el correo o Drive.
      </p>
      <p className="mt-2 text-sm font-medium text-amber-text">
        {ultimo
          ? `Último respaldo: hace ${num(dias!)} ${dias === 1 ? 'día' : 'días'} · ${fecha(ultimo)}`
          : 'Nunca has hecho un respaldo.'}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={onRespaldar}
          className="rounded-full bg-forest-500 py-3 text-center text-sm font-semibold text-paper-raised transition active:scale-95"
        >
          Respaldar ahora
        </button>
        <button
          onClick={onRestaurar}
          className="rounded-full border border-amber-line bg-paper-raised py-3 text-center text-sm font-semibold text-amber-text transition active:scale-95"
        >
          Restaurar
        </button>
      </div>
    </div>
  )
}

// Los galpones de la granja con sus medidas. Con uno solo no hace falta
// nombrarlo y se ve como antes; con varios, cada uno con su nombre, que es el
// que aparece en el ciclo.
function Galpones({ settings: s }: { settings: Settings }) {
  const activos = useLotes('activo')
  const varios = s.galpones.length > 1

  function renombrar(g: Galpon, nombre: string) {
    const limpio = nombre.trim()
    if (!limpio || limpio === g.nombre) return
    saveSettings({ galpones: s.galpones.map((x) => (x.id === g.id ? { ...x, nombre: limpio } : x)) })
  }

  async function quitar(g: Galpon) {
    const resto = s.galpones.filter((x) => x.id !== g.id)
    const enEl = (activos ?? []).filter((l) => galponDe(l, s)?.id === g.id).map((l) => l.nombre)
    const lista = enEl.length > 1 ? `${enEl.slice(0, -1).join(', ')} y ${enEl[enEl.length - 1]}` : enEl[0]
    const ok = await confirmar({
      titulo: `Quitar ${g.nombre}`,
      mensaje:
        enEl.length === 0
          ? 'Se quitan su nombre y sus medidas.'
          : enEl.length === 1
            ? `El ciclo ${lista}, que está en este galpón, pasa a ${resto[0].nombre}.`
            : `Los ciclos ${lista}, que están en este galpón, pasan a ${resto[0].nombre}.`,
      confirmar: 'Quitar',
      peligro: true,
    })
    if (ok) saveSettings({ galpones: resto })
  }

  return (
    <>
      {s.galpones.map((g) => (
        <div key={g.id} className={varios ? 'space-y-3 rounded-xl border border-line p-3' : undefined}>
          {varios && (
            <div className="flex items-center gap-2">
              <Input
                key={`${g.id}-${g.nombre}`}
                defaultValue={g.nombre}
                onBlur={(e) => renombrar(g, e.target.value)}
                aria-label="Nombre del galpón"
                className="flex-1"
              />
              <button
                onClick={() => quitar(g)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft active:bg-paper-sunken"
                aria-label={`Quitar ${g.nombre}`}
              >
                <IconClose width={18} height={18} />
              </button>
            </div>
          )}
          <MedidasGalpon settings={s} galpon={g} />
        </div>
      ))}
      <button
        onClick={() => saveSettings({ galpones: [...s.galpones, nuevoGalpon(s.galpones)] })}
        className="-mx-2 -my-3 block px-2 py-3 text-sm font-medium text-forest-600"
      >
        + Agregar galpón
      </button>
    </>
  )
}

function PlanSanitario({ plan }: { plan: HitoSanitario[] }) {
  const [items, setItems] = useState<HitoSanitario[]>(plan)

  function guardar(next: HitoSanitario[]) {
    setItems(next)
    saveSettings({ planSanitario: next.filter((h) => h.nombre.trim() && h.dia > 0) })
  }

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Plan sanitario"
        nota="Lo que aparece como hito en la barra del ciclo. Ajústalo al plan de tu veterinario."
      />
      <Banda className="space-y-3 px-5 py-4">
        {items.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={h.nombre}
              onChange={(e) => guardar(items.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
              placeholder="Vacuna"
              className="flex-1"
            />
            <div className="relative w-28">
              <Input
                type="number"
                inputMode="numeric"
                value={h.dia || ''}
                onChange={(e) => guardar(items.map((x, j) => (j === i ? { ...x, dia: Number(e.target.value) || 0 } : x)))}
                className="pr-10 text-center"
                placeholder="día"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                día
              </span>
            </div>
            <button
              onClick={() => guardar(items.filter((_, j) => j !== i))}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft active:bg-paper-sunken"
              aria-label="Quitar"
            >
              <IconClose width={18} height={18} />
            </button>
          </div>
        ))}
        <button
          onClick={() => guardar([...items, { nombre: '', dia: 0 }])}
          className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-forest-600"
        >
          + Agregar al plan
        </button>
      </Banda>
    </>
  )
}

function FilaEstatica({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm text-ink-soft">{sub}</div>
      </div>
      <span className="shrink-0 pl-3 font-display text-base font-semibold tnum">{valor}</span>
    </div>
  )
}

function FilaNumero({
  label,
  sub,
  unidad,
  value,
  onSave,
}: {
  label: string
  sub: string
  unidad?: string
  value?: number
  onSave: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm text-ink-soft">{sub}</div>
      </div>
      <div className="flex shrink-0 items-baseline gap-1">
        <input
          type="number"
          inputMode="decimal"
          defaultValue={value ?? ''}
          onBlur={(e) => onSave(Number(e.target.value))}
          placeholder="—"
          className="h-11 w-20 rounded-xl border border-line bg-paper-raised px-2 text-right font-display text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
        />
        {unidad && <span className="text-sm text-ink-soft">{unidad}</span>}
      </div>
    </div>
  )
}
