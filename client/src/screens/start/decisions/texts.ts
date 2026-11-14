// Words for the opening decisions of each niche: how optional purchases group into real-life choices and how the
// questions are asked. No numbers live here — prices, waits and effects are read from the pack when the card is drawn.
// A niche without an entry still gets every decision, with plain generic wording (see buildDecisions).
import type { NicheId } from '@ohh/shared/types';
import { pick } from '../../../ui';
import type { DecisionTexts } from './model';

function cafe(): DecisionTexts {
  return {
    order: ['size', 'espresso', 'menu', 'dishes', 'grinders', 'front', 'sidewalk', 'staff', 'lever_staff_pay', 'lever_sourcing', 'lever_hours', 'lever_cleaning', 'lever_pest_control', 'price'],
    size: {
      question: pick('How many seats?', 'Сколько мест?'),
      why: pick('Every seat is furniture now and cleaning every month. Too few and the lunch crowd walks out; too many and the room looks empty.', 'Каждое место — мебель сейчас и уборка каждый месяц. Мало мест — гости уходят в обед; много — зал выглядит пустым.'),
    },
    staff: {
      question: pick('Who stands behind the counter?', 'Кто стоит за стойкой?'),
      why: pick('Each person is a salary every month and a number of orders an hour. Wages start on opening day, not before.', 'Каждый человек — зарплата каждый месяц и столько-то заказов в час. Зарплата идёт со дня открытия, не раньше.'),
    },
    price: {
      question: pick('What does an average order cost?', 'Сколько стоит средний заказ?'),
      why: pick('A higher price earns more on each cup and brings fewer guests. You can change it any day after opening.', 'Выше цена — больше с каждой чашки и меньше гостей. Цену можно менять в любой день после открытия.'),
    },
    itemGroups: [
      {
        id: 'espresso', title: pick('Espresso machine', 'Кофемашина'), question: pick('Which espresso machine?', 'Какая кофемашина?'),
        why: pick('The machine sets how good the coffee is and how many cups an hour you can pull.', 'Машина определяет вкус кофе и сколько чашек в час вы успеваете.'),
        options: [
          { id: 'two', label: pick('Two-group machine', 'Двухгруппная машина'), detail: pick('Already in every setup. Enough for a normal morning.', 'Уже есть в любом наборе. Хватает на обычное утро.'), items: [] },
          { id: 'three', label: pick('Three-group machine', 'Трёхгруппная машина'), detail: pick('Steadier shots and a third group for the rush. Needs a 220V line.', 'Стабильнее эспрессо и третья группа на час пик. Нужна линия 220 В.'), items: ['premium_espresso_machine'] },
        ],
      },
      {
        id: 'menu', title: pick('Drip and iced drinks', 'Фильтр и холодные напитки'), question: pick('What do you serve besides espresso?', 'Что в меню кроме эспрессо?'),
        why: pick('Drip coffee is the fastest thing to hand over at the morning peak.', 'Фильтр-кофе — самое быстрое, что можно отдать гостю в утренний пик.'),
        options: [
          { id: 'espresso_only', label: pick('Espresso drinks only', 'Только напитки на эспрессо'), detail: pick('No drip coffee; iced drinks on bagged ice from the store.', 'Без фильтра; холодные напитки — на покупном льду.'), items: [] },
          { id: 'drip', label: pick('Add a batch brewer for drip coffee', 'Добавить батч-брю для фильтра'), detail: pick('A brewer, a bulk grinder and airpots.', 'Заварник, гриндер и термосы.'), items: ['batch_brewer'] },
          { id: 'drip_ice', label: pick('Batch brewer and an ice machine', 'Батч-брю и льдогенератор'), detail: pick('Your own ice for iced drinks all summer.', 'Свой лёд для холодных напитков на всё лето.'), items: ['batch_brewer', 'ice_machine'] },
        ],
      },
      {
        id: 'dishes', title: pick('Dishwashing', 'Мытьё посуды'), question: pick('Who washes the cups?', 'Кто моет чашки?'),
        why: pick('The three-compartment sink is required either way. The dishwasher is your choice.', 'Трёхсекционная мойка обязательна в любом случае. Посудомойка — ваш выбор.'),
        options: [
          { id: 'hand', label: pick('Wash by hand', 'Мыть руками'), detail: pick('Legal: wash, rinse, sanitize in the sink you already bought.', 'Законно: мыть, полоскать и дезинфицировать в уже купленной мойке.'), items: [] },
          { id: 'machine', label: pick('Commercial dishwasher', 'Профессиональная посудомойка'), detail: pick('Frees a pair of hands when the room is full.', 'Освобождает руки, когда зал полон.'), items: ['dishwasher'] },
        ],
      },
      {
        id: 'grinders', title: pick('Grinders', 'Кофемолки'), question: pick('How many grinders?', 'Сколько кофемолок?'),
        why: pick('One grinder means one kind of beans on the bar.', 'Одна кофемолка — один сорт зерна на баре.'),
        options: [
          { id: 'one', label: pick('One espresso grinder', 'Одна кофемолка для эспрессо'), detail: pick('Already in every setup. No decaf, no retail bags.', 'Уже есть в любом наборе. Без декафа и без зерна на продажу.'), items: [] },
          { id: 'decaf', label: pick('Add a second grinder for decaf', 'Добавить вторую — для декафа'), items: ['decaf_grinder'] },
          { id: 'full', label: pick('Decaf grinder and a shop grinder', 'Для декафа и большая для фильтра'), detail: pick('Filter coffee ground to order and retail bags.', 'Помол под фильтр и зерно на продажу.'), items: ['decaf_grinder', 'premium_grinder'] },
        ],
      },
      {
        id: 'front', title: pick('Sign and decor', 'Вывеска и интерьер'), question: pick('What does the street see?', 'Что видит улица?'),
        why: pick('A wall sign up to six square feet needs no sign permit in New York.', 'Настенная вывеска до шести квадратных футов в Нью-Йорке не требует разрешения.'),
        options: [
          { id: 'bare', label: pick('Open with no sign', 'Открыться без вывески'), detail: pick('People have to notice the door on their own.', 'Прохожие должны сами заметить дверь.'), items: [] },
          { id: 'sign', label: pick('Storefront sign', 'Вывеска на фасаде'), items: ['signage'] },
          { id: 'sign_decor', label: pick('Sign, menu boards, lighting and decor', 'Вывеска, меню-доски, свет и декор'), items: ['signage', 'decor_lighting'] },
        ],
      },
      {
        id: 'sidewalk', title: pick('Sidewalk tables', 'Уличные столики'), question: pick('Tables on the sidewalk?', 'Столики на тротуаре?'),
        why: pick('The city licenses sidewalk cafes. The wait is long, and tables without the license are a violation.', 'Город лицензирует уличные кафе. Ждать долго, а столики без лицензии — нарушение.'),
        options: [
          { id: 'none', label: pick('No sidewalk tables', 'Без уличных столиков'), detail: pick('Nothing to wait for. You can apply later.', 'Ждать нечего. Подать заявку можно позже.'), items: [] },
          { id: 'license', label: pick('Apply for the Dining Out NYC license now', 'Подать на лицензию Dining Out NYC сейчас'), detail: pick('You open without the tables and put them out when the license arrives.', 'Вы открываетесь без столиков и выставляете их, когда придёт лицензия.'), items: ['sidewalk_cafe_license'] },
        ],
      },
    ],
    levers: {
      staff_pay: { title: pick('Pay', 'Оплата'), question: pick('What do you pay your baristas?', 'Сколько платить бариста?'), why: pick('Pay decides who stays and how fast the line moves.', 'От оплаты зависит, кто останется и как быстро идёт очередь.') },
      sourcing: { title: pick('Roaster', 'Обжарщик'), question: pick('Which roaster and dairy?', 'Какой обжарщик и молоко?'), why: pick('Beans and milk are what a guest tastes first.', 'Зерно и молоко — первое, что чувствует гость.') },
      hours: { title: pick('Hours', 'Часы работы'), question: pick('When are you open?', 'Когда вы открыты?'), why: pick('Longer hours catch the early commuters and cost extra shifts.', 'Длинный день ловит ранних пассажиров и стоит дополнительных смен.') },
      cleaning: { title: pick('Cleaning', 'Уборка'), question: pick('Who cleans, and how often?', 'Кто убирает и как часто?'), why: pick('Every NYC cafe is inspected unannounced at least once a year, and the letter grade hangs in the window.', 'Каждое кафе Нью-Йорка проверяют без предупреждения минимум раз в год, а оценка висит в окне.') },
      pest_control: { title: pick('Pest control', 'Дезинсекция'), question: pick('Do you pay an exterminator?', 'Платить ли дезинсектору?'), why: pick('An inspector looks for mice and roaches and asks to see the exterminator’s contract.', 'Инспектор ищет следы мышей и тараканов и просит показать договор с дезинсектором.') },
    },
  };
}

export function textsFor(niche: NicheId): DecisionTexts {
  return niche === 'cafe' ? cafe() : {};
}
