// КОНТРАКТ ПРОЕКТА. Единственный источник правды о форме данных.
// Меняет этот файл только ведущий. Нужна правка — запиши в свой журнал agents/NN.md, раздел «Просьбы к ведущему»,
// и до ответа держи недостающее поле у себя под ключом `extra`.
// Описание словами — build/CONTRACT.md. Формат пакета ниши — build/PACK.md.

export type NicheId = 'cafe' | 'barbershop' | 'bodega' | 'guesthouse' | 'rentals';
export type Money = number; // доллары США, игровые; не центы
export type PlaceTier = 'prime' | 'mid' | 'cheap';

// ───────────────────────── Пакет ниши (packs/<id>.json) ─────────────────────────

export interface Sourced { source?: string; confidence?: 'verified' | 'estimate'; note?: string }

export interface PackUnit extends Sourced { name: string; refPrice: Money; priceMin: Money; priceMax: Money; cogsPerUnit: Money }

export interface PackMarket extends Sourced {
  unitsPerSlotMonth: number;      // спрос на одно место при refPrice и среднем качестве
  priceElasticity: number;        // отрицательное
  weights: { price: number; quality: number; reputation: number; location: number }; // сумма 1
}

export interface PackCapacity { unitsPerStaffMonth: number | null; minStaff: number; maxStaff: number; hardCapUnits?: number | null; note?: string }

/** Физический размер бизнеса: места в кафе, кресла, метры полок, комнаты, квартиры. */
export interface PackSizing extends Sourced {
  unitName: string;               // 'seat' | 'chair' | 'shelf_ft' | 'room' | 'apartment'
  min: number; max: number; default: number;
  sqftPerUnit: number;            // сколько площади занимает одна единица размера
  unitsServedPerSizeMonth: number;// сколько единиц продажи в месяц пропускает одна единица размера
  takeawayShare?: number;         // доля спроса, которой место не нужно (кофе с собой); 0 если нет
  cleaningCostPerSizeMonth: Money;
  emptyPenaltyBelow?: number;     // загрузка, ниже которой зал «пустой» и репутация падает (0–1)
  crowdPenaltyAbove?: number;     // загрузка, выше которой очередь и качество падает (0–1)
}

export type SetupKind = 'equipment' | 'furniture' | 'buildout' | 'deposit' | 'permit' | 'license' | 'inventory' | 'other';
export interface PackSetupItem extends Sourced {
  id: string; name: string; kind: SetupKind; cost: Money; required: boolean;
  scalesWithSize?: boolean;       // true: цена за одну единицу размера (стул, стол, кресло, кровать)
  lifespanMonths?: number;        // срок службы для амортизации в аналитике
  qualityBonus?: number;          // вклад в качество (0–0.1)
}

/** Готовый набор для открытия: система рекомендует, игрок соглашается одним нажатием. */
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

export type FoundBy = 'inspection' | 'audit' | 'complaint' | 'sting' | 'journalist';
export interface PackViolation extends Sourced {
  id: string; name: string; law: string; official: string; foundBy: FoundBy[];
  fine: { base?: Money; perMonth?: Money; pctOfSaved?: number; max?: Money | null };
  closureDays?: number; reputationHit?: number; criminal?: string;
}

/** Играбельные роли госслужащих. Чиновник пакета относится к одной из них. */
export type OfficialRole = 'inspector' | 'tax_auditor' | 'journalist';
export interface PackOfficial extends Sourced { id: string; name: string; agency: string; role: Exclude<OfficialRole, 'journalist'>; checks: string[]; realProcess?: string }

export interface PackAttack { id: string; name: string; cost: Money; triggers: string; worksIf: string; backfire: string }

export type EffectTarget = 'demand' | 'cogs' | 'staffAvailability' | 'footTraffic' | 'utilities' | 'deliveryShare' | 'rent';
/** Множитель из белого списка. Движок обрезает mult до диапазона 0.5–1.5. */
export interface EventEffect { target: EffectTarget; mult: number; niches?: NicheId[]; tiers?: PlaceTier[] }
export interface PackEvent extends Sourced { id: string; name: string; text?: string; effect: { field: string; mult: number }; months: number }

