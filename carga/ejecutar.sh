#!/usr/bin/env bash
# =============================================================================
# Ejecuta un escenario de carga siguiendo el protocolo de la guía (sección 6.3.1)
# y guarda todos los resultados en carga/resultados/AAAA-MM-DD/.
#
# Uso:
#   carga/ejecutar.sh <humo|piloto|baja|normal|estres>
#
# Variables (opcionales):
#   BASE_URL             sitio a probar (por defecto la VM de Azure)
#   CONTRASENA_CLIENTES  contraseña de test001..test200 (sin ella, se compra como invitado)
#   PROPORCION_INVITADO  fracción de compradores sin cuenta (0..1, por defecto 0)
#   REPETICION           número de repetición (R1, R2, R3...) para la bitácora
#   RESEMBRAR=1          antes de empezar, ejecuta `npm run seed` en la VM por SSH
#   NAVEGADOR=1          lanza en paralelo navegador-real.js (Web Vitals bajo carga)
#   PROMETHEUS=1         envía las métricas de k6 al Prometheus de la VM (túnel SSH)
#   SSH_DESTINO          usuario@host de la VM (por defecto azureuser@<dominio de BASE_URL>)
#   SSH_CLAVE            clave SSH (por defecto ~/.ssh/vm-subligol_key.pem)
#   + cualquier variable de escenarios.js (ESTRES_ESCALONES, MAX_VUS, CALENTAMIENTO...)
#
# Archivos generados (PREFIJO = carga/resultados/AAAA-MM-DD/<escenario>_<HHMM>):
#   PREFIJO.meta.json        commit, horas de inicio y fin, configuración y generador
#   PREFIJO.html             reporte web de k6 (gráficos)
#   PREFIJO.resumen.json     resumen con percentiles por página y umbrales
#   PREFIJO.csv.gz           métricas crudas de cada petición (no se versiona)
#   PREFIJO.generador.log    CPU y memoria del PC generador (vmstat cada 5 s)
#   PREFIJO.navegador.json   Web Vitals de los navegadores reales (si NAVEGADOR=1)
# =============================================================================
set -euo pipefail

ESCENARIO="${1:-}"
case "$ESCENARIO" in
  humo|piloto|baja|normal|estres) ;;
  *) echo "Uso: carga/ejecutar.sh <humo|piloto|baja|normal|estres>" >&2; exit 2 ;;
esac

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

BASE_URL="${BASE_URL:-https://subligol-utem.chilecentral.cloudapp.azure.com}"
HOST="$(echo "$BASE_URL" | sed -E 's#^https?://##; s#[:/].*$##')"
SSH_DESTINO="${SSH_DESTINO:-azureuser@$HOST}"
SSH_CLAVE="${SSH_CLAVE:-$HOME/.ssh/vm-subligol_key.pem}"
ES_LOCAL=0; [[ "$HOST" == "localhost" || "$HOST" == "127.0.0.1" ]] && ES_LOCAL=1

FECHA="$(TZ=America/Santiago date +%F)"
HORA="$(TZ=America/Santiago date +%H%M)"
DIR="carga/resultados/$FECHA"
PREFIJO="$DIR/${ESCENARIO}_${HORA}"
mkdir -p "$DIR"

# Duración aproximada de cada escenario (incluye 1 min de calentamiento), para el navegador real.
case "$ESCENARIO" in
  humo) DURACION=30s ;; piloto) DURACION=4m ;; baja) DURACION=8m ;; normal) DURACION=15m ;; estres) DURACION=15m ;;
esac

ssh_vm() { ssh -i "$SSH_CLAVE" -o BatchMode=yes -o ConnectTimeout=15 "$SSH_DESTINO" "$@"; }

echo "== Prueba de carga: $ESCENARIO contra $BASE_URL"
[[ -z "${CONTRASENA_CLIENTES:-}" ]] && echo "   (sin CONTRASENA_CLIENTES: los compradores compran como invitado)"

# 1. Datos iguales en cada prueba (protocolo: mismo estado inicial).
if [[ "${RESEMBRAR:-0}" == "1" && "$ES_LOCAL" == "0" ]]; then
  echo "== Resembrando la base de datos de la VM..."
  ssh_vm 'cd trabajo-desempeno && sudo docker compose exec -T api npm run seed 2>&1 | grep -E "Listo|rror"'
fi

