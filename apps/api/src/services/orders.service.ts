import { prisma } from "../prisma";
import { sendFacebookPurchaseEvent } from "./facebook.service";

export type OrderStatus = "paid" | "refunded" | "pending" | "canceled";

export interface ParsedOrder {
  externalId: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  customerEmail?: string;
  productName?: string;
  clickId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

function firstDefined(...values: any[]): any {
  return values.find((v) => v !== undefined && v !== null && v !== "");
}

/**
 * Hotmart webhook (Sales API v2). Field names below follow Hotmart's documented
 * "PURCHASE_*" event payload; adjust here if your account sends a different shape.
 */
export function parseHotmart(payload: any): ParsedOrder {
  const purchase = payload?.data?.purchase ?? {};
  const buyer = payload?.data?.buyer ?? {};
  const product = payload?.data?.product ?? {};
  const tracking = purchase?.tracking ?? payload?.data?.subscriber ?? {};

  const statusRaw: string = (purchase.status ?? payload?.event ?? "").toString().toUpperCase();
  let status: OrderStatus = "pending";
  if (["APPROVED", "COMPLETE", "COMPLETED"].some((s) => statusRaw.includes(s))) status = "paid";
  else if (["REFUNDED", "CHARGEBACK", "CANCELLED", "CANCELED", "EXPIRED"].some((s) => statusRaw.includes(s))) status = "refunded";

  return {
    externalId: String(purchase.transaction ?? payload?.data?.purchase?.transaction ?? payload?.id ?? ""),
    status,
    amount: Number(purchase?.price?.value ?? 0),
    currency: purchase?.price?.currency_value ?? "BRL",
    customerEmail: buyer.email,
    productName: product.name,
    clickId: firstDefined(tracking?.click_id, tracking?.src, payload?.click_id),
    utmSource: tracking?.source,
    utmMedium: tracking?.medium,
    utmCampaign: tracking?.campaign ?? tracking?.sck,
  };
}

/**
 * Kiwify webhook. Kiwify sends order data plus a TrackingParameters object where
 * custom checkout params (s1..s4) can carry our click_id if you forward it there.
 */
export function parseKiwify(payload: any): ParsedOrder {
  const statusRaw: string = (payload?.order_status ?? payload?.webhook_event_type ?? "").toString().toLowerCase();
  let status: OrderStatus = "pending";
  if (statusRaw.includes("approved") || statusRaw.includes("paid")) status = "paid";
  else if (statusRaw.includes("refund") || statusRaw.includes("chargeback") || statusRaw.includes("cancel")) status = "refunded";

  const tracking = payload?.TrackingParameters ?? payload?.tracking_parameters ?? {};

  return {
    externalId: String(payload?.order_id ?? payload?.id ?? ""),
    status,
    amount: Number(payload?.Commissions?.charge_amount ?? payload?.amount ?? 0) / (payload?.Commissions ? 100 : 1),
    currency: payload?.Commissions?.currency ?? "BRL",
    customerEmail: payload?.Customer?.email ?? payload?.customer?.email,
    productName: payload?.Product?.product_name ?? payload?.product?.name,
    clickId: firstDefined(tracking.s1, tracking.click_id, payload?.click_id),
    utmSource: tracking.utm_source,
    utmMedium: tracking.utm_medium,
    utmCampaign: tracking.utm_campaign,
    utmContent: tracking.utm_content,
    utmTerm: tracking.utm_term,
  };
}

/**
 * Generic / custom webhook: use this for gateways not natively supported, or to
 * integrate a checkout you built yourself. Expects a normalized JSON body:
 * { external_id, status: "paid"|"refunded"|"pending"|"canceled", amount, currency,
 *   customer_email, product_name, click_id, utm_source, utm_medium, utm_campaign,
 *   utm_content, utm_term }
 */
export function parseGeneric(payload: any): ParsedOrder {
  const statusRaw = String(payload?.status ?? "pending").toLowerCase();
  const status: OrderStatus = (["paid", "refunded", "pending", "canceled"] as const).includes(statusRaw as OrderStatus)
    ? (statusRaw as OrderStatus)
    : "pending";

  return {
    externalId: String(payload?.external_id ?? payload?.id ?? ""),
    status,
    amount: Number(payload?.amount ?? 0),
    currency: payload?.currency ?? "BRL",
    customerEmail: payload?.customer_email,
    productName: payload?.product_name,
    clickId: payload?.click_id,
    utmSource: payload?.utm_source,
    utmMedium: payload?.utm_medium,
    utmCampaign: payload?.utm_campaign,
    utmContent: payload?.utm_content,
    utmTerm: payload?.utm_term,
  };
}

export async function ingestOrder(userId: string, gateway: string, parsed: ParsedOrder, rawPayload: unknown) {
  if (!parsed.externalId) {
    throw new Error("Payload sem identificador externo da venda (external_id/transaction)");
  }

  let click = null as Awaited<ReturnType<typeof prisma.click.findUnique>> | null;
  if (parsed.clickId) {
    click = await prisma.click.findUnique({ where: { clickId: parsed.clickId } });
  }

  const order = await prisma.order.upsert({
    where: { gateway_externalId: { gateway, externalId: parsed.externalId } },
    create: {
      userId,
      gateway,
      externalId: parsed.externalId,
      status: parsed.status,
      amount: parsed.amount,
      currency: parsed.currency,
      customerEmail: parsed.customerEmail,
      productName: parsed.productName,
      clickId: click?.clickId,
      utmSource: firstDefined(click?.utmSource, parsed.utmSource),
      utmMedium: firstDefined(click?.utmMedium, parsed.utmMedium),
      utmCampaign: firstDefined(click?.utmCampaign, parsed.utmCampaign),
      utmContent: firstDefined(click?.utmContent, parsed.utmContent),
      utmTerm: firstDefined(click?.utmTerm, parsed.utmTerm),
      rawPayload: rawPayload as any,
    },
    update: {
      status: parsed.status,
      amount: parsed.amount,
      currency: parsed.currency,
      customerEmail: parsed.customerEmail ?? undefined,
      productName: parsed.productName ?? undefined,
      rawPayload: rawPayload as any,
    },
  });

  if (order.status === "paid" && !order.fbConversionSentAt) {
    sendFacebookPurchaseEvent(userId, order).catch(() => {});
  }

  return order;
}
