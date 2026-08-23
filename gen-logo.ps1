Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1200,630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.FillRectangle([System.Drawing.Color]::FromArgb(7,17,31), 0, 0, 1200, 630)
$font = New-Object System.Drawing.Font('Arial',48)
$brush = [System.Drawing.Brushes]::White
$g.DrawString('Orbita', $font, $brush, 100, 250)
$bmp.Save('client/public/og-image.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$g.Dispose()
Write-Output 'og-image.png created'
