# ПКМ → Запуск от имени администратора
# Экономный режим: ПК всегда доступен по RDP, монитор гаснет, сна нет

$ErrorActionPreference = 'Stop'

Write-Host "=== План питания: Сбалансированный ===" -ForegroundColor Cyan
powercfg /setactive SCHEME_BALANCED

Write-Host "=== От сети (ПК в розетке) ===" -ForegroundColor Cyan
powercfg /change monitor-timeout-ac 10
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change disk-timeout-ac 20

Write-Host "=== От батареи (ноут — на всякий случай) ===" -ForegroundColor Cyan
powercfg /change monitor-timeout-dc 5
powercfg /change standby-timeout-dc 0
powercfg /change hibernate-timeout-dc 0
powercfg /change disk-timeout-dc 10

Write-Host "=== Гибернация и гибридный сон выкл ===" -ForegroundColor Cyan
powercfg /hibernate off
powercfg /setacvalueindex SCHEME_BALANCED SUB_SLEEP HYBRIDSLEEP 0
powercfg /setdcvalueindex SCHEME_BALANCED SUB_SLEEP HYBRIDSLEEP 0
powercfg /setactive SCHEME_BALANCED

Write-Host "=== USB: не отключать при простое (для клавиатуры/мыши) ===" -ForegroundColor Cyan
powercfg /setacvalueindex SCHEME_BALANCED 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /setactive SCHEME_BALANCED

Write-Host ""
Write-Host "=== Текущие настройки ===" -ForegroundColor Cyan
powercfg /getactivescheme
Write-Host "Монитор (сеть): 10 мин | Сон: никогда | Диск: 20 мин" -ForegroundColor Green
Write-Host "RDP + WireGuard: ПК всегда online" -ForegroundColor Green
