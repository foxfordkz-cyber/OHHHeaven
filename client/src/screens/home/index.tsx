import type { ScreenModule } from '../../app/screens';

function Home() {
  return <main className="screen"><h1 className="h1">First Year</h1></main>;
}

export const screen: ScreenModule = { routes: [{ path: '/', element: <Home /> }] };
