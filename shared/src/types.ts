// КОНТРАКТ ПРОЕКТА, версия 5 («медленный город»). Единственный источник правды о форме данных.
// Меняет этот файл только ведущий. Нужна правка — запиши в журнал agents/NN.md, раздел «Просьбы к ведущему»,
// и до ответа держи недостающее поле у себя под ключом `extra`.
// Описание словами — build/CONTRACT.md. Игра — context/08-game-v5.md. Формат пакета ниши — build/PACK.md.

export type NicheId = 'cafe' | 'barbershop' | 'bodega' | 'guesthouse' | 'rentals';
export type Money = number; // доллары США, игровые; не центы
export type PlaceTier = 'prime' | 'mid' | 'cheap';

// ───────────────────────── Пакет ниши (packs/<id>.json) ─────────────────────────

export interface Sourced { source?: string; confidence?: 'verified' | 'estimate'; note?: string }

export interface PackUnit extends Sourced { name: string; refPrice: Money; priceMin: Money; priceMax: Money; cogsPerUnit: Money }

export interface PackMarket extends Sourced {
  unitsPerSlotMonth: number;      // спрос на одно место в месяц при refPrice и среднем качестве
  priceElasticity: number;        // отрицательное
  weights: { price: number; quality: number; reputation: number; location: number }; // сумма 1
}

export interface PackCapacity { unitsPerStaffMonth: number | null; minStaff: number; maxStaff: number; hardCapUnits?: number | null; note?: string }

/** Физический размер бизнеса: места в кафе, кресла, метры полок, комнаты, квартиры. */
export interface PackSizing extends Sourced {
  unitName: string;
  min: number; max: number; default: number;
  sqftPerUnit: number;
  unitsServedPerSizeMonth: number;
  takeawayShare?: number;
  cleaningCostPerSizeMonth: Money;
  emptyPenaltyBelow?: number;
  crowdPenaltyAbove?: number;
}

export type SetupKind = 'equipment' | 'furniture' | 'buildout' | 'deposit' | 'permit' | 'license' | 'inventory' | 'other';
export interface PackSetupItem extends Sourced {
  id: string; name: string; kind: SetupKind; cost: Money; required: boolean;
  scalesWithSize?: boolean;       // цена за одну единицу размера
  lifespanMonths?: number;
  qualityBonus?: number;
  waitDays?: number;              // сколько игровых дней ждать (разрешения и лицензии); нет поля — сразу
  agency?: string;                // кто выдаёт
  link?: string;                  // официальная страница
  withoutItViolation?: string;    // id нарушения, если работать без этого
  /** Как считается цена. fixed (по умолчанию) — `cost`. per_sqft — ставка ремонта по состоянию помещения × площадь.
   *  months_rent — `rate` месяцев аренды этого места. pct_of_buildout — `rate` (доля) от цены ремонта. `cost` — запасное число, если места нет. */
  costBasis?: 'fixed' | 'per_sqft' | 'months_rent' | 'pct_of_buildout';
  rate?: number;
  afterBuildout?: boolean;        // ожидание начинается, когда закончен ремонт (проверка готового помещения)
  includedInTakeover?: boolean;   // при покупке действующего бизнеса уже есть и отдельно не оплачивается
}

export interface PackKit { id: 'lean' | 'standard' | 'premium'; name: string; size: number; items: { id: string; qty: number }[]; pitch: string }

export type CostKind = 'rent' | 'utilities' | 'insurance' | 'supplies' | 'cleaning' | 'marketing' | 'fees' | 'maintenance' | 'debt' | 'other';
export type CostBasis = 'fixed' | 'per_staff' | 'per_unit' | 'pct_revenue' | 'per_size';
export interface PackMonthlyCost extends Sourced { id: string; name: string; kind: CostKind; basis: CostBasis; amount: number }

