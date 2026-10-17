// La pestaña Dinero del ciclo: cómo salió, el precio mínimo y el mejor día
// para vender.

import { useState } from "react";
import { clsx } from "clsx";
import { db, type Gasto, type Ingreso, type Lote, type Registro } from "../../db/schema";
import type { LoteMetrics } from "../../lib/metrics";
import { proyectarVenta, type Proyeccion } from "../../lib/proyeccion";
import { analizarPrecio, precioAlimentoLb } from "../../lib/precios";
import { resultadoCiclo, type Contraste } from "../../lib/cierre";
import { analizarPuntoOptimo } from "../../lib/optimo";
import { pesoObjetivoDe } from "../../lib/lote";
import { gananciaPorSocio } from "../../lib/sociedad";
import { fecha, money, num, numCompacto, pct, plural, porLb } from "../../lib/format";
import { LB_POR_QUINTAL } from "../../lib/standards";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { Banda, Seccion } from "../../components/ui";
import { GraficaLineas } from "../../components/chart";

export function ComoSalio({
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

export function PrecioMinimo({
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
  // Con ventas hechas, el precio mínimo ya descuenta lo cobrado: el desglose
  // por libra también, si no sumaba RD$93 bajo un mínimo de RD$16.
  const neto = a.costoTotal > 0 ? a.costoNeto / a.costoTotal : 1;

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
              key={String(lote.precioVentaLb ?? "")}
              type="number"
              inputMode="decimal"
              min={0}
              defaultValue={lote.precioVentaLb ?? ""}
              onBlur={(e) =>
                db.lotes.update(lote.id, {
                  precioVentaLb: Math.max(0, Number(e.target.value) || 0) || undefined,
                })
              }
              className="h-11 w-20 rounded-xl border border-borde bg-paper-raised px-2 text-center text-base font-semibold text-ink tnum outline-none transition focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
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
          De cada libra que vendas, {porLb((a.costoAlimento * neto) / a.lbEnPie)} son
          alimento ({pct(a.alimentoPctDelCosto, 0)} del costo),{" "}
          {porLb((a.costoAves * neto) / a.lbEnPie)} el pollito y{" "}
          {porLb((a.costoOtros * neto) / a.lbEnPie)} lo demás
          {metrics.ingresos > 0 ? ", ya descontado lo que vendiste" : ""}. Cada {money(1)} de más por
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

export function PuntoOptimo({
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
