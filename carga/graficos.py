#!/usr/bin/env python3
"""
Gráficos del informe (guía, secciones 6.4.3 y 6.5) a partir de los resultados
de carga/resultados/. Escribe PNG en carga/graficos/.

  01  Latencia (p50, p95, p99) en el tiempo + tasa ofrecida/lograda (estrés)
  02  Latencia en el tiempo + VUs (carga normal)
  03  Throughput logrado vs. carga ofrecida (estrés, 3 repeticiones)
  04  p95 vs. throughput: la "rodilla" (estrés, 3 repeticiones)
  05  Tasa de error en el tiempo (estrés, 3 repeticiones)
  06  CPU, memoria y disco del servidor en la misma escala temporal (estrés)
  07  CDF de latencias por escenario (baja, normal, estrés)
  08  Boxplot de latencia por página (carga normal)
  09  Web Vitals p75 del navegador real por escenario
  10  Consultas SQL más costosas durante el estrés

Fuentes por prueba (mismo prefijo): .meta.json, .csv.gz (crudo de k6, solo
local: no se versiona por tamaño), .servidor.csv, .consultas.csv,
.navegador.json. Solo se usan las repeticiones válidas (R1, R2, R3).

Uso:  python3 carga/graficos.py            (requiere matplotlib)
"""
import csv
import gzip
import json
import math
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

RAIZ = Path(__file__).resolve().parent
RESULTADOS = RAIZ / "resultados"
SALIDA = RAIZ / "graficos"

# --- Estilo (paleta categórica validada, modo claro, para imprimir) -------------
AZUL, NARANJA, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
TEXTO, TEXTO_2, GRILLA, GRIS = "#0b0b0b", "#52514e", "#e4e3df", "#8a8984"
COLOR_ESCENARIO = {"baja": AZUL, "normal": NARANJA, "estres": AQUA}
NOMBRE_ESCENARIO = {"baja": "Baja (5 VUs)", "normal": "Normal (30 VUs)", "estres": "Estrés (10–60 ses/s)"}
# Repeticiones: mismo color, se distinguen por marcador y trazo (no por color).
ESTILO_REP = {"R1": ("o", "-"), "R2": ("s", "--"), "R3": ("^", ":")}

plt.rcParams.update({
    "figure.dpi": 150, "savefig.dpi": 200, "savefig.bbox": "tight",
    "font.size": 9, "axes.titlesize": 10, "axes.titleweight": "bold", "axes.labelsize": 9,
    "axes.edgecolor": GRIS, "axes.labelcolor": TEXTO_2, "axes.titlecolor": TEXTO,
    "xtick.color": TEXTO_2, "ytick.color": TEXTO_2, "text.color": TEXTO,
    "axes.grid": True, "grid.color": GRILLA, "grid.linewidth": 0.6,
    "axes.spines.top": False, "axes.spines.right": False,
    "lines.linewidth": 1.5, "legend.frameon": False, "legend.fontsize": 8,
})

CALENTAMIENTO_S, SUBIDA_S, DESCARTE_S = 60, 30, 20
UMBRAL_P95_MS = 800  # criterio de saturación (guía 6.5)


# --- Lectura de datos -------------------------------------------------------------
def pruebas(escenario):
    """Pruebas válidas de un escenario: [(repeticion, prefijo, meta)]."""
    salida = []
    for meta_path in sorted((RESULTADOS / escenario.upper()).glob("*.meta.json")):
        meta = json.loads(meta_path.read_text(encoding="utf8"))
        rep = meta.get("repeticion", "")
        if rep in ("R1", "R2", "R3"):
            salida.append((rep, str(meta_path)[: -len(".meta.json")], meta))
    return sorted(salida)


_cache_crudo = {}


