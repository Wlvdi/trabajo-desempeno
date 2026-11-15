#!/usr/bin/env bash
# =============================================================================
# Exporta las métricas del servidor (Prometheus de la VM, lo mismo que muestra
# Grafana) de una o varias pruebas a CSV, junto a sus demás resultados.
# Así no hacen falta capturas de pantalla y los datos no dependen de la VM
# (Prometheus solo los guarda 15 días).
#
# Uso:
#   carga/exportar-servidor.sh carga/resultados/ESTRES/estres_2026-11-15_1012.meta.json
#   carga/exportar-servidor.sh carga/resultados          # todas las pruebas sin exportar
#
# Genera, por prueba (mismo prefijo que el .meta.json):
#   .servidor.csv   serie de tiempo cada 15 s: req/s, p50/p95/p99, errores,
#                   CPU de la VM y por contenedor, memoria, disco, event loop,
#                   pool de PostgreSQL, argon2, transacciones, compras, VUs
#   .rutas.csv      req/s y p95 por ruta cada 15 s
#   .consultas.csv  las 15 consultas SQL más costosas durante la prueba
#
# Variables: SSH_DESTINO (azureuser@<dominio>), SSH_CLAVE (~/.ssh/vm-subligol_key.pem),
#            FORZAR=1 para volver a exportar aunque ya exista.
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SSH_DESTINO="${SSH_DESTINO:-azureuser@subligol-utem.chilecentral.cloudapp.azure.com}"
SSH_CLAVE="${SSH_CLAVE:-$HOME/.ssh/vm-subligol_key.pem}"
OBJETIVO="${1:?Uso: carga/exportar-servidor.sh <archivo.meta.json | carpeta>}"

if [[ -d "$OBJETIVO" ]]; then
  mapfile -t METAS < <(find "$OBJETIVO" -name '*.meta.json' | sort)
else
  METAS=("$OBJETIVO")
fi

campo() { sed -n "s/.*\"$2\": \"\\([^\"]*\\)\".*/\\1/p" "$1" | head -1; }

for META in "${METAS[@]}"; do
  PREFIJO="${META%.meta.json}"
  if [[ -s "$PREFIJO.servidor.csv" && "${FORZAR:-0}" != "1" ]]; then
    echo "-- ya exportada: $(basename "$PREFIJO")"
    continue
  fi
  if grep -q '"base_url": "http://localhost' "$META"; then
    echo "-- local (sin VM), se omite: $(basename "$PREFIJO")"
    continue
  fi
  INICIO="$(campo "$META" inicio)"; FIN="$(campo "$META" fin)"
  if [[ -z "$FIN" ]]; then
    echo "-- sin hora de fin (¿en curso?), se omite: $(basename "$PREFIJO")"
    continue
  fi

  echo "== $(basename "$PREFIJO"): $INICIO → $FIN"
  TMP="$(mktemp)"
  ssh -i "$SSH_CLAVE" -o BatchMode=yes -o ConnectTimeout=15 "$SSH_DESTINO" \
    "python3 - '$INICIO' '$FIN'" < "$RAIZ/carga/exportar_servidor.py" > "$TMP"

  # Separa las tres secciones "### nombre" en sus archivos.
  awk -v p="$PREFIJO" '
    /^### servidor$/  { f = p ".servidor.csv"; next }
    /^### rutas$/     { f = p ".rutas.csv"; next }
    /^### consultas$/ { f = p ".consultas.csv"; next }
    { print > f }
  ' "$TMP"
  rm -f "$TMP"
  printf '   servidor: %s filas · rutas: %s filas · consultas: %s\n' \
    "$(($(wc -l < "$PREFIJO.servidor.csv") - 1))" \
    "$(($(wc -l < "$PREFIJO.rutas.csv") - 1))" \
    "$(($(wc -l < "$PREFIJO.consultas.csv") - 1))"
done
