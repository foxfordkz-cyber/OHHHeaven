// Practice offline: the game runs in the browser on @ohh/host (agent 06).
// Until @ohh/host is in the main branch, the stub in ./__stubs__/host.ts plays the city on example data.
// To switch to the real host, replace the import below with: import * as host from '@ohh/host';
import * as host from './__stubs__/host';
import type { EngineCtx, HostDeps, HostModule } from './host-types';

export interface LocalRuntime { host: HostModule; ctx: EngineCtx; deps: HostDeps }

export const localRuntime: LocalRuntime = { host, ctx: host.stubCtx, deps: host.stubDeps };
