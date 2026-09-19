import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

export const trackingRouter = Router();

// This endpoint is called from the browser on pages we don't control (the
// customer's own sales page), so it accepts requests from any origin and
// must never throw loudly — a tracking beacon failing should never break the
// page it's embedded on.
trackingRouter.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

trackingRouter.options("/event", (_req, res) => res.sendStatus(204));

const eventSchema = z.object({
  click_id: z.string().min(1),
  event: z.enum(["page_view", "checkout_initiated"]),
});

trackingRouter.post("/event", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(204).end();

  const field = parsed.data.event === "page_view" ? "pageViewedAt" : "checkoutStartedAt";

  try {
    await prisma.click.updateMany({
      where: { clickId: parsed.data.click_id, [field]: null },
      data: { [field]: new Date() },
    });
  } catch {
    // best-effort — never surface tracking errors to the embedding page
  }

  res.status(204).end();
});
