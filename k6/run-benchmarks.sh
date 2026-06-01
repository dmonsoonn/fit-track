#!/usr/bin/env bash
# FitTrack k6 benchmark runner
# Runs k6 bench mode for each VU level and saves reports to k6/reports/
#
# Usage (from repo root):
#   bash k6/run-benchmarks.sh
#   K6_DURATION=3m bash k6/run-benchmarks.sh
#   BASE_URL=http://staging:8080/api/v1 bash k6/run-benchmarks.sh

set -euo pipefail

VU_LEVELS=(1 10 50 100 500)
DURATION="${K6_DURATION:-2m}"
BASE_URL="${BASE_URL:-http://localhost:8080/api/v1}"
REPORTS_DIR="$(dirname "$0")/reports"

mkdir -p "$REPORTS_DIR"

total=${#VU_LEVELS[@]}
current=0
failed=()

for vus in "${VU_LEVELS[@]}"; do
  current=$((current + 1))
  echo ""
  echo "[$current/$total] Running benchmark: $vus VUs for $DURATION ..."

  FT_TYPE=bench \
  K6_VUS=$vus \
  K6_DURATION=$DURATION \
  BASE_URL=$BASE_URL \
    k6 run k6/load-test.js || {
      echo "  FAILED"
      failed+=("$vus VUs")
    }

  echo "  Done — report saved to k6/reports/report-${vus}vus.txt"
done

echo ""
echo "======================================"
echo "Benchmarks complete. Reports in: $REPORTS_DIR"

if [ ${#failed[@]} -gt 0 ]; then
  echo "FAILED runs: ${failed[*]}"
  exit 1
fi
