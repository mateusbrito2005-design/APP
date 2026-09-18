interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}

export default function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
