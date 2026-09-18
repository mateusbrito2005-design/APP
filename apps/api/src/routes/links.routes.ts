import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { env } from "../env";

export const linksRouter = Router();
linksRouter.use(requireAuth);

const createLinkSchema = z.object({
  name: z.string().min(1),
  destinationUrl: z.string().url(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
});

linksRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const code = nanoid(8);
  const link = await prisma.trackingLink.create({
    data: { ...parsed.data, code, userId: req.userId! },
  });

  res.status(201).json({ link: { ...link, trackingUrl: `${env.publicApiUrl}/r/${link.code}` } });
});

linksRouter.get("/", async (req: AuthedRequest, res) => {
  const links = await prisma.trackingLink.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { clicks: true } },
      clicks: { select: { order: { select: { amount: true, status: true } } } },
    },
  });

  const result = links.map((link) => {
    const orders = link.clicks.map((c) => c.order).filter((o): o is NonNullable<typeof o> => !!o);
    const paidOrders = orders.filter((o) => o.status === "paid");
    const revenue = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    return {
      id: link.id,
      name: link.name,
      code: link.code,
      destinationUrl: link.destinationUrl,
      utmSource: link.utmSource,
      utmMedium: link.utmMedium,
      utmCampaign: link.utmCampaign,
      utmContent: link.utmContent,
      utmTerm: link.utmTerm,
      createdAt: link.createdAt,
      trackingUrl: `${env.publicApiUrl}/r/${link.code}`,
      clicksCount: link._count.clicks,
      ordersCount: paidOrders.length,
      revenue,
    };
  });

  res.json({ links: result });
});

linksRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const link = await prisma.trackingLink.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!link) return res.status(404).json({ error: "Link não encontrado" });
  await prisma.trackingLink.delete({ where: { id: link.id } });
  res.status(204).end();
});
