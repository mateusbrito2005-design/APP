import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="brand" style={{ marginBottom: 24 }}>
          <span className="brand-mark">UT</span>
          <span className="brand-name">UTMTrack</span>
        </div>
        <h1>Entrar</h1>
        <p className="auth-sub">Acompanhe suas vendas e campanhas do Facebook Ads.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>E-mail</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <p className="auth-footer">
          Ainda não tem conta? <Link to="/register">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
