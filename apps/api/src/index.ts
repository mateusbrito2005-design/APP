import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env";
import { authRouter } from "./routes/auth.routes";
import { linksRouter } from "./routes/links.routes";
import { redirectRouter } from "./routes/redirect.routes";
import { webhooksRouter } from "./routes/webhooks.routes";
import { facebookRouter } from "./routes/facebook.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { settingsRouter } from "./routes/settings.routes";
import { trackingRouter } from "./routes/tracking.routes";

const app = express();

app.use(express.json());

// Mounted before the restrictive CORS middleware below: this endpoint is a
// tracking beacon meant to be called from arbitrary customer-owned pages
// (not just our own frontend), so it manages its own permissive CORS.
app.use("/api/tracking", trackingRouter);

app.use(cors({ origin: env.webOrigins, credentials: true }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Public: short-link redirect used by tracking links (not under /api so links stay short).
app.use(redirectRouter);

app.use("/api/auth", authRouter);
app.use("/api/links", linksRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/facebook", facebookRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/settings", settingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

app.listen(env.port, () => {
  console.log(`utmtrack API rodando em http://localhost:${env.port}`);
});
