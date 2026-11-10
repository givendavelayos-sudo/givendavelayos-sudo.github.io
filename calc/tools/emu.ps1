# Drives only the "Canon F-789SGA Emulator" window: screenshots it, clicks its keys, copies its LCD.
# Usage: emu.ps1 <command> [args]
#   shot <out.png>             full window image (PrintWindow)
#   click <x> <y> [...]        click client-area points, in order
#   keys <sendkeys-string>     type keys with SendKeys (e.g. "1{+}2~")
#   lcd <out.png>              Ctrl+C in emulator, save clipboard image
#   rect                       print window rect
param([string]$cmd, [Parameter(ValueFromRemainingArguments = $true)] $rest)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
"@
$p0 = Get-Process | Where-Object { $_.MainWindowTitle -like 'Canon F-789SGA Emulator*' } | Select-Object -First 1
$h = if ($p0) { $p0.MainWindowHandle } else { [IntPtr]::Zero }
if ($h -eq [IntPtr]::Zero) { Write-Error 'Emulator window not found'; exit 1 }
function Front { [W]::ShowWindow($h, 9) | Out-Null; [W]::SetForegroundWindow($h) | Out-Null; Start-Sleep -Milliseconds 120 }
switch ($cmd) {
  'rect' { $r = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$r) | Out-Null; "$($r.L) $($r.T) $($r.R) $($r.B)" }
  'shot' {
    $r = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$r) | Out-Null
    $bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
    $g = [System.Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc()
    [W]::PrintWindow($h, $dc, 2) | Out-Null; $g.ReleaseHdc($dc); $g.Dispose()
    $bmp.Save($rest[0], [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    $o = New-Object W+POINT; [W]::ClientToScreen($h, [ref]$o) | Out-Null
    "window $($r.L),$($r.T) client-origin $($o.X),$($o.Y)"
  }
  'click' {
    Front
    for ($i = 0; $i -lt $rest.Count; $i += 2) {
      $p = New-Object W+POINT; $p.X = [int]$rest[$i]; $p.Y = [int]$rest[$i + 1]
      [W]::ClientToScreen($h, [ref]$p) | Out-Null
      [W]::SetCursorPos($p.X, $p.Y) | Out-Null
      [W]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60
      [W]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 140
    }
  }
  'press' {
    # key names separated by spaces; positions are window-image coords minus the client offset (3,46)
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
    Front
    foreach ($n in ($rest -join ' ').Split(' ', [StringSplitOptions]::RemoveEmptyEntries)) {
      if (-not $K.ContainsKey($n)) { Write-Error "unknown key $n"; exit 1 }
      $xy = $K[$n].Split(','); $p = New-Object W+POINT; $p.X = [int]$xy[0] - 3; $p.Y = [int]$xy[1] - 46
      [W]::ClientToScreen($h, [ref]$p) | Out-Null
      [W]::SetCursorPos($p.X, $p.Y) | Out-Null
      [W]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 50
      [W]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 110
    }
  }
  'keys' { Front; [System.Windows.Forms.SendKeys]::SendWait($rest[0]); Start-Sleep -Milliseconds 200 }
  'lcd' {
    Front; [System.Windows.Forms.Clipboard]::Clear()
    [System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 300
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if (-not $img) { Write-Error 'No image on clipboard'; exit 1 }
    $img.Save($rest[0], [System.Drawing.Imaging.ImageFormat]::Png); "lcd $($img.Width)x$($img.Height)"
  }
}