def crudo(prefijo):
    """Peticiones de la fase de medición del CSV crudo de k6 (en caché)."""
    if prefijo in _cache_crudo:
        return _cache_crudo[prefijo]
    peticiones, sesiones, vus = [], [], []
    with gzip.open(f"{prefijo}.csv.gz", "rt", encoding="utf8") as f:
        lector = csv.reader(f)
        cab = next(lector)
        i_nom, i_ts, i_val = cab.index("metric_name"), cab.index("timestamp"), cab.index("metric_value")
        i_ok, i_tags = cab.index("expected_response"), cab.index("extra_tags")
        for fila in lector:
            nombre = fila[i_nom]
            if nombre == "http_req_duration":
                tags = fila[i_tags]
                if "fase=medicion" not in tags:
                    continue
                pagina = re.search(r"pagina=([a-z_]+)", tags)
                peticiones.append((int(fila[i_ts]), float(fila[i_val]), fila[i_ok] == "false",
                                   pagina.group(1) if pagina else "otra"))
            elif nombre == "iterations" and "fase=medicion" in fila[i_tags]:
                sesiones.append(int(fila[i_ts]))
            elif nombre == "vus":
                vus.append((int(fila[i_ts]), float(fila[i_val])))
    t0 = min(p[0] for p in peticiones)
    _cache_crudo[prefijo] = {"t0": t0, "peticiones": peticiones, "sesiones": sesiones, "vus": vus}
    return _cache_crudo[prefijo]


def servidor(prefijo):
    """Serie de tiempo del servidor (.servidor.csv) con epoch en segundos."""
    from datetime import datetime

    filas = []
    with open(f"{prefijo}.servidor.csv", encoding="utf8") as f:
        for fila in csv.DictReader(f):
            o = {k: (float(v) if v not in ("", None) and k != "instante" else math.nan) for k, v in fila.items()}
            o["ts"] = datetime.fromisoformat(fila["instante"]).timestamp()
            filas.append(o)
    return filas


def percentil(valores, p):
    if not valores:
        return math.nan
    s = sorted(valores)
    return s[min(len(s) - 1, int(p * len(s)))]


def escalones(meta):
    return [int(x) for x in meta.get("estres_escalones", "20,50,100,150").split(",")]


def segundos(duracion):
    m = re.fullmatch(r"(?:(\d+)m)?(?:(\d+)s)?", duracion or "")
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0) if m else 150


def mesetas(prefijo, meta):
    """Por meseta: ofrecido, logrado (ses/s y req/s), p50/p95/p99, error %, CPU."""
    d = crudo(prefijo)
    meseta = segundos(meta.get("estres_meseta"))
    srv = servidor(prefijo) if Path(f"{prefijo}.servidor.csv").exists() else []
    salida = []
    for i, ofrecido in enumerate(escalones(meta)):
        ini = d["t0"] + SUBIDA_S + i * (SUBIDA_S + meseta) + DESCARTE_S
        fin = d["t0"] + SUBIDA_S + i * (SUBIDA_S + meseta) + meseta
        p = [x for x in d["peticiones"] if ini <= x[0] < fin]
        if not p:
            continue
        dur = [x[1] for x in p]
        cpu = [s["cpu_vm_pct"] for s in srv if ini <= s["ts"] <= fin and not math.isnan(s["cpu_vm_pct"])]
        salida.append({
            "ofrecido": ofrecido,
            "ses_s": sum(1 for t in d["sesiones"] if ini <= t < fin) / (fin - ini),
            "req_s": len(p) / (fin - ini),
            "p50": percentil(dur, 0.5), "p95": percentil(dur, 0.95), "p99": percentil(dur, 0.99),
            "error": 100 * sum(1 for x in p if x[2]) / len(p),
            "cpu": sum(cpu) / len(cpu) if cpu else math.nan,
        })
    return salida


