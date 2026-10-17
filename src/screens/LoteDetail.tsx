import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { clsx } from "clsx";
import { motion } from "motion/react";
import {
  db,
  type EntregaSocio,
  type Gasto,
  type Ingreso,
  type Lote,
  type Pesaje,
  type Registro,
} from "../db/schema";
import { useLoteData, useSettings } from "../lib/hooks";
import { agruparGastos, juicioFca, type LoteMetrics } from "../lib/metrics";
import { proyectarVenta, type Proyeccion } from "../lib/proyeccion";
import { analizarPrecio, precioAlimentoLb } from "../lib/precios";
import { resultadoCiclo, type Contraste } from "../lib/cierre";
import { analizarPuntoOptimo } from "../lib/optimo";
import { analizarMuestra, tamanoMuestra } from "../lib/muestreo";
import { computeGuiaDia } from "../lib/guia";
import { pesoObjetivoDe, sinAves } from "../lib/lote";
import { nombreGalpon } from "../lib/galpones";
import { pendienteDe } from "../lib/cobros";
import { computeInventarioAlimento, computePlanAlimento } from "../lib/plan";
import {
  computeLiquidacion,
  esYo,
  fraseEntrega,
  gananciaPorSocio,
  nombreSocio,
  type SocioBalance,
  type Traspaso,
} from "../lib/sociedad";
import { compartirReporte } from "../lib/reporte";
import {
  alimentoEn,
  diasEntre,
  fecha,
  hoyISO,
  money,
  num,
  numCompacto,
  pct,
  plural,
  porLb,
} from "../lib/format";
import { categoriaLabel, RAZA, tipoIngresoLabel } from "../lib/labels";
import { LB_POR_QUINTAL, pesoEstandarLb } from "../lib/standards";
import type { Settings } from "../lib/settings";
import { AlertaChip } from "../components/AlertaChip";
import { FichasNav } from "../components/FichasNav";
import { InversionPorDia } from "../components/InversionPorDia";
import { EditarLoteSheet } from "../components/LoteSheet";
import { confirmar, toast } from "../components/confirm";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Button, Banda, Pill, Seccion } from "../components/ui";
import { GraficaLineas } from "../components/chart";
import {
  IconBack,
  IconLapiz,
  IconMoney,
  IconPesa,
  IconPlus,
  IconScale,
  IconTrend,
} from "../components/icons";
import {
  ActionButton,
  CierreSheet,
  CobroSheet,
  EntregaSheet,
  GastoSheet,
  IngresoSheet,
  PesajeSheet,
  RegistroSheet,
} from "../components/sheets";

type SheetKind =
  | "registro"
  | "pesaje"
  | "gasto"
  | "ingreso"
  | "cierre"
  | "lote"
  | "cobro"
  | null;
type Tab = "hoy" | "crecimiento" | "dinero";
const TABS: { id: Tab; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "crecimiento", label: "Crecimiento" },
  { id: "dinero", label: "Dinero" },
];

