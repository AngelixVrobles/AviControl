// La pestaña Hoy del ciclo: la guía del día, la fase del alimento y el cierre
// cuando ya no quedan aves.

import { Link } from "react-router-dom";
import { db, type Gasto, type Ingreso, type Lote } from "../../db/schema";
import type { LoteMetrics } from "../../lib/metrics";
import { computeGuiaDia } from "../../lib/guia";
import { computeInventarioAlimento, computePlanAlimento } from "../../lib/plan";
import { alimentoEn, fecha, hoyISO, money, num, pct, plural } from "../../lib/format";
import { LB_POR_QUINTAL } from "../../lib/standards";
import { nombreFase, type AlimentoPorTipo } from "../../lib/alimentos";
import { confirmar, toast } from "../../components/confirm";
import { cuadrarVentas } from "../../db/cuadre";
import { Banda, Seccion } from "../../components/ui";

// Se vendieron todas las aves con «Venta», o no queda ninguna: el ciclo sigue
// abierto y pedía el registro del día. Aquí se cierra con la fecha de la última
// venta, sin proyección que guardar: con el galpón vacío ya no hay qué proyectar.
// Las ventas con aves estimadas se cuadran con los pollos que salieron, como en
// cualquier cierre: si se estimaron de más, aquí se ajustan.
export function CerrarSinAves({
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
    await db.transaction("rw", db.ingresos, db.lotes, async () => {
      await cuadrarVentas(lote, metrics.bajas);
      await db.lotes.update(lote.id, {
        estado: "cerrado",
        fechaCierre: ultima ?? hoyISO(),
      });
    });
    toast(`Ciclo cerrado · ${money(metrics.ganancia)}`);
  }

  return (
    <div className="mt-1 rounded-xl2 border border-amber-line border-l-4 border-l-amber-400 bg-amber-tint p-4">
      <div className="font-display text-base font-semibold text-amber-text">
        {vendio ? "Vendiste todas las aves" : "No quedan aves en el galpón"}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-amber-text">
        El ciclo sigue abierto. Ciérralo para ver cómo salió y que pase a Reportes.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={cerrar}
          className="rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-paper-raised transition active:scale-95"
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

export function FaseActual({
  lote,
  gastos,
  metrics,
  alimentos,
}: {
  lote: Lote;
  gastos: Gasto[];
  metrics: LoteMetrics;
  alimentos?: AlimentoPorTipo;
}) {
  // Con las compras anotadas manda lo que se compró: el saco que se está dando,
  // lo que queda de ese y el que sigue. Sin compras, la fase que toca por la edad.
  if (alimentos && alimentos.partidas.length > 0)
    return <AlimentoDeHoy lote={lote} alimentos={alimentos} />;
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
              (inv!.diasQueAlcanza <= 3 ? "text-clay-text" : "")
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

function AlimentoDeHoy({ lote, alimentos }: { lote: Lote; alimentos: AlimentoPorTipo }) {
  const actual = alimentos.fases.find((f) => f.fase === alimentos.actual)!;
  const siguiente = alimentos.siguiente
    ? alimentos.fases.find((f) => f.fase === alimentos.siguiente)
    : undefined;
  const quedaQq = actual.quedaLb / LB_POR_QUINTAL;
  const poco = alimentos.alcanzaActual <= 3;
  return (
    <Link
      to={`/lotes/${lote.id}/ficha/alimento`}
      className="mt-5 block rounded-xl2 border border-line bg-paper-raised p-4 transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-ink-faint">Le estás dando</div>
          <div className="font-display text-lg font-semibold leading-tight">{actual.nombre}</div>
          <div className="text-sm text-ink-soft">
            {nombreFase(actual.fase)}
            {quedaQq > 0.05
              ? ` · alcanza ${alimentos.alcanzaActual === 0 ? "para hoy" : `~${alimentos.alcanzaActual} ${plural(alimentos.alcanzaActual, "día", "días")}`}`
              : " · ya no queda"}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={
              "font-display text-lg font-semibold leading-none tnum " + (poco ? "text-clay-text" : "")
            }
          >
            {num(Math.max(0, quedaQq), 1)} qq
          </div>
          <div className="mt-0.5 text-xs text-ink-faint">de este</div>
        </div>
      </div>
      {siguiente && (
        <div
          className={
            "mt-3 border-t border-line pt-2.5 text-sm " +
            (poco && siguiente.quedaLb <= 0 ? "font-medium text-clay-text" : "text-ink-soft")
          }
        >
          Después: {nombreFase(siguiente.fase)}
          {siguiente.quedaLb > 0
            ? ` · ${num(siguiente.quedaLb / LB_POR_QUINTAL, 1)} qq en el almacén`
            : " · todavía no lo compras"}
        </div>
      )}
    </Link>
  );
}

export function GuiaDelDia({
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
    g.tempRealC != null
      ? { label: `Máx. hoy (piden ${g.tempC})`, value: `${num(g.tempRealC)} °C` }
      : { label: "Temperatura", value: `${g.tempC} °C` },
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
                  (desv >= -3 ? "text-forest-600" : "text-clay-text")
                }
              >
                {num(g.pesoRealLb, 2)} lb
              </div>
              <div
                className={
                  "text-xs tnum " +
                  (desv >= -3 ? "text-forest-600" : "text-clay-text")
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
