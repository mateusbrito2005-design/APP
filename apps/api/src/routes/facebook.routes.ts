import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { testFacebookConnection, syncAdSpendForUser, FacebookApiError } from "../services/facebook.service";
import { prisma } from "../prisma";

export const facebookRouter = Router();
facebookRouter.use(requireAuth);

facebookRouter.post("/test-connection", async (req: AuthedRequest, res) => {
  const integration = await prisma.integration.findUnique({ where: { userId: req.userId! } });
  if (!integration?.fbAccessToken || !integration.fbAdAccountId) {
    return res.status(400).json({ error: "Configure o token de acesso e o ID da conta de anúncios primeiro" });
  }
  try {
    const account = await testFacebookConnection(integration.fbAccessToken, integration.fbAdAccountId);
    res.json({ ok: true, account });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof FacebookApiError ? err.message : "Erro desconhecido" });
  }
});

facebookRouter.post("/sync", async (req: AuthedRequest, res) => {
  const days = Number(req.body?.days ?? 30);
  try {
    const result = await syncAdSpendForUser(req.userId!, days);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof FacebookApiError ? err.message : "Erro ao sincronizar" });
  }
});
