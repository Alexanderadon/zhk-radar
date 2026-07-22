# ЖК-Радар — ежедневное обновление квартир (запускается Планировщиком Windows).
# Скрейпит с локального IP Алматы (krisha не режет резидентные IP), считает продано/новых, копирует в public.
$ErrorActionPreference = 'Continue'
Set-Location 'E:\projects\zhk-radar'
New-Item -ItemType Directory -Force logs | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
"[$stamp] старт обновления" | Out-File -Append -Encoding utf8 logs\update.log

# 1) свежие квартиры + diff (продано/новых)
node scripts\collect-listings.mjs *>> logs\update.log

# 2) отдать статикой сайту
Copy-Item data\listings.json      public\listings.json      -Force
Copy-Item data\listings-meta.json public\listings-meta.json -Force -ErrorAction SilentlyContinue
Copy-Item data\listings-sold.json public\listings-sold.json -Force -ErrorAction SilentlyContinue

"[$stamp] готово" | Out-File -Append -Encoding utf8 logs\update.log
