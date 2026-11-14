# First Year — речь на пять минут

B17, третий заход. Основа — `docs/pitch/LIVE-SHOW.md` (концепция Б: Maya и Viktor, соседние кофейни). Презентация — `docs/pitch/deck/deck.pdf`, страницы 1–10.

**Как читать.** Обычный текст под заголовком страницы — речь, по-английски, вслух. Строки, начинающиеся с `▸`, — режиссура на русском, их не произносят. **А** — рассказчик (Maya), **Б** — управляет ноутбуком (Viktor).

**Слова.** Речи — 550 английских слов (лимит 650). Темп — около 140 слов в минуту; время страницы = слова + живые действия (страницы 3 и 4 — по 15–20 секунд действий без слов). Пересчёт: `node docs/pitch/deck/words.mjs`. Числа рынка — из `USER.md` (B15), денег — из `MONEY.md` и `model.mjs` (B16).

**Правило чисел.** Деньги кафе на сцене — те, что показывает игра в эту минуту, не из этого текста. Если экран показывает другое — говорим то, что на экране.

**До выхода.** Город показа и коды телефонов — по `docs/pitch/RUNBOOK.md` (A5): `node scripts/pitch.mjs` должен закончиться `PASS: 16/16 steps in their windows`, затем «Back to start».

---

## 0:00–0:17 · Страница 1 — боль

▸ Титр «Before you sign the lease» 4 секунды, затем страница 1. Говорит А.

Would you risk your family's savings on a coffee shop?
Maya wants one. Her savings cannot survive one expensive mistake.
First Year lets her live the first year of that coffee shop before she signs a lease.

## 0:17–0:47 · Страница 2 — кто и почему болит

▸ А. Числа — из `USER.md` (B15), источники на слайде.

Our user is one person: an American, twenty-one to forty-five, who dreams of a place of their own.
Americans filed a record five point seven million business applications last year. Half of new food places close within five years, and most owners start on their own savings.
Owners don't fail on coffee. "It was pure economics: rents, expenses," said one Manhattan owner, five months in.

## 0:47–1:32 · Страница 3 → живой продукт

▸ Страница 3 на проекторе: как Maya дошла до открытия (настоящие экраны). Говорит А.

Maya typed one line: coffee near the subway. The game found her a real East Village storefront — rent, size, foot traffic, rivals — and computed her first year before she bought anything.

▸ Б переключает проектор на телефон Maya: город показа A5, вход по коду `/p/<код Maya>`, открыт `/biz`, город на паузе (`docs/pitch/RUNBOOK.md`). А открывает вкладку Manage и поворачивается к жюри. Если игра на публичном адресе (B05), А добавляет: “It runs on a public address — scan the code later.”

This is her shop, live. Customers come, and some walk away. Your call: raise the price, or add seats?

▸ Судья выбирает; через пять секунд тишины — цена. А меняет один параметр на телефоне, прогноз месяца меняется до «Apply». Запасной путь — Б на пульте `/pitch`: «Raise the price» или «Add seats» (для мест пульт сам докупит туалет для гостей, если места переходят порог).

The forecast updates before she commits. It is a model, not a promise. Apply.

## 1:32–2:10 · Страница 4 → живой город

▸ Проектор — гостевой вид города (`/p/<гостевой код>`). Говорит Б.

I run the cafe next door. I save money by paying wages off the books.

▸ А на телефоне: Network → Viktor → Report. Б на пульте `/pitch`: Resume · 1 s/day; город сам встанет на паузу, когда придёт уведомление. Запасной путь — кнопка «Maya reports Viktor · run to notice».

Maya reports it. The city opens a case, an inspector checks my payroll.
The verdict is computed by the engine, not scripted by us.

▸ Результат проверки на экране, Б оплачивает на своём телефоне. Если найдено другое нарушение: “The inspector found a different violation. Here is the record.” После показа — «Back to start» на пульте.

## 2:10–2:40 · Страница 5 — что настоящее

▸ Б возвращает презентацию. А.

What is real? A pure engine: every input is an action, and the same code runs on the server and in the browser.
No dice: the same decision gives the same result.
Every number has a source. Seventy-three of the key numbers are verified at the primary source; the rest are marked estimates.
Six hundred thirty-nine automated tests are green. The repo is in front of you.

## 2:40–3:12 · Страница 6 — за что платят и зачем возвращаются

The city, your storefront and your first month are free.
For nineteen dollars a month you get the whole year, the advisor, and your personal plan: your costs, your permits, with official links.
At year end the game shows where you lost money. In our test run: rent and labour above the norm.
Why come back tomorrow? One game month passes every real day: a report, a neighbour's move, a decision waiting.

## 3:12–3:32 · Страница 7 — как к нам приходят

▸ А. Три рекламных захода — черновики на настоящих кадрах, ещё не запускались; так и говорим.

Our ads show one real moment of the year: rent running before the first customer, a neighbour's offer, the year-end bill.
One question — what would you open — and you see your own storefront and its cost. First month free, then nineteen dollars.

## 3:32–4:06 · Страница 8 — деньги

▸ Числа — из модели B16 (`docs/pitch/model.mjs`, коммит 897ac38): на странице их подставляет сборка. Если модель поменялась — читаем числа со слайда, не из этого текста.

We sell only to the person: nineteen dollars a month or one forty-nine a year.
On public benchmarks a payer is worth one hundred twenty dollars and costs forty-seven to reach: two and a half times.
Ads alone don't pay back, so growth must be organic: friends opening next door, the plan you show your family.
Five hundred fifty-seven thousand payers make one hundred million: four percent of young city dwellers who consider a business.

## 4:06–4:26 · Страница 9 — почему не копия

Tycoon games give fun without truth. Courses give truth without practice. Templates and chatbots give a document without consequences. A consultant costs three thousand dollars and up.
We are a rehearsal: your shop, on sourced local numbers, in a city you share with others.

## 4:26–5:00 · Страница 10 — команда и финал

▸ На странице внизу — финальная строка, адрес игры и репозиторий. Последнюю фразу А говорит в зал. Пауза, конец.

Two people and a crew of AI agents built this in twenty-four hours.
Each agent owned its files and kept a journal in the repo; nothing merged unless tests and the end-to-end check were green.
Rehearse your first year before you risk your family's savings.

---

## Если время срезали до трёх минут

Страницы 1 → 3 (живой продукт без выбора жюри: только расчёт первого года) → 5 → 6 → 8 → 10. Город и проверку (страница 4) пропускаем, на вопрос о соседях и проверках отвечаем по `QA.md`, вопрос 19.

## Если живой продукт не открылся

▸ Б: “Here is the same build, recorded.” Показываем страницы 3–4 как есть: на них настоящие экраны, снятые `docs/pitch/deck/capture.mjs` (см. `docs/pitch/deck/img/README.md`). Не выдаём запись за живое действие.