def ventanas(peticiones, t0, ancho=10):
    """Agrupa peticiones en ventanas de `ancho` s: [(minuto, p50, p95, p99, error %, req/s)]."""
    grupos = {}
    for ts, dur, falla, _ in peticiones:
        grupos.setdefault((ts - t0) // ancho, []).append((dur, falla))
    salida = []
    for k in sorted(grupos):
        g = grupos[k]
        dur = [x[0] for x in g]
        salida.append(((k * ancho + ancho / 2) / 60, percentil(dur, 0.5), percentil(dur, 0.95),
                       percentil(dur, 0.99), 100 * sum(1 for x in g if x[1]) / len(g), len(g) / ancho))
    return salida


def ofrecido_en_el_tiempo(meta):
    """Tasa de sesiones/s programada (minutos desde el inicio de la medición)."""
    meseta = segundos(meta.get("estres_meseta"))
    xs, ys, t, previo = [0.0], [5.0], 0, 5  # startRate: 5
    for e in escalones(meta):
        t += SUBIDA_S
        xs.append(t / 60), ys.append(e)
        t += meseta
        xs.append(t / 60), ys.append(e)
        previo = e
    xs.append((t + 60) / 60), ys.append(0)
    return xs, ys


def guardar(fig, nombre):
    SALIDA.mkdir(exist_ok=True)
    fig.savefig(SALIDA / nombre, facecolor="white")
    plt.close(fig)
    print(f"  {nombre}")


def nota(fig, texto):
    fig.text(0.01, -0.02, texto, fontsize=7, color=TEXTO_2, ha="left", va="top", wrap=True)


# --- Gráficos ---------------------------------------------------------------------
def g01_latencia_estres():
    rep, prefijo, meta = pruebas("estres")[0]
    d = crudo(prefijo)
    v = ventanas(d["peticiones"], d["t0"])
    fig, (a, b) = plt.subplots(2, 1, figsize=(7.2, 5.2), sharex=True, gridspec_kw={"height_ratios": [3, 2]})
    x = [w[0] for w in v]
    for i, (nombre, color) in enumerate([("p50", AZUL), ("p95", NARANJA), ("p99", AQUA)], start=1):
        a.plot(x, [w[i] for w in v], color=color, label=nombre)
    a.axhline(UMBRAL_P95_MS, color=GRIS, lw=1, ls="--")
    a.text(x[0], UMBRAL_P95_MS, " criterio p95 = 800 ms", va="bottom", fontsize=7, color=TEXTO_2)
    a.set_ylabel("Latencia (ms)")
    a.set_title(f"Latencia en el tiempo bajo estrés escalonado ({rep})", loc="left")
    a.legend(loc="upper left", ncol=3)
    xs, ys = ofrecido_en_el_tiempo(meta)
    b.plot(xs, ys, color=GRIS, ls="--", label="Ofrecido (programado)")
    logr = {}
    for t in d["sesiones"]:
        logr[(t - d["t0"]) // 10] = logr.get((t - d["t0"]) // 10, 0) + 1
    b.plot([(k * 10 + 5) / 60 for k in sorted(logr)], [logr[k] / 10 for k in sorted(logr)], color=AZUL, label="Logrado")
    b.set_ylabel("Sesiones/s")
    b.set_xlabel("Minutos desde el inicio de la medición (sin calentamiento)")
    b.legend(loc="upper left", ncol=2)
    nota(fig, "Ventanas de 10 s. Fuente: CSV crudo de k6 (fase de medición). Mismo eje de tiempo en ambos paneles.")
    guardar(fig, "01_latencia_tiempo_estres.png")


def g02_latencia_normal():
    rep, prefijo, _ = pruebas("normal")[0]
    d = crudo(prefijo)
    v = ventanas(d["peticiones"], d["t0"], ancho=15)
    fig, (a, b) = plt.subplots(2, 1, figsize=(7.2, 4.6), sharex=True, gridspec_kw={"height_ratios": [3, 2]})
    x = [w[0] for w in v]
    for i, (nombre, color) in enumerate([("p50", AZUL), ("p95", NARANJA), ("p99", AQUA)], start=1):
        a.plot(x, [w[i] for w in v], color=color, label=nombre)
    a.set_ylabel("Latencia (ms)")
    a.set_title(f"Latencia en el tiempo con carga normal ({rep})", loc="left")
    a.legend(loc="upper left", ncol=3)
    vus = [(t - d["t0"]) / 60 for t, _ in d["vus"]], [n for _, n in d["vus"]]
    b.plot(*vus, color=GRIS)
    b.set_ylabel("VUs")
    b.set_xlabel("Minutos desde el inicio de la medición")
    nota(fig, "Ventanas de 15 s. Modelo cerrado: subida a 30 VUs en 2 min, meseta de 10 min y bajada.")
    guardar(fig, "02_latencia_tiempo_normal.png")


def g03_g04_saturacion():
    datos = [(rep, mesetas(prefijo, meta)) for rep, prefijo, meta in pruebas("estres")]
    # 03: throughput logrado vs ofrecido
    fig, ax = plt.subplots(figsize=(6, 4.2))
    tope = max(m["ofrecido"] for _, ms in datos for m in ms)
    ax.plot([0, tope], [0, tope], color=GRIS, ls="--", lw=1, label="Ideal (logrado = ofrecido)")
    for rep, ms in datos:
        marcador, trazo = ESTILO_REP[rep]
        ax.plot([m["ofrecido"] for m in ms], [m["ses_s"] for m in ms], color=AZUL, marker=marcador, ls=trazo, ms=6, label=rep)
    ax.set_xlabel("Carga ofrecida (sesiones/s)")
    ax.set_ylabel("Throughput logrado (sesiones/s)")
    ax.set_title("Throughput logrado vs. carga ofrecida (estrés)", loc="left")
    ax.legend(loc="upper left")
    ax.annotate("se aplana: saturación", xy=(50, 40.4), xytext=(30, 47), fontsize=8, color=TEXTO_2,
                arrowprops={"arrowstyle": "->", "color": GRIS})
    nota(fig, "Cada punto es una meseta (últimos 100 s de cada una). Sesión = recorrido completo de un usuario virtual.")
    guardar(fig, "03_throughput_vs_ofrecido.png")

    # 04: p95 vs throughput (rodilla)
    fig, ax = plt.subplots(figsize=(6, 4.2))
    for rep, ms in datos:
        marcador, trazo = ESTILO_REP[rep]
        ax.plot([m["req_s"] for m in ms], [m["p95"] for m in ms], color=AZUL, marker=marcador, ls=trazo, ms=6, label=rep)
        for m in ms if rep == "R1" else []:
            ax.annotate(f"{m['ofrecido']}", (m["req_s"], m["p95"]), textcoords="offset points", xytext=(-14, 4), fontsize=7, color=TEXTO_2)
    ax.axhline(UMBRAL_P95_MS, color=GRIS, ls="--", lw=1)
    ax.text(40, UMBRAL_P95_MS, "criterio p95 = 800 ms", va="bottom", fontsize=7, color=TEXTO_2)
    ax.set_xlabel("Throughput logrado (peticiones/s)")
    ax.set_ylabel("p95 (ms)")
    ax.set_title("p95 vs. throughput: rodilla de la curva (estrés)", loc="left")
    ax.legend(loc="upper left")
    nota(fig, "Etiquetas (R1): sesiones/s ofrecidas en cada meseta. La latencia crece de forma no lineal desde ~150 req/s.")
    guardar(fig, "04_p95_vs_throughput.png")


def g05_errores():
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    _, _, meta = pruebas("estres")[0]
    fin_mesetas = len(escalones(meta)) * (SUBIDA_S + segundos(meta.get("estres_meseta"))) / 60
    ax.axvspan(fin_mesetas, fin_mesetas + 1.6, color="#f3f2ee", lw=0, zorder=0)
    ax.text(fin_mesetas + 0.05, 75, "bajada", fontsize=7, color=TEXTO_2)
    for rep, prefijo, _ in pruebas("estres"):
        d = crudo(prefijo)
        v = ventanas(d["peticiones"], d["t0"], ancho=15)
        marcador, trazo = ESTILO_REP[rep]
        ax.plot([w[0] for w in v], [w[4] for w in v], color=AZUL, ls=trazo, label=rep)
    ax.axhline(1, color=GRIS, ls="--", lw=1)
    ax.text(0, 1, " criterio 1 %", va="bottom", fontsize=7, color=TEXTO_2)
    ax.set_ylabel("Peticiones fallidas (%)")
    ax.set_xlabel("Minutos desde el inicio de la medición")
    ax.set_title("Tasa de error en el tiempo (estrés)", loc="left")
    ax.legend(loc="upper left")
    nota(fig, "Todos los errores son 1211 (dial timeout) del generador: límite de conexiones de la red doméstica. "
              "El servidor no respondió 5xx (error_5xx_pct = 0 en Prometheus). En la bajada quedan pocas peticiones, "
              "casi todas conexiones en cola que expiran.")
    guardar(fig, "05_errores_tiempo_estres.png")


def g06_recursos():
    rep, prefijo, meta = pruebas("estres")[0]
    srv = servidor(prefijo)
    t0 = crudo(prefijo)["t0"]
    x = [(s["ts"] - t0) / 60 for s in srv]
    fig, ejes = plt.subplots(4, 1, figsize=(7.2, 8), sharex=True)
    paneles = [
        ("CPU de la VM (% de 2 vCPU)", [("cpu_vm_pct", "VM", AZUL)]),
        ("CPU por contenedor (% de 1 núcleo)", [("cpu_api_pct", "API (Node)", AZUL), ("cpu_db_pct", "PostgreSQL", NARANJA),
                                                 ("cpu_monitoreo_pct", "Monitoreo", AQUA)]),
        ("Memoria (MB)", [("memoria_api_mb", "API (Node)", AZUL), ("memoria_db_mb", "PostgreSQL", NARANJA)]),
        ("Disco (kB/s)", [("disco_lectura_kb_s", "Lectura", AZUL), ("disco_escritura_kb_s", "Escritura", NARANJA)]),
    ]
    for ax, (titulo, series) in zip(ejes, paneles):
        for col, nombre, color in series:
            ax.plot(x, [s[col] for s in srv], color=color, label=nombre)
        ax.set_title(titulo, loc="left", fontsize=9)
        if len(series) > 1:
            ax.legend(loc="upper left", ncol=3)
    ejes[0].set_ylim(0, 105)
    # Mesetas sombreadas y rotuladas en el panel superior
    meseta = segundos(meta.get("estres_meseta"))
    for i, e in enumerate(escalones(meta)):
        ini = (SUBIDA_S + i * (SUBIDA_S + meseta)) / 60
        for ax in ejes:
            ax.axvspan(ini, ini + meseta / 60, color="#f3f2ee", zorder=0, lw=0)
        ejes[0].text(ini + meseta / 120, 3, f"{e}", ha="center", fontsize=7, color=TEXTO_2)
    ejes[-1].set_xlabel("Minutos desde el inicio de la medición (bandas: mesetas, en sesiones/s)")
    fig.suptitle(f"Recursos del servidor durante el estrés ({rep})", x=0.01, ha="left", fontweight="bold", fontsize=10)
    fig.tight_layout()
    nota(fig, "Fuente: Prometheus de la VM (node-exporter y cAdvisor), cada 15 s. Azure 2 vCPU / 7,7 GB.")
    guardar(fig, "06_recursos_servidor_estres.png")


def g07_cdf():
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for esc in ("baja", "normal", "estres"):
        todas = [x for _, prefijo, _ in pruebas(esc) for x in crudo(prefijo)["peticiones"]]
        dur = sorted(x[1] for x in todas if not x[2])  # sin las fallidas (no tienen respuesta)
        n = len(dur)
        paso = max(1, n // 2000)
        ax.plot(dur[::paso] + [dur[-1]], [i / n for i in range(0, n, paso)] + [1.0],
                color=COLOR_ESCENARIO[esc], label=f"{NOMBRE_ESCENARIO[esc]} · n = {n:,}".replace(",", "."))
    ax.set_xscale("log")
    for p in (0.95, 0.99):
        ax.axhline(p, color=GRIS, ls=":", lw=1)
        ax.text(1.02, p, f"p{int(p * 100)}", transform=ax.get_yaxis_transform(), fontsize=7, color=TEXTO_2, va="center")
    ax.set_xlabel("Latencia (ms, escala logarítmica)")
    ax.set_ylabel("Proporción de peticiones ≤ x")
    ax.set_title("Distribución acumulada (CDF) de latencias por escenario", loc="left")
    ax.legend(loc="lower right")
    nota(fig, "Peticiones respondidas de la medición (3 repeticiones por escenario); el estrés incluye todas sus mesetas. "
              "Se excluyen las fallidas por el generador (1211, sin respuesta del servidor).")
    guardar(fig, "07_cdf_latencias.png")


def g08_boxplot():
    orden = ["home", "listado", "busqueda", "detalle", "carrito", "login", "checkout", "orden"]
    etiquetas = {"home": "Home", "listado": "Listado", "busqueda": "Búsqueda", "detalle": "Detalle",
                 "carrito": "Carrito", "login": "Login", "checkout": "Checkout", "orden": "Orden"}
    por_pagina = {p: [] for p in orden}
    for _, prefijo, _ in pruebas("normal"):
        for _, dur, _, pagina in crudo(prefijo)["peticiones"]:
            if pagina in por_pagina:
                por_pagina[pagina].append(dur)
    fig, ax = plt.subplots(figsize=(7.2, 4))
    caja = ax.boxplot([por_pagina[p] for p in orden], whis=(5, 95), showfliers=False, patch_artist=True, widths=0.55,
                      medianprops={"color": TEXTO, "lw": 1.5}, whiskerprops={"color": GRIS}, capprops={"color": GRIS})
    for c in caja["boxes"]:
        c.set(facecolor="#d5e5f8", edgecolor=AZUL, lw=1)
    ax.set_xticks(range(1, len(orden) + 1), [f"{etiquetas[p]}\nn = {len(por_pagina[p]):,}".replace(",", ".") for p in orden])
    ax.set_yscale("log")
    ax.set_ylabel("Latencia (ms, escala logarítmica)")
    ax.set_title("Latencia por página con carga normal (3 repeticiones)", loc="left")
    nota(fig, "Caja: p25–p75; línea: mediana; bigotes: p5–p95. Login es la más lenta por argon2id (hash intencionalmente costoso).")
    guardar(fig, "08_boxplot_paginas_normal.png")


def g09_web_vitals():
    vitals = [("ttfb", "TTFB p75 (ms)", 1), ("lcp", "LCP p75 (ms)", 1), ("inp", "INP p75 (ms)", 1), ("cls", "CLS p75", 1)]
    fig, ejes = plt.subplots(1, 4, figsize=(8, 3))
    escenarios = ["baja", "normal", "estres"]
    for ax, (clave, titulo, _) in zip(ejes, vitals):
        medias, bajos, altos = [], [], []
        for esc in escenarios:
            vals = []
            for _, prefijo, _ in pruebas(esc):
                ruta = Path(f"{prefijo}.navegador.json")
                if ruta.exists():
                    m = json.loads(ruta.read_text(encoding="utf8"))["metrics"].get(f"browser_web_vital_{clave}")
                    if m:
                        vals.append(m["values"]["p(75)"])
            media = sum(vals) / len(vals) if vals else math.nan
            medias.append(media), bajos.append(media - min(vals)), altos.append(max(vals) - media)
        ax.bar(range(3), medias, color=[COLOR_ESCENARIO[e] for e in escenarios], width=0.6,
               yerr=[bajos, altos], ecolor=TEXTO_2, capsize=3, error_kw={"lw": 1})
        for i, v in enumerate(medias):
            ax.annotate(f"{v:.3f}" if clave == "cls" else f"{v:.0f}", (i, v), textcoords="offset points",
                        xytext=(8, 2), fontsize=7)
        ax.set_xticks(range(3), ["Baja", "Normal", "Estrés"])
        ax.set_title(titulo, loc="left", fontsize=9)
        ax.grid(axis="x", visible=False)
    fig.suptitle("Web Vitals del navegador real por escenario", x=0.01, ha="left", fontweight="bold", fontsize=10)
    fig.tight_layout()
    nota(fig, "Barra: promedio del p75 de las 3 repeticiones; línea: mínimo–máximo. Umbrales «bueno» de Google: "
              "LCP ≤ 2500 ms, INP ≤ 200 ms, CLS ≤ 0,1, TTFB ≤ 800 ms.")
    guardar(fig, "09_web_vitals_escenarios.png")


def g10_consultas():
    _, prefijo, _ = pruebas("estres")[0]
    with open(f"{prefijo}.consultas.csv", encoding="utf8") as f:
        filas = list(csv.DictReader(f))
    total = sum(float(r["segundos_totales"]) for r in filas)

    def nombre(sql, ms):
        s = sql.lower()
        if "unidades_vendidas" in s:
            return "Productos relacionados (detalle)"
        if "descripcion_larga" in s:
            return "Detalle del producto"
        if s.startswith("select count(*)") and "ilike" in s:
            return "Búsqueda: conteo (ILIKE)"
        if "ilike" in s:
            return "Búsqueda: resultados (ILIKE)"
        if "from categorias c left join productos" in s:
            return "Categorías con conteo"
        if "from productos p" in s and ms > 5:
            return "Búsqueda: resultados (ILIKE)"
        return "Listado del catálogo" if ms < 2 else "Otra consulta"

    top = filas[:5]
    resto = total - sum(float(r["segundos_totales"]) for r in top)
    etiquetas = [f"{nombre(r['consulta'], float(r['ms_por_llamada']))} · {float(r['ms_por_llamada']):.1f} ms/llamada" for r in top]
    valores = [100 * float(r["segundos_totales"]) / total for r in top]
    etiquetas.append("Otras consultas"), valores.append(100 * resto / total)
    fig, ax = plt.subplots(figsize=(7.2, 3.2))
    y = list(range(len(valores)))[::-1]
    ax.barh(y, valores, color=[NARANJA] + [AZUL] * (len(valores) - 1), height=0.6)
    ax.set_yticks(y, etiquetas)
    for yi, v in zip(y, valores):
        ax.text(v + 1, yi, f"{v:.1f} %", va="center", fontsize=8)
    ax.set_xlim(0, 100)
    ax.set_xlabel("% del tiempo total de PostgreSQL durante la prueba")
    ax.set_title("Consultas SQL más costosas durante el estrés (R1)", loc="left")
    ax.grid(axis="y", visible=False)
    nota(fig, "Fuente: pg_stat_statements vía postgres-exporter. La consulta de relacionados se ejecuta en cada visita al detalle.")
    guardar(fig, "10_consultas_sql_estres.png")


if __name__ == "__main__":
    print(f"Gráficos en {SALIDA}:")
    g01_latencia_estres()
    g02_latencia_normal()
    g03_g04_saturacion()
    g05_errores()
    g06_recursos()
    g07_cdf()
    g08_boxplot()
    g09_web_vitals()
    g10_consultas()