export function LoteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const data = useLoteData(id ? Number(id) : undefined);
  const settings = useSettings();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [editRegistro, setEditRegistro] = useState<Registro>();
  const [editGasto, setEditGasto] = useState<Gasto>();
  const [editIngreso, setEditIngreso] = useState<Ingreso>();
  const [editPesaje, setEditPesaje] = useState<Pesaje>();
  const [cobroDe, setCobroDe] = useState<number>();
  const [todoHistorial, setTodoHistorial] = useState(false);

  function abrir(kind: SheetKind) {
    setEditRegistro(undefined);
    setEditGasto(undefined);
    setEditIngreso(undefined);
    setEditPesaje(undefined);
    setSheet(kind);
  }

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("reg") !== "1") return;
    abrir("registro");
    const next = new URLSearchParams(searchParams);
    next.delete("reg");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const tab = (searchParams.get("t") as Tab) || "hoy";
  function setTab(t: Tab) {
    const next = new URLSearchParams(searchParams);
    next.set("t", t);
    setSearchParams(next, { replace: true });
  }

  if (data === undefined)
    return <div className="pt-10 text-center text-ink-faint">Cargando…</div>;
  if (data === null)
    return (
      <div className="pt-10 text-center">
        <p className="text-ink-faint">Este lote no existe.</p>
        <Button variant="soft" className="mt-4" onClick={() => nav("/lotes")}>
          Volver a lotes
        </Button>
      </div>
    );

  const {
    lote,
    registros,
    gastos,
    ingresos,
    pesajes,
    aplicaciones,
    entregas,
    metrics,
    alertas,
  } = data;
  const cerrado =
    lote.estado === "cerrado" && ingresos.some((i) => i.tipo === "aves");
  const gastosCat = agruparGastos(gastos);
  const positivo = metrics.ganancia >= 0;
  // Activo con el galpón vacío: en vez de los botones del día, cerrar el ciclo.
  const vacio = lote.estado === "activo" && sinAves(metrics);

  // El ingreso llega el día de la venta: hasta entonces la ganancia solo puede
  // decir «pérdida», y del tamaño de toda la inversión.
  const sinVender = metrics.ingresos === 0;
  const precioReferencia = lote.precioVentaLb ?? settings.precioMercadoLb;
  const valorEnPie =
    precioReferencia && metrics.pesoEstimadoLb != null
      ? metrics.avesVivas * metrics.pesoEstimadoLb * precioReferencia
      : 0;

  async function reabrir() {
    const ok = await confirmar({
      titulo: "Reabrir ciclo",
      mensaje:
        "Volverá a aparecer como activo. La venta que registraste se queda.",
      confirmar: "Reabrir",
    });
    if (ok)
      await db.lotes.update(lote.id, {
        estado: "activo",
        fechaCierre: undefined,
      });
  }

  // En el reporte de un ciclo que sigue no van el costo por libra de hoy ni
  // las aves vendidas (cero): van el precio mínimo y cuándo se vende.
  const enCurso = lote.estado === "activo";
  const analisisReporte = enCurso
    ? analizarPrecio(
        lote,
        gastos,
        metrics,
        proyectarVenta(lote, registros, gastos, metrics, pesoObjetivoDe(lote)),
      )
    : null;
  const kpis = [
    {
      label:
        (metrics.diasDesdePeso ?? 0) >= 2 ? "Peso estimado hoy" : "Peso prom.",
      value:
        metrics.pesoEstimadoLb != null
          ? `${num(metrics.pesoEstimadoLb, 2)} lb`
          : "—",
    },
    {
      label: "Conv. alim. (FCA)",
      value: metrics.fca != null ? num(metrics.fca, 2) : "—",
    },
    { label: "Mortalidad", value: pct(metrics.mortalidadPct) },
    {
      label: "Alimento total",
      value: `${num(metrics.alimentoTotalLb / LB_POR_QUINTAL, 1)} qq`,
    },
    enCurso
      ? {
          label: "Mínimo para no perder",
          value: analisisReporte ? `${porLb(analisisReporte.precioEquilibrioLb)}/lb` : "—",
        }
      : {
          label: "Costo / lb",
          value: metrics.costoPorLb != null ? porLb(metrics.costoPorLb) : "—",
        },
    enCurso
      ? {
          label: "Venta estimada",
          value:
            metrics.fechaVentaEstimada && metrics.diaVentaEstimado != null
              ? metrics.diaVentaEstimado <= metrics.dias
                ? "lista"
                : `${fecha(metrics.fechaVentaEstimada)} · día ${metrics.diaVentaEstimado}`
              : "—",
        }
      : { label: "Aves vendidas", value: num(metrics.vendidas) },
  ];

  return (
    <div className="animate-rise">
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => nav(-1)}
          className="grid h-11 w-11 place-items-center rounded-full bg-paper-sunken"
          aria-label="Volver"
        >
          <IconBack width={22} height={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold leading-tight">
            {lote.nombre}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-ink-soft tnum">
              Día {metrics.dias}
            </span>
            <span className="text-sm text-ink-soft">· {nombreGalpon(lote, settings) ?? RAZA}</span>
            {lote.estado === "cerrado" && <Pill tone="neutral">Cerrado</Pill>}
          </div>
        </div>
        <button
          onClick={() => abrir("lote")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-sunken text-ink-soft"
          aria-label="Corregir o borrar el ciclo"
        >
          <IconLapiz width={20} height={20} />
        </button>
      </header>

      {alertas.length > 0 && !vacio && (
        <div className="mb-4 space-y-2">
          {alertas.map((a, i) => (
            <AlertaChip key={i} alerta={a} />
          ))}
        </div>
      )}

      {vacio && (
        <CerrarSinAves
          lote={lote}
          metrics={metrics}
          ingresos={ingresos}
          onGasto={() => abrir("gasto")}
        />
      )}

      {lote.estado === "activo" && !vacio && (
        <div className="mt-1 grid grid-cols-4 gap-2">
          <ActionButton
            label="Día"
            tone="green"
            icon={<IconPlus width={20} height={20} />}
            onClick={() => abrir("registro")}
          />
          <ActionButton
            label="Pesaje"
            tone="green"
            icon={<IconPesa width={20} height={20} />}
            onClick={() => abrir("pesaje")}
          />
          <ActionButton
            label="Gasto"
            tone="neutral"
            icon={<IconMoney width={20} height={20} />}
            onClick={() => abrir("gasto")}
          />
          <ActionButton
            label="Venta"
            tone="amber"
            icon={<IconScale width={20} height={20} />}
            onClick={() => abrir("ingreso")}
          />
        </div>
      )}

      <div className="sticky top-0 z-30 -mx-5 mt-5 bg-paper px-5 pb-2 pt-2">
        <div className="flex gap-1 rounded-full bg-sunken p-1">
          {TABS.map((t) => {
            const label =
              t.id === "hoy" && lote.estado === "cerrado" ? "Resumen" : t.label;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex-1 rounded-full py-2.5 text-sm font-semibold"
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="tab-activa"
                    className="absolute inset-0 rounded-full bg-paper-raised shadow-card"
                    transition={{ type: "spring", stiffness: 500, damping: 42 }}
                  />
                )}
                <span
                  className={
                    "relative " + (tab === t.id ? "text-ink" : "text-ink-soft")
                  }
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "hoy" && (
        <div className="animate-rise">
          <FichasNav
            lote={lote}
            metrics={metrics}
            aplicaciones={aplicaciones}
          />
          <GuiaDelDia
            lote={lote}
            metrics={metrics}
            unidad={settings.unidadAlimento}
          />
          <FaseActual lote={lote} gastos={gastos} metrics={metrics} />

          <Seccion className="mb-3 mt-8" etiqueta="Historial" />
          {registros.length === 0 ? (
            <p className="rounded-xl2 border border-dashed border-line bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-faint">
              Sin registros aún. Toca “Registrar día” para empezar.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-faint">
                Toca un día para corregirlo.
              </p>
              <Banda className="divide-y divide-line">
                {[...registros]
                  .reverse()
                  .slice(0, todoHistorial ? undefined : 5)
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setEditRegistro(r);
                        setEditGasto(undefined);
                        setEditIngreso(undefined);
                        setSheet("registro");
                      }}
                      className="flex w-full items-center justify-between px-5 py-3 text-left text-sm transition active:bg-paper-sunken"
                    >
                      <span className="font-medium">
                        {fecha(r.fecha)}
                        {r.soloPeso && (
                          <span className="ml-2 text-xs font-normal text-amber-text">
                            solo pesaje
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3 text-ink-soft tnum">
                        {r.pesoPromedio != null && (
                          <span>{num(r.pesoPromedio, 2)} lb</span>
                        )}
                        {r.alimentoLb > 0 && (
                          <span className="text-ink-faint">
                            {alimentoEn(r.alimentoLb, settings.unidadAlimento)}
                          </span>
                        )}
                        {r.mortalidad > 0 && (
                          <span className="text-ink-soft">
                            {num(r.mortalidad)} bajas
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
              </Banda>
              {!todoHistorial && registros.length > 5 && (
                <button
                  onClick={() => setTodoHistorial(true)}
                  className="mt-2 w-full py-2 text-center text-sm font-medium text-forest-600"
                >
                  Ver los {num(registros.length)} registros
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === "crecimiento" && (
        <div className="animate-rise">
          <Desvio lote={lote} registros={registros} />
          <GridCrecimiento metrics={metrics} />
          <Muestreo
            lote={lote}
            pesajes={pesajes}
            metrics={metrics}
            onNuevo={() => abrir("pesaje")}
            onEditar={(p) => {
              setEditRegistro(undefined);
              setEditGasto(undefined);
              setEditIngreso(undefined);
              setEditPesaje(p);
              setSheet("pesaje");
            }}
          />
          <Diagnostico metrics={metrics} />
        </div>
      )}

      {tab === "dinero" && (
        <div className="animate-rise">
          <ComoSalio lote={lote} metrics={metrics} ingresos={ingresos} />
          <Banda className={clsx("mt-5 overflow-hidden", cerrado && "hidden")}>
            <div className="flex items-stretch">
              <div className="flex-1 p-4">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <IconTrend width={16} height={16} />
                  <span className="text-xs font-medium">
                    {sinVender ? "Invertido" : positivo ? "Ganancia" : "Pérdida"}
                  </span>
                </div>
                <div
                  className={
                    "mt-1 font-display text-2xl font-semibold tracking-tight tnum leading-none " +
                    (sinVender ? "text-ink" : positivo ? "text-forest-600" : "text-clay-deep")
                  }
                >
                  <AnimatedNumber
                    value={sinVender ? metrics.costos : metrics.ganancia}
                    format={(n) => money(n)}
                  />
                </div>
                <div className="mt-1 text-xs text-ink-faint tnum">
                  {sinVender ? "todavía sin vender" : `Margen ${pct(metrics.margenPct)}`}
                </div>
              </div>
              <div className="w-px bg-line" />
              <div className="grid flex-1 grid-rows-2">
                <div className="border-b border-line px-5 py-2.5">
                  <div className="text-xs text-ink-faint">
                    {sinVender ? "Valor en pie" : "Ingresos"}
                  </div>
                  <div className="font-display text-lg font-semibold tnum leading-tight">
                    {sinVender && valorEnPie > 0
                      ? money(valorEnPie)
                      : sinVender
                        ? "—"
                        : money(metrics.ingresos)}
                  </div>
                </div>
                <div className="px-5 py-2.5">
                  <div className="text-xs text-ink-faint">
                    {sinVender ? "Costo por libra" : "Costos"}
                  </div>
                  <div className="font-display text-lg font-semibold tnum leading-tight">
                    {sinVender
                      ? metrics.costoPorLb != null
                        ? porLb(metrics.costoPorLb)
                        : "—"
                      : money(metrics.costos)}
                  </div>
                </div>
              </div>
            </div>
          </Banda>

          {metrics.porCobrar >= 1 && (
            <Link
              to="/cobros"
              className="mt-3 flex items-center justify-between gap-3 rounded-xl2 border border-amber-line bg-amber-tint px-4 py-3 text-sm text-amber-text"
            >
              <span>
                De lo vendido faltan{" "}
                <span className="font-semibold tnum">{money(metrics.porCobrar)}</span> por
                cobrar
              </span>
              <span className="shrink-0 font-semibold">Ver →</span>
            </Link>
          )}

          <PrecioMinimo
            lote={lote}
            registros={registros}
            gastos={gastos}
            metrics={metrics}
          />
          <PuntoOptimo
            lote={lote}
            registros={registros}
            gastos={gastos}
            metrics={metrics}
          />

          <Link
            to={`/lotes/${lote.id}/ficha/gastos`}
            className="mt-7 flex items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 transition active:scale-[0.99]"
          >
            <div>
              <div className="font-display text-lg font-semibold leading-tight">
                A dónde se fue el dinero
              </div>
              <div className="text-sm text-ink-soft">
                {gastosCat.length > 0
                  ? `${categoriaLabel(gastosCat[0].categoria)} se lleva ${pct((gastosCat[0].total / Math.max(1, metrics.costos)) * 100, 0)}`
                  : "Cada categoría, con su detalle"}
              </div>
            </div>
            <span className="shrink-0 text-right">
              <span className="block font-display text-lg font-semibold tnum">
                {money(metrics.costos, { compact: true })}
              </span>
              <span className="text-xs text-ink-faint">ver desglose ›</span>
            </span>
          </Link>

          <InversionPorDia
            lote={lote}
            gastos={gastos}
            diaActual={metrics.dias}
          />

          <Sociedad
            lote={lote}
            registros={registros}
            gastos={gastos}
            ingresos={ingresos}
            entregas={entregas}
            metrics={metrics}
            settings={settings}
          />

          {ingresos.length > 0 && (
            <>
              <Seccion className="mb-3 mt-8" etiqueta="Ventas" />
              <p className="mb-3 text-xs text-ink-faint">
                Toca una para corregirla.
              </p>
              <Banda className="divide-y divide-line">
                {[...ingresos]
                  .sort((a, b) => b.fecha.localeCompare(a.fecha))
                  .map((i) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        setEditIngreso(i);
                        setEditRegistro(undefined);
                        setEditGasto(undefined);
                        setSheet("ingreso");
                      }}
                      className="flex w-full items-center justify-between px-5 py-3 text-left text-sm transition active:bg-paper-sunken"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {i.comprador?.trim() ||
                            i.descripcion ||
                            tipoIngresoLabel(i.tipo)}
                        </div>
                        <div className="text-xs text-ink-faint tnum">
                          {fecha(i.fecha)}
                          {i.cantidad > 0 ? ` · ${num(i.cantidad)} aves` : ""}
                          {i.pesoLb ? ` · ${num(i.pesoLb)} lb` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 text-right tnum">
                        <span className="block font-display font-semibold text-forest-600">
                          +{money(i.monto)}
                        </span>
                        {pendienteDe(i) >= 1 && (
                          <span className="block text-xs font-medium text-amber-text">
                            faltan {money(pendienteDe(i))}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
              </Banda>
            </>
          )}

          <div className="mt-8 space-y-2">
            <Button
              block
              variant="soft"
              onClick={async () => {
                try {
                  const como = await compartirReporte(
                    lote,
                    metrics,
                    settings.granja,
                    kpis,
                    enCurso
                      ? {
                          precioMinimoLb: analisisReporte?.precioEquilibrioLb,
                          valorEnPie,
                        }
                      : undefined,
                  );
                  if (como === "descargado")
                    toast("Reporte descargado: lo encuentras en Descargas.");
                } catch {
                  toast("No se pudo armar el reporte. Inténtalo de nuevo.");
                }
              }}
            >
              Compartir reporte
            </Button>
            <div className="flex justify-center">
              {lote.estado === "activo" ? (
                <Button variant="ghost" onClick={() => abrir("cierre")}>
                  Vender y cerrar ciclo
                </Button>
              ) : (
                <Button variant="ghost" onClick={reabrir}>
                  Reabrir ciclo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <RegistroSheet
        lote={lote}
        registros={registros}
        open={sheet === "registro"}
        onClose={() => setSheet(null)}
        editar={editRegistro}
      />
      <CierreSheet
        lote={lote}
        metrics={metrics}
        registros={registros}
        gastos={gastos}
        open={sheet === "cierre"}
        onClose={() => setSheet(null)}
      />
      <PesajeSheet
        lote={lote}
        avesVivas={metrics.avesVivas}
        open={sheet === "pesaje"}
        onClose={() => setSheet(null)}
        editar={editPesaje}
      />
      <GastoSheet
        lote={lote}
        open={sheet === "gasto"}
        onClose={() => setSheet(null)}
        editar={editGasto}
      />
      <IngresoSheet
        lote={lote}
        metrics={metrics}
        registros={registros}
        gastos={gastos}
        open={sheet === "ingreso"}
        onClose={() => setSheet(null)}
        editar={editIngreso}
        onCobrar={(i) => {
          setCobroDe(i.id);
          setSheet("cobro");
        }}
      />
      <CobroSheet
        ingreso={ingresos.find((i) => i.id === cobroDe)}
        lote={lote}
        open={sheet === "cobro"}
        onClose={() => setSheet(null)}
      />
      <EditarLoteSheet
        lote={lote}
        limites={{
          primeraFecha: [registros[0]?.fecha, pesajes[0]?.fecha, aplicaciones[0]?.fecha]
            .filter((f): f is string => !!f)
            .sort()[0],
          salidas:
            registros.reduce((a, r) => a + (r.mortalidad ?? 0) + (r.descarte ?? 0), 0) +
            metrics.vendidas,
          fechaCierre: lote.fechaCierre,
        }}
        contenido={{
          registros: registros.length,
          gastos: gastos.length,
          ventas: ingresos.length,
          pesajes: pesajes.length,
          aplicaciones: aplicaciones.length,
          entregas: entregas.length,
        }}
        open={sheet === "lote"}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}

// Se vendieron todas las aves con «Venta», o no queda ninguna: el ciclo sigue
// abierto y pedía el registro del día. Aquí se cierra con la fecha de la última
// venta, sin proyección que guardar: con el galpón vacío ya no hay qué proyectar.
function CerrarSinAves({
  lote,
  metrics,
  ingresos,
  onGasto,
}: {
  lote: Lote;
  metrics: LoteMetrics;
  ingresos: Ingreso[];
  onGasto: () => void;
}) {
  const ventas = ingresos
    .filter((i) => i.tipo === "aves")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultima = ventas[ventas.length - 1]?.fecha;
  const vendio = metrics.vendidas > 0;

  async function cerrar() {
    const ok = await confirmar({
      titulo: "Cerrar el ciclo",
      mensaje: `${ultima ? `Se cierra con fecha ${fecha(ultima)}, la de la última venta.` : "Se cierra con fecha de hoy."} Si te falta anotar un gasto, puedes hacerlo antes o reabrirlo después.`,
      confirmar: "Cerrar el ciclo",
    });
    if (!ok) return;
    await db.lotes.update(lote.id, {
      estado: "cerrado",
      fechaCierre: ultima ?? hoyISO(),
    });
    toast(`Ciclo cerrado · ${money(metrics.ganancia)}`);
  }

  return (
    <div className="mt-1 rounded-xl2 border border-amber-line border-l-4 border-l-amber bg-amber-tint p-4">
      <div className="font-display text-base font-semibold text-amber-text">
        {vendio ? "Vendiste todas las aves" : "No quedan aves en el galpón"}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-amber-text">
        El ciclo sigue abierto. Ciérralo para ver cómo salió y que pase a Reportes.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={cerrar}
          className="rounded-full bg-forest-500 px-5 py-2.5 text-sm font-semibold text-paper-raised transition active:scale-95"
        >
          Cerrar el ciclo
        </button>
        <button
          onClick={onGasto}
          className="-mx-2 -my-3 px-2 py-3 text-sm font-medium text-amber-text"
        >
          Anotar un gasto
        </button>
      </div>
    </div>
  );
}

function Muestreo({
  lote,
  pesajes,
  metrics,
  onNuevo,
  onEditar,
}: {
  lote: Lote;
  pesajes: Pesaje[];
  metrics: LoteMetrics;
  onNuevo: () => void;
  onEditar: (p: Pesaje) => void;
}) {
  const aves = metrics.avesVivas;
  const sugeridas = tamanoMuestra(aves);
  const ultimo = pesajes.length ? pesajes[pesajes.length - 1] : undefined;
  const m = ultimo ? analizarMuestra(ultimo.pesos, aves) : null;

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Muestreo de peso"
        accion={
          <button
            onClick={onNuevo}
            className="-mx-2 -my-3 px-2 py-3 text-sm font-semibold text-forest-600"
          >
            Pesar aves →
          </button>
        }
      />

      {!m || !ultimo ? (
        <Banda className="px-5 py-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            Pesando{" "}
            <span className="font-semibold text-ink">
              {num(sugeridas)} aves al azar
            </span>{" "}
            de las {num(aves)} del galpón sabes el peso promedio de todas con un
            margen de ±3 %. De ahí salen las libras que vas a vender y a qué
            precio te conviene.
          </p>
          <Button variant="soft" block className="mt-3" onClick={onNuevo}>
            Empezar pesaje
          </Button>
        </Banda>
      ) : (
        <>
          <Banda className="px-5 py-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-ink-faint">
                  {fecha(ultimo.fecha)} · día{" "}
                  {diasEntre(lote.fechaInicio, ultimo.fecha)}
                </div>
                <div className="font-display text-2xl font-semibold leading-none tnum">
                  {num(m.promedioLb, 2)} lb
                </div>
                <div className="mt-1 text-xs text-ink-soft tnum">
                  ± {num(m.margenLb, 2)} lb · {num(m.n)} aves (
                  {pct(m.pctLote, 1)} del galpón)
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-faint">del estándar Cobb</div>
                <div
                  className={clsx(
                    "font-display text-xl font-semibold leading-none tnum",
                    m.promedioLb >=
                      pesoEstandarLb(
                        diasEntre(lote.fechaInicio, ultimo.fecha),
                      ) *
                        0.95
                      ? "text-forest-600"
                      : "text-clay-deep",
                  )}
                >
                  {pct(
                    (m.promedioLb /
                      pesoEstandarLb(
                        diasEntre(lote.fechaInicio, ultimo.fecha),
                      )) *
                      100,
                    0,
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div>
                <div className="font-display text-lg font-semibold leading-none tnum">
                  {pct(m.uniformidadPct, 0)}
                </div>
                <div className="mt-1 text-xs text-ink-faint">
                  Uniformidad
                </div>
                <div className="text-xs text-ink-soft">{m.uniformidad}</div>
              </div>
              <div>
                <div className="font-display text-lg font-semibold leading-none tnum">
                  {pct(m.cvPct, 1)}
                </div>
                <div className="mt-1 text-xs text-ink-faint">
                  Desparejo (CV)
                </div>
                <div className="text-xs text-ink-soft tnum">
                  {num(m.minLb, 2)}–{num(m.maxLb, 2)} lb
                </div>
              </div>
              <div>
                <div className="font-display text-lg font-semibold leading-none tnum">
                  {num(m.biomasaLb ?? 0)}
                </div>
                <div className="mt-1 text-xs text-ink-faint">
                  Libras vivas
                </div>
                <div className="text-xs text-ink-soft tnum">
                  ±{num((m.biomasaMaxLb ?? 0) - (m.biomasaLb ?? 0))} lb
                </div>
              </div>
            </div>
          </Banda>

          {m.uniformidad === "despareja" && (
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Un lote desparejo (CV sobre 12 %) suele ser falta de comedero o
              bebedero por ave: las aves chicas no alcanzan. Revisa espacio y
              altura de los equipos.
            </p>
          )}

          {pesajes.length > 1 && (
            <Banda className="mt-3 divide-y divide-line">
              {[...pesajes]
                .reverse()
                .slice(0, 6)
                .map((p) => {
                  const s = analizarMuestra(p.pesos, aves);
                  if (!s) return null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onEditar(p)}
                      className="flex w-full items-center justify-between px-5 py-2.5 text-left text-sm transition active:bg-paper-sunken"
                    >
                      <span className="font-medium">
                        Día {diasEntre(lote.fechaInicio, p.fecha)}
                        <span className="ml-2 text-xs text-ink-faint">
                          {num(s.n)} aves
                        </span>
                      </span>
                      <span className="text-ink-soft tnum">
                        {num(s.promedioLb, 2)} lb
                        <span className="ml-2 text-xs text-ink-faint">
                          ±{pct(s.margenPct, 1)}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </Banda>
          )}
        </>
      )}
    </>
  );
}

function ComoSalio({
  lote,
  metrics,
  ingresos,
}: {
  lote: Lote;
  metrics: LoteMetrics;
  ingresos: Ingreso[];
}) {
  if (lote.estado !== "cerrado") return null;
  const r = resultadoCiclo(lote, metrics, ingresos);
  if (!r) return null;
  const positivo = r.ganancia >= 0;
  const reparto = gananciaPorSocio([{ socios: lote.socios, ganancia: r.ganancia }]);

  return (
    <>
      <Seccion className="mb-3 mt-6" etiqueta="Cierre" titulo="Cómo salió el ciclo" />
      <Banda className="px-5 py-4">
        <div className="text-xs text-ink-faint">
          {positivo ? "Ganancia" : "Pérdida"}
        </div>
        <div
          className={clsx(
            "font-display text-3xl font-semibold leading-none tnum",
            positivo ? "text-forest-600" : "text-clay-deep",
          )}
        >
          {money(r.ganancia)}
        </div>
        <div className="mt-1.5 text-sm text-ink-soft tnum">
          {money(r.gananciaPorAve)} por ave · margen {pct(r.margenPct)}
        </div>

        {reparto.socios.length > 0 && (
          <div className="mt-4 divide-y divide-line border-t border-line">
            {reparto.socios.map((s) => (
              <div key={s.nombre} className="flex items-baseline justify-between py-2.5">
                <span className="text-sm">
                  {s.nombre} <span className="text-ink-faint tnum">{pct(s.pct, 0)}</span>
                </span>
                <span
                  className={clsx(
                    "font-display text-lg font-semibold tnum",
                    s.monto >= 0 ? "text-forest-600" : "text-clay-deep",
                  )}
                >
                  {money(s.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <div>
            <div className="font-display text-base font-semibold leading-none tnum">
              {num(r.avesVendidas)}
            </div>
            <div className="mt-1 text-xs text-ink-faint">Aves vendidas</div>
          </div>
          <div>
            <div className="font-display text-base font-semibold leading-none tnum">
              {r.pesoPromedioLb != null
                ? `${num(r.pesoPromedioLb, 2)} lb`
                : "—"}
            </div>
            <div className="mt-1 text-xs text-ink-faint">Peso por ave</div>
          </div>
          <div>
            <div className="font-display text-base font-semibold leading-none tnum">
              {r.precioLogradoLb != null ? porLb(r.precioLogradoLb) : "—"}
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              Precio logrado
            </div>
          </div>
        </div>
      </Banda>

      {r.contrastes.length > 0 && (
        <>
          <p className="mb-2 mt-3 text-xs text-ink-faint">
            Lo que decía la app el día que cerraste, contra lo que pasó de
            verdad.
          </p>
          <Banda className="divide-y divide-line">
            {r.contrastes.map((c) => (
              <Contrastada key={c.etiqueta} c={c} />
            ))}
          </Banda>
        </>
      )}
    </>
  );
}

function Contrastada({ c }: { c: Contraste }) {
  const dif =
    c.proyectado !== 0
      ? ((c.real - c.proyectado) / Math.abs(c.proyectado)) * 100
      : 0;
  const notable = Math.abs(dif) >= 2;
  const buena =
    c.mejorSi === "mayor"
      ? dif > 0
      : c.mejorSi === "menor"
        ? dif < 0
        : undefined;
  const valor = (v: number) =>
    c.formato === "dinero"
      ? money(v, { compact: true })
      : c.formato === "precio"
        ? porLb(v)
        : c.formato === "peso"
          ? `${num(v, 2)} lb`
          : num(v);

  return (
    <div className="flex items-center justify-between px-5 py-2.5 text-sm">
      <span className="min-w-0 text-ink-soft">
        {c.etiqueta}
        {notable && buena != null && (
          <span
            className={clsx(
              "ml-1.5 text-xs font-semibold tnum",
              buena ? "text-forest-600" : "text-clay-text",
            )}
          >
            {dif > 0 ? "▲" : "▼"} {num(Math.abs(dif), 0)}%
          </span>
        )}
      </span>
      <span className="flex shrink-0 gap-4 tnum">
        <span className="w-[84px] text-right text-ink-faint">
          {valor(c.proyectado)}
        </span>
        <span className="w-[84px] text-right font-display font-semibold">
          {valor(c.real)}
        </span>
      </span>
    </div>
  );
}

function PrecioMinimo({
  lote,
  registros,
  gastos,
  metrics,
}: {
  lote: Lote;
  registros: Registro[];
  gastos: Gasto[];
  metrics: LoteMetrics;
}) {
  if (lote.estado !== "activo") return null;
  const objetivo = pesoObjetivoDe(lote);
  const p = proyectarVenta(lote, registros, gastos, metrics, objetivo);
  const a = analizarPrecio(lote, gastos, metrics, p);
  const precioAlim = precioAlimentoLb(lote, gastos, metrics);

  if (!a)
    return (
      <>
        <Seccion className="mb-3 mt-8" etiqueta="A cómo vender" />
        <Banda className="px-5 py-4 text-sm text-ink-faint">
          Pesa unas aves para saber cuántas libras vas a vender; con eso se
          calcula el precio mínimo por libra.
        </Banda>
      </>
    );

  const lbPorAve = a.lbEnPie / Math.max(1, a.aves);

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="A cómo vender"
        nota={
          <>
            Sobre el cierre proyectado: {num(a.lbEnPie)} lb de {num(a.aves)} aves
            {!p
              ? ", con lo gastado hasta hoy."
              : p.listo
                ? ", vendiendo ya."
                : `, vendiendo el ${fecha(p.fechaEstimada)} (día ${p.diaVenta}). ${notaAlimento(p)}`}
          </>
        }
        accion={
          <label className="flex items-center gap-1.5 text-xs text-ink-faint">
            Tu precio
            <input
              type="number"
              inputMode="decimal"
              defaultValue={lote.precioVentaLb ?? ""}
              onBlur={(e) =>
                db.lotes.update(lote.id, {
                  precioVentaLb: Number(e.target.value) || undefined,
                })
              }
              className="h-11 w-20 rounded-xl border border-line bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
            />
            /lb
          </label>
        }
      />

      <Banda className="px-5 py-4">
        <div className="text-xs text-ink-faint">
          Precio mínimo para no perder
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold leading-none tnum">
            <AnimatedNumber value={a.precioEquilibrioLb} format={porLb} />
          </span>
          <span className="text-sm text-ink-soft">/ lb</span>
        </div>
        <div className="mt-1.5 text-sm text-ink-soft tnum">
          = {money(a.precioEquilibrioAve)} por pollo de {num(lbPorAve, 2)} lb
        </div>
        <div className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
          De cada libra que vendas, {porLb(a.costoAlimento / a.lbEnPie)} son
          alimento ({pct(a.alimentoPctDelCosto, 0)} del costo),{" "}
          {porLb(a.costoAves / a.lbEnPie)} el pollito y{" "}
          {porLb(a.costoOtros / a.lbEnPie)} lo demás. Cada {money(1)} de más por
          libra son{" "}
          <span className="font-semibold text-ink-soft">
            {money(a.gananciaPorPesoDeMas)}
          </span>{" "}
          de ganancia.
        </div>
      </Banda>

      <Banda className="mt-3 divide-y divide-line">
        {[...a.escalones, ...(a.actual ? [a.actual] : [])]
          .sort((x, y) => x.precioLb - y.precioLb)
          .map((e, i) => (
            <div
              key={e.etiqueta}
              style={{ animationDelay: `${i * 45}ms` }}
              className={clsx(
                "animate-rise flex items-center justify-between px-5 py-2.5",
                e.esActual && "bg-forest-50",
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{e.etiqueta}</div>
                <div className="text-xs text-ink-faint tnum">
                  {money(e.precioPorAve)} por pollo
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <span className="font-display text-base font-semibold tnum">
                  {porLb(e.precioLb)}
                  <span className="text-xs font-normal text-ink-faint">
                    /lb
                  </span>
                </span>
                <span
                  className={clsx(
                    "w-[84px] font-display text-base font-semibold tnum",
                    e.ganancia >= 0 ? "text-forest-600" : "text-clay-deep",
                  )}
                >
                  {money(e.ganancia, { compact: true })}
                </span>
              </div>
            </div>
          ))}
      </Banda>
      {p && p.sobranteLb >= 50 && precioAlim > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-ink-faint tnum">
          Al vender te sobrarían {num(p.sobranteLb / LB_POR_QUINTAL, 1)} qq (
          {money(p.sobranteLb * precioAlim)}). Están en el precio mínimo porque
          ya los pagaste; si los usas en el próximo ciclo, el mínimo de este
          baja a {porLb(Math.max(0, a.costoNeto - p.sobranteLb * precioAlim) / a.lbEnPie)}.
        </p>
      )}
      {a.actual && (
        <p className="mt-2 text-xs text-ink-faint">
          {a.actual.ganancia >= 0
            ? `A ${porLb(a.actual.precioLb)}/lb vendes ${pct(a.actual.sobreEquilibrioPct, 0)} por encima del equilibrio: ${money(a.actual.gananciaPorAve)} por pollo.`
            : `A ${porLb(a.actual.precioLb)}/lb estás vendiendo por debajo del costo: pierdes ${money(-a.actual.gananciaPorAve)} por pollo.`}
        </p>
      )}
    </>
  );
}

// Lo que falta de alimento hasta la venta, separando lo que ya está en el
// almacén (pagado) de lo que hay que comprar.
function notaAlimento(p: Proyeccion): string {
  const qq = (lb: number) => num(lb / LB_POR_QUINTAL, 1);
  if (p.sinPrecioAlimento)
    return `Faltan ${qq(p.alimentoPorComprarLb)} qq de alimento; sin su precio, lo que cuestan se estima con lo que llevas gastando por día, sin los pollitos. Anota los quintales de cada compra de alimento para afinarlo.`;
  if (p.existenciaLb <= 0)
    return `Hasta entonces hay que comprar ${qq(p.alimentoPorComprarLb)} qq más de alimento.`;
  if (p.alimentoPorComprarLb <= 0)
    return `Se comerán ${qq(p.alimentoRestanteLb)} qq más y alcanzan con los ${qq(p.existenciaLb)} del almacén, que ya están pagados.`;
  return `Se comerán ${qq(p.alimentoRestanteLb)} qq más: ${qq(p.existenciaLb)} ya están en el almacén y pagados, y faltan ${qq(p.alimentoPorComprarLb)} por comprar.`;
}

function PuntoOptimo({
  lote,
  registros,
  gastos,
  metrics,
}: {
  lote: Lote;
  registros: Registro[];
  gastos: Gasto[];
  metrics: LoteMetrics;
}) {
  const [foco, setFoco] = useState<number>();
  if (lote.estado !== "activo") return null;
  const a = analizarPuntoOptimo(lote, registros, gastos, metrics);
  if (!a)
    return (
      <>
        <Seccion
          className="mt-8"
          etiqueta="Punto de venta"
          titulo="Todavía no se puede calcular hasta qué día conviene"
        />
        <Banda className="mt-3 px-5 py-4 text-sm text-ink-faint">
          Necesita tu precio de venta por libra, el precio del quintal y al
          menos un pesaje para decirte hasta qué día vale la pena engordar.
        </Banda>
      </>
    );

  const faltan = a.optimo.dia - metrics.dias;
  const marginalHoy = a.puntos[1]?.costoLbMarginal ?? 0;
  const punto = a.puntos[foco ?? 0];

  return (
    <>
      <Seccion
        className="mt-8"
        etiqueta="Punto de venta"
        titulo={
          faltan > 0
            ? `Te conviene esperar hasta el día ${a.optimo.dia}`
            : `El mejor día era el ${a.optimo.dia} y ya pasó`
        }
        nota="Cada día extra el pollo convierte peor. Este es el día en que la ganancia deja de subir."
      />

      <Banda className="mt-3 px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-ink-faint">Mejor día para vender</div>
            <div className="font-display text-2xl font-semibold leading-none tnum">
              Día {a.optimo.dia}
            </div>
            <div className="mt-1 text-sm text-ink-soft tnum">
              {fecha(a.optimo.fecha)} ·{" "}
              {faltan > 0
                ? `en ${faltan} ${plural(faltan, "día", "días")}`
                : "ya pasó"}{" "}
              · {num(a.optimo.pesoLb, 2)} lb/ave
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-ink-faint">Ganancia</div>
            <div
              className={clsx(
                "font-display text-lg font-semibold leading-none tnum",
                a.optimo.ganancia >= 0 ? "text-forest-600" : "text-clay-deep",
              )}
            >
              {money(a.optimo.ganancia, { compact: true })}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <GraficaLineas
            x={a.puntos.map((p) => p.dia)}
            series={[{ datos: a.puntos.map((p) => Math.round(p.ganancia)) }]}
            alto={160}
            marca={{ x: a.optimo.dia, texto: "el mejor día" }}
            referencia={{ valor: 0, texto: "Equilibrio" }}
            formatoY={(v) => numCompacto(v)}
            etiquetaX={(v) => `d${v}`}
            foco={foco}
            onFoco={setFoco}
            resumen={`Ganancia proyectada del día ${a.puntos[0].dia} al ${a.puntos[a.puntos.length - 1].dia}; el máximo cae el día ${a.optimo.dia}.`}
          />
          <p className="mt-1 text-center text-xs text-ink-faint tnum">
            {foco != null
              ? `Día ${punto.dia} · ${num(punto.pesoLb, 2)} lb · ${money(punto.ganancia)}`
              : "Arrastra el dedo por la gráfica para ver cualquier día"}
          </p>
        </div>
      </Banda>

      <Banda className="mt-3 divide-y divide-line">
        <FilaDato
          label="Esperar hasta ahí"
          value={faltan > 0 ? `+${money(a.gananciaExtra)}` : "Ya lo pasaste"}
          valueClass={a.gananciaExtra > 0 ? "text-forest-600" : undefined}
        />
        <FilaDato
          label="La próxima libra te cuesta"
          value={`${porLb(marginalHoy)} de ${porLb(a.precioVentaLb)}`}
          valueClass={
            marginalHoy > a.precioVentaLb ? "text-clay-deep" : "text-forest-600"
          }
        />
        {a.diaCruce != null && (
          <FilaDato
            label="Deja de convenir"
            value={`día ${a.diaCruce}`}
            valueClass="text-clay-deep"
          />
        )}
        {a.excedeObjetivo && (
          <FilaDato
            label={`Si topan en ${num(a.objetivoLb, 1)} lb`}
            value={`día ${a.tope.dia} · ${money(a.tope.ganancia, { compact: true })}`}
          />
        )}
      </Banda>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        {a.excedeObjetivo
          ? `El día ${a.optimo.dia} sale un pollo de ${num(a.optimo.pesoLb, 2)} lb: solo conviene si te lo pagan a ${money(a.precioVentaLb)} la libra igual que uno de ${num(a.objetivoLb, 1)} lb. `
          : ""}
        Cuenta el alimento de los días extra y la mortalidad que falta por
        ocurrir. Si pagas mano de obra por día, el mejor día es un poco antes
        del que sale aquí.
      </p>
    </>
  );
}

function FilaDato({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <span className="text-ink-faint">{label}</span>
      <span
        className={
          "text-right font-display font-semibold tnum " + (valueClass ?? "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function GridCrecimiento({ metrics: m }: { metrics: LoteMetrics }) {
  const gananciaDiaria =
    m.pesoEstimadoLb != null && m.dias > 0
      ? m.pesoEstimadoLb / m.dias
      : undefined;

  const celdas = [
    {
      label: "Ganancia diaria",
      value: gananciaDiaria != null ? `${num(gananciaDiaria, 3)} lb` : "—",
    },
    { label: "Conversión (FCA)", value: m.fca != null ? num(m.fca, 2) : "—" },
    {
      label: "Índice de eficiencia",
      value: m.iep != null ? num(m.iep, 0) : "—",
    },
  ];
  return (
    <Banda className="mt-4 grid grid-cols-3 gap-3 px-5 py-4">
      {celdas.map((c) => (
        <div key={c.label}>
          <div className="font-display text-lg font-semibold tnum leading-none">
            {c.value}
          </div>
          <div className="mt-1 text-xs text-ink-faint">{c.label}</div>
        </div>
      ))}
    </Banda>
  );
}

function Diagnostico({ metrics: m }: { metrics: LoteMetrics }) {
  const j = juicioFca(m);
  if (m.fca == null || !j) return null;
  if (j.estado === "dudosoBajo" || j.estado === "dudosoAlto")
    return (
      <div className="mt-6 rounded-xl2 border-l-4 border-amber-400 bg-amber-tint p-4">
        <div className="font-display text-base font-semibold text-amber-text">
          La conversión no cuadra
        </div>
        <p className="mt-1 text-sm leading-relaxed text-amber-text">
          {j.estado === "dudosoBajo"
            ? `Sale en ${num(m.fca, 2)}, y al día ${j.dia} Cobb 500 da ${num(j.estandar, 2)}: ningún lote convierte tanto mejor. Falta alimento por anotar; cuenta los sacos que quedan y la app saca lo que se dio.`
            : `Sale en ${num(m.fca, 2)}, más del doble de Cobb 500 al día ${j.dia} (${num(j.estandar, 2)}). Revisa el alimento anotado: ¿libras donde iban sacos?`}{" "}
          Mientras no cuadre, la proyección usa el consumo del estándar.
        </p>
      </div>
    );
  if (j.dia < 21 || m.fca <= j.estandar + 0.15) return null;
  return (
    <div className="mt-6 rounded-xl2 border-l-4 border-amber-400 bg-amber-tint p-4">
      <div className="font-display text-base font-semibold text-amber-text">
        La conversión va por encima del estándar
      </div>
      <p className="mt-1 text-sm leading-relaxed text-amber-text">
        Con FCA {num(m.fca, 2)} (Cobb 500 al día {j.dia}: {num(j.estandar, 2)}) las
        aves comen de más por cada libra que ganan. Revisa desperdicio en
        comederos, densidad y temperatura del galpón antes del día 35.
      </p>
    </div>
  );
}

function FaseActual({
  lote,
  gastos,
  metrics,
}: {
  lote: Lote;
  gastos: Gasto[];
  metrics: LoteMetrics;
}) {
  const plan = computePlanAlimento(lote, metrics);
  if (!plan?.faseActual) return null;
  const f = plan.faseActual;
  const inv = computeInventarioAlimento(gastos, metrics, plan.totalQuintales);
  const quedan = inv?.completo ? inv.existenciaQq : undefined;
  const aprox = inv?.completo && inv.diasSinAnotar > 0;

  return (
    <Link
      to={`/lotes/${lote.id}/ficha/alimento`}
      className="mt-5 flex items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 transition active:scale-[0.99]"
    >
      <div className="min-w-0">
        <div className="text-xs text-ink-faint">Alimento de esta fase</div>
        <div className="font-display text-lg font-semibold leading-tight">
          {f.nombre}
        </div>
        <div className="text-sm text-ink-soft">
          {f.proteinaPct}% proteína · {f.presentacion.toLowerCase()}
        </div>
        {plan.proximoCambio && (
          <div className="text-xs text-ink-faint">
            Cambia en {plan.proximoCambio.enDias}{" "}
            {plural(plan.proximoCambio.enDias, "día", "días")}
          </div>
        )}
      </div>
      {quedan != null && (
        <div className="shrink-0 text-right">
          <div
            className={
              "font-display text-lg font-semibold leading-none tnum " +
              (inv!.diasQueAlcanza <= 3 ? "text-clay-deep" : "")
            }
          >
            {aprox ? "~" : ""}
            {num(Math.max(0, quedan), 1)} qq
          </div>
          <div className="mt-0.5 text-xs text-ink-faint">
            {aprox ? "sin contar" : "en el galpón"}
          </div>
        </div>
      )}
    </Link>
  );
}

function GuiaDelDia({
  lote,
  metrics,
  unidad,
}: {
  lote: Lote;
  metrics: LoteMetrics;
  unidad: "qq" | "lb";
}) {
  const g = computeGuiaDia(lote, metrics);
  if (!g) return null;
  const desv = g.desviacionPct;
  const stats = [
    { label: "Alimento hoy", value: alimentoEn(g.alimentoDiaLb, unidad) },
    {
      label: "Alimento acum.",
      value:
        unidad === "qq"
          ? `${num(g.alimentoAcumLb / LB_POR_QUINTAL, 1)} qq`
          : `${num(g.alimentoAcumLb)} lb`,
    },
    { label: "FCA esperado", value: num(g.fcaEsperado, 2) },
    { label: "Temperatura", value: `${g.tempC} °C` },
    {
      label: "Agua hoy",
      value:
        g.aguaRealL != null
          ? `${num(g.aguaRealL)} L`
          : `~${num(g.aguaLitrosDia)} L`,
    },
    { label: "Mort. esperada", value: pct(g.mortalidadEsperadaPct, 1) },
  ];
  return (
    <>
      <Seccion className="mb-3 mt-8" etiqueta="Hoy" titulo={`Guía del día ${g.dia}`} />
      <Banda className="px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-ink-faint">Peso ideal hoy</div>
            <div className="font-display text-2xl font-semibold tnum leading-none">
              {num(g.pesoObjetivoLb, 2)} lb
            </div>
          </div>
          {desv != null && g.pesoRealLb != null && (
            <div className="text-right">
              <div className="text-xs text-ink-faint">
                {g.pesoEstimado ? "Tu lote (est.)" : "Tu lote"}
              </div>
              <div
                className={
                  "font-display text-lg font-semibold tnum leading-none " +
                  (desv >= -3 ? "text-forest-600" : "text-clay-deep")
                }
              >
                {num(g.pesoRealLb, 2)} lb
              </div>
              <div
                className={
                  "text-xs tnum " +
                  (desv >= -3 ? "text-forest-600" : "text-clay-deep")
                }
              >
                {desv >= 0 ? "+" : ""}
                {pct(desv, 0)}
              </div>
              {g.pesoEstimado && (
                <div className="text-xs text-ink-faint tnum">
                  pesado hace {g.diasDesdePeso} días
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-line pt-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-base font-semibold tnum leading-none">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-ink-faint">{s.label}</div>
            </div>
          ))}
        </div>
      </Banda>
    </>
  );
}

function Sociedad({
  lote,
  registros,
  gastos,
  ingresos,
  entregas,
  metrics,
  settings,
}: {
  lote: Lote;
  registros: Registro[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  entregas: EntregaSocio[];
  metrics: LoteMetrics;
  settings: Settings;
}) {
  const [hoja, setHoja] = useState(false);
  const [sugerida, setSugerida] = useState<{ de: number; a: number; monto: number }>();
  const [editar, setEditar] = useState<EntregaSocio>();
  const liq = computeLiquidacion(lote, gastos, ingresos, metrics, entregas);
  if (!liq) return null;
  const socios = lote.socios!;
  const nombre = (i: number) =>
    socios[i] ? nombreSocio(socios[i], i) : `Socio ${i + 1}`;

  // Antes de vender, lo que cada uno se llevaría si la venta sale como la
  // proyección: la ganancia de hoy es solo lo gastado con signo negativo.
  const proyeccion =
    lote.estado === "activo" && !liq.conVentas
      ? proyectarVenta(
          lote,
          registros,
          gastos,
          metrics,
          pesoObjetivoDe(lote),
        )
      : null;
  const estimada = proyeccion?.gananciaProyectada;

  const parejos = liq.traspasos.length === 0;
  const [antes, despues] = parejos
    ? ["", ""]
    : fraseEntrega(liq.traspasos[0].de, liq.traspasos[0].a);
  const titulo = parejos
    ? liq.conVentas
      ? "La cuenta está pareja"
      : "Van parejos"
    : liq.traspasos.length === 1
      ? `${antes}${money(liq.traspasos[0].monto)}${despues}`
      : `Faltan ${num(liq.traspasos.length)} entregas para quedar parejos`;
  // Lo vendido a crédito que no ha entrado no lo tiene nadie: la cuenta lo
  // espera, y se dice para que nadie pida lo que todavía no se cobra.
  const nota =
    (liq.conVentas
      ? `Cada uno recupera lo que puso y se queda con su parte de la ganancia, ${liq.acuerdo}.`
      : `Lo que ha puesto cada uno, para seguir ${liq.acuerdo} con los gastos.`) +
    (liq.porCobrar >= 1
      ? ` Faltan ${money(liq.porCobrar)} por cobrar de ventas a crédito: cuando entren, la cuenta se pone al día.`
      : "");

  function anotar(t?: Traspaso) {
    setEditar(undefined);
    setSugerida(t ? { de: t.deIdx, a: t.aIdx, monto: t.monto } : undefined);
    setHoja(true);
  }

  function compartir() {
    const L = [
      `${settings.granja} — Cuenta de la sociedad`,
      `${lote.nombre} · ${lote.estado === "cerrado" ? "ciclo cerrado" : `día ${metrics.dias}`}`,
      "",
    ];
    if (liq!.conVentas) {
      L.push(
        `Ventas: ${money(liq!.ingresos)}`,
        `Costos: ${money(liq!.costos)}`,
        `${liq!.ganancia >= 0 ? "Ganancia" : "Pérdida"}: ${money(liq!.ganancia)}`,
      );
      if (liq!.porCobrar >= 1)
        L.push(`Por cobrar de ventas a crédito: ${money(liq!.porCobrar)}`);
    }
    else L.push(`Gastado hasta hoy: ${money(liq!.costos)}`);
    for (const s of liq!.socios) {
      L.push("", `${s.nombre} (${pct(s.pct, 0)})`, `  Puso: ${money(s.aporte)}`);
      if (liq!.conVentas) L.push(`  Cobró de las ventas: ${money(s.cobrado)}`);
      else L.push(`  Le toca poner: ${money(s.leTocaPoner)}`);
      if (s.recibido > 0) L.push(`  Recibió de los socios: ${money(s.recibido)}`);
      if (s.entregado > 0) L.push(`  Entregó a los socios: ${money(s.entregado)}`);
      if (liq!.conVentas)
        L.push(
          `  ${s.corresponde >= 0 ? "Su ganancia" : "Su pérdida"}: ${money(s.corresponde)}`,
        );
      else if (estimada != null)
        L.push(`  Ganancia estimada: ${money((estimada * s.pct) / 100)}`);
    }
    if (entregas.length > 0) {
      L.push("", "Entregas hechas:");
      for (const e of entregas) {
        const [x, y] = fraseEntrega(nombre(e.de), nombre(e.a), {
          voz: "propia",
          hecha: true,
        });
        L.push(`  ${fecha(e.fecha)}: ${x}${money(e.monto)}${y}`);
      }
    }
    L.push("");
    if (parejos) L.push("La cuenta está pareja.");
    else {
      L.push(
        liq!.conVentas ? "Para quedar parejos:" : `Para seguir ${liq!.acuerdo}:`,
      );
      for (const t of liq!.traspasos) {
        const [x, y] = fraseEntrega(t.de, t.a, { voz: "propia" });
        L.push(`  ${x}${money(t.monto)}${y}`);
      }
    }
    const text = L.join("\n");
    if (navigator.share)
      navigator
        .share({ title: `Cuenta de la sociedad · ${lote.nombre}`, text })
        .catch(() => {});
    else {
      navigator.clipboard?.writeText(text);
      toast("Cuenta copiada.");
    }
  }

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Sociedad"
        titulo={titulo}
        nota={nota}
      />

      {!parejos && (
        <div className="mb-4 space-y-2">
          {liq.traspasos.map((t, i) => {
            const [x, y] = fraseEntrega(t.de, t.a);
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-forest-400/30 bg-forest-50 py-2 pl-3.5 pr-2"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-forest-800">
                  {liq.traspasos.length === 1 ? (
                    "Cuando se entregue, anótalo y la cuenta queda al día."
                  ) : (
                    <>
                      {x}
                      <span className="font-semibold tnum">{money(t.monto)}</span>
                      {y}
                    </>
                  )}
                </span>
                <button
                  onClick={() => anotar(t)}
                  className="h-11 shrink-0 rounded-full bg-forest-600 px-4 text-sm font-semibold text-paper-raised transition active:scale-[0.97]"
                >
                  Ya se entregó
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Banda className="divide-y divide-line">
        {liq.socios.map((s, i) => (
          <CuentaSocio
            key={i}
            s={s}
            otros={
              socios.length === 2 ? nombre(i === 0 ? 1 : 0) : "los socios"
            }
            conVentas={liq.conVentas}
            costos={liq.costos}
            estimada={estimada != null ? (estimada * s.pct) / 100 : undefined}
          />
        ))}
      </Banda>
      {estimada != null && (
        <p className="mt-2 text-xs text-ink-faint">
          Lo estimado sale de vender al peso objetivo a{" "}
          {porLb(lote.precioVentaLb ?? 0)} la libra.
        </p>
      )}

      {entregas.length > 0 && (
        <>
          <div className="mb-2 mt-5 text-xs font-medium text-ink-faint">
            Entregas anotadas · toca una para corregirla
          </div>
          <Banda className="divide-y divide-line">
            {[...entregas].reverse().map((e) => {
              const [x, y] = fraseEntrega(nombre(e.de), nombre(e.a), {
                hecha: true,
              });
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    setSugerida(undefined);
                    setEditar(e);
                    setHoja(true);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 px-5 py-3 text-left text-sm transition active:bg-paper-sunken"
                >
                  <span className="min-w-0">
                    <span className="block">
                      {x.trim()}
                      {y}
                    </span>
                    <span className="block text-xs text-ink-faint tnum">
                      {fecha(e.fecha)}
                      {e.nota ? ` · ${e.nota}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-display font-semibold tnum">
                    {money(e.monto)}
                  </span>
                </button>
              );
            })}
          </Banda>
        </>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => anotar(liq.traspasos[0])}>
          Anotar entrega
        </Button>
        <Button variant="soft" onClick={compartir}>
          Compartir
        </Button>
      </div>

      <EntregaSheet
        lote={lote}
        gastos={gastos}
        ingresos={ingresos}
        metrics={metrics}
        entregas={entregas}
        open={hoja}
        onClose={() => setHoja(false)}
        editar={editar}
        sugerida={sugerida}
      />
    </>
  );
}

// La cuenta de un socio en dos renglones que se restan: lo que le toca contra
// lo que ya tiene (o, antes de vender, lo que le toca poner contra lo que ha
// puesto). Al socio que se llama «Yo» se le habla de tú.
function CuentaSocio({
  s,
  otros,
  conVentas,
  costos,
  estimada,
}: {
  s: SocioBalance;
  otros: string;
  conVentas: boolean;
  costos: number;
  estimada?: number;
}) {
  const tu = esYo(s.nombre);
  const t = (aTi: string, aEl: string) => (tu ? aTi : aEl);
  const parejo = Math.abs(s.ajuste) < 1;
  const movimientos = [
    s.recibido > 0 && `${t("recibiste", "recibió")} ${money(s.recibido)} de ${otros}`,
    s.entregado > 0 && `${t("entregaste", "entregó")} ${money(s.entregado)} a ${otros}`,
  ].filter(Boolean);

  const renglones = conVentas
    ? [
        {
          label: t("Te toca", "Le toca"),
          valor: s.aporte + s.corresponde,
          detalle:
            s.corresponde >= 0
              ? `${t("pusiste", "puso")} ${money(s.aporte)} + ${money(s.corresponde)} de ganancia`
              : `${t("pusiste", "puso")} ${money(s.aporte)} − ${money(-s.corresponde)} de pérdida`,
        },
        {
          label: t("Ya tienes", "Ya tiene"),
          valor: s.cobrado + s.recibido - s.entregado,
          detalle:
            [
              s.cobrado > 0 && `${t("cobraste", "cobró")} ${money(s.cobrado)} de ventas`,
              ...movimientos,
            ]
              .filter(Boolean)
              .join(" · ") || t("no has cobrado nada", "no ha cobrado nada"),
        },
      ]
    : [
        {
          label: t("Te toca poner", "Le toca poner"),
          valor: s.leTocaPoner,
          detalle: `${pct(s.pct, 0)} de ${money(costos)} gastados`,
        },
        {
          label: t("Has puesto", "Ha puesto"),
          valor: s.aporte + s.entregado - s.recibido,
          detalle: movimientos.length
            ? [`${t("pagaste", "pagó")} ${money(s.aporte)}`, ...movimientos].join(" · ")
            : "en pollitos y gastos",
        },
      ];

  const resultado = parejo
    ? t("Estás a la par", "Está a la par")
    : conVentas
      ? s.ajuste > 0
        ? `${t("Te falta", "Le falta")} recibir ${money(s.ajuste)}`
        : `${t("Tienes", "Tiene")} ${money(-s.ajuste)} de más`
      : s.ajuste > 0
        ? `${t("Pusiste", "Puso")} ${money(s.ajuste)} de más`
        : `${t("Te falta", "Le falta")} poner ${money(-s.ajuste)}`;
  const bien = parejo || s.ajuste > 0;

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-semibold">{s.nombre}</div>
          <div className="text-xs text-ink-faint tnum">{pct(s.pct, 0)} de la sociedad</div>
        </div>
        {conVentas ? (
          <div className="shrink-0 text-right">
            <div className="text-xs text-ink-faint">
              {s.corresponde >= 0
                ? t("Tu ganancia", "Su ganancia")
                : t("Tu pérdida", "Su pérdida")}
            </div>
            <div
              className={clsx(
                "font-display text-xl font-semibold leading-tight tnum",
                s.corresponde >= 0 ? "text-forest-600" : "text-clay-deep",
              )}
            >
              {money(s.corresponde)}
            </div>
          </div>
        ) : estimada != null ? (
          <div className="shrink-0 text-right">
            <div className="text-xs text-ink-faint">
              {estimada >= 0 ? "Ganancia estimada" : "Pérdida estimada"}
            </div>
            <div
              className={clsx(
                "font-display text-xl font-semibold leading-tight tnum",
                estimada >= 0 ? "text-ink-soft" : "text-clay-deep",
              )}
            >
              ≈ {money(estimada)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {renglones.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-ink-soft">{r.label}</div>
              <div className="text-xs text-ink-faint tnum">{r.detalle}</div>
            </div>
            <div className="shrink-0 font-display font-semibold tnum">
              {money(r.valor)}
            </div>
          </div>
        ))}
      </div>

      <div
        className={clsx(
          "mt-3 border-t border-line pt-2.5 text-sm font-semibold tnum",
          bien ? "text-forest-700" : "text-clay-deep",
        )}
      >
        {parejo ? "✓ " : ""}
        {resultado}
      </div>
    </div>
  );
}

function Desvio({ lote, registros }: { lote: Lote; registros: Registro[] }) {
  const [foco, setFoco] = useState<number>();
  const conPeso = registros
    .filter((r) => r.pesoPromedio != null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (conPeso.length === 0) return null;

  const puntos = conPeso.map((r) => {
    const dia = diasEntre(lote.fechaInicio, r.fecha);
    const std = pesoEstandarLb(dia);
    return { dia, peso: r.pesoPromedio!, std, desvio: (r.pesoPromedio! / std - 1) * 100 };
  });
  const ultimo = puntos[puntos.length - 1];
  const punto = puntos[foco ?? puntos.length - 1];

  const peor = puntos.reduce((p, q, i) => (q.desvio < puntos[p].desvio ? i : p), 0);
  const nota =
    peor !== puntos.length - 1 && Math.abs(puntos[peor].desvio) >= 5
      ? {
          indice: peor,
          texto: `${pct(puntos[peor].desvio, 0)} el día ${puntos[peor].dia}`,
        }
      : undefined;

  return (
    <>
      <Seccion
        etiqueta="Crecimiento"
        titulo={tituloDesvio(puntos)}
        className="mt-8"
      />
      <Banda className="mt-3 px-5 py-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-ink-faint">
              {foco != null ? `Día ${punto.dia}` : `Último pesaje · día ${punto.dia}`}
            </div>
            <div className="font-display text-2xl font-semibold leading-none tnum">
              {num(punto.peso, 2)} lb
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-faint">Le toca</div>
            <div className="font-display text-xl font-semibold leading-none tnum text-ink-soft">
              {num(punto.std, 2)} lb
            </div>
            <div
              className={clsx(
                "mt-0.5 text-xs font-medium tnum",
                punto.desvio >= 0 ? "text-forest-600" : "text-clay-deep",
              )}
            >
              {punto.desvio >= 0 ? "▲" : "▼"} {pct(Math.abs(punto.desvio), 0)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <GraficaLineas
            x={puntos.map((p) => p.dia)}
            series={[{ datos: puntos.map((p) => p.desvio), puntos: true }]}
            alto={190}
            banda="signo"
            referencia={{ valor: 0, texto: RAZA }}
            nota={nota}
            formatoY={(v) => `${v > 0 ? "+" : ""}${num(v, 0)}%`}
            etiquetaX={(v) => `d${v}`}
            foco={foco}
            onFoco={setFoco}
            resumen={`Desvío del peso contra el estándar ${RAZA}, del día ${puntos[0].dia} al ${ultimo.dia}.`}
          />
        </div>
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
          La línea del centro es el {RAZA}. Arriba es lo que le sacas de ventaja;
          abajo, lo que le falta. Arrastra el dedo para ver cualquier pesaje.
        </p>
      </Banda>
    </>
  );
}

// El titular dice la conclusión, no el nombre del gráfico: en libras absolutas
// un 18 % de atraso el día 7 son 0.07 lb y el día 34 son 0.97 lb, así que la
// curva de peso hacía ver como creciente un problema que venía igual desde el
// principio.
function tituloDesvio(puntos: { dia: number; desvio: number }[]) {
  const ultimo = puntos[puntos.length - 1];
  if (Math.abs(ultimo.desvio) < 3) return `Vas al día con el ${RAZA}`;
  const frase = `${pct(Math.abs(ultimo.desvio), 0)} por ${ultimo.desvio > 0 ? "encima" : "debajo"} del ${RAZA}`;
  const primero = puntos[0];
  const vieneDeAntes =
    puntos.length > 1 &&
    Math.abs(primero.desvio) >= 3 &&
    primero.desvio > 0 === ultimo.desvio > 0;
  return vieneDeAntes ? `${frase} desde el día ${primero.dia}` : frase;
}
