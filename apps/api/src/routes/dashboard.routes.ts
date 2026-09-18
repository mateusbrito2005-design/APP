import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

function parseRange(req: AuthedRequest) {
  const until = req.query.until ? new Date(String(req.query.until)) : new Date();
  const since = req.query.since
    ? new Date(String(req.query.since))
    : new Date(until.getTime() - 29 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);
  until.setHours(23, 59, 59, 999);
  return { since, until };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

dashboardRouter.get("/summary", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const { since, until } = parseRange(req);

  const [orders, spendRows, clicksCount] = await Promise.all([
    prisma.order.findMany({ where: { userId, createdAt: { gte: since, lte: until } } }),
    prisma.adSpendDaily.findMany({ where: { userId, date: { gte: since, lte: until } } }),
    prisma.click.count({ where: { userId, createdAt: { gte: since, lte: until } } }),
  ]);

  const paidOrders = orders.filter((o) => o.status === "paid");
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
  const spend = spendRows.reduce((sum, r) => sum + Number(r.spend), 0);
  const ordersCount = paidOrders.length;
  const roas = spend > 0 ? revenue / spend : null;
  const cpa = ordersCount > 0 && spend > 0 ? spend / ordersCount : null;
  const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;

  const revenueByDayMap = new Map<string, number>();
  for (const o of paidOrders) {
    const key = dayKey(new Date(o.createdAt));
    revenueByDayMap.set(key, (revenueByDayMap.get(key) ?? 0) + Number(o.amount));
  }

  const spendByDayMap = new Map<string, number>();
  for (const r of spendRows) {
    const key = dayKey(new Date(r.date));
    spendByDayMap.set(key, (spendByDayMap.get(key) ?? 0) + Number(r.spend));
  }

  const days: string[] = [];
  for (let d = new Date(since); d <= until; d.setDate(d.getDate() + 1)) {
    days.push(dayKey(new Date(d)));
  }

  const series = days.map((day) => ({
    date: day,
    revenue: revenueByDayMap.get(day) ?? 0,
    spend: spendByDayMap.get(day) ?? 0,
  }));

  const campaignSpend = new Map<string, number>();
  for (const r of spendRows) {
    campaignSpend.set(r.campaignName, (campaignSpend.get(r.campaignName) ?? 0) + Number(r.spend));
  }
  const campaignRevenue = new Map<string, number>();
  for (const o of paidOrders) {
    const key = o.utmCampaign ?? "(sem campanha)";
    campaignRevenue.set(key, (campaignRevenue.get(key) ?? 0) + Number(o.amount));
  }
  const campaignNames = new Set([...campaignSpend.keys(), ...campaignRevenue.keys()]);
  const topCampaigns = [...campaignNames]
    .map((name) => {
      const campSpend = campaignSpend.get(name) ?? 0;
      const campRevenue = campaignRevenue.get(name) ?? 0;
      return {
        name,
        spend: campSpend,
        revenue: campRevenue,
        roas: campSpend > 0 ? campRevenue / campSpend : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  res.json({
    range: { since, until },
    totals: { revenue, spend, ordersCount, clicksCount, roas, cpa, avgTicket },
    series,
    topCampaigns,
  });
});

dashboardRouter.get("/orders", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const take = Math.min(Number(req.query.limit ?? 50), 200);
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  res.json({ orders });
});
