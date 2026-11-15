# Makes docs/pitch/deck/index.en.html from the Russian index.html: the same pages, numbers and pictures,
# every visible string and image description replaced from the table below. Run from the repository root:
#   python3 docs/pitch/deck/make-en.py && node docs/pitch/deck/build.mjs
# A string without a translation is printed as "missing" and stays Russian.
import re, sys
T = [
("Рискнёте сбережениями семьи ради кофейни?", "Would you risk your family’s savings on a coffee shop?"),
("Проживите первый год своей кофейни", "Live the first year of your own coffee shop on real New York prices and laws — before you sign a lease. Leave with a plan that is yours."),
("Веб, B2C", "Web, B2C"),
("Месяц игры — за один день жизни", "A game month per real day"),
("Играть:", "Play:"),
("кофейни", "cafés"),
("барбершопы", "barbershops"),
("Ист-Виллидж, схема", "East Village, schematic"),
("Кому продаём", "Who we sell to"),
("Американец 21–45 лет", "An American, 21–45, who dreams of a place of their own and fears losing the savings."),
("примерно столько стоит открыть кофейню", "roughly what a sit-down coffee shop costs to open; 64% of owners start on their own savings"),
("Toast, thepricer: $80–300 тыс. (оценки)", "Toast, thepricer: $80–300K (estimates) · Kauffman/Census, 2014"),
("5,67 млн", "5.67M"),
("заявок на новый бизнес в США в 2025 году", "new business applications in the US in 2025, a record; 300K in food service"),
("Dandy Espresso, Мэдисон-авеню", "Dandy Espresso, Madison Ave — closed after five months. DNAinfo, 2014"),
("1 из 5", "1 in 5"),
("новых заведений общепита закрывается", "new food places close in their first year (81.6% reach year two); half within five years"),
("Продукт — вживую", "The product — live"),
("От идеи до своего первого года", "From an idea to your own first year, on a real block."),
("Идея", "Idea"),
("«Кофейня у метро»", "“Coffee near the subway”"),
("Место", "Place"),
("Настоящая витрина: аренда, прохожие, соседи", "A real storefront: rent, foot traffic, rivals"),
("Открытие", "Opening"),
("14 решений: места, команда, обжарщик, цена", "14 decisions: seats, team, roaster, price"),
("Год", "The year"),
("Цена, штат, соседи, жалобы, проверки", "Price, staff, neighbours, complaints, inspections"),
("Ваш план", "Your plan"),
("Ваши расходы и разрешения со ссылками", "Your costs and permits, with links"),
("1 · место", "1 · place"),
("Настоящая витрина", "A real storefront"),
("2 · решения", "2 · decisions"),
("Каждое решение — ваше", "Every decision is yours"),
("3 · прогноз", "3 · forecast"),
("Прогноз до «Apply»", "Forecast before “Apply”"),
("Один город, много владельцев", "One city, many owners"),
("Ваше решение меняет улицу.", "Your decision changes the street. A neighbour’s shortcut becomes a case."),
("вы", "you"),
("сосед · AI", "neighbour · AI"),
("сосед", "neighbour"),
("жалоба → проверка → штраф", "complaint → inspection → fine"),
("союз:", "alliance:"),
("закупка", "joint buying"),
("Кафе в радиусе 250 м", "Cafés within 250 m share one stream of passers-by. A complaint about hidden wages leads to an inspection; buying supplies together cuts the cost per order by 6%. Residents run by the computer are labelled AI."),
("Соседи: сделка или жалоба", "Neighbours: a deal or a complaint"),
("Что настоящее", "What is real"),
("Ценность считается, а не написана заранее.", "The value is computed, not scripted."),
("Действие игрока", "A player’s action"),
("Движок", "The engine"),
("чистые функции, без случайностей", "pure functions, no dice"),
("сервер", "server"),
("браузер", "browser"),
("один и тот же код:", "the same code:"),
("одно решение —", "one decision,"),
("один результат", "one result"),
("73 из 139", "73 of 139"),
("ключевых чисел проверены", "key numbers verified at the primary source; the rest marked “estimate”"),
("автотеста зелёные", "automated tests green on the build at the freeze"),
("заказов в месяц у первой кофейни", "orders a month for the first café when six neighbours open nearby"),
("Аренда, зарплаты, разрешения, налоги", "Rent, wages, permits, taxes, equipment — every number links to its source; the validator rejects a pack without them. Check it: npm test · node scripts/smoke.mjs"),
("Что продаём · зачем возвращаться", "What we sell · why come back"),
("Бесплатно — первый месяц.", "Free: the first month. Paid: the whole year and your plan."),
("Бесплатно", "Free"),
("Город, своя витрина, план открытия", "The city, your storefront, the opening plan, your first month open; moves with neighbours, always."),
("$19 в месяц · $149 в год", "$19 a month · $149 a year"),
("Решения до конца года", "Decisions for the rest of the year, your plan with links, the advisor, every business type."),
("в игре", "in the game"),
("месяц", "month"),
("день жизни", "real day"),
("Завтра — отчёт месяца", "Tomorrow: the month report"),
("Город идёт по своим часам", "The city keeps its own clock: a game month passes every real day. Tomorrow there is a new report, a neighbour’s move and one decision waiting for you."),
("Экран возвращения", "The return screen"),
("Как к нам приходят", "How people find us"),
("Один настоящий момент — потом свои числа.", "One real moment, then their own numbers."),
("«Нужно", "“You need"),
("заказов в день. Известная кофейня здесь продаёт", "orders a day. A known shop here sells"),
(", а вы начинаете с", " — and you start with"),
("её гостей.»", "of its crowd.”"),
("«Вас не было", "“Away"),
("дней: касса", "days: cash"),
(". Сосед предлагает совместную закупку. Решите сегодня.»", ". A neighbour offers to buy supplies together. Decide today.”"),
("«Аренда нашей кофейни за первый год — на $", "“Our café’s rent ran $"),
("выше нормы. Мы узнали это в игре.»", "above the norm in year one. We learned it in a game.”"),
("Реклама", "Ad"),
("один настоящий момент", "one real moment"),
("«Что бы вы открыли?»", "“What would you open?”"),
("один вопрос, без регистрации", "one question, no sign-up"),
("настоящая витрина, её цена, разрешения", "a real storefront, its cost, its permits"),
("Месяц бесплатно", "First month free"),
("откройте и ведите кофейню", "open and run your shop"),
("$19 в месяц", "$19 a month"),
("весь год и ваш план", "the year and your plan"),
("Черновики рекламы на настоящих экранах", "Ad drafts on real screens; none has run yet. Assumed:"),
("начавших бесплатно; 90% платящих", "of free players pay; 90% of payers come without ads (MONEY.md)."),
("Почему это деньги", "Why it makes money"),
("Только подписка:", "Subscription only:"),
("в месяц или", "a month or"),
("в год.", "a year."),
("ценность одного платящего за всё время", "lifetime value of a payer, net of fees and serving cost"),
("удержание — RevenueCat", "retention: RevenueCat"),
("смешанная цена привлечения (только реклама —", "blended cost per payer (ads alone"),
("клик Meta, конверсия Unbounce", "Meta CPC, Unbounce conversion"),
("LTV к CAC · окупаемость за", "LTV to CAC · payback in"),
("мес.", "months"),
("выручка в год, логарифмическая шкала", "annual revenue, log scale"),
("1 · Кофейни и еда, Нью-Йорк", "1 · Coffee and food, NYC"),
("платящих ·", "payers ·"),
("2 · Весь малый бизнес, Нью-Йорк", "2 · Every small business, NYC"),
("3 · Все города США", "3 · Every US metro"),
("Каждый шаг —", "Each step:"),
("своего пула платят. Только реклама даёт LTV/CAC", "of its pool pays. Ads alone give LTV/CAC"),
(", поэтому 90% платящих должны прийти без рекламы", ", so 90% of payers must come without ads (assumption). Every number is printed by node docs/pitch/model.mjs; we have no measured conversion yet."),
("Почему не копия", "Is it new"),
("Игры — без правды.", "Games lack truth. Courses lack practice. Templates lack consequences."),
("Что люди берут сегодня", "What people use today"),
("Цена", "Price"),
("Настоящие цены и законы", "Real prices and laws"),
("Последствия во времени", "Consequences over time"),
("Соседи в общем городе", "Neighbours in a shared city"),
("План под вас", "A plan for you"),
("Игры-тайкуны про кофейню", "Café tycoon games"),
("Курсы и занятия города", "Courses, city workshops"),
("бесплатно–$80", "free–$80"),
("Шаблоны плана, Excel", "Plan templates, Excel"),
("$20/мес, $99+", "$20/mo, $99+"),
("$20/мес", "$20/mo"),
("Консультант", "Consultant"),
("$19/мес", "$19/mo"),
("Симулятор настоящего первого года", "We found no simulator of a real first year for future owners (search, 14 Nov 2026) — not proof none exists. Prices and sources: docs/pitch/COMPETITORS.md"),
("Как сделано", "How it was built"),
("Два человека и ИИ-агенты", "Two people and AI agents, 24 hours, an open repository."),
("коммиты по часам, UTC, 14–15 ноября", "commits per hour, UTC, 14–15 Nov"),
("638 тестов", "638 tests"),
("613 коммитов", "613 commits"),
("от первого до заморозки;", "from the first to the freeze;"),
("58 заданий", "58 agent tasks"),
("агентам в трёх заходах", "in three rounds (17, 17, 24). Every agent owns its files and keeps a journal in the repo; a branch merges only when type checks, tests and the end-to-end run are green."),
("— ведущий: продукт", "— lead: product, game design, the contract between packages."),
("— сборка: каркас", "— build: skeleton, integration, deploy, research."),
("git log сборки к заморозке", "git log of the build at the freeze · build/tasks, build/ROUND2.md, build/ROUND3.md"),
("Репетируйте, прежде чем рисковать.", "Rehearse before you risk."),
("Код: github.com", "Code: github.com/foxfordkz-cyber/OHHHeaven"),
("→ пробел клик — дальше", "→ space click — next · ← back · F — full screen · L — русский"),
("Схема квартала Ист-Виллидж", "East Village schematic with businesses"),
("Десять новых заведений", "Ten new places; two close in their first year"),
("Карточка витрины", "Storefront card: rent, size, foot traffic, rivals"),
("Решение 1 из 14", "Decision 1 of 14: seats; cash left, opening day and bills on top"),
("Управление: следующие 30 дней", "Manage: the next 30 days if nothing changes"),
("Три кофейни на одной улице", "Three cafés on one street: a complaint about one neighbour, an alliance with another"),
("Вкладка Network", "Network tab: a neighbour's offer waiting, the closest rival"),
("Действие игрока проходит", "A player's action goes through a pure engine; the same code runs on the server and in the browser"),
("Листок календаря", "A calendar leaf: one real day is one game month"),
("While you were away: касса тогда и сейчас, решение", "While you were away: cash then and now, today's decision, the month report"),
("Your bet: счета", "Your bet: monthly bills, orders a day that pay them, what an average shop on the corner sells"),
("While you were away: касса тогда и сейчас, предложение", "While you were away: cash then and now, a neighbour's offer"),
("Where you lost money: аренда", "Where you lost money: rent above the norm"),
("Выручка в год по шагам", "Annual revenue by growth step, log scale"),
("Коммиты по часам с 08:00", "Commits per hour from 08:00 on 14 Nov to the freeze, and the test count"),
("QR-код адреса игры", "QR code to the game"),
("First Year — питч", "First Year — pitch"),
]
src=open('docs/pitch/deck/index.html').read()
head_end=src.index('<div class="deck">')
head=src[:head_end]; body=src[head_end:]
def tr(text):
    t=text.strip()
    if not re.search('[А-Яа-яЁё]', t): return None
    for ru,en in T:
        if t==ru: return en
    for ru,en in T:
        if t.startswith(ru) and len(ru)>6: return en
    return None