export interface PackStaffRole extends Sourced { id: string; name: string; hourlyWage: Money; tipped?: boolean; cashWage?: Money; hoursPerMonth: number; licenseRequired?: string | null }

export type TaxBase = 'revenue' | 'taxable_revenue' | 'payroll' | 'profit' | 'rent' | 'fixed';
export interface PackTax extends Sourced { id: string; name: string; base: TaxBase; rate: number; due: 'monthly' | 'quarterly' | 'annual'; appliesIf?: string }

export interface PackLeverOption { id: string; label: string; monthlyCost: Money; effects?: { quality?: number; reputation?: number; demand?: number; capacity?: number }; causes?: string }
export interface PackLever { id: string; name: string; options: PackLeverOption[] }

export type SavesBasis = 'fixed' | 'pct_payroll' | 'pct_revenue' | 'pct_rent' | 'per_staff';
export interface PackShortcut { id: string; name: string; what: string; saves: { basis: SavesBasis; amount: number }; violation: string }

export type FoundBy = 'inspection' | 'audit' | 'complaint' | 'sting';
export interface PackViolation extends Sourced {
  id: string; name: string; law: string; official: string; foundBy: FoundBy[];
  fine: { base?: Money; perMonth?: Money; pctOfSaved?: number; max?: Money | null };
  closureDays?: number; reputationHit?: number; criminal?: string;
}

/** Играбельные роли госслужащих. */
export type OfficialRole = 'inspector' | 'tax_auditor';
export interface PackOfficial extends Sourced { id: string; name: string; agency: string; role: OfficialRole; checks: string[]; realProcess?: string }

/** «Сообщить городу»: жалоба на конкурента. Единственное нападение в игре. */
export interface PackReport { id: string; name: string; text: string; role: OfficialRole; checks: string[] }

export type EffectTarget = 'demand' | 'cogs' | 'staffAvailability' | 'footTraffic' | 'utilities' | 'deliveryShare' | 'rent' | 'wages' | 'inspections';
/** Множитель из белого списка. Движок обрезает mult до диапазона 0.5–1.5. */
export interface EventEffect { target: EffectTarget; mult: number; niches?: NicheId[]; tiers?: PlaceTier[] }
export interface PackEvent extends Sourced { id: string; name: string; text?: string; effect: { field: string; mult: number }; months: number }

export interface PackRuleCard { id: string; title: string; text: string; source: string }
export interface PackBenchmarks extends Sourced { cogsPct: number; laborPct: number; rentPct: number; netMarginPct: number }

/** Где в жизни искать поставщика. Только справка для игрока, не игровой объект. */
export interface PackSupplier extends Sourced { id: string; category: string; what: string; whereToFind: string; examples?: string; link?: string }

export type RoadmapKind = 'idea' | 'legal' | 'permit' | 'space' | 'money' | 'supplier' | 'people' | 'launch';
/** Шаг плана открытия — как в жизни, по порядку. */
export interface PackRoadmapStep { id: string; title: string; text: string; kind: RoadmapKind; setupItemId?: string; fee?: Money; waitDays?: number; agency?: string; link?: string }

export interface PackManager extends Sourced { monthlySalary: Money }

export interface Pack {
  id: NicheId; version: number; name: string; tagline: string; startCapital: Money;
  unit: PackUnit; market: PackMarket; capacity: PackCapacity; sizing: PackSizing;
  setup: PackSetupItem[]; kits: PackKit[]; monthlyCosts: PackMonthlyCost[]; staff: PackStaffRole[]; taxes: PackTax[];
  levers: PackLever[]; shortcuts: PackShortcut[]; violations: PackViolation[]; officials: PackOfficial[];
  reports: PackReport[]; events: PackEvent[]; ruleCards: PackRuleCard[]; benchmarks: PackBenchmarks;
  suppliers: PackSupplier[]; roadmap: PackRoadmapStep[]; manager: PackManager;
  sources: { url: string; title: string; checked: string }[]; extra?: Record<string, unknown>;
}

