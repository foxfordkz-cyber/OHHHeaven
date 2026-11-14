import { BrowserRouter, Route, Routes } from 'react-router-dom';

function Placeholder({ title }: { title: string }) {
  return <main style={{ padding: 16 }}><h1>{title}</h1></main>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder title="First Year" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Routes>
    </BrowserRouter>
  );
}
