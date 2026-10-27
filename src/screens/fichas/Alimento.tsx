import { useState } from 'react'
import type { Gasto, Ingreso, Lote, Registro } from '../../db/schema'
import type { LoteMetrics } from '../../lib/metrics'
import { fecha, money, num, numCompacto, numCorto, pct, plural, porLb } from '../../lib/format'
import { useLotes, useSettings } from '../../lib/hooks'
import { estadoAgua, type ResumenAgua, resumenAgua } from '../../lib/agua'
import { computeInventarioAlimento, computePlanAlimento } from '../../lib/plan'
import { alimentoPorTipo, faseDeCompra, nombreFase, type AlimentoPorTipo } from '../../lib/alimentos'
import type { Proyeccion } from '../../lib/proyeccion'
import { alimentoDiaEstandarLb, FASES_ALIMENTO } from '../../lib/standards'
import { precioQuintalReal } from '../../lib/precios'
import { fcaEstandar, LB_POR_QUINTAL } from '../../lib/standards'
import { juicioFca } from '../../lib/metrics'
import { pesoObjetivoDe } from '../../lib/lote'
import { proyectarVenta } from '../../lib/proyeccion'
import { db } from '../../db/schema'
import { Banda, Seccion } from '../../components/ui'
import { ConteoSheet, GastoSheet, RegistroSheet } from '../../components/sheets'
import { TraspasoAlimentoSheet } from '../../components/Traspaso'
import { Button } from '../../components/ui'
import { GraficaLineas } from '../../components/chart'
import { Vacio } from './Vacio'

