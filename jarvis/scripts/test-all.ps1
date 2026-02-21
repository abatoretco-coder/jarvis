Param(
  [string]$BaseUrl = 'http://192.168.1.175:8080',
  [string]$DeviceId = 'pc-test',
  [int]$TimeoutSec = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Show-Json($obj) {
  $obj | ConvertTo-Json -Depth 20
}

function Call-Jarvis([string]$text, [bool]$execute = $false) {
  $body = @{ text = $text; options = @{ execute = $execute }; context = @{ deviceId = $DeviceId } } | ConvertTo-Json -Depth 10
  Invoke-RestMethod -Uri "$BaseUrl/v1/command" -Method Post -ContentType 'application/json' -TimeoutSec $TimeoutSec -Body $body
}

Write-Host "== HEALTH ==" -ForegroundColor Cyan
try {
  Show-Json (Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 10)
} catch {
  Write-Host "Health check failed" -ForegroundColor Red
  throw
}

Write-Host "\n== PING (skill) ==" -ForegroundColor Cyan
Show-Json (Call-Jarvis -text 'ping' -execute:$false | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== LLM CHAT (fallback) ==" -ForegroundColor Cyan
Show-Json (Call-Jarvis -text 'Dis bonjour et une phrase courte.' -execute:$false | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== LLM REWRITE (fallback -> ping) ==" -ForegroundColor Cyan
Show-Json (Call-Jarvis -text 'Peux-tu ping ?' -execute:$false | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== HA EXPLICIT (plan only) ==" -ForegroundColor Cyan
Show-Json (Call-Jarvis -text 'ha: light.turn_on entity_id=light.kitchen' -execute:$false | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\nOK: all tests executed" -ForegroundColor Green
