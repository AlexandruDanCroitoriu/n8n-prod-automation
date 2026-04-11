export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
//   const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const baseUrl = process.env.WEBHOOK_URL;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.json();
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  const res = await fetch(`${baseUrl}/sp_fetch_product_link_details`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ product_id: Number(id), link_id: body.link_id }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[product-links-fetch] webhook error", res.status, text);
    return Response.json({ error: `Webhook returned ${res.status}`, body: text }, { status: 502 });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return Response.json(data);
}
