# run.ps1 "name=keys; name=keys; ..."  -> presses keys in emulator, saves LCD to emu\<name>.png after each step
param([string]$spec)
$SP = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($step in $spec.Split(';')) {
  $step = $step.Trim(); if (-not $step) { continue }
  $n, $k = $step.Split('=', 2)
  if ($k.Trim()) { & powershell -STA -NoProfile -ExecutionPolicy Bypass -File "$SP\emu.ps1" press $k.Trim() | Out-Null }
  & powershell -STA -NoProfile -ExecutionPolicy Bypass -File "$SP\emu.ps1" lcd "$SP\emu\$($n.Trim()).png" | Out-Null
  "ok $n"
}
