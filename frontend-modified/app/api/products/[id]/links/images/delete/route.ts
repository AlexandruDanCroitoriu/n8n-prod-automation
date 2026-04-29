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

  const body = await req.json();
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  const results = [];

  for (const update of updates) {
    const linkId = Number(update?.link_id);
    const images = Array.isArray(update?.images)
      ? update.images.filter((img: unknown): img is string => typeof img === "string")
      : [];

    if (!Number.isFinite(linkId)) {
      continue;
    }

    const res = await fetch(`${baseUrl}/sp_delete_product_link_images`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: Number(id),
        link_id: linkId,
        images,
        image_links: images,
        updated_image_links: images,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[product-link-images-delete] webhook error", res.status, text, { linkId });
      return Response.json(
        { error: `Webhook returned ${res.status}`, body: text, link_id: linkId },
        { status: 502 }
      );
    }

    const text = await res.text();
    results.push(text ? JSON.parse(text) : {});
  }

  return Response.json({ ok: true, results });
}