/** packs/_common.json — общие для всех ниш налоги, нарушения, чиновники, жалобы и шаги плана. */
export interface CommonPack {
  id: '_common'; version: number; name: string;
  taxes: PackTax[]; shortcuts: PackShortcut[]; violations: PackViolation[]; officials: PackOfficial[];
  reports: PackReport[]; ruleCards: PackRuleCard[]; roadmap: PackRoadmapStep[];
  sources: { url: string; title: string; checked: string }[]; extra?: Record<string, unknown>;
}

export interface PackSet { common: CommonPack; niches: Partial<Record<NicheId, Pack>> }

// ───────────────────────── Карта (data/places.json) ─────────────────────────

/** Чем помещение было раньше: от этого зависят цена и срок ремонта (pack.extra.buildout). */
export type FormerUse = 'cafe' | 'food' | 'retail' | 'salon';
export type AnchorKind = 'subway' | 'college' | 'school' | 'park' | 'hospital' | 'library' | 'museum' | 'plaza';
/** Что стоит рядом и влияет на поток: станция метро, вуз, школа, парк, больница. Из открытых данных города. */
export interface PlaceAnchor { kind: AnchorKind; name: string; distM: number; ridersPerDay?: number }
/** Настоящие заведения той же ниши рядом (в игре не участвуют, но делят тех же прохожих). */
export interface PlaceRivals { niche: NicheId; within150m: number; weight: number; nearest: { name: string; distM: number }[] }
/** Действующий бизнес на продажу: дороже пустого помещения, зато без ремонта и с готовой базой клиентов. */
export interface PlaceForSale { niche: NicheId; askingPrice: Money; size: number; note?: string }

export interface Place {
  id: string; address: string; block: string;            // block — улица-квартал для фонда квартала
  lat: number; lng: number; kind: 'storefront' | 'building';
  sqft: number; tier: PlaceTier; rentPerSqftYear: Money; footTraffic: number; // 0–1
  suitableFor: NicheId[]; sourceDataset?: string; note?: string;
  pedestriansPerDay?: number;      // человек в будний день проходит по этому кварталу (оба тротуара); расчёт по открытым данным
  corner?: boolean;
  formerUse?: FormerUse;
  forSale?: PlaceForSale;
  anchors?: PlaceAnchor[];
  rivals?: PlaceRivals[];
  footfallNote?: string;           // как получено число прохожих
}

// ───────────────────────── Мир ─────────────────────────

export interface WorldConfig {
  id: string; name: string; city: 'nyc';
  seasonMonths: number;          // 12
  dayMs: number;                 // настоящих миллисекунд на игровой день: живой город 2_880_000, демо 2_000
  paused: boolean;
  maxOwners: number;             // 100
  aiBusinessesTarget: number;    // сколько бизнесов под управлением ИИ держать в городе
  entryFee: Money;               // настоящие (в демо — тестовые) доллары
  prizeShare: number; officialsShare: number; platformShare: number;   // 0.90, 0.05, 0.05
  nichePrizeTable: number[];     // доли призов ниши по местам: [0.5, 0.3, 0.2]
  demo: boolean; seed: number;
}

export interface GameDate { day: number; month: number; dayOfMonth: number; weekday: number; label: string }

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'heat' | 'storm';
export interface DayWeather { day: number; tempF: number; condition: WeatherCondition; footTrafficMult: number; label: string }

export interface InboxItem { id: string; day: number; kind: 'summary' | 'deal' | 'case' | 'event' | 'money' | 'system'; title: string; text: string; ref?: { type: 'deal' | 'case' | 'business'; id: string }; read: boolean }

export interface Player {
  id: string; name: string; kind: 'owner' | 'official'; isAi: boolean; paid: boolean;
  role?: OfficialRole; joinedDay: number; lastSeenDay: number; inbox: InboxItem[];
  strategy?: string;                        // характер жителя под управлением ИИ; в view не отдаётся
  seenCash?: Money; seenDay?: number;       // касса и день на момент последнего захода — для сводки «пока тебя не было»
}

