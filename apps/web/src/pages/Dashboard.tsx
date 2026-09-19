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
import FunnelChart from "../components/FunnelChart";
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
    profit: number | null;
  };
  currencies: { spend: string; revenue: string; mismatch: boolean };
  series: { date: string; revenue: number; spend: number }[];
  topCampaigns: { name: string; spend: number; revenue: number; roas: number | null }[];
  funnel: {
    clicks: number;
    pageViews: number;
    checkoutsStarted: number;
    ordersStarted: number;
    ordersApproved: number;
  };
}

const RANGE_OPTIONS = [
  { label: "Hoje", days: 1 },
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
      {data?.currencies.mismatch && (
        <div className="alert alert-info">
          Seu gasto em anúncios está em <strong>{data.currencies.spend}</strong> e suas vendas em{" "}
          <strong>{data.currencies.revenue}</strong> — Lucro e ROAS ficam indisponíveis (mostrando "—") até as duas
          moedas serem iguais, pra não misturar valores sem conversão.
        </div>
      )}

      {loading || !data ? (
        <div className="skeleton-block" />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Investimento em anúncios" value={formatCurrency(data.totals.spend, data.currencies.spend)} />
            <StatCard label="Receita" value={formatCurrency(data.totals.revenue, data.currencies.revenue)} tone="positive" />
            <StatCard
              label="Lucro"
              value={data.totals.profit != null ? formatCurrency(data.totals.profit, data.currencies.revenue) : "—"}
              tone={data.totals.profit != null ? (data.totals.profit >= 0 ? "positive" : "negative") : "default"}
            />
            <StatCard
              label="ROAS"
              value={data.totals.roas != null ? `${data.totals.roas.toFixed(2)}x` : "—"}
              hint={data.totals.roas != null ? formatPercent(data.totals.roas) : undefined}
              tone={data.totals.roas != null && data.totals.roas >= 1 ? "positive" : "negative"}
            />
            <StatCard label="CPA" value={data.totals.cpa != null ? formatCurrency(data.totals.cpa, data.currencies.spend) : "—"} />
            <StatCard label="Ticket médio" value={formatCurrency(data.totals.avgTicket, data.currencies.revenue)} />
          </div>

          <div className="card">
            <h3>Funil de conversão</h3>
            <FunnelChart
              stages={[
                { label: "Cliques", value: data.funnel.clicks },
                { label: "Visitou página", value: data.funnel.pageViews },
                { label: "Iniciou checkout", value: data.funnel.checkoutsStarted },
                { label: "Venda iniciada (PIX)", value: data.funnel.ordersStarted },
                { label: "Venda aprovada", value: data.funnel.ordersApproved },
              ]}
            />
          </div>

          <div className="card chart-card">
            <h3>Receita vs. investimento</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.series} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#232838" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12, fill: "#a4abbb" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#a4abbb" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatCurrency(Number(v))} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => formatDateShort(String(label))}
                  contentStyle={{ borderRadius: 12, border: "1px solid #232838", background: "#12151e", color: "#f2f3f7" }}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Receita" stroke="#34d399" fill="url(#revenueGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="spend" name="Investimento" stroke="#f97316" fill="url(#spendGradient)" strokeWidth={2} />
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
                      <td>{formatCurrency(c.spend, data.currencies.spend)}</td>
                      <td>{formatCurrency(c.revenue, data.currencies.revenue)}</td>
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
