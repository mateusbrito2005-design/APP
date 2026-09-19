import { formatNumber } from "../lib/format";

interface FunnelStage {
  label: string;
  value: number;
}

const COLORS = ["#5b6ef5", "#8b5cf6", "#ec4899", "#f97316"];

export default function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = stages[0]?.value || 1;
  const pct = stages.map((s) => (max > 0 ? Math.min(s.value / max, 1) : 0));

  return (
    <div className="funnel">
      <div className="funnel-track">
        {stages.slice(0, -1).map((stage, i) => {
          const leftPct = pct[i] * 100;
          const rightPct = pct[i + 1] * 100;
          const from = COLORS[i % COLORS.length];
          const to = COLORS[(i + 1) % COLORS.length];
          return (
            <div
              key={stage.label}
              className="funnel-segment"
              style={{
                clipPath: `polygon(0% ${50 - leftPct / 2}%, 100% ${50 - rightPct / 2}%, 100% ${
                  50 + rightPct / 2
                }%, 0% ${50 + leftPct / 2}%)`,
                background: `linear-gradient(90deg, ${from}, ${to})`,
              }}
            />
          );
        })}
      </div>
      <div className="funnel-labels">
        {stages.map((stage, i) => (
          <div key={stage.label} className="funnel-label-col">
            <div className="funnel-value">{formatNumber(stage.value)}</div>
            <div className="funnel-name">{stage.label}</div>
            <div className="funnel-pct">{(pct[i] * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
