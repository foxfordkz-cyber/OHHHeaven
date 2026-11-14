# D12 — журнал проверки чисел (рабочий)

Задание D12 из `build/NICHE-DEEP.md`: проверка чисел пакета кафе и общего пакета по первоисточникам.
База: `packs/cafe.json` версии 2 из ветки `claude/keen-cray-yytcbp` (включает extra.footfall, extra.buildout, extra.takeover) и `packs/_common.json` из основной ветки.

## Как открывались источники

- Сеть контейнера ограничена списком хостов. Открыты напрямую (curl через прокси): dol.ny.gov, nyc-business.nyc.gov, www.diningoutnyc.info, www.wcb.ny.gov, www.irs.gov, dos.ny.gov, www.tax.ny.gov, www.nysenate.gov, fred.stlouisfed.org, www.bls.gov и др.
- www.nyc.gov отвечает 403 (Akamai) на любой автоматический запрос, в том числе из Chromium. Числа с nyc.gov сверяются через поиск и через зеркала (nyc-business.nyc.gov, тексты правил), пометка остаётся прежней, если сам документ не открыт.

## Сделано

- 16:20 UTC — инвентаризация: в cafe.json 45 записей `estimate`, ~60 чисел без `source` (рычаги, срезанные углы, штрафы внутри нарушений, extra); в _common.json 10 записей `estimate`.
- 16:35 UTC — проверены напрямую: минимальная зарплата NYC $17.00 (2026 и 2027, off-ramp), tip credit $11.35/$5.65 (2026 и 2027), UI new employer 4.1% и база $17,600 (2026), FUTA 6.0%/5.4%/$7,000, LLC $200 + $50, минимальный штраф IRS за неподачу $525, Dining Out NYC сборы и штрафы, разрешение FSE $280 и 22 дня, FPC $24/$114, WCB $2,000 за 10 дней.
- 18:10 UTC — открыты напрямую: правила DOHMH Chapter 23 (2021 и 2025) на rules.cityofnewyork.us, eCFR 28 CFR 85.5 (I-9), NYSIF DBL 2026, PFL 2026, NRA (4.0%, 65%, аренда 6.0%), Insureon, LLC Publishers, Visions Espresso, WebstaurantStore (кофемашины, холодильник, посудомойка, раковины, стаканы, столы, Bunn), Square fees, FRED (кофе, молоко, арабика), Pub 718, Pub 15, Tax Law §1145, Labor Law §§196-d, 198, Penal Law §§200.00, 80.00, WCB, IRS failure-to-file, NY DOL OEWS (файл с зарплатами Нью-Йорка на I квартал 2026).
- Собран `D12-build.py` + `D12_patches.py` → `D12-number-check.json`, `D12-number-check.common.json`, `D12-table.md`.
- 18:50 UTC — второй пакет: штраф 28-06 ($200, не $100) и формула pest_activity; цена готовой кофейни 0.41 выручки по BizBuySell (было 0.2); источники и расчёты у всех рычагов и срезанных углов (кафе 8, общие 12); 32 числа перепроверены без изменений (`extra.d12CheckedUnchanged`). Фрагмент, влитый в пакет v2, проходит `validate-pack.mjs` с 0 ошибок.
