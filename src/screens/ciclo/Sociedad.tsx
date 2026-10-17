// La cuenta de cada socio del ciclo: lo que puso, lo que le toca y lo que se
// entregaron.

import { useState } from "react";
import { clsx } from "clsx";
import type { EntregaSocio, Gasto, Ingreso, Lote, Registro } from "../../db/schema";
import type { LoteMetrics } from "../../lib/metrics";
import { proyectarVenta } from "../../lib/proyeccion";
import { pesoObjetivoDe } from "../../lib/lote";
import { computeLiquidacion, esYo, fraseEntrega, nombreSocio, type SocioBalance, type Traspaso } from "../../lib/sociedad";
import { fecha, money, num, pct, porLb } from "../../lib/format";
import type { Settings } from "../../lib/settings";
import { toast } from "../../components/confirm";
import { Button, Banda, Seccion } from "../../components/ui";
import { EntregaSheet } from "../../components/sheets";

export function Sociedad({
  lote,
  registros,
  gastos,
  ingresos,
  entregas,
  metrics,
  settings,
  soloVer = false,
}: {
  lote: Lote;
  registros: Registro[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  entregas: EntregaSocio[];
  metrics: LoteMetrics;
  settings: Settings;
  soloVer?: boolean;
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
      : `Lo que ha puesto cada uno, para seguir ${liq.acuerdo} con los gastos.${
          liq.ingresos > 0
            ? " Lo cobrado de las ventas cuenta como dinero que ya recuperó quien lo recibió."
            : ""
        }`) +
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
    else {
      L.push(`Gastado hasta hoy: ${money(liq!.costos)}`);
      if (liq!.ingresos > 0) L.push(`Vendido hasta hoy: ${money(liq!.ingresos)}`);
    }
    for (const s of liq!.socios) {
      L.push("", `${s.nombre} (${pct(s.pct, 0)})`, `  Puso: ${money(s.aporte)}`);
      if (liq!.conVentas || s.cobrado > 0) L.push(`  Cobró de las ventas: ${money(s.cobrado)}`);
      if (!liq!.conVentas)
        L.push(
          `  Le toca poner: ${money(liq!.ingresos > 0 ? Math.max(0, -s.corresponde) : s.leTocaPoner)}`,
        );
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
                {!soloVer && (
                  <button
                    onClick={() => anotar(t)}
                    className="h-11 shrink-0 rounded-full bg-forest-600 px-4 text-sm font-semibold text-paper-raised transition active:scale-[0.97]"
                  >
                    Ya se entregó
                  </button>
                )}
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
            hayVentas={liq.ingresos > 0}
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
            {soloVer ? "Entregas anotadas" : "Entregas anotadas · toca una para corregirla"}
          </div>
          <Banda className="divide-y divide-line">
            {[...entregas].reverse().map((e) => {
              const [x, y] = fraseEntrega(nombre(e.de), nombre(e.a), {
                hecha: true,
              });
              return (
                <button
                  key={e.id}
                  disabled={soloVer}
                  onClick={() => {
                    setSugerida(undefined);
                    setEditar(e);
                    setHoja(true);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 px-5 py-3 text-left text-sm transition active:bg-paper-sunken disabled:active:bg-transparent"
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

      <div className={clsx("mt-3 grid gap-2", soloVer ? "grid-cols-1" : "grid-cols-2")}>
        {!soloVer && (
          <Button variant="soft" onClick={() => anotar(liq.traspasos[0])}>
            Anotar entrega
          </Button>
        )}
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
  hayVentas = false,
  costos,
  estimada,
}: {
  s: SocioBalance;
  otros: string;
  conVentas: boolean;
  hayVentas?: boolean;
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
        // Con ventas antes de cerrar, a cada uno le toca poner su parte de lo
        // gastado menos lo vendido, y lo que cobró de esas ventas ya es dinero
        // que recuperó: así las tres cifras cuadran con lo que falta.
        {
          label: t("Te toca poner", "Le toca poner"),
          valor: hayVentas ? Math.max(0, -s.corresponde) : s.leTocaPoner,
          detalle: hayVentas
            ? `${pct(s.pct, 0)} de lo gastado menos lo vendido`
            : `${pct(s.pct, 0)} de ${money(costos)} gastados`,
        },
        {
          label: t("Has puesto", "Ha puesto"),
          valor: s.aporte + s.entregado - s.recibido - s.cobrado,
          detalle:
            movimientos.length || s.cobrado > 0
              ? [
                  `${t("pagaste", "pagó")} ${money(s.aporte)}`,
                  s.cobrado > 0 && `${t("cobraste", "cobró")} ${money(s.cobrado)} de ventas`,
                  ...movimientos,
                ]
                  .filter(Boolean)
                  .join(" · ")
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
