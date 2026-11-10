# sheet.ps1 out.png name1 name2 ... -> grid (2 columns) of emu\<name>.png with labels, scaled 2x
param([string]$out, [Parameter(ValueFromRemainingArguments = $true)] $names)
Add-Type -AssemblyName System.Drawing
$SP = Split-Path -Parent $MyInvocation.MyCommand.Path
$w = 213 * 2; $hh = 80 * 2 + 18; $cols = 2; $rows = [math]::Ceiling($names.Count / $cols)
$bmp = New-Object System.Drawing.Bitmap ($w * $cols + 10), ($hh * $rows)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::LightGray)
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$f = New-Object System.Drawing.Font 'Arial', 10
for ($i = 0; $i -lt $names.Count; $i++) {
  $x = ($i % $cols) * ($w + 10); $y = [math]::Floor($i / $cols) * $hh
  $g.DrawString($names[$i], $f, [System.Drawing.Brushes]::Black, $x, $y)
  $p = "$SP\emu\$($names[$i]).png"
  if (Test-Path $p) { $im = [System.Drawing.Image]::FromFile($p); $g.DrawImage($im, $x, $y + 16, $im.Width * 2, $im.Height * 2); $im.Dispose() }
}
$bmp.Save($out); $g.Dispose(); $bmp.Dispose()
