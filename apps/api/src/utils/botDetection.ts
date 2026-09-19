// Link-preview crawlers (Facebook/WhatsApp/Telegram/etc.) and search/SEO bots
// fetch a shared or ad-reviewed URL to generate a thumbnail/preview. That GET
// request looks identical to a human click unless we check the User-Agent, so
// without this filter every crawler hit inflates the click count with no
// corresponding ad spend or real visitor.
const BOT_PATTERNS = [
  /facebookexternalhit/i,
  /facebookcatalog/i,
  /facebot/i,
  /meta-externalagent/i,
  /whatsapp/i,
  /telegrambot/i,
  /slackbot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /discordbot/i,
  /skypeuripreview/i,
  /googlebot/i,
  /bingbot/i,
  /pinterest/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /mj12bot/i,
  /bytespider/i,
  /applebot/i,
  /crawler/i,
  /spider/i,
  /bot\//i,
  /headlesschrome/i,
  /python-requests/i,
  /go-http-client/i,
  /curl\//i,
  /wget\//i,
];

export function isBotUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent) return true; // no UA at all is almost always a script, not a browser
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}
