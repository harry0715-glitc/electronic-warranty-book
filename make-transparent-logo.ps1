Add-Type -AssemblyName System.Drawing
$src = 'E:\HTML電子名片\assets\logo.jpg'
$out = 'E:\HTML電子名片\assets\logo-transparent.png'
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$canvas = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $bmp.Height; $y++) {
  for ($x = 0; $x -lt $bmp.Width; $x++) {
    $c = $bmp.GetPixel($x, $y)
    if ($c.R -gt 242 -and $c.G -gt 242 -and $c.B -gt 242) {
      $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $c.R, $c.G, $c.B))
    }
    elseif ($c.R -gt 225 -and $c.G -gt 225 -and $c.B -gt 225) {
      $avg = [int](($c.R + $c.G + $c.B) / 3)
      $a = [Math]::Max(0, [Math]::Min(255, (242 - $avg) * 15))
      $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B))
    }
    else {
      $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
    }
  }
}
$canvas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose()
$bmp.Dispose()
Write-Output $out
