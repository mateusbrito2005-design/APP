import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { env } from "../env";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

function mask(secret: string | null): string | null {
  if (!secret) return null;
  if (secret.length <= 6) return "••••••";
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

settingsRouter.get("/", async (req: AuthedRequest, res) => {
  const integration = await prisma.integration.findUnique({ where: { userId: req.userId! } });
  if (!integration) return res.status(404).json({ error: "Configuração não encontrada" });

  res.json({
    settings: {
      fbAdAccountId: integration.fbAdAccountId,
      fbPixelId: integration.fbPixelId,
      fbAccessTokenMasked: mask(integration.fbAccessToken),
      fbAccessTokenSet: !!integration.fbAccessToken,
      hotmartSecretSet: !!integration.hotmartSecret,
      kiwifySecretSet: !!integration.kiwifySecret,
      wiapySecretSet: !!integration.wiapySecret,
      genericWebhookSecretSet: !!integration.genericWebhookSecret,
    },
    webhookUrls: {
      hotmart: `${env.publicApiUrl}/api/webhooks/hotmart/${integration.webhookToken}`,
      kiwify: `${env.publicApiUrl}/api/webhooks/kiwify/${integration.webhookToken}`,
      wiapy: `${env.publicApiUrl}/api/webhooks/wiapy/${integration.webhookToken}`,
      generic: `${env.publicApiUrl}/api/webhooks/generic/${integration.webhookToken}`,
    },
  });
});

const updateSchema = z.object({
  fbAccessToken: z.string().optional(),
  fbAdAccountId: z.string().optional(),
  fbPixelId: z.string().optional(),
  hotmartSecret: z.string().optional(),
  kiwifySecret: z.string().optional(),
  wiapySecret: z.string().optional(),
  genericWebhookSecret: z.string().optional(),
});

settingsRouter.put("/", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value) data[key] = value;
  }

  await prisma.integration.update({ where: { userId: req.userId! }, data });
  res.json({ ok: true });
});
