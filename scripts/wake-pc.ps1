# Отправить Wake-on-LAN на домашний ПК
# 1) Сначала включи WireGuard (Test_Test) на ноуте
# 2) Запусти: powershell -File wake-pc.ps1

param(
    [string]$Mac = '00-31-92-52-AB-03',
    [string]$Broadcast = '192.168.50.255',
    [int]$Port = 9
)

function Send-WolPacket {
    param([string]$MacAddress, [string]$TargetIp, [int]$TargetPort)

    $macBytes = $MacAddress -split '[:-]' | ForEach-Object { [byte]('0x' + $_) }
    $packet = [byte[]](, 0xFF * 6) + ($macBytes * 16)

    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.EnableBroadcast = $true
    $endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Parse($TargetIp), $TargetPort)
    [void]$udp.Send($packet, $packet.Length, $endpoint)
    $udp.Close()
}

Write-Host "WOL -> $Mac на $Broadcast`:$Port" -ForegroundColor Cyan
1..3 | ForEach-Object {
    Send-WolPacket -MacAddress $Mac -TargetIp $Broadcast -TargetPort $Port
    Start-Sleep -Milliseconds 300
}
Write-Host "Пакеты отправлены. Подожди 15-30 сек и подключайся: mstsc -> 10.10.0.6" -ForegroundColor Green
