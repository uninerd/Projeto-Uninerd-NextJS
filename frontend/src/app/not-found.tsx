import Link from 'next/link';
export default function NotFound() {
  return <main className="p-12 text-center"><h1 className="text-2xl font-bold">Página não encontrada</h1><Link className="text-blue-600" href="/">Voltar ao início</Link></main>;
}
