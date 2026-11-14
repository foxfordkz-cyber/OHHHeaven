// Темы и порядок показа рычагов и срезанных углов кафе (задание A2 третьего захода).
// Из этого файла packs/next/build.mjs собирает pack.extra.leverGroups. Каждый рычаг и каждый угол — ровно в одной теме;
// сборщик падает, если чего-то нет или есть лишнее.
//
// show:
//   'first'                 — на экране Manage с первого дня (рычагов 15, углов 6);
//   { months: [..] }        — только в эти месяцы года (1–12), обычно с месяца до начала сезона;
//   { phase: '..' }         — только на шаге до открытия: before_lease, construction, closing;
//   { entry: 'takeover' }   — только при покупке действующей кофейни;
//   { staffAtLeast: n }     — когда в штате n человек и больше;
//   { seatsAtLeast: n }     — когда мест n и больше;
//   { afterDays: n }        — через n дней после открытия;
//   { event: [поля] }       — пока объявлено или идёт событие с эффектом на эти поля (EVENTS.md, задание A3);
//   { lowCash: true }       — когда в кассе меньше одного месяца постоянных расходов;
//   'more'                  — только в полном списке «All levers».
// Месяцы взяты из самих записей пакета (activeMonths) или из сроков закона, ссылка — в why.

export const LEVER_GROUPS = [
  {
    id: 'floor', label: 'Room and line',
    levers: {
      hours: 'first',
      peak_schedule: 'first',
      seating_layout: 'first',
      queue_setup: 'first',
      laptop_policy: 'first',
      restroom_access: { seatsAtLeast: 16 },
      outdoor_seating: { months: [3, 4, 5, 6, 7, 8, 9, 10] },
      music_tempo: { afterDays: 30 },
      music: { afterDays: 30 },
      ordering_kiosk: { afterDays: 60 },
      community_nights: { afterDays: 60 },
      step_at_the_door: 'more',
    },
  },
  {
    id: 'menu', label: 'Menu and supplies',
    levers: {
      sourcing: 'first',
      bean_contract: 'first',
      pastry_program: 'first',
      alt_milk_pricing: 'first',
      day_end_surplus: { afterDays: 14 },
      ordering_par: { afterDays: 14 },
      menu_size: { afterDays: 30 },
      seasonal_menu: { afterDays: 30 },
      value_anchor: { afterDays: 30 },
      inventory_control: { afterDays: 30 },
      grab_and_go: { afterDays: 60 },
      cold_brew_prep: { months: [4, 5, 6, 7, 8, 9] },
      ice_supply: { months: [4, 5, 6, 7, 8, 9] },
      supply_route: 'more',
      safety_stock: 'more',
      early_deliveries: 'more',
      cup_program: 'more',
      takeout_packaging: 'more',
      condiment_milk: 'more',
      waste_service: 'more',
    },
  },
  {
    id: 'team', label: 'Team',
    levers: {
      staff_pay: 'first',
      training: 'first',
      owner_schedule: { afterDays: 7 },
      tipping_setup: { staffAtLeast: 2 },
      scheduling: { staffAtLeast: 3 },
      tip_pool_rules: { staffAtLeast: 3 },
      staff_benefits: { staffAtLeast: 3 },
      cross_training: { staffAtLeast: 3 },
      sick_call_policy: { staffAtLeast: 3 },
      bench_depth: { staffAtLeast: 4 },
      complaint_handling: { staffAtLeast: 4 },
      harassment_prevention: 'more',
      job_ads: 'more',
      interview_screening: 'more',
      epli_cover: 'more',
      hiring_programs: 'more',
    },
  },
  {
    id: 'sales', label: 'Customers and sales',
    levers: {
      order_ahead: 'first',
      loyalty: 'first',
      delivery_apps: 'first',
      street_presence: { afterDays: 14 },
      reviews: { afterDays: 30 },
      refund_policy: { afterDays: 30 },
      catering: { afterDays: 60 },
      gift_cards: { months: [10, 11, 12] },
      card_pricing: 'more',
    },
  },
  {
    id: 'upkeep', label: 'Cleaning and equipment',
    levers: {
      cleaning: 'first',
      pest_control: { afterDays: 14 },
      temperature_checks: { afterDays: 14 },
      food_handling: { afterDays: 14 },
      espresso_service: { afterDays: 30 },
      water_treatment: { afterDays: 30 },
      refrigeration_care: { afterDays: 30 },
      mock_inspection: { afterDays: 30 },
      hvac_service: { months: [4, 5, 9, 10] },
      outage_kit: { event: ['closureDays', 'utilities'] },
      connectivity_backup: 'more',
      rodent_proofing: 'more',
      allergen_labels: 'more',
    },
  },
  {
    id: 'street', label: 'Street, weather and the city',
    levers: {
      winter_proofing: { months: [10, 11, 12, 1, 2, 3] },
      snow_ice_plan: { months: [11, 12, 1, 2, 3] },
      holiday_hours: { months: [10, 11, 12, 1] },
      sidewalk_care: { afterDays: 14 },
      storm_day_policy: { event: ['footTraffic', 'closureDays'] },
      shed_response: { event: ['footTraffic'] },
      disruption_playbook: { event: ['footTraffic'] },
      event_day_plan: { event: ['footTraffic', 'demand'] },
      flood_protection: { event: ['closureDays'] },
      air_quality_plan: { event: ['footTraffic'] },
      entrance_floor_safety: 'more',
      delivery_hatch_rule: 'more',
      night_security: 'more',
    },
  },
  {
    id: 'money', label: 'Money, insurance and law',
    levers: {
      bill_timing: { lowCash: true },
      tax_reserve_account: { afterDays: 30 },
      cash_reserve: { afterDays: 60 },
      estimated_tax_plan: { months: [3, 5, 8, 12] },
      inspector_door_policy: { afterDays: 14 },
      cash_controls: { staffAtLeast: 3 },
      worker_complaints: { staffAtLeast: 3 },
      insurance_package: 'more',
      payout_schedule: 'more',
      owner_health_cover: 'more',
      legal_help: 'more',
    },
  },
];

