# Hands-off control of the "Canon F-789SGA Emulator" window: no real mouse, no focus change, no clipboard.
# Usage: emu2.ps1 "name=keys; name=keys; ..."  [-full]
#   Each step posts mouse-click messages for the keys, then saves the window image to emu\<name>.png
#   (PrintWindow). With -full the whole window is saved, otherwise only the LCD area (see $LCD).
param([string]$spec, [switch]$full, [int]$delay = 330)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W2 {
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  public delegate bool P(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, P p, IntPtr l);
  // child button whose rectangle contains window-image point (x, y)
  public static IntPtr At(IntPtr main, int x, int y) {
    RECT m; GetWindowRect(main, out m); IntPtr hit = IntPtr.Zero;
    EnumChildWindows(main, (c, l) => { RECT r; GetWindowRect(c, out r);
      if (x >= r.L - m.L && x < r.R - m.L && y >= r.T - m.T && y < r.B - m.T) { hit = c; return false; } return true; }, IntPtr.Zero);
    return hit;
  }
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
$SP = Split-Path -Parent $MyInvocation.MyCommand.Path
$p0 = Get-Process | Where-Object { $_.MainWindowTitle -like 'Canon F-789SGA Emulator*' } | Select-Object -First 1
if (-not $p0) { Write-Error 'Emulator window not found'; exit 1 }
$h = $p0.MainWindowHandle
if ([W2]::IsIconic($h)) { [W2]::ShowWindow($h, 4) | Out-Null; Start-Sleep -Milliseconds 300 }  # show without activating
$K = @{
  shift = '49,277'; alpha = '82,277'; mode = '203,277'; on = '240,277'; apps = '42,309'; conv = '240,309'
  up = '144,277'; left = '115,305'; right = '172,305'; down = '144,334'
  calc = '42,344'; inv = '82,344'; integ = '203,344'; eng = '240,344'
  frac = '42,377'; sqrt = '82,377'; pow = '122,377'; sq = '162,377'; log = '203,377'; ln = '240,377'
  neg = '42,410'; dms = '82,410'; hyp = '122,410'; sin = '162,410'; cos = '203,410'; tan = '240,410'
  rcl = '42,443'; abs = '82,443'; lp = '122,443'; rp = '162,443'; sd = '203,443'; mplus = '240,443'
  '7' = '47,483'; '8' = '95,483'; '9' = '143,483'; del = '190,483'; ac = '238,483'
  '4' = '47,522'; '5' = '95,522'; '6' = '143,522'; mul = '190,522'; div = '238,522'
  '1' = '47,560'; '2' = '95,560'; '3' = '143,560'; add = '190,560'; sub = '238,560'
  '0' = '47,598'; dot = '95,598'; exp = '143,598'; ans = '190,598'; eq = '238,598'
}
function Grab() {
  $r = New-Object W2+RECT; [W2]::GetWindowRect($h, [ref]$r) | Out-Null
  $bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [System.Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc()
  [W2]::PrintWindow($h, $dc, 2) | Out-Null; $g.ReleaseHdc($dc); $g.Dispose()
  if (-not $full) { $c = $bmp.Clone((New-Object System.Drawing.Rectangle 37, 155, 213, 80), $bmp.PixelFormat); $bmp.Dispose(); $bmp = $c }  # LCD only
  return $bmp
}
function Sig($bmp) {  # signature of the dot area + count of dark dots
  $sb = New-Object System.Text.StringBuilder; $n = 0
  for ($y = 14; $y -lt 78; $y += 2) { for ($x = 1; $x -lt 211; $x += 2) { if ($bmp.GetPixel($x, $y).R -lt 128) { [void]$sb.Append('1'); $n++ } else { [void]$sb.Append('0') } } }
  return @($sb.ToString(), $n)
}
# capture once the LCD has stopped changing and is not blank (up to ~5 s; blank is accepted after that)
function Shot($path) {
  $prev = $null; $bmp = $null
  for ($i = 0; $i -lt 16; $i++) {
    if ($bmp) { $bmp.Dispose() }
    $bmp = Grab
    if ($full) { break }
    $sg = Sig $bmp
    if ($sg[1] -gt 0 -and $sg[0] -eq $prev) { break }
    $prev = $sg[0]; Start-Sleep -Milliseconds 300
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
foreach ($step in $spec.Split(';')) {
  $step = $step.Trim(); if (-not $step) { continue }
  $n, $ks = $step.Split('=', 2)
  foreach ($key in $ks.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)) {
    if (-not $K.ContainsKey($key)) { Write-Error "unknown key $key"; exit 1 }
    $xy = $K[$key].Split(','); $b = [W2]::At($h, [int]$xy[0], [int]$xy[1])
    if ($b -eq [IntPtr]::Zero) { Write-Error "no button for $key"; exit 1 }
    $l = [IntPtr]((8 -shl 16) -bor 8)
    [W2]::PostMessage($b, 0x0201, [IntPtr]1, $l) | Out-Null; Start-Sleep -Milliseconds 90   # WM_LBUTTONDOWN
    [W2]::PostMessage($b, 0x0202, [IntPtr]0, $l) | Out-Null; Start-Sleep -Milliseconds $delay # WM_LBUTTONUP
  }
  Start-Sleep -Milliseconds 300
  Shot "$SP\emu\$($n.Trim()).png"
  "ok $n"
}