export interface ViolationTrail { violationId: string; months: number; saved: Money; lastActiveMonth: number; discovered: boolean }
export interface TaxLiability { taxId: string; amount: Money; dueDay: number; paid: boolean }

export type PnlKind = 'revenue' | 'cogs' | 'payroll' | 'payroll_tax' | 'rent' | 'opex' | 'tax' | 'fine' | 'saving' | 'deal' | 'setup' | 'other';
/** amount > 0 — деньги пришли, amount < 0 — ушли. */
export interface PnlLine { id: string; label: string; kind: PnlKind; amount: Money }

/** Постоянные распоряжения: действуют каждый день, пока владелец их не сменит. */
export interface StandingOrders {
  price: Money;
  staff: Record<string, number>;        // id роли → число работников
  levers: Record<string, string>;       // id рычага → id варианта
  shortcuts: string[];                  // включённые способы срезать угол
  blockFund: boolean;                   // платить взнос в фонд квартала
  autopilot: 'hold' | 'manager';        // hold — держать распоряжения; manager — нанятый управляющий следует безопасным советам
}

export interface PermitState { itemId: string; appliedDay: number; readyDay: number }

export interface DayReport {
  day: number; demandUnits: number; servedUnits: number;
  lost: { size: number; staff: number; closure: number };
  revenue: Money; variableCosts: Money; sizeUtilization: number;
  weather: WeatherCondition; notes: string[];
}

export interface MonthReport {
  month: number; avgPrice: Money;
  demandUnits: number; servedUnits: number; lost: { size: number; staff: number; closure: number };
  capacityUnits: number; sizeUtilization: number;
  lines: PnlLine[]; revenue: Money; profit: Money; cashStart: Money; cashEnd: Money;
  taxesAccrued: Money; taxesPaid: Money; fines: Money;
  quality: number; reputation: number; netWorth: Money; rankInNiche: number;
}

export interface Owner { playerId: string; share: number }   // сумма долей = 1

export interface BusinessState {
  id: string; name: string; niche: NicheId; placeId: string; isAi: boolean;
  owners: Owner[]; managerPlayerId: string;                 // кто управляет (основатель)
  status: 'setup' | 'open' | 'closed' | 'bankrupt';         // setup — до открытия дверей; closed — закрыт по проверке до closedUntilDay
  createdDay: number; openedDay?: number; closedUntilDay?: number; bankruptDay?: number;
  cash: Money; size: number; items: { id: string; qty: number }[]; setupSpent: Money; permits: PermitState[];
  quality: number; reputation: number;                      // 0–1
  trust: { kept: number; broken: number };                  // выполненные и сорванные сделки
  orders: StandingOrders;
  trails: ViolationTrail[]; liabilities: TaxLiability[];
  mtd: { lines: PnlLine[]; demandUnits: number; servedUnits: number; lost: { size: number; staff: number; closure: number } }; // с начала месяца
  days: DayReport[];                                        // последние 30 дней
  history: MonthReport[];
  staffPrev?: Record<string, number>;                       // штат на конец прошлого месяца (крючки ниш)
  extra?: Record<string, unknown>;                          // служебные данные модулей: extra.econ, extra.law, extra.deals
}

// ───────────────────────── Сделки ─────────────────────────

export type DealTerms =
  | { type: 'joint_purchase'; months: number }
  | { type: 'cross_promo'; months: number }
  | { type: 'loan'; amount: Money; monthlyRatePct: number; months: number }       // from даёт в долг, to возвращает равными платежами
  | { type: 'partnership'; amount: Money; sharePct: number };                     // from вкладывает amount в бизнес to за долю