// Срезанные углы: тема — по тому, кто находит нарушение (official у violation). Сначала видны шесть, что были в пакете v1.
export const SHORTCUT_GROUPS = [
  {
    id: 'food', label: 'Food safety', officials: ['health_inspector', 'ag_markets_inspector'],
    show: {
      skip_food_protection_cert: 'first',
      keep_old_food: 'first',
      home_baked_pastries: 'first',
      squeeze_extra_seats: { seatsAtLeast: 15 },
      trade_on_sellers_permit: { entry: 'takeover' },
      keep_food_after_outage: { event: ['closureDays', 'utilities'] },
      serve_without_water: { event: ['closureDays', 'utilities'] },
      hide_bad_grade: { afterDays: 30 },
      let_permit_lapse: { afterDays: 300 },
    },
  },
  {
    id: 'pay', label: 'Staff and pay',
    officials: ['labor_investigator', 'wage_hour_investigator', 'nlrb_agent', 'benefits_coverage_investigator', 'wcb_investigator', 'irs_tip_examiner'],
    show: {
      keep_tips: 'first',
      unpaid_trial_shifts: 'first',
      no_spread_of_hours: 'first',
      solo_shifts_no_break: { afterDays: 7 },
      tip_credit_no_notice: { staffAtLeast: 2 },
      unreported_cash_tips: { staffAtLeast: 2 },
      manager_in_tip_pool: { staffAtLeast: 3 },
      flat_salary_no_overtime: { staffAtLeast: 3 },
      fire_union_organizers: { staffAtLeast: 5 },
      punish_the_complainer: { staffAtLeast: 3 },
    },
  },
  {
    id: 'building', label: 'Building, fire and plumbing', officials: ['dob_inspector', 'fdny_inspector', 'dep_inspector'],
    show: {
      open_in_wrong_use_space: { phase: 'before_lease' },
      build_without_permit: { phase: 'construction' },
      start_work_before_permit: { phase: 'construction' },
      work_through_stop_order: { phase: 'construction' },
      handyman_plumbing_electric: { phase: 'construction' },
      big_sign_no_permit: { phase: 'construction' },
      overpack_event_nights: { afterDays: 60 },
      pack_the_line_inside: { afterDays: 14 },
      skip_grease_trap_cleaning: { afterDays: 30 },
    },
  },
  {
    id: 'street', label: 'Sidewalk, trash and signs', officials: ['dot_inspector', 'dsny_agent'],
    show: {
      sidewalk_tables: { months: [3, 4, 5, 6, 7, 8, 9, 10] },
      sidewalk_cafe_creep: { months: [4, 5, 6, 7, 8, 9, 10] },
      skip_snow_clearing: { months: [12, 1, 2, 3] },
      skip_the_carter: { afterDays: 14 },
    },
  },
  {
    id: 'tax', label: 'Taxes', officials: ['tax_auditor', 'irs_revenue_officer'],
    show: {
      skip_bulk_sale_notice: { entry: 'takeover' },
      spend_payroll_withholding: { lowCash: true },
      ring_drinks_as_groceries: { afterDays: 30 },
    },
  },
  {
    id: 'customers', label: 'Customers and prices', officials: ['dcwp_inspector', 'civil_court'],
    show: {
      ac_with_open_door: { months: [6, 7, 8, 9] },
      hidden_card_fee: { afterDays: 30 },
      buy_fake_reviews: { afterDays: 30 },
    },
  },
];
// Углы, которых нет в show своей темы, получают 'more'.
