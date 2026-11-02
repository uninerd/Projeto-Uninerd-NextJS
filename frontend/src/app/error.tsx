'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="p-12"><h1>Não foi possível carregar esta página.</h1><button onClick={reset}>Tentar novamente</button></main>;
}
