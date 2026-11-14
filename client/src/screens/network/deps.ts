// The one place where the network and desk screens get the app shell of agent 08 (client/src/app).
// Until it is in the main branch: trimmed copies in __stubs__/app. When it lands, replace the lines below with
//   export { useGame, useOfficialView, useOwnerView } from '../../app/store';
//   export { DevStore } from '../../app/dev';
//   export { CityMapSlot } from '../../app/slots';
//   export type { ScreenModule } from '../../app/screens';
// and delete __stubs__/app.
export { useGame, useOfficialView, useOwnerView } from './__stubs__/app/store';
export { DevStore } from './__stubs__/app/dev';
export { CityMapSlot } from './__stubs__/app/slots';
export type { ScreenModule } from './__stubs__/app/screens';