export interface PackRuleCard { id: string; title: string; text: string; source: string }
export interface PackBenchmarks extends Sourced { cogsPct: number; laborPct: number; rentPct: number; netMarginPct: number }

export interface Pack {
  id: NicheId; version: number; name: string; tagline: string; startCapital: Money;
  unit: PackUnit; market: PackMarket; capacity: PackCapacity; sizing: PackSizing;
  setup: PackSetupItem[]; kits: PackKit[]; monthlyCosts: PackMonthlyCost[]; staff: PackStaffRole[]; taxes: PackTax[];
  levers: PackLever[]; shortcuts: PackShortcut[]; violations: PackViolation[]; officials: PackOfficial[];
  attacks: PackAttack[]; events: PackEvent[]; ruleCards: PackRuleCard[]; benchmarks: PackBenchmarks;
  sources: { url: string; title: string; checked: string }[]; extra?: Record<string, unknown>;
}

/** packs/_common.json — общие для всех ниш налоги, нарушения и чиновники. */
export interface CommonPack {
  id: '_common'; version: number; name: string;
  taxes: PackTax[]; shortcuts: PackShortcut[]; violations: PackViolation[]; officials: PackOfficial[];
  ruleCards: PackRuleCard[]; sources: { url: string; title: string; checked: string }[]; extra?: Record<string, unknown>;
}

export interface PackSet { common: CommonPack; niches: Partial<Record<NicheId, Pack>> }

// ───────────────────────── Карта (data/places.json) ─────────────────────────

export interface Place {
  id: string; address: string; lat: number; lng: number; kind: 'storefront' | 'building';
  sqft: number; tier: PlaceTier; rentPerSqftYear: Money; footTraffic: number; // 0–1
  suitableFor: NicheId[]; sourceDataset?: string; note?: string;
}

// ───────────────────────── Сезон ─────────────────────────

export interface SeasonConfig {
  id: string; city: 'nyc'; seats: number; officialSeats: number;
  entryFee: Money;            // настоящие (в демо — тестовые) доллары, не игровые
  rounds: number;             // 12
  roundSeconds: number;       // 40 в демо
  prizeTable: number[];       // доли призового фонда по местам, сумма 1
  prizeShare: number;         // 0.90 банка
  officialsShare: number;     // 0.05
  platformShare: number;      // 0.05
  demo: boolean;
}

export type Phase = 'lobby' | 'setup' | 'decide' | 'resolve' | 'ended';

export interface PlayerInfo { id: string; name: string; kind: 'owner' | 'official'; isBot: boolean; paid: boolean; connected: boolean }

export interface ViolationTrail { violationId: string; months: number; saved: Money; lastActiveMonth: number; discovered: boolean }
export interface TaxLiability { taxId: string; amount: Money; dueMonth: number; paid: boolean }

export type PnlKind = 'revenue' | 'cogs' | 'payroll' | 'payroll_tax' | 'rent' | 'opex' | 'tax' | 'fine' | 'saving' | 'attack' | 'setup' | 'other';
/** amount > 0 — деньги пришли, amount < 0 — ушли. */
export interface PnlLine { id: string; label: string; kind: PnlKind; amount: Money }

export interface InspectionResult {
  month: number; officialId: string; businessId: string; role: OfficialRole;
  found: { violationId: string; months: number; fine: Money; closureDays: number }[];
  bribe?: { offered: Money; accepted: boolean; exposed: boolean };
}

export type FeedKind = 'event' | 'inspection' | 'attack' | 'bankruptcy' | 'bribe' | 'story' | 'system';
export interface FeedItem { id: string; month: number; kind: FeedKind; text: string; businessId?: string; public: boolean }

export interface MonthReport {
  month: number; price: Money;
  demandUnits: number; servedUnits: number;
  lost: { size: number; staff: number; closure: number };   // сколько единиц спроса потеряно и почему
  capacityUnits: number; sizeUtilization: number;           // 0–1+
  lines: PnlLine[]; revenue: Money; profit: Money; cashStart: Money; cashEnd: Money;
  taxesAccrued: Money; taxesPaid: Money; fines: Money;
  quality: number; reputation: number; rank: number;
  inspections: InspectionResult[]; feed: FeedItem[];
}

