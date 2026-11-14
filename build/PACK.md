# Формат «пакета ниши» — контракт между данными и движком

Решение ведущего, 14 ноября 2026, 10:46 UTC. Движок один на все ниши; ниша — это файл данных `packs/<id>.json`. Чтобы в игре было пять ниш «как в жизни», агенты ниш сдают пять файлов **в одном формате**; типы — `Pack` и `CommonPack` в `shared/src/types.ts`. Файл, который не проходит проверку `node build/validate-pack.mjs packs/<id>.json`, не принимается.

## Правила для содержимого

1. **Язык.** Все строки, которые увидит игрок (`name`, `label`, `what`, `text`, `title`), — на английском: аудитория — США. Отчёт к пакету — на русском.
2. **Числа настоящие.** У каждого числа есть `source` (ссылка на первоисточник: nyc.gov, ny.gov, irs.gov, bls.gov, текст закона) и `confidence`: `verified` — открыл первоисточник и увидел число сам; `estimate` — оценка, тогда в `note` расчёт. Выдуманных чисел нет. Суммы — в долларах США, ставки — долями (8,875% = `0.08875`). Данные — на 2026 год; если нашёл только более старые, напиши год в `note`.
3. **Месяц — единица времени.** Раунд игры равен месяцу. Годовые суммы дели на 12, почасовые умножай на часы в месяц.
4. **Масштаб.** Маленькое заведение одного владельца: 1–8 работников, одно помещение.
5. **Идентификаторы** — латиница в `snake_case`, уникальны внутри файла.
6. **«Срезать угол» — главная механика.** Каждый `shortcut` экономит деньги сейчас и создаёт нарушение (`violation`), за которое по настоящему закону положено настоящее наказание. Игра показывает цену риска, а не учит уклоняться: у каждого нарушения есть карточка `ruleCards` с законом и наказанием.
7. **Случая нет.** Проверка находит нарушение, если оно есть. Поэтому вероятностей в пакете нет; есть «кто может это найти» и «как растёт наказание с каждым месяцем».

## Поля

