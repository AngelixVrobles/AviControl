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
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  db,
  type Gasto,
  type Ingreso,
  type Lote,
  type Pesaje,
  type Registro,
} from "../db/schema";
import { useLoteData, useSettings } from "../lib/hooks";
import { agruparGastos, type LoteMetrics } from "../lib/metrics";
import { proyectarVenta } from "../lib/proyeccion";
import { analizarPrecio } from "../lib/precios";
import { resultadoCiclo, type Contraste } from "../lib/cierre";
import { analizarPuntoOptimo } from "../lib/optimo";
import { analizarMuestra, tamanoMuestra } from "../lib/muestreo";
import { computeGuiaDia } from "../lib/guia";
import { computeInventarioAlimento, computePlanAlimento } from "../lib/plan";
import { computeLiquidacion } from "../lib/sociedad";
import { compartirReporte } from "../lib/reporte";
import {
  diasEntre,
  fecha,
  money,
  num,
  numCompacto,
  pct,
  plural,
  porLb,
} from "../lib/format";
import { categoriaLabel, RAZA, tipoIngresoLabel } from "../lib/labels";
import {
  PESO_OBJETIVO_DEFAULT,
  fcaEstandar,
  pesoEstandarLb,
} from "../lib/standards";
import { reduceMotion } from "../lib/motion";
import type { Settings } from "../lib/settings";
import { AlertaChip } from "../components/AlertaChip";
import { FichasNav } from "../components/FichasNav";
import { confirmar } from "../components/confirm";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Button, Card, Pill } from "../components/ui";
import {
  IconBack,
  IconMoney,
  IconPesa,
  IconPlus,
  IconScale,
  IconTrend,
} from "../components/icons";
import {
  ActionButton,
  CierreSheet,
  GastoSheet,
  IngresoSheet,
  PesajeSheet,
  RegistroSheet,
} from "../components/sheets";

