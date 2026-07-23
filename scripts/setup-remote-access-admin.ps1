# Запускать: ПКМ → «Выполнить с PowerShell от имени администратора»
# Настройка удалённого доступа: RDP autostart + отключение сна

$ErrorActionPreference = 'Stop'

Write-Host "=== RDP: автозапуск служб ===" -ForegroundColor Cyan
sc.exe config TermService start= auto | Out-Null
sc.exe config SessionEnv start= auto | Out-Null
Set-Service -Name TermService -StartupType Automatic
Set-Service -Name SessionEnv -StartupType Automatic
Write-Host "TermService, SessionEnv -> Automatic" -ForegroundColor Green

Write-Host "=== Питание: без сна от сети ===" -ForegroundColor Cyan
powercfg /hibernate off
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 30
powercfg /change standby-timeout-dc 0
powercfg /change hibernate-timeout-dc 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP HYBRIDSLEEP 0
powercfg /setactive SCHEME_CURRENT
Write-Host "Сон и гибридный сон отключены (монитор гаснет через 30 мин)" -ForegroundColor Green

Write-Host "=== WireGuard Test_Test ===" -ForegroundColor Cyan
$wgService = 'WireGuardTunnel$Test_Test'
$wg = Get-Service -Name $wgService -ErrorAction SilentlyContinue
if ($wg) {
  if ($wg.StartType -ne 'Automatic') {
    sc.exe config $wgService start= auto | Out-Null
    Write-Host "$wgService -> Automatic" -ForegroundColor Green
  } else {
    Write-Host "$wgService уже Automatic" -ForegroundColor Green
  }
  if ($wg.Status -ne 'Running') {
    Start-Service -Name $wgService
    Write-Host "$wgService запущен" -ForegroundColor Green
  }
} else {
  Write-Host "Служба $wgService не найдена — проверь WireGuard вручную" -ForegroundColor Yellow
}

Write-Host "=== Фаервол: RDP разрешён ===" -ForegroundColor Cyan
Enable-NetFirewallRule -DisplayGroup 'Remote Desktop' -ErrorAction SilentlyContinue
Write-Host "Готово." -ForegroundColor Green
Write-Host ""
Write-Host "Проверка с ноута: WireGuard ON -> mstsc -> 10.10.0.6" -ForegroundColor Cyan