export interface Deal {
  id: string; fromBusinessId: string; toBusinessId: string; terms: DealTerms;
  status: 'proposed' | 'active' | 'declined' | 'expired' | 'completed' | 'broken' | 'cancelled';
  proposedDay: number; expiresDay: number; startDay?: number; endDay?: number;
  paidBack?: Money;                                         // для займа
}

export interface BlockFundStatus { block: string; month: number; contributors: number; eligible: number; active: boolean; feeMonth: Money }

// ───────────────────────── Дела госслужащих ─────────────────────────

export interface FoundViolation { violationId: string; months: number; fine: Money; closureDays: number }

export interface Case {
  id: string; businessId: string; role: OfficialRole;
  origin: 'report' | 'flag' | 'routine'; reportId?: string; reporterBusinessId?: string;
  openedDay: number; hints: string[];
  status: 'open' | 'taken' | 'notice' | 'bribe_offered' | 'closed';
  officialId?: string; takenDay?: number; inspectDay?: number;
  found?: FoundViolation[]; fine?: Money; closureDays?: number; answerByDay?: number;
  response?: 'pay' | 'contest' | 'bribe'; bribeAmount?: Money;
  outcome?: 'clean' | 'fined' | 'bribed' | 'dismissed'; closedDay?: number;
}

export interface OfficialState {
  id: string; playerId: string; name: string; isAi: boolean; role: OfficialRole;
  points: number; casesClosed: number; bribesTaken: Money; bribesThisMonth: number; exposed: boolean; suspendedUntilDay?: number;
}

// ───────────────────────── События и лента ─────────────────────────

export interface GameEvent {
  id: string; kind: 'weather' | 'traffic' | 'supply' | 'city' | 'regulation' | 'demand' | 'staff';
  title: string; text: string;
  announcedDay: number; startDay: number; endDay: number;
  effects: EventEffect[];
  origin: 'ai' | 'deck'; block?: string;                    // block — если событие касается одной улицы
}

export type FeedKind = 'event' | 'inspection' | 'report' | 'bankruptcy' | 'deal' | 'opening' | 'bribe' | 'system';
export interface FeedItem { id: string; day: number; kind: FeedKind; text: string; businessId?: string }

export interface Standing { businessId: string; niche: NicheId; rank: number; netWorth: Money; isAi: boolean; bankrupt: boolean; name?: string; prize?: Money }   // prize — прогноз приза за это место
export interface Payout { playerId: string; kind: 'owner' | 'official' | 'platform'; amount: Money; niche?: NicheId; rank?: number }

export interface WorldState {
  config: WorldConfig;
  phase: 'running' | 'ended';
  day: number;                   // игровой день с начала сезона, с 1
  version: number;               // растёт при каждом изменении; клиент по нему понимает, что нужно перерисовать
  bank: Money;
  players: Player[]; businesses: BusinessState[]; officials: OfficialState[];
  deals: Deal[]; cases: Case[]; blockFunds: BlockFundStatus[];
  weather: DayWeather[];         // сегодня и прогноз на 7 дней
  events: GameEvent[]; feed: FeedItem[];
  standings: Standing[]; payouts?: Payout[];
}

// ───────────────────────── Действия: всё, что может сделать игрок ─────────────────────────

export type Action =
  // владелец: открытие
  | { type: 'open_business'; niche: NicheId; placeId: string; name: string; kitId: PackKit['id']; size: number; items?: { id: string; qty: number }[] }
  | { type: 'launch' }                                   // открыть двери; без готовых разрешений — нарушение
  // владелец: управление
  | { type: 'set_orders'; orders: Partial<StandingOrders> }
  | { type: 'buy_item'; itemId: string; qty: number }
  | { type: 'sell_item'; itemId: string; qty: number }
  | { type: 'resize'; size: number }
  | { type: 'spend'; kind: 'marketing' | 'training' | 'deep_clean' | 'accountant'; amount?: Money }
  // владелец: соседи
  | { type: 'propose_deal'; toBusinessId: string; terms: DealTerms }
  | { type: 'answer_deal'; dealId: string; accept: boolean }
  | { type: 'cancel_deal'; dealId: string }
  | { type: 'report'; targetBusinessId: string; reportId: string }
  | { type: 'answer_notice'; caseId: string; response: 'pay' | 'contest' | 'bribe'; bribeAmount?: Money }
  | { type: 'read_inbox'; ids: string[] }
  // госслужащий
  | { type: 'take_case'; caseId: string }
  | { type: 'dismiss_case'; caseId: string }
  | { type: 'answer_bribe'; caseId: string; accept: boolean };

