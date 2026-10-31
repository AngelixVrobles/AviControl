import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { db, type Gasto, type Ingreso, type Pesaje, type Registro } from "../db/schema";
import { useLoteData, useModoVenta, useSettings } from "../lib/hooks";
import { agruparGastos } from "../lib/metrics";
import { proyectarVenta } from "../lib/proyeccion";
import { analizarPrecio } from "../lib/precios";
import { pesoObjetivoDe, sinAves } from "../lib/lote";
import { galponInicial, nombreGalpon } from "../lib/galpones";
import { avesPorGalpon } from "../lib/reparto";
import { retiroEn } from "../lib/retiro";
import { armarCiclo } from "../lib/compartido";
import { computeArranque, tituloArranque } from "../lib/arranque";
import { alimentoPorTipo } from "../lib/alimentos";
import { resumenPesada } from "../lib/pesada";
import { porGravedad } from "../lib/alerts";
import { TarjetaArranque } from "../components/Arranque";
import { useVolver } from "../components/useVolver";
import { hojasDelCiclo } from "../lib/exportar";
import { crearXlsx, TIPO_XLSX } from "../lib/xlsx";
import { entregarArchivo, nombreArchivo } from "../lib/archivo";
import { mandarCiclo } from "../components/useCicloCompartido";
import { borrarCiclo } from "../db/ciclo";
import { conCalor, juicioDe } from "../lib/calor";
import { pendienteDe } from "../lib/cobros";
import { valorHoy } from "../lib/venta";
import { compartirReporte } from "../lib/reporte";
import { alimentoEn, diaLocal, fecha, hoyISO, money, num, numCorto, pct, plural, porLb } from "../lib/format";
import { categoriaLabel, RAZA, tipoIngresoLabel } from "../lib/labels";
import { LB_POR_QUINTAL } from "../lib/standards";
import { AlertaChip } from "../components/AlertaChip";
import { FichasNav } from "../components/FichasNav";
import { InversionPorDia } from "../components/InversionPorDia";
import { EditarLoteSheet } from "../components/LoteSheet";
import { confirmar, toast } from "../components/confirm";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Button, Banda, Pestanas, Pill, Seccion } from "../components/ui";
import { IconBack, IconClose, IconLapiz, IconMoney, IconPesa, IconPlus, IconTrend, IconVenta } from "../components/icons";
import {
  ActionButton,
  CierreSheet,
  CobroSheet,
  CuadreSheet,
  ComoVendesSheet,
  DiaVentaSheet,
  EmpleadosSheet,
  GastoSheet,
  IngresoSheet,
  PesajeSheet,
  PorVenirSheet,
  RegistroSheet,
} from "../components/sheets";
import { CerrarSinAves, FaseActual, GuiaDelDia } from "./ciclo/Hoy";
import { Desvio, Diagnostico, GridCrecimiento, Muestreo } from "./ciclo/Crecimiento";
import { ComoSalio, PrecioMinimo, PuntoOptimo } from "./ciclo/Dinero";
import { Sociedad } from "./ciclo/Sociedad";
import { GananciaEstimada } from "./ciclo/Estimado";