```jsonc
{
  "id": "cafe",                    // cafe | barbershop | bodega | guesthouse | rentals | _common
  "version": 1,
  "name": "Coffee shop",
  "tagline": "One line for the niche card on the map",
  "startCapital": 60000,           // игровые доллары на старте; одинаковы у всех игроков ниши

  // Что продаём. Одна «единица продажи»: заказ, стрижка, чек, ночь, квартира-месяц.
  "unit": { "name": "order", "refPrice": 6.5, "priceMin": 3, "priceMax": 12, "cogsPerUnit": 1.9,
            "source": "…", "confidence": "estimate", "note": "расчёт" },

  // Спрос: сколько единиц в месяц приходит на одно место при цене refPrice и среднем качестве.
  "market": { "unitsPerSlotMonth": 5200, "priceElasticity": -1.4,
              "weights": { "price": 0.35, "quality": 0.25, "reputation": 0.2, "location": 0.2 },
              "source": "…", "confidence": "estimate", "note": "…" },

  // Мощность: сколько единиц в месяц может обслужить бизнес.
  "capacity": { "unitsPerStaffMonth": 1800, "minStaff": 1, "maxStaff": 8,
                "hardCapUnits": null,          // для отеля и квартир: число комнат × 30 или число квартир
                "note": "…" },

  // Физический размер: места в кафе, кресла, метры полок, комнаты, квартиры. Игрок выбирает size; движок считает,
  // что будет, если мест мало (очередь, потерянные продажи) или много (лишние расходы, пустой зал).
  "sizing": { "unitName": "seat", "min": 6, "max": 40, "default": 18,
              "sqftPerUnit": 18,                 // площадь на одно место вместе с проходами
              "unitsServedPerSizeMonth": 150,    // сколько заказов «в зале» в месяц пропускает одно место
              "takeawayShare": 0.45,             // доля спроса, которой место не нужно; 0, если такого нет
              "cleaningCostPerSizeMonth": 12,
              "crowdPenaltyAbove": 0.9, "emptyPenaltyBelow": 0.3,
              "source": "…", "confidence": "estimate", "note": "расчёт" },

  // Разовые расходы до открытия: ремонт, мебель, оборудование, депозит, разрешения, лицензии, первый запас.
  "setup": [
    { "id": "espresso_machine", "name": "Espresso machine", "kind": "equipment",   // equipment | furniture | buildout | deposit | permit | license | inventory | other
      "cost": 9000, "required": true, "lifespanMonths": 84, "qualityBonus": 0.03,
      "source": "…", "confidence": "estimate", "note": "…" },
    { "id": "fse_permit", "name": "Food Service Establishment Permit", "kind": "permit", "cost": 280, "required": true,
      "waitDays": 21,                               // настоящий срок получения в днях; игровой день = день
      "agency": "NYC DOHMH", "link": "https://…",   // кто выдаёт и официальная страница
      "withoutItViolation": "no_fse_permit",        // нарушение, если открыться раньше
      "source": "…", "confidence": "verified" },
    { "id": "chair", "name": "Dining chair", "kind": "furniture", "cost": 85, "required": true,
      "scalesWithSize": true,                     // цена за одну единицу размера: движок умножит на size
      "lifespanMonths": 60, "source": "…", "confidence": "verified" }
  ],

  // Три готовых набора. Система рекомендует их игроку: он не выбирает мебель по одной.
  // В каждом — все предметы с required: true. qty у предметов со scalesWithSize не указывается (берётся size).
  "kits": [
    { "id": "lean",     "name": "Lean start",  "size": 12, "items": [ { "id": "espresso_machine", "qty": 1 }, { "id": "chair", "qty": 12 } ], "pitch": "Cheapest way to open. Small room, used equipment." },
    { "id": "standard", "name": "Standard",    "size": 18, "items": [ … ], "pitch": "…" },
    { "id": "premium",  "name": "Premium",     "size": 24, "items": [ … ], "pitch": "…" }
  ],

  // Ежемесячные расходы, кроме зарплаты и налогов.
  "monthlyCosts": [
    { "id": "rent", "name": "Rent", "kind": "rent",      // rent | utilities | insurance | supplies | cleaning | marketing | fees | maintenance | debt | other
      "basis": "fixed",                                   // fixed | per_staff | per_unit | pct_revenue | per_size
      "amount": 9500, "source": "…", "confidence": "verified", "note": "…" }
  ],

  // Работники.
  "staff": [
    { "id": "barista", "name": "Barista", "hourlyWage": 17.0, "tipped": true, "cashWage": 11.35,
      "hoursPerMonth": 140, "licenseRequired": null, "source": "…", "confidence": "verified" }
  ],

  // Налоги и обязательные сборы именно этой ниши. Общие для всех ниш лежат в packs/_common.json.
  "taxes": [
    { "id": "sales_tax", "name": "Sales tax", "base": "taxable_revenue",   // revenue | taxable_revenue | payroll | profit | rent | fixed
      "rate": 0.08875, "due": "quarterly",                                  // monthly | quarterly | annual
      "appliesIf": "prepared food and drinks", "source": "…", "confidence": "verified" }
  ],

  // Законные решения игрока каждый месяц (кроме цены и числа работников — они есть всегда).
  "levers": [
    { "id": "cleaning", "name": "Cleaning", "options": [
        { "id": "full",    "label": "Daily deep clean", "monthlyCost": 900, "effects": { "quality": 0.05 } },
        { "id": "minimal", "label": "Wipe and go",      "monthlyCost": 250, "effects": { "quality": -0.05 }, "causes": "dirty_surfaces" }
    ] }
  ],

  // Незаконные или серые способы сэкономить. Каждый ссылается на нарушение.
  "shortcuts": [
    { "id": "cash_wages", "name": "Pay staff in cash, off the books",
      "what": "No payroll taxes this month. If anyone audits you, you owe it all back with penalties.",
      "saves": { "basis": "pct_payroll", "amount": 0.18 },     // fixed | pct_payroll | pct_revenue | pct_rent | per_staff
      "violation": "off_books_payroll" }
  ],

  // Нарушения: что это, по какому закону, кто находит, чем наказывают.
  "violations": [
    { "id": "off_books_payroll", "name": "Unreported cash payroll",
      "law": "NY Tax Law §…; 26 U.S.C. §…",
      "official": "tax_inspector",                  // id из officials этого файла или _common
      "foundBy": ["audit", "complaint"],            // inspection | audit | complaint | sting
      "fine": { "base": 0, "perMonth": 0, "pctOfSaved": 1.5, "max": null },   // штраф = base + perMonth × месяцев + pctOfSaved × сэкономленное
      "closureDays": 0, "reputationHit": 0.1, "criminal": "текстом: когда это уже уголовное дело",
      "source": "…", "confidence": "verified", "note": "…" }
  ],

  // Госслужащие, которые проверяют эту нишу (роли для бесплатных игроков).
  "officials": [
    { "id": "health_inspector", "name": "Health inspector", "agency": "NYC DOHMH",
      "role": "inspector",                          // inspector (городские инспекции) | tax_auditor (налоги и труд)
      "checks": ["dirty_surfaces"], "realProcess": "Как проверка идёт в жизни, 2–3 фразы", "source": "…" }
  ],

  // «Сообщить городу»: жалобы, которые игрок может подать на конкурента. Единственное нападение в игре.
  "reports": [
    { "id": "report_dirty_kitchen", "name": "Report unsanitary conditions (311)",
      "text": "The Health Department sends an inspector. If you are wrong, you get a warning.",
      "role": "inspector", "checks": ["dirty_surfaces"] }      // checks — id нарушений, на которые указывает жалоба
  ],

  // События из жизни ниши, объявляются за месяц.
  "events": [
    { "id": "coffee_price_spike", "name": "Coffee beans up 15%", "effect": { "field": "cogsPerUnit", "mult": 1.15 }, "months": 2, "source": "…" }
  ],

  // Карточки «Real rule»: показываются игроку при первой встрече с правилом.
  "ruleCards": [
    { "id": "letter_grade", "title": "Letter grades", "text": "До 280 знаков, по-английски, с числом.", "source": "…" }
  ],

  // План открытия, как в жизни, по порядку. Общие шаги (LLC, EIN, sales tax, страховки) лежат в _common.roadmap — здесь шаги ниши.
  // kind: idea | legal | permit | space | money | supplier | people | launch
  "roadmap": [
    { "id": "get_fse_permit", "title": "Get your Food Service Establishment Permit", "kind": "permit",
      "text": "Apply online before you build out. An inspector visits before you open.",
      "setupItemId": "fse_permit", "fee": 280, "waitDays": 21, "agency": "NYC DOHMH", "link": "https://…" }
  ],

  // Где в жизни искать поставщиков. Справка для игрока: категории, где ищут, известные примеры.
  "suppliers": [
    { "id": "coffee_beans", "category": "Coffee", "what": "Wholesale roasted beans, usually with free equipment service",
      "whereToFind": "Local wholesale roasters; ask cafes you like who supplies them", "examples": "…", "link": "https://…",
      "source": "…", "confidence": "estimate", "note": "…" }
  ],

  // Зарплата нанятого управляющего, который ведёт бизнес, пока владельца нет.
  "manager": { "monthlySalary": 4800, "source": "…", "confidence": "verified" },

  // Нормы отрасли для аналитики игрока: доли от выручки.
  "benchmarks": { "cogsPct": 0.30, "laborPct": 0.30, "rentPct": 0.08, "netMarginPct": 0.06, "source": "…", "confidence": "verified" },

  "sources": [ { "url": "…", "title": "…", "checked": "2026-11-14" } ]
}
```

