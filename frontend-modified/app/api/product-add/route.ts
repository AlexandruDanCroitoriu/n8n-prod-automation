export async function POST() {
  const baseUrl = process.env.WEBHOOK_URL;
//   const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  const res = await fetch(`${baseUrl}/sp_add_product`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[product-add] webhook error", res.status, text);
    return Response.json({ error: `Webhook returned ${res.status}`, body: text }, { status: 502 });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return Response.json(data);
}