type SheetKind =
  | "registro"
  | "pesaje"
  | "gasto"
  | "ingreso"
  | "cierre"
  | "cuadre"
  | "lote"
  | "cobro"
  | "empleados"
  | "porVenir"
  | "comoVendes"
  | "diaVenta"
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
  const volver = useVolver("/lotes");
  const data = useLoteData(id ? Number(id) : undefined);
  const settings = useSettings();
  const modo = useModoVenta();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [editRegistro, setEditRegistro] = useState<Registro>();
  const [editGasto, setEditGasto] = useState<Gasto>();
  const [editIngreso, setEditIngreso] = useState<Ingreso>();
  const [editPesaje, setEditPesaje] = useState<Pesaje>();
  const [cobroDe, setCobroDe] = useState<number>();
  const [porVenir, setPorVenir] = useState<number>();
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
  const alertasEnOrden = [...alertas].sort(porGravedad);
  // Dinero, con el ciclo en curso, es la pestaña más larga: el índice lleva a
  // cada parte sin tener que bajar buscándola.
  const indiceDinero: [string, string][] =
    lote.estado === "activo" && !sinAves(metrics)
      ? [
          ["d-estimado", "Estimado"],
          ["d-precio", "A cómo vender"],
          ["d-punto", "Cuándo vender"],
          ["d-gastos", "Gastos"],
          ...(lote.socios && lote.socios.length >= 2 ? [["d-socios", "Socios"] as [string, string]] : []),
          ...(ingresos.length > 0 ? [["d-ventas", "Ventas"] as [string, string]] : []),
        ]
      : [];
  const cerrado =
    lote.estado === "cerrado" && ingresos.some((i) => i.tipo === "aves");
  const gastosCat = agruparGastos(gastos);
  const positivo = metrics.ganancia >= 0;
  // Activo con el galpón vacío: en vez de los botones del día, cerrar el ciclo.
  const vacio = lote.estado === "activo" && sinAves(metrics);
  // Ya se vendió y la app todavía cree que quedan pollos: si salió el último,
  // las aves de las ventas se cuadran con las que salieron.
  const puedeCuadrar =
    lote.estado === "activo" && !vacio && metrics.vendidas > 0 && !lote.compartido;
  // Un ciclo que mandó un socio se mira y no se toca: lo lleva él.
  const soloVer = !!lote.compartido;
  const arranque = computeArranque(lote, registros, metrics.dias);
  // Qué alimento se da cada día, por lo que se compró.
  const alimentos = alimentoPorTipo(lote, registros, gastos, metrics);

  async function quitarCopia() {
    const ok = await confirmar({
      titulo: "Quitar esta copia",
      mensaje: `Se quita de este teléfono la copia de ${lote.nombre}. El ciclo sigue en el teléfono de ${lote.compartido?.de ?? "tu socio"}, y te lo puede mandar otra vez.`,
      confirmar: "Quitar",
      peligro: true,
    });
    if (!ok) return;
    await borrarCiclo(lote.id);
    toast("Copia quitada.");
    nav("/lotes", { replace: true });
  }

  // Mientras el ciclo sigue, la ganancia solo puede decir «pérdida», del tamaño
  // de lo que falta por vender: se muestra lo invertido, aunque ya haya una
  // venta. Con 300 de 4,660 aves vendidas decía «Pérdida −RD$1,302,850 ·
  // Margen −1,754.7 %».
  const sinVender = lote.estado === "activo" || metrics.ingresos === 0;
  // Lo que vale hoy lo del galpón: arreglado, a tu precio y menos lo de
  // arreglarlo; sin precio del ciclo, en pie al del mercado.
  const valorEnPie = valorHoy(
    metrics.avesVivas,
    metrics.pesoEstimadoLb,
    lote.precioVentaLb,
    settings.precioMercadoLb,
    modo,
  );
  const valeArreglado = modo.arreglado && !!lote.precioVentaLb;
  // Los galpones donde tiene aves hoy: el que se vació con una venta ya no.
  const galponesHoy =
    lote.estado === "activo"
      ? avesPorGalpon(lote, galponInicial(lote, settings), registros, ingresos, hoyISO()).map(
          (c) => c.galponId,
        )
      : undefined;

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
  const enRetiro = enCurso ? retiroEn(aplicaciones, hoyISO()) : undefined;
  const proyeccion = enCurso
    ? proyectarVenta(lote, registros, gastos, metrics, pesoObjetivoDe(lote), modo)
    : null;
  const analisisReporte = enCurso
    ? analizarPrecio(lote, gastos, metrics, proyeccion, modo)
    : null;
  const kpis = [
    {
      label:
        (metrics.diasDesdePeso ?? 0) >= 2 ? "Peso estimado hoy" : "Peso promedio",
      value:
        metrics.pesoEstimadoLb != null
          ? `${num(metrics.pesoEstimadoLb, 2)} lb`
          : "—",
    },
    {
      label: "Conversión (FCA)",
      value: metrics.fca != null ? num(metrics.fca, 2) : "—",
    },
    { label: "Mortalidad", value: pct(metrics.mortalidadPct) },
    {
      label: "Alimento total",
      value: `${num(metrics.alimentoTotalLb / LB_POR_QUINTAL, 1)} qq`,
    },
    enCurso
      ? {
          label: modo.arreglado ? "Mínimo por lb arreglada" : "Mínimo para no perder",
          value: analisisReporte ? `${porLb(analisisReporte.precioEquilibrioLb)}/lb` : "—",
        }
      : {
          label: "Costo por lb",
          value: metrics.costoPorLb != null ? porLb(metrics.costoPorLb) : "—",
        },
    enCurso
      ? {
          label: "Venta estimada",
          // Con el retiro de una medicina corriendo, no se vende antes.
          value:
            enRetiro &&
            (!metrics.fechaVentaEstimada || enRetiro.libreDesde > metrics.fechaVentaEstimada)
              ? `desde el ${fecha(enRetiro.libreDesde)} (retiro)`
              : metrics.fechaVentaEstimada && metrics.diaVentaEstimado != null
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
          onClick={volver}
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
            <span className="truncate text-sm text-ink-soft">
              · {lote.compartido
                ? `de ${lote.compartido.de}`
                : (nombreGalpon(lote, settings, galponesHoy) ?? RAZA)}
            </span>
            {lote.estado === "cerrado" && <Pill tone="neutral">Cerrado</Pill>}
          </div>
        </div>
        {soloVer ? (
          <button
            onClick={quitarCopia}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-sunken text-ink-soft"
            aria-label="Quitar esta copia"
          >
            <IconClose width={20} height={20} />
          </button>
        ) : (
          <button
            onClick={() => abrir("lote")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-sunken text-ink-soft"
            aria-label="Corregir o borrar el ciclo"
          >
            <IconLapiz width={20} height={20} />
          </button>
        )}
      </header>

      {lote.compartido && (
        <div className="mb-4 rounded-xl2 border border-line bg-paper-sunken px-4 py-3 text-sm leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">Te lo mandó {lote.compartido.de}</span>{" "}
          el {fecha(diaLocal(lote.compartido.exportado))}. Es una copia para mirar: no se
          puede cambiar y no entra en tus cuentas. Para verlo al día, pídele que te lo mande otra
          vez.
        </div>
      )}

      {alertas.length > 0 && !vacio && (
        // Completas en Hoy; en las otras pestañas, la más seria en un renglón:
        // tres avisos largos empujaban la gráfica o el dinero fuera de la
        // pantalla cada vez que se cambiaba de pestaña.
        <div className="mb-4 space-y-2">
          {tab === "hoy" ? (
            alertasEnOrden.map((a, i) => <AlertaChip key={i} alerta={a} />)
          ) : (
            <AlertaChip
              alerta={alertasEnOrden[0]}
              mas={alertasEnOrden.length - 1}
              onClick={() => setTab("hoy")}
            />
          )}
        </div>
      )}

      {vacio && !soloVer && (
        <CerrarSinAves
          lote={lote}
          metrics={metrics}
          ingresos={ingresos}
          onGasto={() => abrir("gasto")}
        />
      )}

      {lote.estado === "activo" && !vacio && !soloVer && (
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
            tone="neutral"
            icon={<IconVenta width={20} height={20} />}
            onClick={() => abrir("ingreso")}
          />
        </div>
      )}

      <div className="sticky top-0 z-30 -mx-5 mt-5 bg-paper px-5 pb-2 pt-2">
        <Pestanas
          etiqueta="Partes del ciclo"
          valor={tab}
          onCambio={setTab}
          opciones={TABS.map((t) => ({
            id: t.id,
            label: t.id === "hoy" && lote.estado === "cerrado" ? "Resumen" : t.label,
          }))}
        />
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
          {/* La primera semana se mira de cerca: lo que pasa ahí viene del
              pollito y del recibo, y todavía se le puede reclamar a la incubadora. */}
          {lote.estado === "activo" && metrics.dias <= 10 && (
            <>
              <Seccion
                className="mb-3 mt-8"
                etiqueta="Primera semana"
                titulo={tituloArranque(arranque, metrics.dias)}
              />
              <TarjetaArranque a={arranque} dia={metrics.dias} />
            </>
          )}
          <FaseActual lote={lote} gastos={gastos} metrics={metrics} alimentos={alimentos} />

          <Seccion className="mb-3 mt-8" etiqueta="Historial" />
          {registros.length === 0 ? (
            <p className="rounded-xl2 border border-dashed border-line bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-faint">
              Sin registros aún. Toca “Registrar día” para empezar.
            </p>
          ) : (
            <>
              {!soloVer && (
                <p className="mb-3 text-xs text-ink-faint">
                  Toca un día para corregirlo.
                </p>
              )}
              <Banda className="divide-y divide-line">
                {[...registros]
                  .reverse()
                  .slice(0, todoHistorial ? undefined : 5)
                  .map((r) => (
                    <button
                      key={r.id}
                      disabled={soloVer}
                      onClick={() => {
                        setEditRegistro(r);
                        setEditGasto(undefined);
                        setEditIngreso(undefined);
                        setSheet("registro");
                      }}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm transition active:bg-paper-sunken disabled:active:bg-transparent"
                    >
                      {/* A 320 px las cifras se partían en «15-/oct» y «35/°C»:
                          cada una va entera, y si no caben bajan de línea. */}
                      <span className="shrink-0 whitespace-nowrap font-medium">
                        {fecha(r.fecha)}
                        {r.soloPeso && (
                          <span className="ml-2 text-xs font-normal text-amber-text">
                            solo pesaje
                          </span>
                        )}
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-0.5 whitespace-nowrap text-ink-soft tnum">
                        {r.pesoPromedio != null && (
                          <span>{num(r.pesoPromedio, 2)} lb</span>
                        )}
                        {r.alimentoLb > 0 && (
                          <span className="text-ink-faint">
                            {alimentoEn(r.alimentoLb, settings.unidadAlimento)}
                          </span>
                        )}
                        {r.tempMaxC != null && (
                          <span
                            className={
                              conCalor(juicioDe(lote, r))
                                ? "font-medium text-clay-text"
                                : "text-ink-faint"
                            }
                          >
                            {num(r.tempMaxC)} °C
                          </span>
                        )}
                        {r.mortalidad > 0 && (
                          <span className="text-ink-soft">
                            {num(r.mortalidad)} {plural(r.mortalidad, "baja", "bajas")}
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
            onNuevo={soloVer ? undefined : () => abrir("pesaje")}
            onEditar={
              soloVer
                ? undefined
                : (p) => {
                    setEditRegistro(undefined);
                    setEditGasto(undefined);
                    setEditIngreso(undefined);
                    setEditPesaje(p);
                    setSheet("pesaje");
                  }
            }
          />
          <Diagnostico metrics={metrics} />
        </div>
      )}

      {tab === "dinero" && (
        <div className="animate-rise">
          {indiceDinero.length > 0 && <IndiceDinero partes={indiceDinero} />}
          <ComoSalio lote={lote} metrics={metrics} ingresos={ingresos} />
          {/* La cifra grande va sola arriba y las otras dos debajo: lado a lado,
              a 320 px se cortaban en «RD$74,2…» y «RD$1,37…». */}
          <Banda className={clsx("mt-5 overflow-hidden", cerrado && "hidden")}>
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-ink-faint">
                <IconTrend width={16} height={16} />
                <span className="text-xs font-medium">
                  {sinVender ? "Invertido" : positivo ? "Ganancia" : "Pérdida"}
                </span>
              </div>
              <div
                className={
                  "mt-1 font-display text-2xl font-semibold tracking-tight tnum leading-none " +
                  (sinVender ? "text-ink" : positivo ? "text-forest-600" : "text-clay-text")
                }
              >
                <AnimatedNumber
                  value={sinVender ? metrics.costos : metrics.ganancia}
                  format={(n) => money(n)}
                />
              </div>
              <div className="mt-1 text-xs text-ink-faint tnum">
                {!sinVender
                  ? `Margen ${pct(metrics.margenPct)}`
                  : metrics.ingresos > 0
                    ? `vendido hasta hoy ${money(metrics.ingresos)}`
                    : lote.estado === "activo"
                      ? "todavía sin vender"
                      : "sin ventas"}
              </div>
            </div>
            <div className="grid border-t border-line min-[360px]:grid-cols-2">
              <div className="border-line px-4 py-2.5 max-[359px]:border-b min-[360px]:border-r">
                <div className="text-xs text-ink-faint">
                  {sinVender ? (valeArreglado ? "Vale hoy, arreglado" : "Valor en pie") : "Ingresos"}
                </div>
                <div className="font-display text-lg font-semibold tnum leading-tight">
                  {sinVender && valorEnPie > 0
                    ? money(valorEnPie)
                    : sinVender
                      ? "—"
                      : money(metrics.ingresos)}
                </div>
              </div>
              <div className="px-4 py-2.5">
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

          <div id="d-estimado" className="scroll-mt-20">
            <GananciaEstimada
              lote={lote}
              metrics={metrics}
              proyeccion={proyeccion}
              modo={modo}
              onEmpleados={soloVer ? undefined : () => setSheet("empleados")}
              onPorVenir={
                soloVer
                  ? undefined
                  : (i) => {
                      setPorVenir(i);
                      setSheet("porVenir");
                    }
              }
              onComoVendes={soloVer ? undefined : () => setSheet("comoVendes")}
              onDiaVenta={soloVer ? undefined : () => setSheet("diaVenta")}
            />
          </div>
          <div id="d-precio" className="scroll-mt-20">
            <PrecioMinimo
              lote={lote}
              registros={registros}
              gastos={gastos}
              metrics={metrics}
              modo={modo}
            />
          </div>
          <div id="d-punto" className="scroll-mt-20">
            <PuntoOptimo
              lote={lote}
              registros={registros}
              gastos={gastos}
              metrics={metrics}
              modo={modo}
            />
          </div>

          <Link
            id="d-gastos"
            to={`/lotes/${lote.id}/ficha/gastos`}
            className="mt-7 flex scroll-mt-20 items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 transition active:scale-[0.99]"
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

          <div id="d-socios" className="scroll-mt-20">
            <Sociedad
              lote={lote}
              registros={registros}
              gastos={gastos}
              ingresos={ingresos}
              entregas={entregas}
              metrics={metrics}
              settings={settings}
              soloVer={soloVer}
            />
          </div>

          {ingresos.length > 0 && (
            <>
              <Seccion id="d-ventas" className="mb-3 mt-8 scroll-mt-20" etiqueta="Ventas" />
              {!soloVer && (
                <p className="mb-3 text-xs text-ink-faint">
                  Toca una para corregirla.
                </p>
              )}
              <Banda className="divide-y divide-line">
                {[...ingresos]
                  .sort((a, b) => b.fecha.localeCompare(a.fecha))
                  .map((i) => (
                    <button
                      key={i.id}
                      disabled={soloVer}
                      onClick={() => {
                        setEditIngreso(i);
                        setEditRegistro(undefined);
                        setEditGasto(undefined);
                        setSheet("ingreso");
                      }}
                      className="flex w-full items-center justify-between px-5 py-3 text-left text-sm transition active:bg-paper-sunken disabled:active:bg-transparent"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {i.comprador?.trim() ||
                            i.descripcion ||
                            tipoIngresoLabel(i.tipo)}
                        </div>
                        <div className="text-xs text-ink-faint tnum">
                          {fecha(i.fecha)}
                          {i.cantidad > 0 ? ` · ${i.avesEstimadas ? "unas " : ""}${num(i.cantidad)} aves` : ""}
                          {i.pesoLb ? ` · ${numCorto(i.pesoLb, 1)} lb${i.arreglado ? " arregladas" : ""}` : ""}
                          {i.pesada && resumenPesada(i.pesada).cajas > 0
                            ? ` · ${num(resumenPesada(i.pesada).cajas)} cajas`
                            : ""}
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
              {/* Las ventas por libras casi nunca se cuentan: cuando sale el
                  último pollo, la app cuadra sus aves con las que salieron. */}
              {puedeCuadrar && ingresos.some((i) => i.tipo === "aves" && i.avesEstimadas) && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs leading-relaxed text-ink-faint">
                    Las aves que dicen «unas» son estimadas. Cuando salga el último pollo, la app las
                    cuadra por sus libras.
                  </p>
                  <Button variant="soft" className="shrink-0 px-4 py-2 text-sm" onClick={() => abrir("cuadre")}>
                    Ya no quedan pollos
                  </Button>
                </div>
              )}
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
                          valorEnPie,
                          gananciaEstimada: proyeccion?.gananciaProyectada,
                          arreglado: modo.arreglado,
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
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="soft"
                onClick={async () => {
                  // Se arma al momento con lo que ya está en pantalla: en el
                  // iPhone el menú de compartir solo se abre justo tras el toque.
                  const bytes = crearXlsx(
                    hojasDelCiclo(
                      { lote, registros, pesajes, gastos, ingresos, aplicaciones, entregas, metrics },
                      settings.granja,
                      settings.galpones,
                    ),
                  );
                  try {
                    const como = await entregarArchivo(
                      new File([bytes], `${nombreArchivo(lote.nombre)}.xlsx`, { type: TIPO_XLSX }),
                    );
                    if (como === "descargado")
                      toast("Hoja descargada: la encuentras en Descargas.");
                  } catch {
                    toast("No se pudo armar la hoja. Inténtalo de nuevo.");
                  }
                }}
              >
                Excel
              </Button>
              <Button variant="soft" onClick={() => nav(`/lotes/${lote.id}/imprimir`)}>
                Imprimir o PDF
              </Button>
            </div>
            {!soloVer && (
              <>
                <Button
                  block
                  variant="soft"
                  onClick={() =>
                    mandarCiclo(
                      armarCiclo(
                        { lote, registros, pesajes, gastos, ingresos, aplicaciones, entregas },
                        settings.granja,
                      ),
                    )
                  }
                >
                  Mandar el ciclo a un socio
                </Button>
                <p className="px-2 text-center text-xs leading-relaxed text-ink-faint">
                  Le llega un archivo que abre en su AviControl, en Ajustes: ve todo el ciclo,
                  sin poder cambiarlo.
                </p>
                <div className="flex flex-wrap justify-center">
                  {lote.estado === "activo" ? (
                    <>
                      <Button variant="ghost" onClick={() => abrir("cierre")}>
                        Vender y cerrar ciclo
                      </Button>
                      {puedeCuadrar && (
                        <Button variant="ghost" onClick={() => abrir("cuadre")}>
                          Ya no quedan pollos
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="ghost" onClick={reabrir}>
                      Reabrir ciclo
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Un ciclo compartido no abre hojas para anotar: ni con ?reg=1. */}
      {!soloVer && (
        <>
          <RegistroSheet
            lote={lote}
            registros={registros}
            ingresos={ingresos}
            alimentos={alimentos}
            open={sheet === "registro"}
            onClose={() => setSheet(null)}
            editar={editRegistro}
          />
          <CierreSheet
            lote={lote}
            metrics={metrics}
            registros={registros}
            gastos={gastos}
            ingresos={ingresos}
            aplicaciones={aplicaciones}
            open={sheet === "cierre"}
            onClose={() => setSheet(null)}
            onSinPollos={() => setSheet("cuadre")}
          />
          <CuadreSheet
            lote={lote}
            metrics={metrics}
            ingresos={ingresos}
            open={sheet === "cuadre"}
            onClose={() => setSheet(null)}
            onAnotarBajas={() => abrir("registro")}
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
            ingresos={ingresos}
            aplicaciones={aplicaciones}
            open={sheet === "ingreso"}
            onClose={() => setSheet(null)}
            editar={editIngreso}
            onCobrar={(i) => {
              setCobroDe(i.id);
              setSheet("cobro");
            }}
          />
          <EmpleadosSheet
            lote={lote}
            gastos={gastos}
            diaVenta={proyeccion?.diaVenta ?? metrics.diaVentaEstimado ?? metrics.dias}
            aves={metrics.vendidas + (proyeccion?.avesAlVender ?? metrics.avesVivas)}
            open={sheet === "empleados"}
            onClose={() => setSheet(null)}
          />
          <PorVenirSheet
            lote={lote}
            indice={porVenir}
            open={sheet === "porVenir"}
            onClose={() => setSheet(null)}
          />
          <DiaVentaSheet
            lote={lote}
            diaHoy={metrics.dias}
            open={sheet === "diaVenta"}
            onClose={() => setSheet(null)}
          />
          <ComoVendesSheet
            lote={lote}
            metrics={metrics}
            ingresos={ingresos}
            proyeccion={proyeccion}
            open={sheet === "comoVendes"}
            onClose={() => setSheet(null)}
          />
          <CobroSheet
            ingreso={ingresos.find((i) => i.id === cobroDe)}
            lote={lote}
            open={sheet === "cobro"}
            onClose={() => setSheet(null)}
            onCorregir={() => {
              setEditIngreso(ingresos.find((i) => i.id === cobroDe));
              setSheet("ingreso");
            }}
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
        </>
      )}
    </div>
  );
}

function IndiceDinero({ partes }: { partes: [string, string][] }) {
  const ir = (id: string) =>
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  return (
    <nav aria-label="Partes de Dinero" className="-mx-5 mb-1 flex gap-2 overflow-x-auto px-5 pb-1">
      {partes.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => ir(id)}
          className="h-9 shrink-0 rounded-full border border-line bg-paper-raised px-3.5 text-sm font-medium text-ink-soft transition active:bg-paper-sunken"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
