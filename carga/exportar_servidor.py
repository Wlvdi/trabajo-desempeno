"""
Exporta las métricas del SERVIDOR de una prueba de carga desde Prometheus
(lo que Grafana muestra en el dashboard "Subligol – Desempeño") a CSV.

Se ejecuta EN LA VM (la llama carga/exportar-servidor.sh por SSH) y escribe en
la salida estándar un único bloque con tres secciones separadas por líneas
"### <nombre>", que el script local guarda como:
  <prefijo>.servidor.csv    serie de tiempo (cada 15 s) del servidor
  <prefijo>.rutas.csv       req/s y p95 por ruta (cada 15 s)
  <prefijo>.consultas.csv   las 15 consultas SQL más costosas de la prueba

Argumentos: INICIO FIN (ISO 8601 con zona horaria, tomados del .meta.json).
Solo usa la biblioteca estándar de Python (la VM no tiene pandas).
"""
import csv
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

CHILE = ZoneInfo("America/Santiago")  # misma zona horaria que el .meta.json

PROM = "http://localhost:9090/api/v1/"
PASO = 15  # segundos (igual que el scrape de Prometheus x3, sin huecos)
S = "container_label_com_docker_compose_service"
EXCLUIR = 'ruta!~"/api/salud|/api/vitals"'  # healthcheck y respaldo de Web Vitals
MONITOREO = "cadvisor|prometheus|grafana|node-exporter|postgres-exporter"

inicio = datetime.fromisoformat(sys.argv[1]).timestamp()
fin = datetime.fromisoformat(sys.argv[2]).timestamp()


def rango(expr):
    """query_range → {timestamp: valor} (una serie) o {etiqueta: {ts: valor}}."""
    url = PROM + "query_range?" + urllib.parse.urlencode(
        {"query": expr, "start": inicio, "end": fin, "step": PASO}
    )
    return json.load(urllib.request.urlopen(url, timeout=60))["data"]["result"]


def serie(expr, factor=1.0):
    r = rango(expr)
    return {int(t): float(v) * factor for t, v in r[0]["values"]} if r else {}


# --- Serie de tiempo del servidor ------------------------------------------------
COLUMNAS = [
    # Tráfico (servidor)
    ("req_s", f"sum(rate(http_request_duration_seconds_count{{{EXCLUIR}}}[1m]))", 1),
    ("p50_ms", f"histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket{{{EXCLUIR}}}[1m])))", 1000),
    ("p95_ms", f"histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{{{EXCLUIR}}}[1m])))", 1000),
    ("p99_ms", f"histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{{{EXCLUIR}}}[1m])))", 1000),
    ("latencia_media_ms", f"sum(rate(http_request_duration_seconds_sum{{{EXCLUIR}}}[1m])) / sum(rate(http_request_duration_seconds_count{{{EXCLUIR}}}[1m]))", 1000),
    ("error_5xx_pct", f'(100 * sum(rate(http_request_duration_seconds_count{{estado=~"5..",{EXCLUIR}}}[1m])) / clamp_min(sum(rate(http_request_duration_seconds_count{{{EXCLUIR}}}[1m])), 1e-9)) or vector(0)', 1),
    ("error_4xx_pct", f'(100 * sum(rate(http_request_duration_seconds_count{{estado=~"4..",{EXCLUIR}}}[1m])) / clamp_min(sum(rate(http_request_duration_seconds_count{{{EXCLUIR}}}[1m])), 1e-9)) or vector(0)', 1),
    ("peticiones_en_curso", "sum(http_peticiones_en_curso)", 1),
    # Recursos (VM y contenedores; CPU en % de un núcleo, la VM tiene 2)
    ("cpu_vm_pct", '100 - 100 * avg(rate(node_cpu_seconds_total{mode="idle"}[1m]))', 1),
    ("cpu_api_pct", f'100 * sum(rate(container_cpu_usage_seconds_total{{{S}="api"}}[1m]))', 1),
    ("cpu_db_pct", f'100 * sum(rate(container_cpu_usage_seconds_total{{{S}="db"}}[1m]))', 1),
    ("cpu_web_pct", f'100 * sum(rate(container_cpu_usage_seconds_total{{{S}="web"}}[1m]))', 1),
    ("cpu_monitoreo_pct", f'100 * sum(rate(container_cpu_usage_seconds_total{{{S}=~"{MONITOREO}"}}[1m]))', 1),
    ("memoria_vm_pct", "100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)", 1),
    ("memoria_api_mb", f'sum(container_memory_working_set_bytes{{{S}="api"}})', 1 / 2**20),
    ("memoria_db_mb", f'sum(container_memory_working_set_bytes{{{S}="db"}})', 1 / 2**20),
    ("disco_lectura_kb_s", "sum(rate(node_disk_read_bytes_total[1m]))", 1 / 1024),
    ("disco_escritura_kb_s", "sum(rate(node_disk_written_bytes_total[1m]))", 1 / 1024),
    ("red_api_rx_kb_s", f'sum(rate(container_network_receive_bytes_total{{{S}="web"}}[1m]))', 1 / 1024),
    ("red_api_tx_kb_s", f'sum(rate(container_network_transmit_bytes_total{{{S}="web"}}[1m]))', 1 / 1024),
    # Node.js y pool de PostgreSQL
    ("eventloop_p99_ms", 'max(nodejs_eventloop_lag_p99_seconds{job="api"})', 1000),
    ("pool_total", 'sum(api_pg_pool_conexiones{estado="total"})', 1),
    ("pool_libres", 'sum(api_pg_pool_conexiones{estado="libres"})', 1),
    ("pool_en_espera", 'sum(api_pg_pool_conexiones{estado="en_espera"})', 1),
    ("argon2_verificar_p95_ms", 'histogram_quantile(0.95, sum by (le) (rate(api_contrasenas_duracion_segundos_bucket{operacion="verificar"}[1m])))', 1000),
    # Base de datos y negocio
    ("pg_conexiones_activas", 'sum(pg_stat_activity_count{datname="subligol",state="active"})', 1),
    ("pg_transacciones_s", 'sum(rate(pg_stat_database_xact_commit{datname="subligol"}[1m]))', 1),
    ("compras_ok_s", 'sum(rate(api_compras_total{resultado="ok"}[1m]))', 1),
    ("logins_s", "sum(rate(api_logins_total[1m]))", 1),
    # Generador (si la prueba usó PROMETHEUS=1)
    ("k6_vus", "max(k6_vus)", 1),
    ("k6_sesiones_s", 'sum(rate(k6_iterations_total{fase="medicion"}[1m]))', 1),
]

