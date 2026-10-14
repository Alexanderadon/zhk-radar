# ЖК-Радар — ежедневное обновление квартир (Планировщик Windows, задача ZhkRadar-Listings-Daily).
#
# Скрейпим с домашнего IP: krisha не режет резидентные адреса, в отличие от
# датацентровых. Поэтому обновление живёт здесь, а не в GitHub Actions.
#
# Что изменилось против первой версии:
#  * собирались только квартиры Алматы — остальные четыре города стояли
#    нетронутыми месяцами;
#  * результат никуда не уезжал: файлы обновлялись на ноутбуке, а на проде
#    лежал снимок месячной давности. Теперь после сбора идёт сборка и деплой;
#  * сборщик пишет в файл то, что получил, даже если это пустота. Если krisha
#    начнёт резать запросы, прежняя версия молча скопировала бы огрызок в
#    public и выкатила его. Теперь город с подозрительной просадкой не
#    копируется и не деплоится, а строка про него остаётся в логе.

$ErrorActionPreference = 'Continue'
Set-Location 'E:\projects\zhk-radar'
New-Item -ItemType Directory -Force logs | Out-Null

$log = 'logs\update.log'
function Say([string]$text) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $text
  $line | Out-File -Append -Encoding utf8 $log
  Write-Output $line
}

# Алматы обновляем каждый день — там десятки изменений в сутки. Остальные
# города заметно спокойнее, им хватает раза в неделю, а 21 тысяча запросов
# каждую ночь — лишняя нагрузка и на krisha, и на домашний канал.
$cities = @(
  @{ Key = 'almaty';      Slug = 'almaty';      Box = '43.40 76.70 43.05 77.20'; EveryDays = 1 },
  @{ Key = 'astana';      Slug = 'astana';      Box = '51.25 71.20 51.00 71.70'; EveryDays = 7 },
  @{ Key = 'shymkent';    Slug = 'shymkent';    Box = '42.42 69.48 42.22 69.78'; EveryDays = 7 },
  @{ Key = 'taldykorgan'; Slug = 'taldykorgan'; Box = '45.07 78.28 44.94 78.47'; EveryDays = 7 },
  # у Капчагая слуг krisha — konaev, а имя файла kapchagay: это 7-й аргумент
  @{ Key = 'kapchagay';   Slug = 'konaev';      Box = '43.93 76.98 43.80 77.15'; EveryDays = 7 }
)

# ниже этой доли от прошлого снимка город считаем сломанным и не публикуем
$MinKeepRatio = 0.6

Say 'старт обновления'
$updated = @()

foreach ($c in $cities) {
  $sfx  = if ($c.Key -eq 'almaty') { '' } else { "-$($c.Key)" }
  $meta = "data\listings-meta$sfx.json"

  $prevTotal = 0
  $ageDays = 999
  if (Test-Path $meta) {
    try {
      $m = Get-Content $meta -Raw | ConvertFrom-Json
      $prevTotal = [int]$m.total
      $ageDays = [math]::Round(((Get-Date) - [datetime]$m.updatedAt).TotalDays, 1)
    } catch { Say "$($c.Key): прошлую мету не прочитать — собираем заново" }
  }

  if ($ageDays -lt $c.EveryDays) {
    Say "$($c.Key): свежие данные ($ageDays дн.) — пропускаем"
    continue
  }

  Say "$($c.Key): сбор (прошлому снимку $ageDays дн.)"
  $args = "scripts\collect-listings.mjs $($c.Slug) $($c.Box) $($c.Key)".Split(' ')
  & node $args *>> $log

  if (-not (Test-Path $meta)) { Say "$($c.Key): меты нет, сбор не удался — пропускаем"; continue }
  $m = Get-Content $meta -Raw | ConvertFrom-Json
  $newTotal = [int]$m.total

  if ($prevTotal -gt 0 -and $newTotal -lt $prevTotal * $MinKeepRatio) {
    Say "$($c.Key): ВНИМАНИЕ — было $prevTotal, стало $newTotal. Похоже на блокировку, в public не копируем"
    continue
  }

  foreach ($n in @("listings$sfx.json", "listings-meta$sfx.json", "listings-sold$sfx.json")) {
    if (Test-Path "data\$n") { Copy-Item "data\$n" "public\$n" -Force }
  }
  Say "$($c.Key): ок — $newTotal квартир (было $prevTotal)"
  $updated += $c.Key
}

if ($updated.Count -eq 0) {
  Say 'обновлять нечего, деплой не нужен'
  exit 0
}

Say "обновлены: $($updated -join ', ') — собираем и деплоим"
& pnpm build *>> $log
if ($LASTEXITCODE -ne 0) { Say 'сборка упала — деплой отменён'; exit 1 }

# vercel@latest (59.16+) отвечает Not authorized на сохранённой сессии,
# работающей в 59.11.7 — версия закреплена намеренно.
& npx --yes vercel@59.11.7 deploy --prod --yes *>> $log
if ($LASTEXITCODE -ne 0) { Say 'деплой упал'; exit 1 }

Say 'готово: данные на проде'
