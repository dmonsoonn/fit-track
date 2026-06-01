# FitTrack k6 benchmark runner
# Runs k6 bench mode for each VU level and saves reports to k6/reports/
#
# Usage:
#   .\k6\run-benchmarks.ps1
#   .\k6\run-benchmarks.ps1 -Duration 3m
#   .\k6\run-benchmarks.ps1 -BaseUrl http://staging:8080/api/v1

param(
    [int[]]$VuLevels = @(5, 10, 25, 50),
    [string]$Duration = "2m",
    [string]$BaseUrl = "http://localhost:8080/api/v1"
)

$ReportsDir = Join-Path $PSScriptRoot "reports"

if (-not (Test-Path $ReportsDir)) {
    New-Item -ItemType Directory -Path $ReportsDir | Out-Null
}

$total = $VuLevels.Count
$current = 0
$failed = @()

foreach ($vus in $VuLevels) {
    $current++

    Write-Host ""
    Write-Host "[$current/$total] Running benchmark: $vus VUs for $Duration..." -ForegroundColor Cyan

    $env:FT_TYPE = "bench"
    $env:FT_VUS = "$vus"
    $env:FT_DURATION = $Duration
    $env:BASE_URL = $BaseUrl

    k6 run k6/load-test.js

    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED (exit code $LASTEXITCODE)" -ForegroundColor Red
        $failed += "$vus VUs"
    }
    else {
        Write-Host "Done - report saved to k6/reports/report-$($vus)vus.txt" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Benchmarks complete. Reports in: $ReportsDir"

if ($failed.Count -gt 0) {
    Write-Host ("FAILED runs: " + ($failed -join ", ")) -ForegroundColor Red
    exit 1
}

exit 0