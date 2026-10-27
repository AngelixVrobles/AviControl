// La pestaña Crecimiento del ciclo: el pesaje, el peso contra la tabla y lo
// que se desvía.

import { useState } from "react";
import { clsx } from "clsx";
import type { Lote, Pesaje, Registro } from "../../db/schema";
import { juicioFca, type LoteMetrics } from "../../lib/metrics";
import { analizarMuestra, tamanoMuestra } from "../../lib/muestreo";
import { diasEntre, fecha, num, pct } from "../../lib/format";
import { RAZA } from "../../lib/labels";
import { pesoEstandarLb } from "../../lib/standards";
import { Button, Banda, Seccion } from "../../components/ui";
import { GraficaLineas } from "../../components/chart";

export function Muestreo({
  lote,
  pesajes,
  metrics,
  onNuevo,
  onEditar,
}: {
  lote: Lote;
  pesajes: Pesaje[];
  metrics: LoteMetrics;
  onNuevo?: () => void;
  onEditar?: (p: Pesaje) => void;
}) {
  const aves = metrics.avesVivas;
  const [todos, setTodos] = useState(false);
  const sugeridas = tamanoMuestra(aves);
  const ultimo = pesajes.length ? pesajes[pesajes.length - 1] : undefined;
  const m = ultimo ? analizarMuestra(ultimo.pesos, aves) : null;

  return (
    <>
      <Seccion
        className="mb-3 mt-8"
        etiqueta="Muestreo de peso"
        accion={
          onNuevo && (
            <button
              onClick={onNuevo}
              className="-mx-2 -my-3 px-2 py-3 text-sm font-semibold text-forest-600"
            >
              Pesar aves →
            </button>
          )
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
          {onNuevo && (
            <Button variant="soft" block className="mt-3" onClick={onNuevo}>
              Empezar pesaje
            </Button>
          )}
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
                      : "text-clay-text",
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

          {/* Todos los pesajes, también el único: antes la lista salía con dos
              o más y solo con los seis últimos, y los demás no se podían
              corregir. */}
          {pesajes.length > 0 && (
            <Banda className="mt-3 divide-y divide-line">
              {[...pesajes]
                .reverse()
                .slice(0, todos ? undefined : 6)
                .map((p) => {
                  const s = analizarMuestra(p.pesos, aves);
                  if (!s) return null;
                  return (
                    <button
                      key={p.id}
                      disabled={!onEditar}
                      onClick={() => onEditar?.(p)}
                      className="flex w-full items-center justify-between px-5 py-2.5 text-left text-sm transition active:bg-paper-sunken disabled:active:bg-transparent"
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
          {!todos && pesajes.length > 6 && (
            <button
              onClick={() => setTodos(true)}
              className="mt-2 w-full py-2 text-center text-sm font-medium text-forest-600"
            >
              Ver los {num(pesajes.length)} pesajes
            </button>
          )}
        </>
      )}
    </>
  );
}

export function GridCrecimiento({ metrics: m }: { metrics: LoteMetrics }) {
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

export function Diagnostico({ metrics: m }: { metrics: LoteMetrics }) {
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

export function Desvio({ lote, registros }: { lote: Lote; registros: Registro[] }) {
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
                punto.desvio >= 0 ? "text-forest-600" : "text-clay-text",
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
            referencia={{ valor: 0, texto: RAZA, minimo: 10 }}
            nota={nota}
            formatoY={(v) => `${v > 0 ? "+" : ""}${num(v, 0)}%`}
            etiquetaX={(v) => `d${v}`}
            foco={foco}
            onFoco={setFoco}
            resumen={`Desvío del peso contra el estándar ${RAZA}, del día ${puntos[0].dia} al ${ultimo.dia}.`}
          />
        </div>
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
          La línea marcada {RAZA} es el peso que le toca. Arriba es lo que le sacas
          de ventaja; abajo, lo que le falta. Arrastra el dedo para ver cualquier pesaje.
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
