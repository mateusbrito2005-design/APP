import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

export const trackingRouter = Router();

// This is called from pages we don't control (the customer's own sales
// page), possibly from inside restrictive in-app browsers (Facebook's,
// Instagram's...) that are known to throttle or drop fetch/sendBeacon calls
// to third-party domains. A 1x1 image request is never blocked by any of
// that — it's indistinguishable from a normal page asset — so it's the
// primary delivery mechanism here, with JSON POST kept as a secondary path
// for browsers/snippets that still use it.
trackingRouter.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

trackingRouter.options("/event", (_req, res) => res.sendStatus(204));

const eventSchema = z.object({
  click_id: z.string().min(1),
  event: z.enum(["page_view", "checkout_initiated"]),
});

async function recordEvent(clickId: string, event: "page_view" | "checkout_initiated") {
  const field = event === "page_view" ? "pageViewedAt" : "checkoutStartedAt";
  try {
    await prisma.click.updateMany({
      where: { clickId, [field]: null },
      data: { [field]: new Date() },
    });
  } catch {
    // best-effort — never surface tracking errors to the embedding page
  }
}

trackingRouter.post("/event", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (parsed.success) await recordEvent(parsed.data.click_id, parsed.data.event);
  res.status(204).end();
});

const TRANSPARENT_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

trackingRouter.get("/pixel.gif", async (req, res) => {
  const parsed = eventSchema.safeParse({ click_id: req.query.click_id, event: req.query.event });
  if (parsed.success) await recordEvent(parsed.data.click_id, parsed.data.event);

  res.set({
    "Content-Type": "image/gif",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.status(200).end(TRANSPARENT_GIF);
});