export interface ActionResult { world: WorldState; error?: string }

// ───────────────────────── Аналитика, советы, план ─────────────────────────

export interface Benchmark { metric: string; you: number; industry: number; verdict: 'good' | 'ok' | 'bad' }
export interface NicheKpi { id: string; label: string; value: number; unit: string }

export interface Analytics {
  month: number; daysIntoMonth: number;
  revenue: Money; profit: Money; cumulativeProfit: Money; netWorth: Money;   // revenue и profit — прогноз на полный месяц по текущим дням
  cogsPct: number; laborPct: number; rentPct: number; primeCostPct: number; netMarginPct: number;
  fixedCostsMonth: Money; variableCostPerUnit: Money; contributionPerUnit: Money;
  breakEvenUnitsMonth: number | null; breakEvenRevenueMonth: Money | null; breakEvenPrice: Money | null;
  utilization: number; sizeUtilization: number; lostSalesUnits: number; lostSalesMoney: Money;
  cashRunwayMonths: number | null;             // null — бизнес в плюсе
  setupInvested: Money; paybackMonths: number | null;
  taxDueNext: { amount: Money; day: number } | null;
  exposure: Money;                             // сколько штрафов придёт, если найдут все текущие нарушения
  benchmarks: Benchmark[]; nicheKpis: NicheKpi[];
  nicheAvgPrice?: Money;                       // средняя цена открытых бизнесов ниши
}

export interface Recommendation {
  id: string; severity: 'info' | 'warn' | 'critical'; title: string; text: string;
  suggested?: Action;                          // что система предлагает сделать одним нажатием
  impact?: { profitDeltaMonth: Money };
  ruleCardId?: string;
}

export interface OpenRecommendation { kitId: PackKit['id']; size: number; items: { id: string; qty: number }[]; total: Money; cashLeft: Money; orders: StandingOrders; daysToOpen: number; why: string[] }

export interface RoadmapItem extends PackRoadmapStep { status: 'todo' | 'waiting' | 'done'; readyDay?: number }

/** Личный план для жизни: главный результат игры для человека, который боится начинать. */
export interface RealWorldPlan {
  niche: NicheId; businessName: string;
  startupBudget: { label: string; amount: Money }[]; startupTotal: Money;
  monthlyCosts: { label: string; amount: Money }[]; monthlyTotal: Money;
  reserveAdvised: Money; breakEvenUnitsMonth: number | null; paybackMonths: number | null;
  checklist: PackRoadmapStep[]; suppliers: PackSupplier[];
  lessons: { title: string; amount: Money; lesson: string; ruleCardId?: string }[];
  disclaimer: string;
}

export interface AdvisorAnswer { answer: string; sources: { title: string; url: string }[]; origin: 'ai' | 'rules' }
export interface IdeaMatch { niche: NicheId; businessName: string; tier: PlaceTier; kitId: PackKit['id']; notes: string[]; origin: 'ai' | 'rules' }
export interface Debrief { headline: string; lostMoneyOn: { title: string; amount: Money; lesson: string; ruleCardId?: string }[]; didWell: string[]; nextTime: string[]; origin: 'ai' | 'rules' }

// ───────────────────────── Что видит клиент ─────────────────────────