## Минимальный объём пакета ниши

| Раздел | Минимум |
|---|---|
| `setup` | 12 строк, среди них мебель и оборудование поимённо, депозит, ремонт, все обязательные разрешения и лицензии |
| `sizing` | заполнен полностью |
| `kits` | ровно три: `lean`, `standard`, `premium` |
| `benchmarks` | заполнен, с источником |
| `monthlyCosts` | 10 строк |
| `staff` | 2 роли |
| `taxes` | всё, что специфично для ниши |
| `levers` | 4 |
| `shortcuts` | 8, каждый с нарушением |
| `violations` | 10 |
| `officials` | 2 |
| `reports` | 3 |
| `roadmap` | 10 шагов по порядку |
| `suppliers` | 6 категорий |
| `manager` | заполнен |
| `events` | 5 |
| `ruleCards` | 12 |

## Как проверить

```bash
node build/validate-pack.mjs packs/cafe.json
```

Ошибки (`ERROR`) надо исправить. Предупреждения (`WARN`) — исправить или объяснить в отчёте.

## Чего в формате не хватает

Если твоей нише нужно поле, которого нет (ипотека у квартир, сезонность у отеля), добавь его под ключом `"extra": { … }` и опиши в отчёте в разделе «Просьбы к ведущему». Существующие поля не переименовывай.
