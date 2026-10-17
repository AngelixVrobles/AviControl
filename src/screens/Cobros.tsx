import { useState } from 'react'
import { clsx } from 'clsx'
import { usePorCobrar } from '../lib/hooks'
import { desdeHace, fecha, money, num, plural } from '../lib/format'
import type { VentaPorCobrar } from '../lib/cobros'
import { Banda, EmptyState, Seccion } from '../components/ui'
import { IconBack, IconMoney } from '../components/icons'
import { CobroSheet } from '../components/sheets'
import { useVolver } from '../components/useVolver'

// Lo que te deben de las ventas a crédito: por comprador, el que más debe
// primero, y en cada uno la venta más vieja primero, que es la que hay que ir
// a cobrar. Tocar una venta abre el cobro.
export function Cobros() {
  const volver = useVolver('/')
  const resumen = usePorCobrar()
  // La venta queda elegida mientras la hoja se cierra, para que no se vacíe.
  const [venta, setVenta] = useState<VentaPorCobrar>()
  const [abierta, setAbierta] = useState(false)

  if (!resumen) return <div className="pt-10 text-center text-ink-faint">Cargando…</div>

  return (
    <div className="animate-rise">
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={volver}
          className="grid h-11 w-11 place-items-center rounded-full bg-paper-sunken"
          aria-label="Volver"
        >
          <IconBack width={22} height={22} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-tight">Te deben</h1>
          <p className="text-sm text-ink-soft tnum">
            {resumen.total >= 1
              ? `${money(resumen.total)} · ${num(resumen.ventas)} ${plural(resumen.ventas, 'venta', 'ventas')} a crédito`
              : 'Ventas a crédito'}
          </p>
        </div>
      </header>

      {resumen.compradores.length === 0 ? (
        <EmptyState
          icon={<IconMoney width={28} height={28} />}
          title="Nadie te debe"
          text="Cuando vendas a crédito, aquí verás quién te debe y desde cuándo."
        />
      ) : (
        resumen.compradores.map((c) => (
          <div key={c.comprador}>
            <Seccion
              className="mb-3 mt-6"
              etiqueta={c.comprador}
              titulo={money(c.total)}
              nota={`Te debe ${desdeHace(c.masVieja)}.`}
            />
            <Banda className="divide-y divide-line">
              {c.ventas.map((v) => (
                <button
                  key={v.ingreso.id}
                  onClick={() => {
                    setVenta(v)
                    setAbierta(true)
                  }}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm transition active:bg-paper-sunken"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{v.lote?.nombre ?? 'Venta'}</div>
                    <div className="text-xs text-ink-faint tnum">
                      {fecha(v.ingreso.fecha)} · vendido {money(v.ingreso.monto)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tnum">
                    <div className="font-display font-semibold">{money(v.pendiente)}</div>
                    <div
                      className={clsx(
                        'text-xs font-medium',
                        v.dias > 15 ? 'text-clay-text' : 'text-forest-600',
                      )}
                    >
                      Cobrar →
                    </div>
                  </div>
                </button>
              ))}
            </Banda>
          </div>
        ))
      )}

      <CobroSheet
        ingreso={venta?.ingreso}
        lote={venta?.lote}
        open={abierta}
        onClose={() => setAbierta(false)}
      />
    </div>
  )
}