datos = {nombre: serie(expr, f) for nombre, expr, f in COLUMNAS}
tiempos = sorted({t for s in datos.values() for t in s})

salida = csv.writer(sys.stdout, lineterminator="\n")
print("### servidor")
salida.writerow(["instante", "segundos"] + [c[0] for c in COLUMNAS])
for t in tiempos:
    fila = [datetime.fromtimestamp(t, CHILE).isoformat(timespec="seconds"), int(t - inicio)]
    for nombre, _, _ in COLUMNAS:
        v = datos[nombre].get(t)
        fila.append("" if v is None or v != v else round(v, 3))  # v != v → NaN
    salida.writerow(fila)

# --- Por ruta ---------------------------------------------------------------------
print("### rutas")
salida.writerow(["instante", "segundos", "ruta", "req_s", "p95_ms"])
req = {r["metric"]["ruta"]: dict(r["values"]) for r in rango(f"sum by (ruta) (rate(http_request_duration_seconds_count{{{EXCLUIR}}}[1m]))")}
p95 = {r["metric"]["ruta"]: dict(r["values"]) for r in rango(f"histogram_quantile(0.95, sum by (le, ruta) (rate(http_request_duration_seconds_bucket{{{EXCLUIR}}}[1m])))")}
for ruta in sorted(req):
    for t, v in sorted(req[ruta].items()):
        if float(v) == 0:
            continue
        p = p95.get(ruta, {}).get(t)
        salida.writerow([
            datetime.fromtimestamp(t, CHILE).isoformat(timespec="seconds"), int(t - inicio), ruta,
            round(float(v), 3), "" if p is None or p == "NaN" else round(1000 * float(p), 1),
        ])

# --- Consultas SQL más costosas en la ventana (pg_stat_statements) ------------------
print("### consultas")
salida.writerow(["queryid", "segundos_totales", "llamadas", "ms_por_llamada", "consulta"])
duracion = max(60, int(fin - inicio))
costosas = rango(f'topk(25, sum by (queryid) (increase(pg_stat_statements_seconds_total{{datname="subligol"}}[{duracion}s])))')
llamadas = {r["metric"]["queryid"]: r["values"][-1][1] for r in rango(f'sum by (queryid) (increase(pg_stat_statements_calls_total{{datname="subligol"}}[{duracion}s]))')}
filas = []
for r in costosas:
    qid = r["metric"]["queryid"]
    seg = float(r["values"][-1][1])
    n = float(llamadas.get(qid, 0))
    # Sin llamadas en la ventana: es una consulta anterior (p. ej. el seed que se
    # ejecuta justo antes) que Prometheus extrapola al ser una serie nueva.
    if n >= 1:
        filas.append((qid, seg, n))
filas.sort(key=lambda x: -x[1])
textos = {}
if filas:
    ids = ",".join(f"{qid}" for qid, _, _ in filas)
    sql = f"select queryid, left(regexp_replace(query, '\\s+', ' ', 'g'), 300) from pg_stat_statements where queryid in ({ids})"
    try:
        crudo = subprocess.run(
            ["sudo", "docker", "compose", "exec", "-T", "db", "psql", "-U", "subligol", "-d", "subligol", "-At", "-F", "\t", "-c", sql],
            cwd="/home/azureuser/trabajo-desempeno", capture_output=True, text=True, timeout=60,
        ).stdout
        textos = dict(linea.split("\t", 1) for linea in crudo.splitlines() if "\t" in linea)
    except Exception:
        pass
for qid, seg, n in filas[:15]:
    salida.writerow([qid, round(seg, 3), int(n), round(1000 * seg / n, 3) if n else "", textos.get(qid, "")])
