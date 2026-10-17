import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
      <div className="display" style={{ fontSize: 56, color: 'var(--brand-deep)' }}>404</div>
      <div style={{ color: 'var(--text-dim)', fontSize: 16 }}>Такого ЖК или застройщика в базе нет.</div>
      <Link href="/#map" className="btn btn-accent">На карту</Link>
    </div>
  );
}
