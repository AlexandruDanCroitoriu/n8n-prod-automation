import { ensureProductImageGids } from "../shopify-image-sync";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = process.env.WEBHOOK_URL;
  // const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const productId = Number(id);
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  try {
    await ensureProductImageGids(productId, baseUrl, credentials, new URL(req.url).origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload product images before Shopify publish";
    console.error("[post-to-shopify] image sync error", error);
    return Response.json({ error: message }, { status: 502 });
  }

  const res = await fetch(`${baseUrl}/sp_product_post_to_shopify`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ product_id: productId }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[post-to-shopify] webhook error", res.status, text);
    return Response.json({ error: `Webhook returned ${res.status}`, body: text }, { status: 502 });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return Response.json(data);
}
