import axios from "axios";
import { createHash } from "crypto";
import { prisma } from "../prisma";
import type { Order } from "@prisma/client";

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface FbInsightRow {
  campaign_id: string;
  campaign_name: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  date_start: string;
}

export class FacebookApiError extends Error {}

export async function testFacebookConnection(accessToken: string, adAccountId: string) {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const { data } = await axios.get(`${GRAPH_URL}/${accountId}`, {
      params: { access_token: accessToken, fields: "id,name,account_status,currency" },
    });
    return data;
  } catch (err: any) {
    throw new FacebookApiError(err?.response?.data?.error?.message ?? "Falha ao conectar com o Facebook");
  }
}

export async function fetchCampaignInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<FbInsightRow[]> {
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const { data } = await axios.get(`${GRAPH_URL}/${accountId}/insights`, {
      params: {
        access_token: accessToken,
        level: "campaign",
        fields: "campaign_id,campaign_name,spend,impressions,clicks",
        time_range: JSON.stringify({ since, until }),
        time_increment: 1,
        limit: 500,
      },
    });
    return data.data ?? [];
  } catch (err: any) {
    throw new FacebookApiError(err?.response?.data?.error?.message ?? "Falha ao buscar dados do Facebook Ads");
  }
}

export async function syncAdSpendForUser(userId: string, days = 30) {
  const integration = await prisma.integration.findUnique({ where: { userId } });
  if (!integration?.fbAccessToken || !integration.fbAdAccountId) {
    throw new FacebookApiError("Facebook Ads não está configurado. Adicione o token de acesso e o ID da conta em Configurações.");
  }

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const [rows, account] = await Promise.all([
    fetchCampaignInsights(integration.fbAccessToken, integration.fbAdAccountId, fmt(since), fmt(until)),
    testFacebookConnection(integration.fbAccessToken, integration.fbAdAccountId).catch(() => null),
  ]);

  if (account?.currency && account.currency !== integration.fbCurrency) {
    await prisma.integration.update({ where: { userId }, data: { fbCurrency: account.currency } });
  }

  for (const row of rows) {
    await prisma.adSpendDaily.upsert({
      where: {
        userId_date_campaignId: {
          userId,
          date: new Date(row.date_start),
          campaignId: row.campaign_id,
        },
      },
      create: {
        userId,
        date: new Date(row.date_start),
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
      },
      update: {
        campaignName: row.campaign_name,
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
      },
    });
  }

  return { syncedRows: rows.length };
}

function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendFacebookPurchaseEvent(userId: string, order: Order) {
  const integration = await prisma.integration.findUnique({ where: { userId } });
  if (!integration?.fbAccessToken || !integration.fbPixelId) return { skipped: true };
  if (order.status !== "paid") return { skipped: true };

  const eventPayload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(new Date(order.createdAt).getTime() / 1000),
        action_source: "website",
        event_id: order.id,
        user_data: order.customerEmail ? { em: [sha256(order.customerEmail)] } : {},
        custom_data: {
          currency: order.currency,
          value: Number(order.amount),
          content_name: order.productName ?? undefined,
        },
      },
    ],
    access_token: integration.fbAccessToken,
  };

  try {
    await axios.post(`${GRAPH_URL}/${integration.fbPixelId}/events`, eventPayload);
    await prisma.order.update({ where: { id: order.id }, data: { fbConversionSentAt: new Date() } });
    return { sent: true };
  } catch (err: any) {
    // Best-effort: a failure to notify Facebook must never break order ingestion.
    return { sent: false, error: err?.response?.data?.error?.message ?? "unknown error" };
  }
}