missing=[]
def rep_text(m):
    inner=m.group(1)
    e=tr(inner)
    if e is None:
        if re.search('[А-Яа-яЁё]', inner): missing.append(inner.strip()[:80])
        return m.group(0)
    lead=inner[:len(inner)-len(inner.lstrip())]; trail=inner[len(inner.rstrip()):]
    return '>'+lead+e+trail+'<'
body=re.sub(r'>([^<>]*)<', rep_text, body)
def rep_attr(m):
    e=tr(m.group(2))
    if e is None:
        if re.search('[А-Яа-яЁё]', m.group(2)): missing.append(m.group(2)[:80])
        return m.group(0)
    return f'{m.group(1)}="{e}"'
body=re.sub(r'(alt|aria-label)="([^"]*)"', rep_attr, body)
head=head.replace('<html lang="ru">','<html lang="en">').replace('<title>First Year — питч</title>','<title>First Year — pitch</title>')
head=re.sub(r'<!--.*?-->', '<!--\n  English version of index.html (L in the live deck switches). Same pages, numbers and pictures; build.mjs fills\n  and checks both. The PDF is printed from the Russian one.\n-->', head, count=1, flags=re.S)
out=head+body
open('docs/pitch/deck/index.en.html','w').write(out)
left=[l for l in re.findall(r'[^<>"]*[А-Яа-яЁё][^<>"]*', out)]
print('missing', missing); print('cyrillic left', left[:10])
