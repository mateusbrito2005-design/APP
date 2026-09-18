import { Router } from "express";
import { prisma } from "../prisma";
import { parseHotmart, parseKiwify, parseWiapy, parseGeneric, ingestOrder } from "../services/orders.service";
import { hmacSha256Hex, safeEqual } from "../services/webhookVerify";

export const webhooksRouter = Router();

async function findUserByToken(token: string) {
  const integration = await prisma.integration.findUnique({ where: { webhookToken: token } });
  return integration;
}

async function logAndRespond(
  userId: string,
  gateway: string,
  payload: unknown,
  res: any,
  handler: () => Promise<void>
) {
  const log = await prisma.webhookLog.create({ data: { userId, gateway, payload: payload as any } });
  try {
    await handler();
    await prisma.webhookLog.update({ where: { id: log.id }, data: { processed: true } });
    res.status(200).json({ ok: true });
  } catch (err: any) {
    await prisma.webhookLog.update({ where: { id: log.id }, data: { error: err?.message ?? "erro desconhecido" } });
    res.status(422).json({ ok: false, error: err?.message });
  }
}

// Hotmart: URL includes the per-user webhook token. Hotmart also sends a
// "hottok" field in the payload that should match the configured secret.
webhooksRouter.post("/hotmart/:token", async (req, res) => {
  const integration = await findUserByToken(req.params.token);
  if (!integration) return res.status(404).json({ error: "webhook não encontrado" });

  if (integration.hotmartSecret) {
    const hottok = req.body?.hottok ?? req.body?.data?.hottok;
    if (!hottok || !safeEqual(String(hottok), integration.hotmartSecret)) {
      return res.status(401).json({ error: "assinatura inválida" });
    }
  }

  await logAndRespond(integration.userId, "hotmart", req.body, res, async () => {
    const parsed = parseHotmart(req.body);
    await ingestOrder(integration.userId, "hotmart", parsed, req.body);
  });
});

// Kiwify: signature is sent as ?signature=... computed as HMAC-SHA1 of the raw
// body using the account's webhook secret.
webhooksRouter.post("/kiwify/:token", async (req, res) => {
  const integration = await findUserByToken(req.params.token);
  if (!integration) return res.status(404).json({ error: "webhook não encontrado" });

  if (integration.kiwifySecret) {
    const signature = req.query.signature as string | undefined;
    const expected = hmacSha256Hex(integration.kiwifySecret, JSON.stringify(req.body));
    if (!signature || !safeEqual(signature, expected)) {
      return res.status(401).json({ error: "assinatura inválida" });
    }
  }

  await logAndRespond(integration.userId, "kiwify", req.body, res, async () => {
    const parsed = parseKiwify(req.body);
    await ingestOrder(integration.userId, "kiwify", parsed, req.body);
  });
});

// Wiapy: sends the token you configured in their webhook settings verbatim as
// the "Authorization" header (not a signature) on every request.
webhooksRouter.post("/wiapy/:token", async (req, res) => {
  const integration = await findUserByToken(req.params.token);
  if (!integration) return res.status(404).json({ error: "webhook não encontrado" });

  if (integration.wiapySecret) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !safeEqual(String(authHeader), integration.wiapySecret)) {
      return res.status(401).json({ error: "assinatura inválida" });
    }
  }

  await logAndRespond(integration.userId, "wiapy", req.body, res, async () => {
    const parsed = parseWiapy(req.body);
    await ingestOrder(integration.userId, "wiapy", parsed, req.body);
  });
});

// Generic webhook for any other gateway / custom checkout. Verified via the
// X-Webhook-Secret header matching the configured secret.
webhooksRouter.post("/generic/:token", async (req, res) => {
  const integration = await findUserByToken(req.params.token);
  if (!integration) return res.status(404).json({ error: "webhook não encontrado" });

  if (integration.genericWebhookSecret) {
    const secretHeader = req.headers["x-webhook-secret"];
    if (!secretHeader || !safeEqual(String(secretHeader), integration.genericWebhookSecret)) {
      return res.status(401).json({ error: "assinatura inválida" });
    }
  }

  await logAndRespond(integration.userId, "generic", req.body, res, async () => {
    const parsed = parseGeneric(req.body);
    await ingestOrder(integration.userId, "generic", parsed, req.body);
  });
});