type SheetKind = "registro" | "pesaje" | "gasto" | "ingreso" | "cierre" | null;
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
    metrics,
    alertas,
  } = data;
  const cerrado =
    lote.estado === "cerrado" && ingresos.some((i) => i.tipo === "aves");
  const gastosCat = agruparGastos(gastos);
  const positivo = metrics.ganancia >= 0;

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
    { label: "Alimento total", value: `${num(metrics.alimentoTotalLb)} lb` },
    {
      label: "Costo / lb",
      value: metrics.costoPorLb != null ? porLb(metrics.costoPorLb) : "—",
    },
    { label: "Aves vendidas", value: num(metrics.vendidas) },
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
            <span className="text-sm text-ink-soft">· {RAZA}</span>
            {lote.estado === "cerrado" && <Pill tone="neutral">Cerrado</Pill>}
          </div>
        </div>
      </header>

      {alertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {alertas.map((a, i) => (
            <AlertaChip key={i} alerta={a} />
          ))}
        </div>
      )}

      {lote.estado === "activo" && (
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
                className="relative flex-1 rounded-full py-2 text-sm font-semibold"
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
          <GuiaDelDia lote={lote} metrics={metrics} />
          <FaseActual lote={lote} gastos={gastos} metrics={metrics} />

          <h2 className="mb-1 mt-7 font-display text-lg font-semibold">
            Historial
          </h2>
          {registros.length === 0 ? (
            <p className="rounded-xl2 border border-dashed border-line bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-faint">
              Sin registros aún. Toca “Registrar día” para empezar.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-faint">
                Toca un día para corregirlo.
              </p>
              <Card className="divide-y divide-line">
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
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition active:bg-paper-sunken"
                    >
                      <span className="font-medium">{fecha(r.fecha)}</span>
                      <div className="flex items-center gap-3 text-ink-soft tnum">
                        {r.pesoPromedio != null && (
                          <span>{num(r.pesoPromedio, 2)} lb</span>
                        )}
                        {r.alimentoLb > 0 && (
                          <span className="text-ink-faint">
                            {num(r.alimentoLb)} lb alim.
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
              </Card>
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
          <CurvaEstandar lote={lote} registros={registros} />
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
          <Card className={clsx("mt-5 overflow-hidden", cerrado && "hidden")}>
            <div className="flex items-stretch">
              <div className="flex-1 p-4">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <IconTrend width={16} height={16} />
                  <span className="text-xs font-medium">
                    {positivo ? "Ganancia" : "Pérdida"}
                  </span>
                </div>
                <div
                  className={
                    "mt-1 font-display text-2xl font-semibold tracking-tight tnum leading-none " +
                    (positivo ? "text-forest-600" : "text-clay-deep")
                  }
                >
                  <AnimatedNumber
                    value={metrics.ganancia}
                    format={(n) => money(n)}
                  />
                </div>
                <div className="mt-1 text-xs text-ink-faint tnum">
                  Margen {pct(metrics.margenPct)}
                </div>
              </div>
              <div className="w-px bg-line" />
              <div className="grid flex-1 grid-rows-2">
                <div className="border-b border-line px-4 py-2.5">
                  <div className="text-xs text-ink-faint">Ingresos</div>
                  <div className="font-display text-lg font-semibold tnum leading-tight">
                    {money(metrics.ingresos)}
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-xs text-ink-faint">Costos</div>
                  <div className="font-display text-lg font-semibold tnum leading-tight">
                    {money(metrics.costos)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

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
            className="mt-7 flex items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 shadow-card transition active:scale-[0.99]"
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

          <Sociedad
            lote={lote}
            gastos={gastos}
            ingresos={ingresos}
            metrics={metrics}
            settings={settings}
          />

          {ingresos.length > 0 && (
            <>
              <h2 className="mb-1 mt-7 font-display text-lg font-semibold">
                Ventas
              </h2>
              <p className="mb-3 text-xs text-ink-faint">
                Toca una para corregirla.
              </p>
              <Card className="divide-y divide-line">
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
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition active:bg-paper-sunken"
                    >
                      <div>
                        <div className="font-medium">
                          {i.descripcion || tipoIngresoLabel(i.tipo)}
                        </div>
                        <div className="text-xs text-ink-faint tnum">
                          {fecha(i.fecha)}
                          {i.cantidad > 0 ? ` · ${num(i.cantidad)} aves` : ""}
                          {i.pesoLb ? ` · ${num(i.pesoLb)} lb` : ""}
                        </div>
                      </div>
                      <span className="font-display font-semibold text-forest-600 tnum">
                        +{money(i.monto)}
                      </span>
                    </button>
                  ))}
              </Card>
            </>
          )}

          <div className="mt-8 space-y-2">
            <Button
              block
              variant="soft"
              onClick={() =>
                compartirReporte(lote, metrics, settings.granja, kpis)
              }
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
        open={sheet === "ingreso"}
        onClose={() => setSheet(null)}
        editar={editIngreso}
      />
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
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Muestreo de peso</h2>
        <button
          onClick={onNuevo}
          className="text-sm font-semibold text-forest-600"
        >
          Pesar aves →
        </button>
      </div>

      {!m || !ultimo ? (
        <Card className="p-4">
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
        </Card>
      ) : (
        <>
          <Card className="p-4">
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
          </Card>

          {m.uniformidad === "despareja" && (
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Un lote desparejo (CV sobre 12 %) suele ser falta de comedero o
              bebedero por ave: las aves chicas no alcanzan. Revisa espacio y
              altura de los equipos.
            </p>
          )}

          {pesajes.length > 1 && (
            <Card className="mt-3 divide-y divide-line">
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
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition active:bg-paper-sunken"
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
            </Card>
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

  return (
    <>
      <h2 className="mb-3 mt-5 font-display text-lg font-semibold">
        Cómo salió el ciclo
      </h2>
      <Card className="p-4">
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
      </Card>

      {r.contrastes.length > 0 && (
        <>
          <p className="mb-2 mt-3 text-xs text-ink-faint">
            Lo que decía la app el día que cerraste, contra lo que pasó de
            verdad.
          </p>
          <Card className="divide-y divide-line">
            {r.contrastes.map((c) => (
              <Contrastada key={c.etiqueta} c={c} />
            ))}
          </Card>
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
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
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
  const objetivo = lote.pesoObjetivoLb ?? PESO_OBJETIVO_DEFAULT;
  const p = proyectarVenta(lote, registros, gastos, metrics, objetivo);
  const a = analizarPrecio(lote, gastos, metrics, p);

  if (!a)
    return (
      <>
        <h2 className="mb-3 mt-7 font-display text-lg font-semibold">
          ¿A cómo vender?
        </h2>
        <Card className="p-4 text-sm text-ink-faint">
          Pesa unas aves para saber cuántas libras vas a vender; con eso se
          calcula el precio mínimo por libra.
        </Card>
      </>
    );

  const lbPorAve = a.lbEnPie / Math.max(1, a.aves);

  return (
    <>
      <div className="mb-1 mt-7 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">¿A cómo vender?</h2>
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
      </div>
      <p className="mb-3 text-xs text-ink-faint">
        Sobre el cierre proyectado: {num(a.lbEnPie)} lb de {num(a.aves)} aves
        {p && !p.listo
          ? `, vendiendo el ${fecha(p.fechaEstimada)} (día ${p.diaVenta}) y comprando ${num(p.alimentoRestanteQuintales, 1)} qq más de alimento.`
          : ", con el alimento que falta comprar."}
      </p>

      <Card className="p-4">
        <div className="text-xs text-ink-faint">
          Precio mínimo para no perder
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold leading-none tnum">
            {porLb(a.precioEquilibrioLb)}
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
      </Card>

      <Card className="mt-3 divide-y divide-line">
        {[...a.escalones, ...(a.actual ? [a.actual] : [])]
          .sort((x, y) => x.precioLb - y.precioLb)
          .map((e) => (
            <div
              key={e.etiqueta}
              className={clsx(
                "flex items-center justify-between px-4 py-2.5",
                e.esActual && "bg-green-tint",
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
      </Card>
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
  if (lote.estado !== "activo") return null;
  const a = analizarPuntoOptimo(lote, registros, gastos, metrics);
  if (!a)
    return (
      <>
        <h2 className="mb-3 mt-7 font-display text-lg font-semibold">
          ¿Hasta qué día conviene?
        </h2>
        <Card className="p-4 text-sm text-ink-faint">
          Necesita tu precio de venta por libra, el precio del quintal y al
          menos un pesaje para decirte hasta qué día vale la pena engordar.
        </Card>
      </>
    );

  const faltan = a.optimo.dia - metrics.dias;
  const datos = a.puntos.map((p) => ({ x: p.dia, g: Math.round(p.ganancia) }));
  const marginalHoy = a.puntos[1]?.costoLbMarginal ?? 0;

  return (
    <>
      <h2 className="mb-1 mt-7 font-display text-lg font-semibold">
        ¿Hasta qué día conviene?
      </h2>
      <p className="mb-3 text-xs text-ink-faint">
        Cada día extra el pollo convierte peor. Aquí está el día en que la
        ganancia deja de subir.
      </p>

      <Card className="p-4">
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
          <ResponsiveContainer width="100%" height={150}>
            <LineChart
              data={datos}
              margin={{ top: 4, right: 6, left: -14, bottom: 0 }}
            >
              <CartesianGrid stroke="#EEEBE2" vertical={false} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 11, fill: "#5C6A61" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={44}
                tick={{ fontSize: 11, fill: "#5C6A61" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => numCompacto(Number(v))}
              />
              <Tooltip
                labelFormatter={(x) => `día ${x}`}
                formatter={(v) => [money(Number(v)), "Ganancia"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #E3DFD3",
                  background: "#FCFBF7",
                  fontSize: 13,
                  boxShadow: "0 8px 24px -12px rgba(27,43,34,0.2)",
                }}
              />
              <ReferenceLine
                x={a.optimo.dia}
                stroke="#1E7340"
                strokeDasharray="4 3"
              />
              <Line
                dataKey="g"
                stroke="#2F8A4C"
                strokeWidth={2.5}
                dot={false}
                animationDuration={600}
                isAnimationActive={!reduceMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-3 divide-y divide-line">
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
      </Card>
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
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
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
    <Card className="mt-4 grid grid-cols-3 gap-3 p-4">
      {celdas.map((c) => (
        <div key={c.label}>
          <div className="font-display text-lg font-semibold tnum leading-none">
            {c.value}
          </div>
          <div className="mt-1 text-xs text-ink-faint">{c.label}</div>
        </div>
      ))}
    </Card>
  );
}

function Diagnostico({ metrics: m }: { metrics: LoteMetrics }) {
  const std = fcaEstandar(m.dias);
  if (m.dias < 21 || m.fca == null || m.fca <= std + 0.15) return null;
  return (
    <div className="mt-6 rounded-xl2 border-l-4 border-amber-400 bg-amber-tint p-4">
      <div className="font-display text-base font-semibold text-amber-text">
        La conversión va por encima del estándar
      </div>
      <p className="mt-1 text-sm leading-relaxed text-amber-text">
        Con FCA {num(m.fca, 2)} (Cobb 500 al día {m.dias}: {num(std, 2)}) las
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

  return (
    <Link
      to={`/lotes/${lote.id}/ficha/alimento`}
      className="mt-5 flex items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 shadow-card transition active:scale-[0.99]"
    >
      <div className="min-w-0">
        <div className="text-xs text-ink-faint">Alimento de esta fase</div>
        <div className="font-display text-lg font-semibold leading-tight">
          {f.nombre}
        </div>
        <div className="text-sm text-ink-soft">
          {f.proteinaPct}% proteína · {f.presentacion.toLowerCase()}
          {plan.proximoCambio
            ? ` · cambia en ${plan.proximoCambio.enDias} ${plan.proximoCambio.enDias === 1 ? "día" : "días"}`
            : ""}
        </div>
      </div>
      {quedan != null && (
        <div className="shrink-0 text-right">
          <div
            className={
              "font-display text-lg font-semibold leading-none tnum " +
              (inv!.diasQueAlcanza <= 3 ? "text-clay-deep" : "")
            }
          >
            {num(Math.max(0, quedan), 1)} qq
          </div>
          <div className="mt-0.5 text-xs text-ink-faint">en el galpón</div>
        </div>
      )}
    </Link>
  );
}

function GuiaDelDia({ lote, metrics }: { lote: Lote; metrics: LoteMetrics }) {
  const g = computeGuiaDia(lote, metrics);
  if (!g) return null;
  const desv = g.desviacionPct;
  const stats = [
    { label: "Alimento hoy", value: `${num(g.alimentoDiaLb)} lb` },
    { label: "Alimento acum.", value: `${num(g.alimentoAcumLb)} lb` },
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
      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">
        Guía del día {g.dia}
      </h2>
      <Card className="p-4">
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
      </Card>
    </>
  );
}

function Sociedad({
  lote,
  gastos,
  ingresos,
  metrics,
  settings,
}: {
  lote: Lote;
  gastos: Gasto[];
  ingresos: Ingreso[];
  metrics: LoteMetrics;
  settings: Settings;
}) {
  const liq = computeLiquidacion(lote, gastos, ingresos, metrics);
  if (!liq) return null;
  const hayGanancia = metrics.ingresos > 0;

  function compartir() {
    const L = [`${settings.granja} — Liquidación`, lote.nombre, ""];
    for (const s of liq!.socios) {
      L.push(`${s.nombre} (${pct(s.pct, 0)})`);
      L.push(`  Aportó: ${money(s.aporte)}`);
      if (hayGanancia) L.push(`  Le corresponde: ${money(s.corresponde)}`);
    }
    L.push("", `Ganancia total: ${money(liq!.ganancia)}`);
    for (const t of liq!.traspasos)
      L.push(`${t.de} le paga ${money(t.monto)} a ${t.a}`);
    const text = L.join("\n");
    if (navigator.share)
      navigator
        .share({ title: `Liquidación ${lote.nombre}`, text })
        .catch(() => {});
    else {
      navigator.clipboard?.writeText(text);
      alert("Liquidación copiada.");
    }
  }

  return (
    <>
      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Sociedad</h2>
      <Card className="divide-y divide-line">
        {liq.socios.map((s, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{s.nombre}</span>
              <Pill tone="neutral">{pct(s.pct, 0)}</Pill>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-faint">Aportó</span>
              <span className="font-display font-semibold tnum">
                {money(s.aporte)}
              </span>
            </div>
            {hayGanancia && (
              <div className="mt-0.5 flex items-center justify-between text-sm">
                <span className="text-ink-faint">Le corresponde</span>
                <span
                  className={
                    "font-display font-semibold tnum " +
                    (s.corresponde >= 0 ? "text-forest-600" : "text-clay-deep")
                  }
                >
                  {money(s.corresponde)}
                </span>
              </div>
            )}
          </div>
        ))}
      </Card>
      {liq.traspasos.length > 0 && (
        <>
          <div className="mb-2 mt-3 text-xs font-medium text-ink-faint">
            {lote.estado === "cerrado"
              ? "Liquidación final"
              : "Para igualar aportes"}
          </div>
          <div className="space-y-1.5">
            {liq.traspasos.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border border-forest-400/30 bg-forest-50 px-3.5 py-2.5 text-sm font-medium text-forest-700"
              >
                <span className="font-semibold">{t.de}</span> le paga{" "}
                <span className="font-semibold tnum">{money(t.monto)}</span> a{" "}
                <span className="font-semibold">{t.a}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <Button block variant="soft" className="mt-3" onClick={compartir}>
        Compartir liquidación
      </Button>
    </>
  );
}

function CurvaEstandar({
  lote,
  registros,
}: {
  lote: Lote;
  registros: Registro[];
}) {
  const conPeso = registros.filter((r) => r.pesoPromedio != null);
  if (conPeso.length === 0) return null;
  const reales = new Map(
    conPeso.map((r) => [diasEntre(lote.fechaInicio, r.fecha), r.pesoPromedio!]),
  );
  const maxDia = Math.max(...reales.keys(), 21);
  const dias = new Set<number>(reales.keys());
  for (let d = 0; d <= maxDia; d += 7) dias.add(d);
  const puntos = [...dias]
    .sort((a, b) => a - b)
    .map((d) => ({
      x: d,
      real: reales.get(d),
      std: Number(pesoEstandarLb(d).toFixed(2)),
    }));
  const titulo = `Curva de peso vs. ${RAZA} (lb)`;
  const unidadX = "día";

  return (
    <>
      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">{titulo}</h2>
      <Card className="p-4 pt-5">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={puntos}
            margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
          >
            <CartesianGrid stroke="#EEEBE2" vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 11, fill: "#5C6A61" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5C6A61" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              labelFormatter={(x) => `${unidadX} ${x}`}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E3DFD3",
                background: "#FCFBF7",
                fontSize: 13,
                boxShadow: "0 8px 24px -12px rgba(27,43,34,0.2)",
              }}
            />
            <Line
              dataKey="std"
              name="Estándar"
              stroke="#5C6A61"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              dot={false}
              animationDuration={600}
              animationEasing="ease-out"
              isAnimationActive={!reduceMotion}
            />
            <Line
              dataKey="real"
              name="Tu lote"
              stroke="#2F8A4C"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#2F8A4C" }}
              connectNulls
              animationDuration={600}
              animationEasing="ease-out"
              isAnimationActive={!reduceMotion}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center justify-center gap-5 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-forest-500" /> Tu lote
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded border-b border-dashed border-ink-faint" />{" "}
            Estándar
          </span>
        </div>
      </Card>
    </>
  );
}
