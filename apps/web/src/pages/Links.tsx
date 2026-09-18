import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatCurrency, formatNumber } from "../lib/format";

interface TrackingLink {
  id: string;
  name: string;
  code: string;
  destinationUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  trackingUrl: string;
  clicksCount: number;
  ordersCount: number;
  revenue: number;
}

const emptyForm = {
  name: "",
  destinationUrl: "",
  utmSource: "facebook",
  utmMedium: "cpc",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
};

export default function Links() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ links: TrackingLink[] }>("/api/links");
      setLinks(res.links);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os links");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post("/api/links", form);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o link");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(link: TrackingLink) {
    try {
      await navigator.clipboard.writeText(link.trackingUrl);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard API unavailable — ignore, user can still select the text manually
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este link? O histórico de cliques será mantido, mas o link deixará de funcionar.")) return;
    await api.delete(`/api/links/${id}`);
    await load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Links UTM</h1>
          <p className="page-sub">
            Crie um link de rastreamento para usar nos seus anúncios do Facebook. Ele registra o clique e encaminha um
            <code> click_id</code> para o checkout, permitindo atribuir a venda à campanha certa.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>Novo link</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <label className="field">
            <span>Nome interno</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Campanha Black Friday" />
          </label>
          <label className="field field-wide">
            <span>URL de destino (sua página de vendas / checkout)</span>
            <input
              required
              type="url"
              value={form.destinationUrl}
              onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
              placeholder="https://minhaloja.com/produto"
            />
          </label>
          <label className="field">
            <span>utm_source</span>
            <input value={form.utmSource} onChange={(e) => setForm({ ...form, utmSource: e.target.value })} />
          </label>
          <label className="field">
            <span>utm_medium</span>
            <input value={form.utmMedium} onChange={(e) => setForm({ ...form, utmMedium: e.target.value })} />
          </label>
          <label className="field">
            <span>utm_campaign</span>
            <input value={form.utmCampaign} onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })} placeholder="nome-da-campanha" />
          </label>
          <label className="field">
            <span>utm_content</span>
            <input value={form.utmContent} onChange={(e) => setForm({ ...form, utmContent: e.target.value })} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? "Criando…" : "Criar link"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Seus links</h3>
        {loading ? (
          <div className="skeleton-block" />
        ) : links.length === 0 ? (
          <p className="empty-state">Nenhum link criado ainda.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Link de rastreamento</th>
                <th>Cliques</th>
                <th>Vendas</th>
                <th>Receita</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <div>{link.name}</div>
                    <div className="muted small">
                      {link.utmSource} / {link.utmMedium} {link.utmCampaign ? `/ ${link.utmCampaign}` : ""}
                    </div>
                  </td>
                  <td>
                    <code className="link-code">{link.trackingUrl}</code>
                  </td>
                  <td>{formatNumber(link.clicksCount)}</td>
                  <td>{formatNumber(link.ordersCount)}</td>
                  <td>{formatCurrency(link.revenue)}</td>
                  <td className="actions-cell">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(link)}>
                      {copiedId === link.id ? "Copiado!" : "Copiar"}
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(link.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
