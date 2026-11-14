# Формат «пакета ниши» — контракт между исследователями и движком

Решение ведущего, 14 ноября 2026, 11:05 UTC. Движок один на все ниши; ниша — это файл данных `packs/<id>.json`. Чтобы в игре было пять ниш «как в жизни», пять исследователей сдают пять файлов **в одном формате**. Файл, который не проходит проверку `node build/validate-pack.mjs packs/<id>.json`, не принимается.

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

  // Разовые расходы до открытия: ремонт, мебель, оборудование, депозит, разрешения, лицензии, первый запас.
  "setup": [
    { "id": "espresso_machine", "name": "Espresso machine", "kind": "equipment",   // equipment | furniture | buildout | deposit | permit | license | inventory | other
      "cost": 9000, "required": true, "source": "…", "confidence": "estimate", "note": "…" }
  ],

  // Ежемесячные расходы, кроме зарплаты и налогов.
  "monthlyCosts": [
    { "id": "rent", "name": "Rent", "kind": "rent",      // rent | utilities | insurance | supplies | cleaning | marketing | fees | maintenance | debt | other
      "basis": "fixed",                                   // fixed | per_staff | per_unit | pct_revenue
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
      "foundBy": ["audit", "complaint"],            // inspection | audit | complaint | sting | journalist
      "fine": { "base": 0, "perMonth": 0, "pctOfSaved": 1.5, "max": null },   // штраф = base + perMonth × месяцев + pctOfSaved × сэкономленное
      "closureDays": 0, "reputationHit": 0.1, "criminal": "текстом: когда это уже уголовное дело",
      "source": "…", "confidence": "verified", "note": "…" }
  ],

  // Госслужащие, которые проверяют эту нишу (роли для бесплатных игроков).
  "officials": [
    { "id": "health_inspector", "name": "Health inspector", "agency": "NYC DOHMH",
      "checks": ["dirty_surfaces"], "realProcess": "Как проверка идёт в жизни, 2–3 фразы", "source": "…" }
  ],

  // Атаки игрока на конкурента в этой нише.
  "attacks": [
    { "id": "report_to_311", "name": "File a 311 complaint", "cost": 0,
      "triggers": "health_inspector", "worksIf": "цель действительно нарушает", "backfire": "ложная жалоба: штраф и раскрытие имени" }
  ],

  // События из жизни ниши, объявляются за месяц.
  "events": [
    { "id": "coffee_price_spike", "name": "Coffee beans up 15%", "effect": { "field": "cogsPerUnit", "mult": 1.15 }, "months": 2, "source": "…" }
  ],

  // Карточки «Real rule»: показываются игроку при первой встрече с правилом.
  "ruleCards": [
    { "id": "letter_grade", "title": "Letter grades", "text": "До 280 знаков, по-английски, с числом.", "source": "…" }
  ],

  "sources": [ { "url": "…", "title": "…", "checked": "2026-11-14" } ]
}
```

## Минимальный объём пакета ниши

| Раздел | Минимум |
|---|---|
| `setup` | 10 строк, среди них мебель, оборудование, депозит, ремонт, все обязательные разрешения и лицензии |
| `monthlyCosts` | 10 строк |
| `staff` | 2 роли |
| `taxes` | всё, что специфично для ниши |
| `levers` | 4 |
| `shortcuts` | 8, каждый с нарушением |
| `violations` | 10 |
| `officials` | 2 |
| `attacks` | 4 |
| `events` | 5 |
| `ruleCards` | 12 |

## Как проверить

```bash
node build/validate-pack.mjs packs/cafe.json
```

Ошибки (`ERROR`) надо исправить. Предупреждения (`WARN`) — исправить или объяснить в отчёте.

## Чего в формате не хватает

Если твоей нише нужно поле, которого нет (ипотека у квартир, сезонность у отеля), добавь его под ключом `"extra": { … }` и опиши в отчёте в разделе «Просьбы к ведущему». Существующие поля не переименовывай.
