# First Year — речь на пять минут

B17, третий заход. Основа — `docs/pitch/LIVE-SHOW.md` (концепция Б: Maya и Viktor, соседние кофейни). Презентация — `docs/pitch/deck/deck.pdf`, страницы 1–10.

**Как читать.** Строки в кавычках не нужны: всё, что набрано обычным текстом под заголовком страницы, — это речь, по-английски, вслух. Строки, начинающиеся с `▸`, — режиссура на русском, их не произносят. **А** — рассказчик (Maya), **Б** — управляет ноутбуком (Viktor).

**Слова.** Речи — 558 английских слов на 22:29 UTC (лимит 650; с паузами на живые действия это впритык — режем страницу 5, если репетиция дольше 5:00). Пересчёт: `node docs/pitch/deck/words.mjs`. Числа денег в `[квадратных скобках]` ждут `MONEY.md` (B16) и до его прихода не произносятся; числа рынка — из `USER.md` (B15).

**Правило чисел.** Деньги кафе на сцене — те, что показывает игра в эту минуту, не из этого текста. Если экран показывает другое — говорим то, что на экране.

---

## 0:00–0:20 · Страница 1 — боль

▸ Титр «Before you sign the lease» 4 секунды, затем страница 1. Говорит А.

Would you risk your family's savings on a coffee shop?
Maya wants one. Her savings cannot survive one expensive mistake.
First Year lets her live the first year of that coffee shop before she signs a lease.

## 0:20–0:45 · Страница 2 — кто и почему болит

▸ А. Числа — из `USER.md` (B15), источники на слайде.

Our user is one person: an American, twenty-one to forty-five, who dreams of a place of their own.
Americans filed a record five point seven million business applications last year. Half of new food places close within five years, and most owners start on their own savings.
Owners don't fail on coffee. "It was pure economics: rents, expenses," said one Manhattan owner, five months in.

## 0:45–1:50 · Страница 3 → живой продукт

▸ Б переключает проектор на телефон Maya (подготовленная сессия, город на паузе). А держит телефон. Если игра открыта с публичного адреса (B05), А добавляет: “On a public address — scan the code later.”

This is the product, live.
Maya picked a real East Village storefront: rent, size, foot traffic, and rivals within two hundred fifty meters.
Before she buys anything, the game computes her first year: the build-out, the permits, the rent she pays while she waits.
Every number here has a source, and says whether it is verified or an estimate.

▸ Б открывает Manage. А поворачивается к жюри.

Her shop is open. Customers come, and some walk away. Your call: raise the price, or add seats?

▸ Судья выбирает; через пять секунд тишины — цена. А меняет один параметр, прогноз меняется до «Apply».

The forecast updates before she commits. It is a model, not a promise. Apply.

## 1:50–2:30 · Страница 4 → живой город

▸ Б открывает экран города. Говорит Б.

I run the cafe next door. I save money by paying wages off the books.

▸ А отправляет жалобу. Б снимает паузу; после результата — пауза.

Maya reports it. The city opens a case, an inspector checks my payroll.
The verdict is computed by the engine, not scripted by us.

▸ Результат проверки на экране. Если найдено другое нарушение: “The inspector found a different violation. Here is the record.”

## 2:30–3:05 · Страница 5 — что настоящее

▸ Б возвращает презентацию. А.

What is real? A pure engine: every input is an action, and the same code runs on the server and in the browser.
No dice. Events are announced in advance, so the same decision gives the same result.
Seventy-three of one hundred thirty-eight key numbers are verified at the primary source; the rest are marked estimates.
Six hundred thirty-nine automated tests are green. The repo is in front of you.

## 3:05–3:35 · Страница 6 — за что платят и зачем возвращаются

The city, your storefront and your first month are free.
For nineteen dollars a month you get the whole year, the advisor, and your personal plan: your costs, your permits, with official links.
At year end the game shows where you lost money. In our test run: rent and labour above the norm.
Why come back tomorrow? One game month passes every real day: a report, a neighbour's move, a decision waiting.

## 3:35–3:55 · Страница 7 — как к нам приходят

▸ А. Три рекламных захода — черновики на настоящих кадрах, ещё не запускались; так и говорим.

Our ads show one real moment of the year: rent running before the first customer, a neighbour's offer, the year-end bill.
One question — what would you open — and you see your own storefront and its cost. First month free, then nineteen dollars.

## 3:55–4:20 · Страница 8 — деньги

▸ Только числа из `MONEY.md` и `model.mjs`: на странице они подставлены сборкой из модели. Каждое допущение называем допущением.

We sell only to the person, by subscription.
[LTV $N against CAC $N — assumptions.] [N paying members make one hundred million ARR.]
Coffee shops first, then every small business on the same engine, then every city as a new data pack.
Price, retention and acquisition are still untested. That is our next experiment.

## 4:20–4:40 · Страница 9 — почему не копия

Tycoon games give fun without truth. Courses give truth without practice. Templates and chatbots give a document without consequences. A consultant costs three thousand dollars and up.
We are a rehearsal: your shop, on sourced local numbers, in a city you share with others.

## 4:40–5:00 · Страница 10 — команда и финал

▸ На странице внизу — финальная строка, адрес игры и репозиторий. Последнюю фразу А говорит в зал. Пауза, конец.

Two people and a crew of AI agents built this in twenty-four hours.
Each agent owned its files and kept a journal in the repo; nothing merged unless tests and the end-to-end check were green.
Rehearse your first year before you risk your family's savings.

---

## Если время срезали до трёх минут

Страницы 1 → 3 (живой продукт без выбора жюри: только расчёт первого года) → 5 → 6 → 8 → 10. Город и проверку (страница 4) пропускаем, на вопрос о соседях и проверках отвечаем по `QA.md`, вопрос 19.

## Если живой продукт не открылся

▸ Б: “Here is the same build, recorded.” Показываем страницы 3–4 как есть: на них настоящие экраны, снятые `docs/pitch/deck/capture.mjs` (см. `docs/pitch/deck/img/README.md`). Не выдаём запись за живое действие.