# 2. Métricas de k6 hacia Prometheus (misma línea de tiempo que CPU, pool, etc.).
SALIDAS=(--out "csv=$PREFIJO.csv.gz")
TUNEL_PID=""
if [[ "${PROMETHEUS:-0}" == "1" ]]; then
  if [[ "$ES_LOCAL" == "0" ]]; then
    echo "== Abriendo túnel SSH al Prometheus de la VM (localhost:19090)..."
    ssh -i "$SSH_CLAVE" -o BatchMode=yes -o ExitOnForwardFailure=yes -N -L 19090:localhost:9090 "$SSH_DESTINO" &
    TUNEL_PID=$!
    sleep 3
    export K6_PROMETHEUS_RW_SERVER_URL="http://localhost:19090/api/v1/write"
  else
    export K6_PROMETHEUS_RW_SERVER_URL="${K6_PROMETHEUS_RW_SERVER_URL:-http://127.0.0.1:9090/api/v1/write}"
  fi
  export K6_PROMETHEUS_RW_TREND_STATS="p(50),p(90),p(95),p(99),avg,max"
  SALIDAS+=(--out experimental-prometheus-rw)
fi

# 3. Metadatos de la ejecución (guía 6.3.1: congelar la versión y anotar horas).
INICIO="$(TZ=America/Santiago date --iso-8601=seconds)"
cat > "$PREFIJO.meta.json" <<EOF
{
  "escenario": "$ESCENARIO",
  "repeticion": "${REPETICION:-}",
  "base_url": "$BASE_URL",
  "commit": "$(git rev-parse --short HEAD)",
  "inicio": "$INICIO",
  "proporcion_invitado": "${PROPORCION_INVITADO:-0}",
  "navegador_real": "${NAVEGADOR:-0}",
  "prometheus": "${PROMETHEUS:-0}",
  "generador": {
    "equipo": "$(hostname)",
    "cpus": $(nproc),
    "memoria": "$(free -h | awk '/^Mem/{print $2}')",
    "k6": "$(k6 version | head -1 | awk '{print $2}')"
  }
}
EOF

# 4. CPU y memoria del generador (si supera ~80 %, el cuello de botella es el generador).
LC_ALL=C vmstat -t 5 > "$PREFIJO.generador.log" &   # formato estándar (columnas us, sy, id) para analizarlo
VMSTAT_PID=$!

# 5. Navegadores reales en paralelo (Web Vitals bajo carga).
NAV_PID=""
if [[ "${NAVEGADOR:-0}" == "1" ]]; then
  echo "== Navegador real en paralelo ($DURACION)"
  k6 run -q -e SITIO_URL="${SITIO_URL:-$BASE_URL}" -e ESCENARIO="$ESCENARIO" -e DURACION="$DURACION" \
    -e SALIDA_JSON="$PREFIJO.navegador.json" carga/k6/navegador-real.js > "$PREFIJO.navegador.log" 2>&1 &
  NAV_PID=$!
fi

limpiar() {
  kill "$VMSTAT_PID" 2>/dev/null || true
  [[ -n "$TUNEL_PID" ]] && kill "$TUNEL_PID" 2>/dev/null || true
}
trap limpiar EXIT

# 6. La prueba. El reporte HTML queda en PREFIJO.html.
set +e
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="$PREFIJO.html" \
k6 run \
  -e ESCENARIO="$ESCENARIO" -e BASE_URL="$BASE_URL" \
  -e SALIDA_JSON="$PREFIJO.resumen.json" \
  --tag testid="${ESCENARIO}_${FECHA}_${HORA}" \
  "${SALIDAS[@]}" \
  carga/k6/escenarios.js
CODIGO=$?
set -e

[[ -n "$NAV_PID" ]] && { echo "== Esperando al navegador real..."; wait "$NAV_PID" || true; }

FIN="$(TZ=America/Santiago date --iso-8601=seconds)"
# Agrega la hora de fin y el resultado de los umbrales a los metadatos.
sed -i "s|\"inicio\": \"$INICIO\",|\"inicio\": \"$INICIO\",\n  \"fin\": \"$FIN\",\n  \"umbrales_cumplidos\": $([[ $CODIGO -eq 0 ]] && echo true || echo false),|" "$PREFIJO.meta.json"

echo
echo "== Listo. Resultados en $DIR/:"
ls -1 "$PREFIJO".* | sed 's#^#   #'
echo "== Ventana para Grafana: $INICIO → $FIN"
[[ $CODIGO -eq 99 ]] && echo "== Algún umbral (SLO) NO se cumplió: revisa el resumen (en estrés es lo esperado)."
exit "$CODIGO"