export type PlayerAction =
  | { type: 'attack'; attackId: string; targetId: string }
  | { type: 'invest'; kind: 'marketing' | 'training' | 'equipment'; amount: Money }
  | { type: 'defend'; kind: 'lawyer' | 'deep_clean' | 'accountant' }
  | { type: 'resize'; size: number };

/** Всё, что владелец решает за месяц. Не больше шести решений. */
export interface MonthDecisions {
  price: Money;
  staff: Record<string, number>;        // id роли → число работников
  levers: Record<string, string>;       // id рычага → id варианта
  shortcuts: string[];                  // включённые способы срезать угол
  action?: PlayerAction | null;
  bribeOffer?: Money | null;            // сколько предложить, если в этом месяце придут с проверкой
}

export interface BusinessState {
  id: string; ownerId: string; name: string; isBot: boolean; niche: NicheId; placeId: string; openedMonth: number;
  cash: Money; size: number; items: { id: string; qty: number }[]; setupSpent: Money;
  quality: number; reputation: number;          // 0–1
  closedDaysNext: number;                       // закрытие по итогам проверки, действует в следующем месяце
  trails: ViolationTrail[]; liabilities: TaxLiability[];
  decisions: MonthDecisions; history: MonthReport[];
  bankrupt: boolean; bankruptMonth?: number;
}

export interface OfficialDecisions {
  inspect: string[];                                     // id бизнесов; не больше inspectionsPerMonth
  bribes?: Record<string, 'accept' | 'refuse'>;          // id бизнеса → ответ на предложенную взятку
  publish?: { targetId: string; about: 'bribe' | 'violation' } | null;   // только журналист
}

export interface OfficialState {
  id: string; playerId: string; name: string; isBot: boolean; role: OfficialRole;
  points: number; inspectionsPerMonth: number; bribesTaken: Money; exposed: boolean;
  history: InspectionResult[];
}

export interface GameEvent {
  id: string; kind: 'weather' | 'traffic' | 'supply' | 'city' | 'regulation' | 'demand' | 'staff';
  title: string; text: string;
  announcedMonth: number; startMonth: number; months: number;   // объявляется минимум за месяц до начала
  effects: EventEffect[];
  origin: 'ai' | 'deck' | 'real_data'; realData?: { provider: string; summary: string };
}

export interface Standing { businessId: string; rank: number; score: Money; bankrupt: boolean }
export interface Payout { playerId: string; kind: 'owner' | 'official' | 'platform'; amount: Money; rank?: number }

export interface SeasonState {
  config: SeasonConfig; phase: Phase; month: number;       // 0 до старта, затем 1…rounds
  bank: Money; players: PlayerInfo[]; businesses: BusinessState[]; officials: OfficialState[];
  events: GameEvent[]; feed: FeedItem[]; standings: Standing[]; payouts?: Payout[];
}

// ───────────────────────── Аналитика и советы ─────────────────────────

export interface Benchmark { metric: string; you: number; industry: number; verdict: 'good' | 'ok' | 'bad' }
export interface NicheKpi { id: string; label: string; value: number; unit: string }

export interface Analytics {
  month: number;
  revenue: Money; profit: Money; cumulativeProfit: Money;
  cogsPct: number; laborPct: number; rentPct: number; primeCostPct: number; netMarginPct: number;
  fixedCostsMonth: Money; variableCostPerUnit: Money; contributionPerUnit: Money;
  breakEvenUnitsMonth: number | null; breakEvenRevenueMonth: Money | null; breakEvenPrice: Money | null;
  utilization: number; sizeUtilization: number; lostSalesUnits: number; lostSalesMoney: Money;
  cashRunwayMonths: number | null;             // null — бизнес в плюсе
  setupInvested: Money; paybackMonths: number | null;   // через сколько месяцев вернутся вложения при текущей прибыли
  taxDueNext: { amount: Money; month: number } | null;
  exposure: Money;                             // сколько штрафов придёт, если найдут все текущие нарушения
  benchmarks: Benchmark[]; nicheKpis: NicheKpi[];
}

