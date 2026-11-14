# D12 — журнал проверки чисел (рабочий)

Задание D12 из `build/NICHE-DEEP.md`: проверка чисел пакета кафе и общего пакета по первоисточникам.
База: `packs/cafe.json` версии 2 из ветки `claude/keen-cray-yytcbp` (включает extra.footfall, extra.buildout, extra.takeover) и `packs/_common.json` из основной ветки.

## Как открывались источники

- Сеть контейнера ограничена списком хостов. Открыты напрямую (curl через прокси): dol.ny.gov, nyc-business.nyc.gov, www.diningoutnyc.info, www.wcb.ny.gov, www.irs.gov, dos.ny.gov, www.tax.ny.gov, www.nysenate.gov, fred.stlouisfed.org, www.bls.gov и др.
- www.nyc.gov отвечает 403 (Akamai) на любой автоматический запрос, в том числе из Chromium. Числа с nyc.gov сверяются через поиск и через зеркала (nyc-business.nyc.gov, тексты правил), пометка остаётся прежней, если сам документ не открыт.

## Сделано

- 16:20 UTC — инвентаризация: в cafe.json 45 записей `estimate`, ~60 чисел без `source` (рычаги, срезанные углы, штрафы внутри нарушений, extra); в _common.json 10 записей `estimate`.
- 16:35 UTC — проверены напрямую: минимальная зарплата NYC $17.00 (2026 и 2027, off-ramp), tip credit $11.35/$5.65 (2026 и 2027), UI new employer 4.1% и база $17,600 (2026), FUTA 6.0%/5.4%/$7,000, LLC $200 + $50, минимальный штраф IRS за неподачу $525, Dining Out NYC сборы и штрафы, разрешение FSE $280 и 22 дня, FPC $24/$114, WCB $2,000 за 10 дней.
