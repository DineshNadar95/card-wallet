export function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <section className="page">
      <h1 className="page-title">{title}</h1>
      <div className="panel muted">This screen is built in Phase {phase}.</div>
    </section>
  );
}
