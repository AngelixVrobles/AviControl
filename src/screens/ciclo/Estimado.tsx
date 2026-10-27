// La ganancia estimada del ciclo que sigue: lo que va a entrar al vender,
// menos lo gastado y lo que falta por pagar —el alimento por comprar, los
// empleados, los gastos que ya se saben y, si se vende arreglado, arreglar
// cada pollo—. Cada renglón que se puede ajustar se toca.

import type { ReactNode } from "react";
import { clsx } from "clsx";
import type { Lote } from "../../db/schema";
import type { LoteMetrics } from "../../lib/metrics";
import type { Proyeccion } from "../../lib/proyeccion";
import { fecha, money, num, pct } from "../../lib/format";
import { deQueTipo } from "../../lib/alimentos";
import { categoriaLabel } from "../../lib/labels";
import { fraseDelPago } from "../../lib/porPagar";
import { precioCorto, type ModoVenta } from "../../lib/venta";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { Banda, Seccion } from "../../components/ui";

export function GananciaEstimada({
  lote,
  metrics,
  proyeccion: p,
  modo,
  onEmpleados,
  onPorVenir,
  onComoVendes,
  onDiaVenta,
}: {
  lote: Lote;
  metrics: LoteMetrics;
  proyeccion: Proyeccion | null;
  modo: ModoVenta;
  /** Sin ellos, el ciclo es de un socio y solo se mira. */
  onEmpleados?: () => void;
  onPorVenir?: (indice?: number) => void;
  onComoVendes?: () => void;
  onDiaVenta?: () => void;
}) {
  if (lote.estado !== "activo" || metrics.avesVivas <= 0) return null;

  const precio = lote.precioVentaLb;
  const libra = modo.arreglado ? "lb arregladas" : "lb";
  const ganancia = p && precio ? p.gananciaProyectada : undefined;
  const avesQueSalen = metrics.vendidas + (p?.avesAlVender ?? 0);
  const e = lote.empleados;

  const cuando = !p
    ? "Con un pesaje se sabe cuántas libras vas a vender."
    : `${p.listo ? "Si vendes ya" : `Si vendes el ${fecha(p.fechaEstimada)}, día ${p.diaVenta}`}${
        precio
          ? `, a ${precioCorto(precio)} la libra${modo.arreglado ? " arreglada" : " en pie"}`
          : ""
      }${metrics.diaVentaFijo != null ? "." : `, cuando lleguen a ${num(p.pesoVentaLb, 1)} lb.`}`;

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Ganancia estimada"
        nota={cuando}
        accion={
          onDiaVenta ? (
            <button
              type="button"
              onClick={onDiaVenta}
              className="-mx-2 -my-3 px-2 py-3 text-sm font-semibold text-forest-600"
            >
              Cambiar el día
            </button>
          ) : undefined
        }
      />
      <Banda className="overflow-hidden">
        <div className="px-5 py-4">
          {ganancia != null ? (
            <>
              <div className="text-xs text-ink-faint">
                {ganancia >= 0 ? "Te quedarían" : "Perderías"}
              </div>
              <div
                className={clsx(
                  "font-display text-3xl font-semibold leading-none tnum",
                  ganancia >= 0 ? "text-forest-600" : "text-clay-text",
                )}
              >
                <AnimatedNumber value={ganancia} format={(n) => money(n)} />
              </div>
              <div className="mt-1.5 text-sm text-ink-soft tnum">
                {money(ganancia / Math.max(1, avesQueSalen))} por pollo
                {p?.margenProyectadoPct != null && ` · margen ${pct(p.margenProyectadoPct)}`}
              </div>
            </>
          ) : (
            <div className="text-sm leading-relaxed text-ink-soft">
              {!p
                ? "Pesa unas aves y aquí verás cuánto te queda al vender, con todo lo que falta por pagar."
                : "Pon a cómo vendes la libra y aquí verás cuánto te queda al vender."}
              {p && onComoVendes && (
                <button
                  type="button"
                  onClick={onComoVendes}
                  className="mt-2 block h-11 font-semibold text-forest-600"
                >
                  Poner el precio
                </button>
              )}
            </div>
          )}
        </div>

        <Grupo titulo="Lo que entra" />
        {metrics.ingresos > 0 && (
          <Fila
            label="Ya vendido"
            sub={`${num(metrics.vendidas)} aves${metrics.porCobrar >= 1 ? ` · te deben ${money(metrics.porCobrar)}` : ""}`}
            valor={money(metrics.ingresos)}
          />
        )}
        <Fila
          label="Por vender"
          sub={
            p
              ? `${num(p.avesAlVender)} aves · ${num(p.lbVenta)} ${libra}${precio ? ` a ${precioCorto(precio)}` : ""}`
              : "Falta un pesaje"
          }
          valor={p && precio ? money(p.lbVenta * precio) : "—"}
          onClick={onComoVendes}
        />

        <Grupo titulo="Lo que sale" />
        <Fila label="Gastado hasta hoy" valor={money(-metrics.costos)} />
        <Fila
          label="Alimento por comprar"
          sub={
            !p
              ? undefined
              : p.sinPrecioAlimento
                ? "Sin precio del quintal: con lo gastado por día"
                : p.alimentoPorComprarLb > 0
                  ? `${num(p.alimentoPorComprarQuintales, 1)} qq ${deQueTipo(p.comprarPorTipo)}`.trim()
                  : "Alcanza con lo del almacén"
          }
          valor={p ? money(-p.faltaAlimento) : "—"}
        />
        <Fila
          label="Empleados"
          sub={e ? `${money(e.monto)} ${fraseDelPago(e.cada)}` : "¿Cuánto les pagas?"}
          valor={e ? (p ? money(-p.faltaEmpleados) : "—") : onEmpleados ? <Poner /> : "—"}
          onClick={onEmpleados}
        />
        {modo.arreglado && (
          <Fila
            label="Arreglar los pollos"
            sub={
              modo.costoAve > 0
                ? `${num(p?.avesAlVender ?? metrics.avesVivas)} a ${precioCorto(modo.costoAve)} cada uno`
                : "¿Cuánto cuesta cada uno? Gas, fundas, hielo"
            }
            valor={
              modo.costoAve > 0 ? (p ? money(-p.faltaArreglo) : "—") : onComoVendes ? <Poner /> : "—"
            }
            onClick={onComoVendes}
          />
        )}
        {(lote.gastosPorVenir ?? []).map((g, i) => (
          <Fila
            key={i}
            label={g.concepto}
            sub={`Por pagar · ${categoriaLabel(g.categoria)}`}
            valor={money(-g.monto)}
            onClick={onPorVenir ? () => onPorVenir(i) : undefined}
          />
        ))}
        {onPorVenir && (
          <button
            type="button"
            onClick={() => onPorVenir()}
            className="flex h-12 w-full items-center gap-2 border-t border-line px-5 text-sm font-semibold text-forest-600 transition active:bg-paper-sunken"
          >
            + Otro gasto que viene: la luz, el transporte…
          </button>
        )}
      </Banda>
    </>
  );
}

function Grupo({ titulo }: { titulo: string }) {
  return (
    <div className="border-t border-line px-5 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
      {titulo}
    </div>
  );
}

function Poner() {
  return <span className="text-sm text-forest-600">Poner</span>;
}

function Fila({
  label,
  sub,
  valor,
  onClick,
}: {
  label: string;
  sub?: string;
  valor: ReactNode;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {sub && <div className="text-xs text-ink-faint tnum">{sub}</div>}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-right font-display text-base font-semibold tnum">
        {valor}
        {onClick && (
          <span aria-hidden className="text-ink-faint">
            ›
          </span>
        )}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition active:bg-paper-sunken"
    >
      {contenido}
    </button>
  ) : (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">{contenido}</div>
  );
}
