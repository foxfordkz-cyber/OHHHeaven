import type { ScreenModule } from '../../app/screens';

function Start() {
  return <main className="screen"><h1 className="h1">Open your business</h1></main>;
}

export const screen: ScreenModule = { routes: [{ path: '/start', element: <Start /> }] };
