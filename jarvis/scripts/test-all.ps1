Param(
  [string]$BaseUrl = 'http://192.168.1.175:8080',
  [string]$DeviceId = 'pc-test',
  [string]$KitchenEntityId = 'light.kitchen',
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

function Assert-AnySkill($resp, [string[]]$skills, [string]$label) {
  $skill = [string]$resp.skill
  if ($skills -notcontains $skill) {
    Write-Host "KO: $label (skill=$skill, expected=$($skills -join ', '))" -ForegroundColor Red
    throw "Unexpected skill for: $label"
  }
  Write-Host "OK: $label (skill=$skill intent=$($resp.intent))" -ForegroundColor Green
}

Write-Host "== HEALTH ==" -ForegroundColor Cyan
try {
  Show-Json (Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 10)
} catch {
  Write-Host "Health check failed" -ForegroundColor Red
  throw
}

Write-Host "\n== PING (skill) ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text 'ping' -execute:$false)
Assert-AnySkill $r @('ping') 'ping'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== LLM CHAT (fallback) ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text 'Dis bonjour et une phrase courte.' -execute:$false)
Assert-AnySkill $r @('llm','fallback') 'llm chat (fallback)'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== LLM REWRITE (fallback -> ping) ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text 'Peux-tu ping ?' -execute:$false)
Assert-AnySkill $r @('ping','llm','fallback') 'llm rewrite -> ping'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== FR: TIME ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text 'Quelle heure est-il ?' -execute:$false)
Assert-AnySkill $r @('time','llm','fallback') 'fr time'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== FR: TIMER ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text 'Mets un minuteur 5 minutes' -execute:$false)
Assert-AnySkill $r @('timer','llm','fallback') 'fr timer'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== FR: INBOX (WhatsApp summarize) ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text 'Résume mes messages WhatsApp' -execute:$false)
Assert-AnySkill $r @('inbox','llm','fallback') 'fr inbox summarize'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== FR: LIGHTS (natural) ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text 'Allume la lumière cuisine à 40%' -execute:$false)
Assert-AnySkill $r @('lights','llm','fallback') 'fr lights natural'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\n== HA EXPLICIT (plan only) ==" -ForegroundColor Cyan
$r = (Call-Jarvis -text "ha: light.turn_on entity_id=$KitchenEntityId" -execute:$false)
Assert-AnySkill $r @('home_assistant') 'ha explicit'
Show-Json ($r | Select-Object requestId,skill,intent,mode,result,actions)

Write-Host "\nOK: all tests executed" -ForegroundColor Green
