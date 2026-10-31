import { db, type Ingreso, type Lote } from '../../db/schema'
import { Banda, Button, Sheet } from '../ui'
import { toast } from '../confirm'
import { diasEntre, fecha as fechaCorta, hoyISO, money, num, numCorto, plural } from '../../lib/format'
import type { LoteMetrics } from '../../lib/metrics'
import { avesQueSalieron, cuadrarAves, cuadreRaro, pesoEsperadoLb } from '../../lib/cuadre'
import { useEnvio } from '../useEnvio'

// Ya salió el último pollo, pero por las cuentas quedan 57: las ventas se
// anotaron a 10 por caja y el pollero las sobrecargó. Si se fueron en las
// ventas, se reparten entre las que tienen las aves estimadas según sus
// libras, y el ciclo se cierra con la fecha de la última venta. Si se murieron
// sin anotar, van como bajas en el registro del día.
export function CuadreSheet({
  lote,
  metrics,
  ingresos,
  open,
  onClose,
  onAnotarBajas,
}: {
  lote: Lote
  metrics: LoteMetrics
  ingresos: Ingreso[]
  open: boolean
  onClose: () => void
  onAnotarBajas: () => void
}) {
  const { ocupado, enviar } = useEnvio(open)
  const ventas = ingresos
    .filter((i) => i.tipo === 'aves')
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado)
  const salieron = avesQueSalieron(lote, metrics.bajas)
  const marcadas = cuadrarAves(lote, ventas, salieron)
  // Las ventas anotadas antes de que la app supiera de aves estimadas no lo
  // dicen: si ninguna lo dice, se reparten entre todas las que tienen libras.
  const todas = marcadas ? undefined : cuadrarAves(lote, ventas.map((v) => ({ ...v, avesEstimadas: true })), salieron)
  const cuadre = marcadas ?? todas
  const cambian = cuadre
    ? ventas
        .map((v, k) => ({ v, antes: v.cantidad, despues: cuadre.cantidades[k] }))
        .filter((x) => x.antes !== x.despues)
    : []
  const ultima = ventas[ventas.length - 1]?.fecha

  async function cuadrar() {
    await db.transaction('rw', db.ingresos, db.lotes, async () => {
      for (const { v, despues } of cambian) await db.ingresos.update(v.id, { cantidad: despues, avesEstimadas: true })
      await db.lotes.update(lote.id, { estado: 'cerrado', fechaCierre: ultima ?? hoyISO() })
    })
    toast(`Ciclo cerrado · ${money(metrics.ganancia)}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ya no quedan pollos">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Por las cuentas quedan{' '}
          <span className="font-semibold text-ink">
            {num(metrics.avesVivas)} {plural(metrics.avesVivas, 'pollo', 'pollos')}
          </span>{' '}
          en el galpón. Si ya salió el último, se fueron en las ventas: la app los reparte entre las que
          tienen las aves estimadas, según sus libras.
        </p>

        {cuadre && cambian.length > 0 ? (
          <>
            {todas && (
              <p className="text-xs leading-relaxed text-ink-faint">
                Ninguna venta tiene las aves marcadas como estimadas: se reparten entre todas las que
                tienen libras.
              </p>
            )}
            <Banda className="divide-y divide-line">
              {cambian.map(({ v, antes, despues }) => (
                <div key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{v.comprador?.trim() || 'Venta'}</div>
                    <div className="text-xs text-ink-faint tnum">
                      {fechaCorta(v.fecha)} · {numCorto(v.pesoLb ?? 0, 1)} lb{v.arreglado ? ' arregladas' : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tnum" aria-label={`De ${num(antes)} a ${num(despues)} aves`}>
                    <span className="text-xs text-ink-faint line-through">{num(antes)}</span>{' '}
                    <span className="font-display text-base font-semibold">{num(despues)} aves</span>
                  </div>
                </div>
              ))}
            </Banda>
            <p className="rounded-xl bg-forest-50 px-4 py-3 text-sm leading-relaxed text-forest-700">
              Salieron {num(salieron)} pollos en ventas: los que llegaron menos los que se murieron.
              {cuadre.pesoAveLb != null ? ` Cada uno pesó ${numCorto(cuadre.pesoAveLb, 2)} lb en pie, en promedio.` : ''}
            </p>
            {ultima && <AvisoCuadre lote={lote} metrics={metrics} pesoAveLb={cuadre.pesoAveLb} fecha={ultima} />}
            <Button block className="h-14" disabled={ocupado} onClick={enviar(cuadrar)}>
              Cuadrar y cerrar el ciclo
            </Button>
            <p className="text-center text-xs leading-relaxed text-ink-faint">
              Se cierra con la fecha de la última venta. Si te falta un gasto, lo anotas después de
              reabrirlo.
            </p>
          </>
        ) : (
          <p className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
            No hay ventas con libras entre las que repartirlos.
          </p>
        )}

        <div className="border-t border-line pt-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            ¿Se murieron sin anotar? Anótalos como bajas en el registro del día: con el galpón en cero, el
            ciclo se cierra desde ahí.
          </p>
          <Button variant="ghost" className="-mx-5 mt-1" onClick={onAnotarBajas}>
            Anotar las bajas
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

// El cuadre que da pollos que no pueden ser no se calla: falta algo por anotar.
export function AvisoCuadre({
  lote,
  metrics,
  pesoAveLb,
  fecha,
}: {
  lote: Lote
  metrics: LoteMetrics
  pesoAveLb?: number
  fecha: string
}) {
  const esperado = pesoEsperadoLb(lote, fecha, metrics.factorCurva)
  const raro = cuadreRaro(pesoAveLb, esperado, metrics.pesoEstimadoLb != null)
  if (!raro || pesoAveLb == null) return null
  return (
    <p className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
      Ojo: así cada pollo habría pesado {numCorto(pesoAveLb, 2)} lb, y a los{' '}
      {num(diasEntre(lote.fechaInicio, fecha))} días deberían andar por {numCorto(esperado, 1)}.{' '}
      {raro === 'livianos'
        ? 'Puede que falte anotar una venta o unas bajas.'
        : 'Puede que haya bajas anotadas de más, o una venta con aves de más.'}
    </p>
  )
}
