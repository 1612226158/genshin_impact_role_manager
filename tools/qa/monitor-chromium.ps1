# Monitor creation of Chromium-family processes (chrome / msedge / msedgewebview2).
# Usage: powershell -File monitor-chromium.ps1 [duration_seconds=180]
# Output: tools/qa/monitor-log.txt  (PID / parent PID+name / full command line)
#
# NOTE: keep this file ASCII-only. PowerShell 5.1 reads BOM-less UTF-8 as ANSI
#       and Chinese comments/strings break the parser (see LESSONS L10).
param([int]$Duration = 180)

$log = Join-Path $PSScriptRoot 'monitor-log.txt'
$seen = @{}
"==== monitor start $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====" | Out-File $log -Encoding utf8

$deadline = (Get-Date).AddSeconds($Duration)
while ((Get-Date) -lt $deadline) {
    $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe' OR Name='msedgewebview2.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        if (-not $seen.ContainsKey($p.ProcessId)) {
            $seen[$p.ProcessId] = $true
            $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" -ErrorAction SilentlyContinue
            $pname = if ($parent) { $parent.Name } else { 'PARENT-EXITED' }
            $pcmd = ''
            if ($parent -and $parent.CommandLine) { $pcmd = $parent.CommandLine.Substring(0, [Math]::Min(160, $parent.CommandLine.Length)) }
            $created = 'unknown'
            if ($p.CreationDate) { $created = (Get-Date $p.CreationDate -Format 'HH:mm:ss') }
            $line = "[{0}] NEW {1} PID={2} PPID={3} parent={4} created={5}" -f (Get-Date -Format 'HH:mm:ss.fff'), $p.Name, $p.ProcessId, $p.ParentProcessId, $pname, $created
            Add-Content -Path $log -Value $line -Encoding utf8
            Add-Content -Path $log -Value ("      CMD: {0}" -f $p.CommandLine) -Encoding utf8
            Add-Content -Path $log -Value ("      PARENT-CMD: {0}" -f $pcmd) -Encoding utf8
        }
    }
    Start-Sleep -Milliseconds 700
}
"==== monitor end $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====" | Out-File $log -Encoding utf8 -Append
