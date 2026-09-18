import { Router } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";

export const redirectRouter = Router();

// Public tracking redirect. A link created in the dashboard points people here
// (e.g. https://api.example.com/r/AbC12345). We log a Click, then bounce the
// visitor to the real destination with the utm params and a click_id attached
// so it can be forwarded through checkout and matched back to this click when
// the sale webhook arrives.
redirectRouter.get("/r/:code", async (req, res) => {
  const link = await prisma.trackingLink.findUnique({ where: { code: req.params.code } });
  if (!link) return res.status(404).send("Link não encontrado");

  const clickId = randomUUID();
  const query = req.query as Record<string, string | undefined>;

  const utmSource = query.utm_source ?? link.utmSource ?? undefined;
  const utmMedium = query.utm_medium ?? link.utmMedium ?? undefined;
  const utmCampaign = query.utm_campaign ?? link.utmCampaign ?? undefined;
  const utmContent = query.utm_content ?? link.utmContent ?? undefined;
  const utmTerm = query.utm_term ?? link.utmTerm ?? undefined;

  await prisma.click.create({
    data: {
      clickId,
      userId: link.userId,
      trackingLinkId: link.id,
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? undefined,
      userAgent: req.headers["user-agent"],
      fbclid: query.fbclid,
      fbp: req.cookies?.["_fbp"],
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
    },
  });

  const destination = new URL(link.destinationUrl);
  if (utmSource) destination.searchParams.set("utm_source", utmSource);
  if (utmMedium) destination.searchParams.set("utm_medium", utmMedium);
  if (utmCampaign) destination.searchParams.set("utm_campaign", utmCampaign);
  if (utmContent) destination.searchParams.set("utm_content", utmContent);
  if (utmTerm) destination.searchParams.set("utm_term", utmTerm);
  destination.searchParams.set("click_id", clickId);
  if (query.fbclid) destination.searchParams.set("fbclid", query.fbclid);

  res.redirect(302, destination.toString());
});
