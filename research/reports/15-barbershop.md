# 15 — Барбершоп: данные ниши (черновик, пополняется)

Агент 15, 14 ноября 2026. Пакет — `packs/barbershop.json`. Этот файл — рабочие заметки: факты и откуда они. Итоговый отчёт (P&L честного владельца и нарушителя, что не нашёл, где оценки) будет в этом же файле.

## Как я проверял числа

Сеть сессии закрыта для прямого доступа к сайтам: `dos.ny.gov`, `tax.ny.gov`, `nysenate.gov`, `nyc.gov`, `bls.gov` и остальные отвечают отказом политики (HTTP 403 на прокси). Работает только веб-поиск. Поэтому правило такое:

- `verified` — число стоит в выдержке поиска из текста самой страницы первоисточника (сайт ведомства, текст закона, страница продавца с ценой);
- `estimate` — число из вторичных источников или мой расчёт; расчёт записан в `note`.

Страницы целиком я не открывал. Если ведущий откроет сессии доступ к этим сайтам, все `verified` стоит перечитать по ссылкам.

## Факты, найденные на 11:56 UTC

### Лицензии и разрешения
| Что | Число | Источник |
|---|---|---|
| NYS Barber Shop Owner license | $60 первая заявка, $60 продление; срок 4 года (NY Business Express) | https://dos.ny.gov/get-barber-shop-ownerarea-renter-license ; https://businessexpress.ny.gov/app/answers/cms/a_id/1988 |
| NYS Barber Area Renter license | $60; мастер, который работает в шопе, но не нанят владельцем, — независимый подрядчик и обязан иметь эту лицензию сверх своей лицензии барбера | https://dos.ny.gov/get-barber-shop-ownerarea-renter-license |
| Лицензия владельца не даёт права стричь | каждый, кто стрижёт, должен иметь лицензию barber operator | https://dos.ny.gov/frequently-asked-questions-barber |
| NYS Barber (operator) license | $40, продление $40; экзамен $15; ученик (apprentice) $20 | GBL § 440: https://www.nysenate.gov/legislation/laws/GBS/440 |
| Путь в барберы | 2 года ученичества с лицензией ученика или курс в школе, одобренной штатом; затем экзамен | https://dos.ny.gov/frequently-asked-questions-barber |
| Ученик | с 17 лет, осмотр у врача | https://dos.ny.gov/become-barber-apprentice |
| NYC DOHMH Barber Shop Permit (Health Code Art. 163) | $15 в год (новая заявка $7,50–$15), истекает 31 октября, документ приходит почтой за 7–10 дней | https://nyc-business.nyc.gov/nycbusiness/description/barber-shop-permit ; https://portal.311.nyc.gov/article/?kanumber=KA-01847 |
| Certificate of Occupancy | разрешение DOHMH не даёт права занимать помещение: нужен C of O (NYC Charter § 645) | там же |

### Штрафы по лицензиям
| Что | Число | Источник |
|---|---|---|
| GBL § 441(a) | приостановка или отзыв лицензии либо штраф до $500 или выговор — за нарушение статьи 28, её правил или санитарного кодекса; после отзыва лицензию шопа не выдают год | https://www.nysenate.gov/legislation/laws/GBS/441 |
| GBL § 444 | стричь или держать шоп без лицензии, допустить к работе человека без лицензии — misdemeanor: до 6 месяцев, или штраф до $500, или оба; каждое нарушение — отдельное | https://www.nysenate.gov/legislation/laws/GBS/444 |

### Санитария
- NYC Health Code § 163.05: раковина с горячей и холодной водой, дозатор мыла, свежевыстиранные или одноразовые полотенца, закрытые баки для грязного белья и для волос; инструмент нельзя использовать на клиенте, если он не «clean and sanitary». § 163.11: пол подметать и мыть не реже раза в день. https://www.nyc.gov/assets/doh/downloads/pdf/about/healthcode/health-code-article163.pdf
- 10 NYCRR 10.24: инструменты чистые всегда и тщательно очищаются после каждого клиента; 10.20: владелец отвечает за чистоту шопа. https://regs.health.ny.gov/
- 19 NYCRR 160.17 (правила Appearance Enhancement, для сравнения): многоразовый инструмент после каждого клиента моют, ополаскивают и стерилизуют.

### Sales tax
- Услуги барбера вне города Нью-Йорк налогом не облагаются; в городе Нью-Йорк — местный налог 4,5%, налога штата нет. Товары на вынос — 8,875%. https://www.nyc.gov/site/finance/business/business-nys-sales-tax.page ; бюллетень TB-ST-60 https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/beauty_salons_barbers.htm
- Аренда кресла (booth rental) — аренда недвижимости, sales tax не облагается. Кресла, зеркала, ножницы при покупке облагаются. Там же.
- Штраф за неуплату: 10% за первый месяц + 1% за каждый следующий, не больше 30%, минимум $50; пропуск больше 25% налога в декларации — ещё 10%. https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_and_use_tax_penalties.htm

### Труд
- Минимальная зарплата в городе Нью-Йорк с 1 января 2026 — $17,00. https://dol.ny.gov/minimum-wage-0
- С 31 декабря 2020 в «miscellaneous industries» (в том числе парикмахерские) tip credit запрещён: мастер получает полный минимум до чаевых. https://dol.ny.gov/minimum-wage-tipped-workers
- Labor Law § 196-d: работодатель не вправе забирать чаевые. https://www.nysenate.gov/legislation/laws/LAB/196-D
- Labor Law §§ 198, 663: недоплата взыскивается за 6 лет, плюс 100% liquidated damages; § 218 — гражданский штраф департамента.
- WCL § 52: без страховки workers' comp — до $2 000 за каждые 10 дней; оформление работников подрядчиками названо примером обмана. https://www.wcb.ny.gov/content/main/Employers/violations-wclaw.jsp
- BLS OEWS, май 2023, барберы (39-5011), агломерация Нью-Йорка: 2 090 человек, средняя $22,30 в час, $46 390 в год. https://www.bls.gov/oes/2023/may/oes395011.htm

### Цены и рынок
- Minerva Traditional Barber Chair (SKU 1181b) — $599. https://www.minervabeauty.com/traditional-barber-chair-in-black
- Takara Belmont Elegance (BB-225) — $3 862,50 у продавца в США; Legacy — $5 950.
- Barbicide, концентрат 64 oz — $15,49–$31,84; банка для дезинфекции — $39,99.
- Square: $0 тариф Free, приём карт лично 2,6% + 15¢ (с конца 2025 года было 10¢).
- Booksy: $29,99 в месяц за первого, +$20 за каждого следующего мастера.
- Аренда кресла в Нью-Йорке: $230–$462 в неделю, среднее $368 (пять объявлений SalonRenter). Комиссия: чаще 50/50 или 60/40 в пользу мастера (Squire, Vagaro).
- Средняя цена мужской стрижки: США — $43 (Squire, 2026, 7 000 шопов); Нью-Йорк — $77, диапазон $33–$170 (Square).
- Предельный тариф на вывоз мусора (BIC): $26,87 за куб. ярд, $17,64 за 100 фунтов (ноябрь 2024).
- Вывеска: разрешение DOB нужно, если вывеска больше 6 кв. футов или светится; вешает Licensed Sign Hanger.