export interface PublicBusiness {
  id: string; name: string; ownerName: string; isAi: boolean; niche: NicheId; placeId: string;
  status: BusinessState['status']; price: Money; reputation: number; rankInNiche: number;
  trust: { kept: number; broken: number }; grade?: string; partners: string[];   // id бизнесов с активными сделками
}

export interface WorldPublic { config: WorldConfig; phase: WorldState['phase']; day: number; date: GameDate; version: number; bank: Money; msToNextDay: number; stats: { owners: number; aiBusinesses: number; officials: number; open: number; bankrupt: number } }

export interface CaseNotice { caseId: string; role: OfficialRole; found: FoundViolation[]; fine: Money; closureDays: number; answerByDay: number; status: Case['status']; outcome?: Case['outcome'] }

export interface OwnerView {
  kind: 'owner'; me: Player; world: WorldPublic;
  business: BusinessState | null; stakes: { businessId: string; share: number }[];
  neighbors: PublicBusiness[]; deals: Deal[]; notices: CaseNotice[]; blockFund: BlockFundStatus | null;
  weather: DayWeather[]; events: GameEvent[]; feed: FeedItem[];
  analytics: Analytics | null; recommendations: Recommendation[]; roadmap: RoadmapItem[];
  leaderboards: Partial<Record<NicheId, Standing[]>>; away: { days: number; profit: Money; items: InboxItem[] } | null;
  payouts?: Payout[];                          // после конца сезона: выплаты этому игроку
  officialsRanking?: { name: string; points: number; isAi: boolean }[];
}

export interface CaseCard { caseId: string; business: PublicBusiness; role: OfficialRole; origin: Case['origin']; openedDay: number; hints: string[]; status: Case['status']; bribeAmount?: Money; found?: FoundViolation[] }

export interface OfficialView {
  kind: 'official'; me: Player; world: WorldPublic; official: OfficialState;
  queue: CaseCard[]; mine: CaseCard[]; ranking: { name: string; points: number; isAi: boolean }[];
  weather: DayWeather[]; events: GameEvent[]; feed: FeedItem[];
}

/** Главная страница и экран проектора: открытая картина города. */
export interface CityView {
  kind: 'city'; world: WorldPublic; businesses: PublicBusiness[];
  weather: DayWeather[]; events: GameEvent[]; feed: FeedItem[];
  leaderboards: Partial<Record<NicheId, Standing[]>>;
  blockFunds?: BlockFundStatus[];              // улицы с работающим фондом квартала — для карты
}

export type ClientView = OwnerView | OfficialView | CityView;

// ───────────────────────── Запросы без изменения мира ─────────────────────────

export type Query =
  | { type: 'recommend_opening'; niche: NicheId; placeId: string }      // → OpenRecommendation[]
  | { type: 'what_if'; orders: Partial<StandingOrders>; size?: number } // → { projected: MonthReport; analytics: Analytics }; size — прогноз при другом размере зала
  | { type: 'roadmap'; niche: NicheId }                                 // → RoadmapItem[]
  | { type: 'real_world_plan' }                                         // → RealWorldPlan
  | { type: 'advisor'; question: string }                               // → AdvisorAnswer
  | { type: 'idea'; text: string }                                      // → IdeaMatch
  | { type: 'debrief' };                                                // → Debrief

export interface Ack<T = undefined> { ok: boolean; error?: string; data?: T }

/** Один интерфейс для игры по сети и для игры в браузере без сервера. */
export interface GameClient {
  listWorlds(): Promise<{ id: string; name: string; demo: boolean; owners: number; day: number }[]>;
  join(worldId: string, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): Promise<Ack<{ playerId: string; token: string }>>;
  view(worldId: string, knownVersion?: number): Promise<ClientView | { unchanged: true }>;
  act(worldId: string, action: Action): Promise<Ack>;
  query<T>(worldId: string, q: Query): Promise<Ack<T>>;
}
