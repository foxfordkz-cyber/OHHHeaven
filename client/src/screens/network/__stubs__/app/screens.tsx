// COPY of agent 08 client/src/app/screens.tsx (branch claude/inspiring-babbage-xgafu9, commit aefcbcd). Delete when it is in main.
import type { ReactNode } from 'react';

/**
 * How a screen plugs into the app without touching the router:
 * create `src/screens/<name>/index.tsx` and export `screen: ScreenModule`.
 * The router finds every such file at build time (import.meta.glob).
 */
export interface ScreenRoute {
  /** react-router path, e.g. '/biz/*', '/desk', '/city/:id', '/end' */
  path: string;
  element: ReactNode;
  /** full-width layout (projector screen) instead of the 480 px phone column */
  wide?: boolean;
}

export interface DevScreen {
  /** opens at /dev/<id> */
  id: string;
  title: string;
  render: () => ReactNode;
  wide?: boolean;
}

/** A tab inside /biz (agent 10 renders them; agents 11 and 12 add Insights and Network). */
export interface BizTab {
  id: string;
  label: string;
  /** Today 10, Manage 20, Books 30, Network 40, Insights 50 */
  order: number;
  element: ReactNode;
  badge?: number;
}

export interface ScreenModule {
  routes?: ScreenRoute[];
  dev?: DevScreen[];
  bizTabs?: BizTab[];
}
