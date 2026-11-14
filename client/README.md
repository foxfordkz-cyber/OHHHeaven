# @ohh/client — First Year

Vite + React 19 + TypeScript. Phone first (390 px), dark theme, one accent (taxi yellow).

```bash
cd client && npm install
npm run dev        # http://localhost:5173 — /api goes to http://localhost:3000 (set OHH_API to change)
npm test           # vitest
npm run check      # tsc --noEmit
npm run build      # dist/ — the server serves it in production
```

Modes: by default the client talks to the server (`remote`). `?mode=local` or the "Practice offline" button runs the
whole city in the browser (`local`, on `@ohh/host`; until it lands — the stub in `src/app/__stubs__/host.ts`).
`?world=nyc` picks the live city; default is the fast `demo` city.

## Plug in your screen (agents 09–12)

Create `src/screens/<name>/index.tsx` and export `screen`. The router finds it by itself — do not edit `src/app/`.

```tsx
import type { ScreenModule } from '../../app/screens';
import { DevStore } from '../../app/dev';
import { ownerView } from './fixtures';           // keep your own example views in your folder

export const screen: ScreenModule = {
  routes: [{ path: '/biz/*', element: <Business /> }],             // '/desk', '/city/:id' (wide: true), '/end'
  dev: [{ id: 'biz', title: 'My business', render: () => <DevStore view={ownerView}><Business /></DevStore> }],
  bizTabs: [{ id: 'network', label: 'Network', order: 40, element: <NetworkTab /> }], // tabs inside /biz
};
```

Agent 10 builds the /biz tab bar from `getBizTabs()` (`src/app/screens.tsx`): Today 10, Manage 20, Books 30, Network 40, Insights 50.

## Data and actions — `src/app/store.ts`

| Hook / function | What it gives |
|---|---|
| `useView()` | last `ClientView`; starts polling (`?v=<version>`, 2 s in demo, 15 s live) |
| `useOwnerView()`, `useOfficialView()`, `useCityView()` | the view if it is of that kind, else `null` |
| `useGame()` | `act(action)`, `query(q)`, `join(p)`, `toast(text, tone)`, `refresh()` — errors become toasts |
| `useStoreState()` | `{ mode, worldId, status: 'live' \| 'offline' …, toasts }` |
| `DevStore` (`src/app/dev.tsx`) | example view for `/dev/<id>`; `answers` for queries, `onAct` returns the next view |

Screens never compute money: numbers come from the view and from `query` answers.

## Components — `import { … } from '../../ui'`

`Button` (primary · secondary · ghost · danger; sm · lg; `icon`, `loading`, `block`) · `Card` (`title`, `subtitle`, `action`, tone accent · warn · loss · profit · flat, `onClick`) ·
`Sheet` (bottom panel: `open`, `onClose`, `title`, `footer`) · `Stat` · `MoneyText` (`signed` colors profit and loss) · `Stepper` · `Slider` ·
`Toggle` · `SegmentedControl` · `Badge` · `ProgressBar` · `List` + `ListRow` · `Toast` / `Toaster` · `Tabs` · `BottomNav` · `TopBar` ·
`Field` · `Banner` · `Skeleton` · `RuleCard` ("Real rule" with source link) · `Feed` (city feed) · `Clock` (game date, weather, day progress) ·
`AiBadge` · `Icon` (inline SVG, see `ICON_NAMES`) · `formatMoney`, `formatPct`, `formatNumber`.

All of them are on `/dev/ui`. Tokens (colors, spacing `--s-1…--s-12`, type `--fs-xs…--fs-3xl`, radii) are in `src/ui/tokens.css`;
layout helpers: `.screen`, `.screen--with-nav`, `.stack`, `.row`, `.row-between`, `.grid-2`, `.h1–.h3`, `.muted`, `.num`.

## The map (agent 09)

Home and `/start` render the map through `src/app/slots.tsx` (`CityMapSlot`). Until `src/map/` exports `CityMap`, the slot
draws a styled stand-in. When the map lands, switch the one import in `slots.tsx`. `maplibre-gl` is already a dependency.