export function FichaAlimento({
  lote,
  registros,
  gastos,
  ingresos = [],
  metrics,
  soloVer = false,
}: {
  lote: Lote
  registros: Registro[]
  gastos: Gasto[]
  ingresos?: Ingreso[]
  metrics: LoteMetrics
  soloVer?: boolean
}) {
  const { unidadAlimento } = useSettings()
  const [contando, setContando] = useState(false)
  // El día se anota aquí mismo: antes llevaba al ciclo, y «Volver» regresaba a
  // esta ficha en vez de al ciclo.
  const [anotando, setAnotando] = useState(false)
  const [pasando, setPasando] = useState(false)
  // Lo que sobró al cerrar puede pasar a un ciclo en curso, con su costo.
  const enCurso = useLotes('activo')
  const destinos = (enCurso ?? []).filter((l) => l.id !== lote.id)
  // Lo que se da cada día, por lo que se compró: el tipo de cada saco manda.
  const porTipo = alimentoPorTipo(lote, registros, gastos, metrics)
  const [editarCompra, setEditarCompra] = useState<Gasto>()
  const precioQq = precioQuintalReal(gastos)
  const plan = computePlanAlimento(lote, metrics, precioQq ?? lote.precioQuintal)
  const inv = computeInventarioAlimento(gastos, metrics, plan?.totalQuintales ?? 0)
  const compras = gastos
    .filter((g) => g.categoria === 'alimento')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const consumo = metrics.alimento
  const diaFca = Math.min(metrics.diaAlimento ?? metrics.dias, metrics.dias)
  const stdFca = fcaEstandar(diaFca)
  const estadoFca = juicioFca(metrics)?.estado
  const agua = resumenAgua(lote, registros, ingresos)
  const activo = lote.estado === 'activo'
  // En un ciclo compartido no se cuenta ni se anota: lo lleva el socio.
  const anota = activo && !soloVer
  const ultimoConteo = consumo.conteos.length ? consumo.conteos[consumo.conteos.length - 1] : undefined
  // Lo mismo que usa «A cómo vender»: el consumo hasta el día de venta menos lo
  // que ya está en el almacén.
  const proy = activo
    ? proyectarVenta(lote, registros, gastos, metrics, pesoObjetivoDe(lote))
    : null
  const sinAlimento = metrics.alimentoTotalLb === 0

  if (sinAlimento && !compras.length && !activo)
    return <Vacio texto="En este ciclo no se anotó alimento." />

  return (
    <div className="space-y-5">
      {sinAlimento ? (
        <SinAlimento
          compras={compras.length}
          sinCantidad={inv?.comprasSinCantidad ?? 0}
          compradoQq={inv?.compradoQq ?? 0}
          activo={anota}
          onContar={() => setContando(true)}
          onAnotar={() => setAnotando(true)}
        />
      ) : (
        <Banda className="px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs text-ink-faint">Consumido</div>
              <div className="font-display text-2xl font-semibold leading-none tnum">
                {num(metrics.alimentoTotalLb / LB_POR_QUINTAL, 1)} qq
              </div>
              <div className="mt-1 text-sm text-ink-soft tnum">
                {num(metrics.alimentoTotalLb)} lb
                {precioQq ? ` · ${money(precioQq)} el quintal` : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-ink-faint">Conversión</div>
              {metrics.fca != null ? (
                <>
                  <div
                    className={
                      'font-display text-xl font-semibold leading-none tnum ' +
                      (estadoFca === 'bien'
                        ? 'text-forest-600'
                        : estadoFca === 'temprano'
                          ? 'text-ink'
                          : 'text-clay-text')
                    }
                  >
                    {num(metrics.fca, 2)}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint tnum">
                    {estadoFca === 'dudosoBajo'
                      ? 'no cuadra: falta alimento'
                      : estadoFca === 'dudosoAlto'
                        ? 'no cuadra: revisa lo anotado'
                        : estadoFca === 'temprano'
                          ? 'se juzga desde el día 7'
                          : `Cobb ${num(stdFca, 2)}${diaFca < metrics.dias ? ` · al día ${diaFca}` : ''}`}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-display text-xl font-semibold leading-none text-ink-faint">—</div>
                  <div className="mt-0.5 text-xs text-ink-faint">falta un pesaje</div>
                </>
              )}
            </div>
          </div>
          {(consumo.porConteoLb > 0 || (activo && diaFca < metrics.dias - 1)) && (
            <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint tnum">
              {consumo.porConteoLb > 0 &&
                `${numCorto(consumo.porConteoLb / LB_POR_QUINTAL, 1)} qq salen del conteo de sacos${ultimoConteo ? ` del ${fecha(ultimoConteo.fecha)}` : ''}. `}
              {activo && diaFca < metrics.dias - 1
                ? `El último dato de alimento es del día ${diaFca}: la conversión se mide a ese día. Anota los días que faltan o vuelve a contar los sacos.`
                : ''}
            </p>
          )}
        </Banda>
      )}

      {consumo.descuadres.length > 0 && (
        <p className="rounded-xl border-l-4 border-clay bg-clay-tint px-4 py-3 text-sm leading-relaxed text-clay-text">
          El conteo del {fecha(consumo.descuadres[consumo.descuadres.length - 1].fecha)} no cuadra
          con las compras por {numCorto(consumo.descuadres[consumo.descuadres.length - 1].qq, 1)} qq:
          hay más alimento del que se compró. ¿Falta anotar una compra o tiene otra fecha?
        </p>
      )}
      {consumo.conteosSinUsar && (
        <p className="rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
          Tienes sacos contados, pero {inv?.comprasSinCantidad === 1 ? 'una compra' : 'algunas compras'}{' '}
          de alimento no {inv?.comprasSinCantidad === 1 ? 'tiene' : 'tienen'} los quintales anotados.
          Anótalos en Gastos para que el conteo cuente.
        </p>
      )}

      {porTipo.partidas.length > 0 && (
        <div>
          <Seccion
            className="mb-3"
            etiqueta="Alimento por tipo"
            nota={
              activo
                ? 'Se da en orden: se acaba uno y sigue el próximo. Si cambiaste antes, dilo en el registro del día.'
                : 'Lo que se dio de cada alimento y los días en que se dio.'
            }
          />
          {porTipo.supuestas > 0 && (
            <p className="mb-3 rounded-xl border-l-4 border-amber-400 bg-amber-tint px-4 py-3 text-sm leading-relaxed text-amber-text">
              {porTipo.supuestas === 1 ? 'Una compra no dice' : `${num(porTipo.supuestas)} compras no dicen`} qué
              alimento {porTipo.supuestas === 1 ? 'es' : 'son'}: la app lo supuso por la fecha. Tócala abajo, en
              Compras, y dile cuál es.
            </p>
          )}
          <PorTipo lote={lote} alimentos={porTipo} proyeccion={proy} />
        </div>
      )}

      {(activo ? inv || compras.length > 0 : inv?.completo) && (
        <div>
          <Seccion
            className="mb-3"
            etiqueta={activo ? 'Existencia' : 'Lo que sobró'}
            accion={
              anota ? (
                <button
                  onClick={() => setContando(true)}
                  className="-mx-2 -my-3 px-2 py-3 text-sm font-semibold text-forest-600"
                >
                  Contar sacos →
                </button>
              ) : undefined
            }
          />
          {inv?.completo ? (
            <Banda className="px-5 py-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-display text-xl font-semibold leading-none tnum">
                    {inv.diasSinAnotar > 0 ? '~' : ''}
                    {num(Math.max(0, inv.existenciaQq), 1)} qq
                  </div>
                  <div className="mt-1 text-sm text-ink-soft tnum">
                    {num(inv.compradoQq, 1)} comprados − {num(inv.consumidoQq + inv.sinAnotarQq, 1)} dados
                  </div>
                  {porTipo.fases.filter((f) => f.quedaLb >= 5).length > 1 && (
                    <div className="mt-0.5 text-xs text-ink-faint tnum">
                      {porTipo.fases
                        .filter((f) => f.quedaLb >= 5)
                        .map((f) => `${num(f.quedaLb / LB_POR_QUINTAL, 1)} de ${nombreFase(f.fase)}`)
                        .join(' · ')}
                    </div>
                  )}
                </div>
                {activo && inv.existenciaQq > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-ink-faint">Alcanza</div>
                    <div className="font-display text-base font-semibold leading-none tnum">
                      {inv.diasQueAlcanza > 0
                        ? `${inv.diasQueAlcanza} ${plural(inv.diasQueAlcanza, 'día', 'días')}`
                        : 'hoy'}
                    </div>
                  </div>
                )}
              </div>
              {activo && (
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint tnum">
                {ultimoConteo
                  ? `Contaste ${numCorto(ultimoConteo.qq, 1)} sacos el ${fecha(ultimoConteo.fecha)}. `
                  : 'Nunca has contado los sacos: el saldo sale de lo anotado cada día. '}
                {inv.diasSinAnotar > 0
                  ? `${inv.diasSinAnotar} ${plural(inv.diasSinAnotar, 'día', 'días')} sin dato de alimento se calcularon con el consumo esperado (${numCorto(inv.sinAnotarQq, 1)} qq): cuenta los sacos para saber lo que hay de verdad.`
                  : ''}
              </p>
              )}
              {!activo && !soloVer && inv.existenciaQq >= 0.5 && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Si esos sacos los usa el ciclo que sigue, pásalos con su costo: este ciclo deja de cargar con
                    ellos y el otro los tiene en su almacén.
                  </p>
                  <Button variant="soft" className="mt-3" onClick={() => setPasando(true)}>
                    Pasar al ciclo que sigue
                  </Button>
                </div>
              )}
              {proy && !proy.listo && proy.alimentoRestanteLb > 0 && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft tnum">
                  Para vender el día {proy.diaVenta} ({fecha(proy.fechaEstimada)}) se comerán{' '}
                  {num(proy.alimentoRestanteQuintales, 1)} qq más:{' '}
                  {proy.alimentoPorComprarLb > 0 ? (
                    <>
                      faltan{' '}
                      <span className="font-semibold text-ink">
                        {num(proy.alimentoPorComprarQuintales, 1)} qq
                      </span>{' '}
                      por comprar
                      {proy.comprarPorTipo.length === 1 ? ` de ${nombreFase(proy.comprarPorTipo[0].fase).toLowerCase()}` : ''}
                      {!proy.sinPrecioAlimento ? `, unos ${money(proy.faltaAlimento)}` : ''}.
                    </>
                  ) : proy.sobranteLb >= 50 ? (
                    `alcanza con lo que hay y sobran ${num(proy.sobranteLb / LB_POR_QUINTAL, 1)} qq.`
                  ) : (
                    'alcanza con lo que hay.'
                  )}
                </p>
              )}
            </Banda>
          ) : (
            <Banda className="px-5 py-4 text-sm leading-relaxed text-ink-faint">
              {inv && inv.comprasSinCantidad > 0
                ? `${inv.comprasSinCantidad === 1 ? 'Una compra' : `${num(inv.comprasSinCantidad)} compras`} de alimento no ${inv.comprasSinCantidad === 1 ? 'tiene' : 'tienen'} quintales anotados: corrígelas en Gastos y aquí aparece cuánto queda y hasta qué día alcanza.`
                : 'Anota las compras de alimento con sus quintales para saber cuánto queda.'}
            </Banda>
          )}
        </div>
      )}

      {agua && <Agua resumen={agua} />}

      {!porTipo.partidas.length && !precioQq && !soloVer && activo && (
        <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
          Precio del quintal, si no anotas las compras
          <input
            type="number"
            inputMode="decimal"
            defaultValue={lote.precioQuintal || ''}
            onBlur={(e) => db.lotes.update(lote.id, { precioQuintal: Number(e.target.value) || undefined })}
            className="h-11 w-28 rounded-xl border border-borde bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
          />
        </label>
      )}

      {compras.length > 0 && (
        <div>
          <Seccion className="mb-3" etiqueta="Compras" />
          <Banda className="divide-y divide-line">
            {compras.map((g) => {
              const tipo = faseDeCompra(g)
              const supuesta = !tipo && porTipo.partidas.find((p) => p.gastoId === g.id)?.supuesta
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!anota}
                  onClick={() => setEditarCompra(g)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left text-sm transition active:bg-paper-sunken disabled:active:bg-transparent"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{g.descripcion || 'Alimento'}</div>
                    <div className="text-xs text-ink-faint tnum">
                      {tipo ? (
                        <span className="font-semibold text-forest-700">{nombreFase(tipo)}</span>
                      ) : supuesta ? (
                        <span className="font-semibold text-amber-text">¿Qué alimento es?</span>
                      ) : null}
                      {tipo || supuesta ? ' · ' : ''}
                      {fecha(g.fecha)}
                      {g.cantidadQq ? ` · ${num(g.cantidadQq, 1)} qq` : ' · sin cantidad anotada'}
                    </div>
                  </div>
                  <div className="shrink-0 pl-3 text-right tnum">
                    <div className="font-display font-semibold">{money(g.monto)}</div>
                    {g.cantidadQq ? (
                      <div className="text-xs text-ink-faint">{money(g.monto / g.cantidadQq)} el quintal</div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </Banda>
          {metrics.biomasaLb != null && metrics.biomasaLb > 0 && (
            <p className="mt-2 text-xs text-ink-faint tnum">
              El alimento va en{' '}
              {porLb(compras.reduce((a, g) => a + g.monto, 0) / metrics.biomasaLb)} por libra de pollo
              producida, {pct((compras.reduce((a, g) => a + g.monto, 0) / metrics.costos) * 100, 0)} de
              todo lo que llevas gastado.
            </p>
          )}
        </div>
      )}

      {!sinAlimento && anota && (
        <p className="text-xs leading-relaxed text-ink-faint">
          Anotas el alimento en {unidadAlimento === 'qq' ? 'quintales (qq) de 100 lb' : 'libras'}; lo cambias en
          el registro del día.
        </p>
      )}

      {!soloVer && (
        <>
          <ConteoSheet lote={lote} gastos={gastos} open={contando} onClose={() => setContando(false)} />
          <GastoSheet lote={lote} open={!!editarCompra} editar={editarCompra} onClose={() => setEditarCompra(undefined)} />
          <RegistroSheet
            lote={lote}
            registros={registros}
            ingresos={ingresos}
            alimentos={porTipo}
            open={anotando}
            onClose={() => setAnotando(false)}
          />
          {!activo && (
            <TraspasoAlimentoSheet
              lote={lote}
              destinos={destinos}
              sobranQq={Math.max(0, inv?.existenciaQq ?? 0)}
              fase={[...porTipo.fases].sort((a, b) => b.quedaLb - a.quedaLb)[0]?.fase}
              precioQq={precioQq}
              open={pasando}
              onClose={() => setPasando(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// Sin alimento no hay conversión, ni consumo por fase, ni saldo. Antes la ficha
// mostraba «0.0 qq» y «Conversión 0.00» como si fueran datos; ahora dice qué
// falta y da las dos maneras de llenarlo.
function SinAlimento({
  compras,
  sinCantidad,
  compradoQq,
  activo,
  onContar,
  onAnotar,
}: {
  compras: number
  sinCantidad: number
  compradoQq: number
  activo: boolean
  onContar: () => void
  onAnotar: () => void
}) {
  return (
    <div className="rounded-xl2 border border-amber-line border-l-4 border-l-amber-400 bg-amber-tint p-4">
      <div className="font-display text-base font-semibold text-amber-text">
        Falta saber cuánto alimento se ha dado
      </div>
      <p className="mt-1 text-sm leading-relaxed text-amber-text">
        Sin eso no se puede sacar la conversión (FCA) ni lo que va en cada fase.{' '}
        {compras > 0 && sinCantidad === 0
          ? `Compraste ${numCorto(compradoQq, 1)} qq: cuenta los sacos que quedan y la app saca lo que se dio.`
          : compras > 0
            ? 'Anota los quintales de cada compra en Gastos y cuenta los sacos que quedan, o anota lo que das cada día.'
            : 'Anota lo que das cada día en el registro, en sacos o en libras.'}
      </p>
      {activo && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onContar}
            className="rounded-full bg-forest-600 py-3 text-center text-sm font-semibold text-paper-raised transition active:scale-95"
          >
            Contar sacos
          </button>
          <button
            onClick={onAnotar}
            className="rounded-full border border-amber-line bg-paper-raised py-3 text-center text-sm font-semibold text-amber-text transition active:scale-95"
          >
            Anotar el de hoy
          </button>
        </div>
      )}
    </div>
  )
}

// Cada alimento con lo que se dio, en qué días, lo que queda y lo que falta
// comprar hasta la venta, a su precio. Contra Cobb se mide solo lo anotado.
function PorTipo({
  lote,
  alimentos,
  proyeccion,
}: {
  lote: Lote
  alimentos: AlimentoPorTipo
  proyeccion: Proyeccion | null
}) {
  const activo = lote.estado === 'activo'
  const faltaDe = (f: string) => proyeccion?.comprarPorTipo.find((c) => c.fase === f)
  const visibles = alimentos.fases.filter(
    (f) =>
      f.compradoQq > 0 ||
      f.dadoLb > 0 ||
      !!faltaDe(f.fase) ||
      (activo && (f.fase === alimentos.actual || f.fase === alimentos.siguiente)),
  )
  return (
    <Banda className="divide-y divide-line">
      {visibles.map((f) => {
        const anotados = alimentos.dias.filter((d) => d.fase === f.fase && !d.estimado)
        const realLb = anotados.reduce((a, d) => a + d.lb, 0)
        const planLb = anotados.reduce((a, d) => a + alimentoDiaEstandarLb(d.dia) * lote.cantidadInicial, 0)
        const dif = planLb > 0 ? ((realLb - planLb) / planLb) * 100 : 0
        const notable = anotados.length >= 2 && Math.abs(dif) >= 5
        const hoy = activo && f.fase === alimentos.actual
        const falta = faltaDe(f.fase)
        const desdeCobb = FASES_ALIMENTO.find((x) => x.id === f.fase)?.desde ?? 0
        return (
          <div key={f.fase} className={'px-5 py-3 ' + (hoy ? 'bg-forest-50' : '')}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {nombreFase(f.fase)}
                  {hoy && (
                    <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-700">
                      Hoy
                    </span>
                  )}
                </div>
                {f.nombre !== nombreFase(f.fase) && (
                  <div className="truncate text-xs text-ink-faint">{f.nombre}</div>
                )}
              </div>
              <div className="shrink-0 text-right tnum">
                <div className="font-display font-semibold">{num(f.dadoLb / LB_POR_QUINTAL, 1)} qq</div>
                <div className="text-xs text-ink-faint">dados</div>
              </div>
            </div>
            <div className="mt-1 text-xs text-ink-faint tnum">
              {f.desdeDia != null
                ? f.desdeDia === f.hastaDia
                  ? `Día ${f.desdeDia}`
                  : `Días ${f.desdeDia}–${f.hastaDia}`
                : `Por la edad, desde el día ${desdeCobb}`}
              {notable && (
                <span className={dif > 0 ? 'font-semibold text-clay-text' : 'font-semibold text-forest-600'}>
                  {' · '}
                  {dif > 0 ? '▲' : '▼'} {num(Math.abs(dif), 0)}% contra Cobb
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-ink-faint tnum">
              {f.compradoQq > 0
                ? `Compraste ${num(f.compradoQq, 1)} · quedan ${num(f.quedaLb / LB_POR_QUINTAL, 1)}`
                : 'Todavía no lo compras'}
              {f.precioQq != null ? ` · ${money(f.precioQq)} el quintal` : ''}
            </div>
            {falta && (
              <div className="mt-1 text-sm font-medium tnum">
                Faltan {num(falta.lb / LB_POR_QUINTAL, 1)} qq por comprar
                {falta.costo != null ? `: unos ${money(falta.costo)}` : ''}
              </div>
            )}
            {f.compradoQq > 0 && (
              <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-forest-500"
                  style={{ width: `${Math.min(100, (f.dadoLb / (f.compradoQq * LB_POR_QUINTAL)) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </Banda>
  )
}

function Agua({ resumen }: { resumen: ResumenAgua }) {
  const [foco, setFoco] = useState<number>()
  const dia = resumen.dias[foco ?? resumen.dias.length - 1]
  const estado = estadoAgua(dia.litrosPorLb)

  return (
    <div>
      <Seccion etiqueta="Agua" titulo={tituloAgua(resumen)} />
      <Banda className="mt-3 px-5 py-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-faint">
              {foco != null ? `Día ${dia.dia}` : `Último día anotado · día ${dia.dia}`}
            </div>
            <div className="font-display text-xl font-semibold leading-none tnum">
              {num(dia.litros)} L
            </div>
            <div className="mt-1 text-sm text-ink-soft tnum">
              lo normal eran {num(dia.esperadoL)} L
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-faint">Por libra de alimento</div>
            <div
              className={
                'font-display text-xl font-semibold leading-none tnum ' +
                (estado === 'normal' ? 'text-forest-600' : 'text-clay-text')
              }
            >
              {num(dia.litrosPorLb, 2)} L
            </div>
            <div className="mt-0.5 text-xs text-ink-faint">
              {estado === 'normal' ? '✓ normal' : estado === 'bajo' ? '▼ beben poco' : '▲ beben de más'}
            </div>
          </div>
        </div>

        {resumen.dias.length > 1 && (
          <div className="mt-4 border-t border-line pt-4">
            <GraficaLineas
              x={resumen.dias.map((d) => d.dia)}
              series={[
                {
                  datos: resumen.dias.map((d) => d.esperadoL),
                  tono: 'guia',
                  punteada: true,
                },
                { datos: resumen.dias.map((d) => d.litros) },
              ]}
              alto={150}
              banda="neutro"
              formatoY={(v) => numCompacto(v)}
              etiquetaX={(v) => `d${v}`}
              nota={
                resumen.caidaPct != null
                  ? {
                      indice: resumen.dias.length - 1,
                      texto: `${pct(resumen.caidaPct, 0)} menos`,
                    }
                  : undefined
              }
              foco={foco}
              onFoco={setFoco}
              resumen={`Agua bebida por día contra lo esperado, del día ${resumen.dias[0].dia} al ${resumen.ultimo.dia}.`}
            />
            <p className="mt-2 text-center text-xs text-ink-faint">
              La punteada es lo que les tocaba beber ese día.
            </p>
          </div>
        )}
      </Banda>
      {resumen.caidaPct != null && (
        <p className="mt-2 rounded-xl border-l-4 border-clay bg-clay-tint px-4 py-3 text-sm leading-relaxed text-clay-text">
          Revisa que los bebederos tengan presión y altura, y mira si hay aves decaídas: el agua se
          cae un día antes que todo lo demás.
        </p>
      )}
    </div>
  )
}

function tituloAgua(resumen: ResumenAgua) {
  if (resumen.caidaPct != null)
    return `El último día bebieron ${pct(resumen.caidaPct, 0)} menos que los anteriores`
  if (resumen.estado === 'bajo') return 'Están bebiendo por debajo de lo normal'
  if (resumen.estado === 'alto') return 'Están bebiendo más de lo normal'
  return 'Beben lo que les toca'
}
