// La ganancia estimada del ciclo que sigue: lo que va a entrar al vender,
// menos lo gastado y lo que falta por pagar —el alimento por comprar, los
// empleados, los gastos que ya se saben y, si se vende arreglado, arreglar
// cada pollo—. Cada renglón que se puede ajustar se toca.

import type { ReactNode } from "react";
import { clsx } from "clsx";
import type { Lote } from "../../db/schema";
import type { LoteMetrics } from "../../lib/metrics";
import type { Proyeccion } from "../../lib/proyeccion";
import { fecha, money, num, pct, plural, sumarDias } from "../../lib/format";
import { margenRelativo } from "../../lib/estimador";
import { tamanoMuestra } from "../../lib/muestreo";
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
  onPesar,
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
  onPesar?: () => void;
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
              {p?.gananciaRango && (
                <div className="mt-1 text-xs text-ink-faint tnum">
                  Puede quedar entre {money(p.gananciaRango[0])} y {money(p.gananciaRango[1])}
                </div>
              )}
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

        {p && <QueTanCerca lote={lote} metrics={metrics} p={p} onPesar={onPesar} />}

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

// Qué tan cerca de la realidad está el estimado, de dónde sale y qué lo afina:
// cuántas aves pesar, cuándo y cómo. El rango es el de 8 de cada 10 veces.
function QueTanCerca({
  lote,
  metrics: m,
  p,
  onPesar,
}: {
  lote: Lote;
  metrics: LoteMetrics;
  p: Proyeccion;
  onPesar?: () => void;
}) {
  const e = m.estimador;
  if (!e) return null;
  const pesajes = e.pesadas.length;
  const diaVenta = p.listo ? m.dias : p.diaVenta;
  const margen = margenRelativo(e, diaVenta);
  // Pesar unos días antes de vender afina más que pesar hoy para dentro de un mes.
  const diaPesaje = Math.max(m.dias, diaVenta - 3);
  const aves = tamanoMuestra(m.avesVivas, e.ultimo.cv * 100);
  const conPesaje = e.margenSiPesa(aves, diaPesaje, diaVenta);
  const cuando =
    diaPesaje <= m.dias ? "hoy" : `el ${fecha(sumarDias(lote.fechaInicio, diaPesaje))}, 3 días antes de vender`;
  const vale = conPesaje < margen - 0.01;

  return (
    <div className="border-t border-line px-5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm">Peso al vender</div>
        <div className="text-right font-display text-base font-semibold tnum">
          {p.pesoVentaRango
            ? `${num(p.pesoVentaLb, 1)} lb`
            : p.diaVentaRango
              ? `día ${p.diaVentaRango[0]}–${p.diaVentaRango[1]}`
              : `${num(p.pesoVentaLb, 1)} lb`}
        </div>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-faint tnum">
        {p.pesoVentaRango
          ? `Entre ${num(p.pesoVentaRango[0], 1)} y ${num(p.pesoVentaRango[1], 1)} lb, 8 de cada 10 veces (±${num(margen * 100, 0)}%).`
          : p.diaVentaRango
            ? `Llegan a ${num(p.pesoVentaLb, 1)} lb entre el día ${p.diaVentaRango[0]} y el ${p.diaVentaRango[1]}, 8 de cada 10 veces.`
            : ""}{" "}
        {`Sale de ${num(pesajes)} ${plural(pesajes, "pesaje", "pesajes")} de esta pollada`}
        {e.conHistoria && e.perfil
          ? `${
              e.perfil.ciclos === 1
                ? " y de tu pollada cerrada, que vendió"
                : ` y de tus ${num(e.perfil.ciclos)} polladas cerradas, que venden`
            } al ${pct(e.perfil.factor * 100, 0)} del peso Cobb. Un pesaje viejo no se estira con la curva: el lote se va pareciendo a lo que logra tu granja.`
          : ". Cuando cierres una pollada con sus ventas pesadas, la app aprende lo que logra tu granja y el estimado se acerca más."}
      </p>
      {vale && (
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-forest-50 px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-forest-700">
            Para afinarlo, pesa <span className="font-semibold tnum">{num(aves)} aves</span> {cuando}, de 5
            puntos del galpón —esquinas, centro, junto a comederos y bebederos—, no solo las que se dejan
            agarrar. El margen baja de ±{num(margen * 100, 0)}% a ±{num(conPesaje * 100, 0)}%.
          </p>
          {onPesar && diaPesaje <= m.dias && (
            <button
              type="button"
              onClick={onPesar}
              className="h-10 shrink-0 rounded-full bg-forest-600 px-4 text-sm font-semibold text-paper-raised transition active:scale-[0.97]"
            >
              Pesar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
