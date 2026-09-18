import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api, ApiError } from "../lib/api";
import StatCard from "../components/StatCard";
import { formatCurrency, formatDateShort, formatNumber, formatPercent } from "../lib/format";

interface SummaryResponse {
  totals: {
    revenue: number;
    spend: number;
    ordersCount: number;
    clicksCount: number;
    roas: number | null;
    cpa: number | null;
    avgTicket: number;
  };
  series: { date: string; revenue: number; spend: number }[];
  topCampaigns: { name: string; spend: number; revenue: number; roas: number | null }[];
}

const RANGE_OPTIONS = [
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const range = useMemo(() => {
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    return { since: since.toISOString(), until: until.toISOString() };
  }, [days]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SummaryResponse>(
        `/api/dashboard/summary?since=${encodeURIComponent(range.since)}&until=${encodeURIComponent(range.until)}`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o painel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      await api.post<{ syncedRows: number }>("/api/facebook/sync", { days });
      setSyncMessage("Dados do Facebook Ads sincronizados.");
      await load();
    } catch (err) {
      setSyncMessage(err instanceof ApiError ? err.message : "Falha ao sincronizar com o Facebook");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Painel</h1>
          <p className="page-sub">Visão geral das suas vendas e investimento em anúncios.</p>
        </div>
        <div className="page-actions">
          <div className="range-picker">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                className={`range-btn${days === opt.days ? " active" : ""}`}
                onClick={() => setDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
            {syncing ? "Sincronizando…" : "Sincronizar Facebook Ads"}
          </button>
        </div>
      </div>

      {syncMessage && <div className="alert alert-info">{syncMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {loading || !data ? (
        <div className="skeleton-block" />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Receita" value={formatCurrency(data.totals.revenue)} tone="positive" />
            <StatCard label="Investimento em anúncios" value={formatCurrency(data.totals.spend)} />
            <StatCard
              label="ROAS"
              value={data.totals.roas != null ? `${data.totals.roas.toFixed(2)}x` : "—"}
              hint={data.totals.roas != null ? formatPercent(data.totals.roas) : undefined}
              tone={data.totals.roas != null && data.totals.roas >= 1 ? "positive" : "negative"}
            />
            <StatCard label="Vendas pagas" value={formatNumber(data.totals.ordersCount)} />
            <StatCard label="CPA" value={data.totals.cpa != null ? formatCurrency(data.totals.cpa) : "—"} />
            <StatCard label="Ticket médio" value={formatCurrency(data.totals.avgTicket)} />
            <StatCard label="Cliques rastreados" value={formatNumber(data.totals.clicksCount)} />
          </div>

          <div className="card chart-card">
            <h3>Receita vs. investimento</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.series} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatCurrency(Number(v))} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => formatDateShort(String(label))}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Receita" stroke="#16a34a" fill="url(#revenueGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="spend" name="Investimento" stroke="#ea580c" fill="url(#spendGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3>Campanhas</h3>
            {data.topCampaigns.length === 0 ? (
              <p className="empty-state">
                Nenhuma campanha com dados ainda. Sincronize o Facebook Ads e registre vendas para ver o desempenho aqui.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Campanha</th>
                    <th>Investimento</th>
                    <th>Receita</th>
                    <th>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCampaigns.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{formatCurrency(c.spend)}</td>
                      <td>{formatCurrency(c.revenue)}</td>
                      <td>
                        <span className={`pill ${c.roas != null && c.roas >= 1 ? "pill-positive" : "pill-negative"}`}>
                          {c.roas != null ? `${c.roas.toFixed(2)}x` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
