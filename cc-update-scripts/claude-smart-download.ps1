param(
    [switch]$OpenBrowser = $true,
    [switch]$Json = $true
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Claude Smart Downloader (CLI Pro)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------
# 1. Check proxy / Clash status
# ----------------------------
Write-Host "[1/6] Checking network environment..." -ForegroundColor Yellow

$proxy = $env:HTTP_PROXY + $env:HTTPS_PROXY

if ($proxy) {
    Write-Host "[INFO] Proxy detected: $proxy" -ForegroundColor Green
} else {
    Write-Host "[WARN] No system proxy detected (Clash TUN may still work)" -ForegroundColor DarkYellow
}

# Optional: quick connectivity test
try {
    $test = Invoke-WebRequest -Uri "https://www.google.com" -TimeoutSec 5 -UseBasicParsing
    Write-Host "[OK] Internet reachable" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Internet test failed (but may still be routed via TUN)" -ForegroundColor Yellow
}

Write-Host ""

# ----------------------------
# 2. Get latest version
# ----------------------------
Write-Host "[2/6] Fetching latest version..." -ForegroundColor Yellow

try {
    $version = Invoke-RestMethod "https://downloads.claude.ai/claude-code-releases/latest"
    Write-Host "[OK] Latest version: $version" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to fetch version" -ForegroundColor Red
    exit 1
}

# ----------------------------
# 3. Define CDN candidates
# ----------------------------
Write-Host ""
Write-Host "[3/6] Preparing CDN candidates..." -ForegroundColor Yellow

$platform = "win32-x64"
$base = "https://downloads.claude.ai/claude-code-releases"

$urls = @(
    "$base/$version/$platform/claude.exe"
)

# future-proof fallback patterns
$urls += "$base/latest/$platform/claude.exe"

Write-Host "[INFO] Candidate URLs:"
$urls | ForEach-Object { Write-Host "  $_" }

Write-Host ""

# ----------------------------
# 4. Latency test (HEAD request)
# ----------------------------
Write-Host "[4/6] Testing CDN latency..." -ForegroundColor Yellow

$results = @()

foreach ($url in $urls) {
    $sw = [Diagnostics.Stopwatch]::StartNew()

    try {
        Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 5 | Out-Null
        $sw.Stop()

        $results += [PSCustomObject]@{
            url = $url
            latency_ms = $sw.ElapsedMilliseconds
            status = "ok"
        }

        Write-Host "[OK] $url -> $($sw.ElapsedMilliseconds) ms" -ForegroundColor Green
    } catch {
        $sw.Stop()

        $results += [PSCustomObject]@{
            url = $url
            latency_ms = 999999
            status = "fail"
        }

        Write-Host "[FAIL] $url" -ForegroundColor Red
    }
}

Write-Host ""

# ----------------------------
# 5. Select best URL
# ----------------------------
Write-Host "[5/6] Selecting best URL..." -ForegroundColor Yellow

$best = $results |
    Where-Object { $_.status -eq "ok" } |
    Sort-Object latency_ms |
    Select-Object -First 1

if (-not $best) {
    Write-Host "[ERROR] No reachable CDN found" -ForegroundColor Red
    exit 1
}

Write-Host "[BEST] $($best.url)" -ForegroundColor Green
Write-Host ""

# ----------------------------
# 6. Output JSON + open browser
# ----------------------------
Write-Host "[6/6] Final output..." -ForegroundColor Yellow

$resultObj = [PSCustomObject]@{
    version = $version
    platform = $platform
    best_url = $best.url
    all_results = $results
}

if ($Json) {
    $resultObj | ConvertTo-Json -Depth 5 | Write-Host
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " FINAL DOWNLOAD URL:" -ForegroundColor Cyan
Write-Host $best.url -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

# Open browser
if ($OpenBrowser) {
    Start-Process $best.url
}