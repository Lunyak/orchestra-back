# ПКМ → Запуск от имени администратора
# Wake-on-LAN для Realtek Ethernet

$ErrorActionPreference = 'Stop'
$adapterName = 'Ethernet'
$deviceName = 'Realtek PCIe 2.5GbE Family Controller'
$mac = '00-31-92-52-AB-03'

function Set-NicProperty {
    param([string]$Name, [string]$Keyword, [string]$Value)
    try {
        Set-NetAdapterAdvancedProperty -Name $Name -RegistryKeyword $Keyword -RegistryValue $Value -NoRestart -ErrorAction Stop
        Write-Host "  $Keyword = $Value" -ForegroundColor Green
    } catch {
        try {
            Set-NetAdapterAdvancedProperty -Name $Name -RegistryKeyword $Keyword -DisplayValue $Value -NoRestart -ErrorAction Stop
            Write-Host "  $Keyword -> $Value" -ForegroundColor Green
        } catch {
            Write-Host "  $Keyword — пропуск: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host "=== Адаптер $adapterName ===" -ForegroundColor Cyan
Enable-NetAdapter -Name $adapterName -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "=== Драйвер: энергосбережение выкл, WOL вкл ===" -ForegroundColor Cyan
Set-NicProperty $adapterName '*WakeOnMagicPacket' '1'
Set-NicProperty $adapterName '*WakeOnPattern' '1'
Set-NicProperty $adapterName 'S5WakeOnLan' '1'
Set-NicProperty $adapterName '*ModernStandbyWoLMagicPacket' '1'
Set-NicProperty $adapterName 'PowerSavingMode' '0'
Set-NicProperty $adapterName 'EnableGreenEthernet' '0'
Set-NicProperty $adapterName 'GigaLite' '0'
Set-NicProperty $adapterName '*SelectiveSuspend' '0'
Set-NicProperty $adapterName '*EEE' '0'
Set-NicProperty $adapterName 'AdvancedEEE' '0'

Write-Host "=== Windows: разрешить пробуждение ===" -ForegroundColor Cyan
Set-NetAdapterPowerManagement -Name $adapterName -WakeOnMagicPacket Enabled -WakeOnPattern Enabled -ErrorAction SilentlyContinue
powercfg /deviceenablewake $deviceName
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP AWAYMODE 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP HYBRIDSLEEP 0
powercfg /setactive SCHEME_CURRENT

Write-Host "=== Реестр: не отключать адаптер для экономии ===" -ForegroundColor Cyan
$netClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bcfc-08002be10318}'
Get-ChildItem $netClass -ErrorAction SilentlyContinue | ForEach-Object {
    $desc = (Get-ItemProperty -Path $_.PSPath -Name DriverDesc -ErrorAction SilentlyContinue).DriverDesc
    if ($desc -match 'Realtek PCIe 2.5GbE') {
        Set-ItemProperty -Path $_.PSPath -Name PnPCapabilities -Value 0x100 -Type DWord -Force
        Set-ItemProperty -Path $_.PSPath -Name '*WakeOnMagicPacket' -Value '1' -Type String -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $_.PSPath -Name 'S5WakeOnLan' -Value '1' -Type String -Force -ErrorAction SilentlyContinue
        Write-Host "  Реестр обновлён для $desc" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Статус ===" -ForegroundColor Cyan
Get-NetAdapter -Name $adapterName | Format-Table Name, Status, MacAddress, LinkSpeed -AutoSize
powercfg /devicequery wake_armed | Select-String -Pattern 'Realtek'

Write-Host ""
Write-Host "MAC для WOL: $mac" -ForegroundColor Cyan
Write-Host "Broadcast: 192.168.50.255" -ForegroundColor Cyan
if ((Get-NetAdapter -Name $adapterName).Status -ne 'Up') {
    Write-Host ""
    Write-Host "ВНИМАНИЕ: Ethernet без линка! Проверь кабель и порт роутера." -ForegroundColor Red
}
