function getWebhookConfig() {
  const baseUrl = process.env.WEBHOOK_URL;
  // const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;

  if (!baseUrl || !username || !password) {
    return null;
  }

  return {
    baseUrl,
    credentials: Buffer.from(`${username}:${password}`).toString("base64"),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = getWebhookConfig();

  if (!config) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const res = await fetch(`${config.baseUrl}/sp_product_data?id=${id}`, {
    method: "GET",
    headers: { Authorization: `Basic ${config.credentials}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[product] webhook error", res.status, text);
    return Response.json({ error: `Webhook returned ${res.status}`, body: text }, { status: 502 });
  }

  return Response.json(await res.json());
}

