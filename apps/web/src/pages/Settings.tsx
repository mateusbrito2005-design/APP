import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

interface SettingsResponse {
  settings: {
    fbAdAccountId: string | null;
    fbPixelId: string | null;
    fbAccessTokenMasked: string | null;
    fbAccessTokenSet: boolean;
    hotmartSecretSet: boolean;
    kiwifySecretSet: boolean;
    wiapySecretSet: boolean;
    genericWebhookSecretSet: boolean;
  };
  webhookUrls: { hotmart: string; kiwify: string; wiapy: string; generic: string };
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="webhook-field">
      <div className="webhook-label">{label}</div>
      <div className="webhook-row">
        <code>{value}</code>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // ignore
            }
          }}
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [fbAccessToken, setFbAccessToken] = useState("");
  const [fbAdAccountId, setFbAdAccountId] = useState("");
  const [fbPixelId, setFbPixelId] = useState("");
  const [hotmartSecret, setHotmartSecret] = useState("");
  const [kiwifySecret, setKiwifySecret] = useState("");
  const [wiapySecret, setWiapySecret] = useState("");
  const [genericWebhookSecret, setGenericWebhookSecret] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<SettingsResponse>("/api/settings");
      setData(res);
      setFbAdAccountId(res.settings.fbAdAccountId ?? "");
      setFbPixelId(res.settings.fbPixelId ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar as configurações");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSaveFacebook(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.put("/api/settings", {
        fbAccessToken: fbAccessToken || undefined,
        fbAdAccountId,
        fbPixelId,
      });
      setFbAccessToken("");
      setMessage("Configurações do Facebook salvas.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveWebhookSecrets(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.put("/api/settings", {
        hotmartSecret: hotmartSecret || undefined,
        kiwifySecret: kiwifySecret || undefined,
        wiapySecret: wiapySecret || undefined,
        genericWebhookSecret: genericWebhookSecret || undefined,
      });
      setHotmartSecret("");
      setKiwifySecret("");
      setWiapySecret("");
      setGenericWebhookSecret("");
      setMessage("Segredos de webhook salvos.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.post<{ ok: boolean; account?: { name: string } }>("/api/facebook/test-connection");
      setMessage(res.account ? `Conectado à conta "${res.account.name}".` : "Conexão validada.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao testar conexão");
    } finally {
      setTesting(false);
    }
  }

  if (loading || !data) return <div className="skeleton-block" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Configurações</h1>
          <p className="page-sub">Conecte o Facebook Ads e os webhooks de venda dos seus gateways de pagamento.</p>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>Facebook Ads</h3>
        <p className="muted small" style={{ marginBottom: 16 }}>
          Gere um token de acesso de longa duração em{" "}
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
            developers.facebook.com
          </a>{" "}
          com as permissões <code>ads_read</code> e <code>ads_management</code>.
        </p>
        <form className="form-grid" onSubmit={handleSaveFacebook}>
          <label className="field field-wide">
            <span>Token de acesso {data.settings.fbAccessTokenSet && <em className="muted small">(atual: {data.settings.fbAccessTokenMasked})</em>}</span>
            <input
              type="password"
              value={fbAccessToken}
              onChange={(e) => setFbAccessToken(e.target.value)}
              placeholder={data.settings.fbAccessTokenSet ? "Deixe em branco para manter o atual" : "EAAB..."}
            />
          </label>
          <label className="field">
            <span>ID da conta de anúncios</span>
            <input value={fbAdAccountId} onChange={(e) => setFbAdAccountId(e.target.value)} placeholder="123456789012345" />
          </label>
          <label className="field">
            <span>ID do Pixel (para Conversions API)</span>
            <input value={fbPixelId} onChange={(e) => setFbPixelId(e.target.value)} placeholder="987654321098765" />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={handleTestConnection} disabled={testing || !data.settings.fbAccessTokenSet}>
              {testing ? "Testando…" : "Testar conexão"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Webhooks de vendas</h3>
        <p className="muted small" style={{ marginBottom: 16 }}>
          Cole cada URL no painel de webhooks do respectivo gateway. Cada URL é única para sua conta — não compartilhe.
        </p>
        <CopyField label="Hotmart" value={data.webhookUrls.hotmart} />
        <CopyField label="Kiwify" value={data.webhookUrls.kiwify} />
        <CopyField label="Wiapy" value={data.webhookUrls.wiapy} />
        <CopyField label="Genérico / checkout próprio" value={data.webhookUrls.generic} />

        <form className="form-grid" onSubmit={handleSaveWebhookSecrets} style={{ marginTop: 20 }}>
          <label className="field">
            <span>Segredo Hotmart (hottok) {data.settings.hotmartSecretSet && <em className="muted small">(configurado)</em>}</span>
            <input type="password" value={hotmartSecret} onChange={(e) => setHotmartSecret(e.target.value)} placeholder="Opcional, mas recomendado" />
          </label>
          <label className="field">
            <span>Segredo Kiwify {data.settings.kiwifySecretSet && <em className="muted small">(configurado)</em>}</span>
            <input type="password" value={kiwifySecret} onChange={(e) => setKiwifySecret(e.target.value)} placeholder="Opcional, mas recomendado" />
          </label>
          <label className="field">
            <span>Token Wiapy {data.settings.wiapySecretSet && <em className="muted small">(configurado)</em>}</span>
            <input
              type="password"
              value={wiapySecret}
              onChange={(e) => setWiapySecret(e.target.value)}
              placeholder="Defina um token e cole o mesmo valor no painel de webhook da Wiapy"
            />
          </label>
          <label className="field">
            <span>Segredo genérico (X-Webhook-Secret) {data.settings.genericWebhookSecretSet && <em className="muted small">(configurado)</em>}</span>
            <input
              type="password"
              value={genericWebhookSecret}
              onChange={(e) => setGenericWebhookSecret(e.target.value)}
              placeholder="Opcional, mas recomendado"
            />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar segredos"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
