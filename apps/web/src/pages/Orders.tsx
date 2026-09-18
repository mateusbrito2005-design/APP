import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatCurrency } from "../lib/format";

interface Order {
  id: string;
  gateway: string;
  status: string;
  amount: string;
  currency: string;
  customerEmail: string | null;
  productName: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  refunded: "Reembolsado",
  pending: "Pendente",
  canceled: "Cancelado",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ orders: Order[] }>("/api/dashboard/orders?limit=100")
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar as vendas"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Vendas</h1>
          <p className="page-sub">Vendas recebidas pelos webhooks dos seus gateways de pagamento.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="skeleton-block" />
        ) : orders.length === 0 ? (
          <p className="empty-state">
            Nenhuma venda registrada ainda. Configure o webhook do seu gateway de pagamento em Configurações para começar a
            receber vendas automaticamente.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Cliente</th>
                <th>Gateway</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="muted small">{new Date(o.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{o.productName ?? "—"}</td>
                  <td className="muted small">{o.customerEmail ?? "—"}</td>
                  <td>
                    <span className="pill pill-neutral">{o.gateway}</span>
                  </td>
                  <td className="muted small">{[o.utmSource, o.utmCampaign].filter(Boolean).join(" / ") || "—"}</td>
                  <td>
                    <span className={`pill ${o.status === "paid" ? "pill-positive" : o.status === "refunded" ? "pill-negative" : "pill-neutral"}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td>{formatCurrency(Number(o.amount), o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