export interface Recommendation {
  id: string; severity: 'info' | 'warn' | 'critical'; title: string; text: string;
  suggested?: Partial<MonthDecisions>;         // что система предлагает нажать
  impact?: { profitDelta: Money };             // оценка эффекта по whatIf
  ruleCardId?: string;
}

export interface OpenRecommendation { kitId: PackKit['id']; size: number; items: { id: string; qty: number }[]; total: Money; cashLeft: Money; firstDecisions: MonthDecisions; why: string[] }

// ───────────────────────── Что видит клиент ─────────────────────────

export interface PublicBusiness { id: string; name: string; ownerName: string; isBot: boolean; niche: NicheId; placeId: string; price: Money; reputation: number; rank: number; bankrupt: boolean; grade?: string }

export interface OwnerView {
  kind: 'owner'; me: PlayerInfo; season: Pick<SeasonState, 'config' | 'phase' | 'month' | 'bank' | 'standings' | 'payouts'>;
  secondsLeft: number; business: BusinessState | null; others: PublicBusiness[];
  events: GameEvent[]; feed: FeedItem[]; analytics: Analytics | null; recommendations: Recommendation[]; submitted: boolean;
}

export interface OfficialCase { business: PublicBusiness; complaints: number; hints: string[]; bribeOffer?: Money }
export interface OfficialView {
  kind: 'official'; me: PlayerInfo; season: OwnerView['season']; secondsLeft: number;
  official: OfficialState; cases: OfficialCase[]; events: GameEvent[]; feed: FeedItem[]; submitted: boolean;
}

export interface SpectatorView { kind: 'spectator'; season: OwnerView['season']; secondsLeft: number; businesses: PublicBusiness[]; events: GameEvent[]; feed: FeedItem[] }

export type ClientView = OwnerView | OfficialView | SpectatorView;

// ───────────────────────── События сокета ─────────────────────────

export interface Ack<T = undefined> { ok: boolean; error?: string; data?: T }

export interface ClientToServer {
  'season:join': (p: { seasonId?: string; name: string; kind: 'owner' | 'official' | 'spectator'; role?: OfficialRole; token?: string }, ack: (r: Ack<{ playerId: string; token: string; seasonId: string }>) => void) => void;
  'season:pay': (ack: (r: Ack) => void) => void;                                   // тестовый взнос
  'business:recommend': (p: { niche: NicheId; placeId: string }, ack: (r: Ack<OpenRecommendation[]>) => void) => void;
  'business:open': (p: { niche: NicheId; placeId: string; name: string; kitId: PackKit['id']; size: number; items?: { id: string; qty: number }[] }, ack: (r: Ack) => void) => void;
  'turn:submit': (p: MonthDecisions, ack: (r: Ack) => void) => void;
  'turn:whatif': (p: MonthDecisions, ack: (r: Ack<{ report: MonthReport; analytics: Analytics }>) => void) => void;
  'official:submit': (p: OfficialDecisions, ack: (r: Ack) => void) => void;
  'advisor:ask': (p: { question: string }, ack: (r: Ack<AdvisorAnswer>) => void) => void;
  'season:start': (ack: (r: Ack) => void) => void;                                 // хост заполняет пустые места ботами и запускает
}

export interface ServerToClient {
  'view': (v: ClientView) => void;            // полное состояние для этого клиента; шлётся при каждом изменении
  'tick': (p: { secondsLeft: number }) => void;
  'debrief': (d: Debrief) => void;
}

// ───────────────────────── ИИ ─────────────────────────

export interface AdvisorAnswer { answer: string; sources: { title: string; url: string }[]; origin: 'ai' | 'rules' }
export interface Debrief { headline: string; lostMoneyOn: { title: string; amount: Money; lesson: string; ruleCardId?: string }[]; didWell: string[]; nextTime: string[]; origin: 'ai' | 'rules' }
export interface WeatherMonth { month: number; avgHighF: number; avgLowF: number; precipDays: number; snowIn: number; summary: string; provider: string }
