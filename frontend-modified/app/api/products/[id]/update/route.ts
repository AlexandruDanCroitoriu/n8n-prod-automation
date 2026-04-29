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
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  const metafields = typeof body?.metafields === "string"
    ? body.metafields
    : JSON.stringify(body?.metafields_json ?? body?.metafields ?? []);
  const images = Array.isArray(body?.images)
    ? body.images.flatMap((image: unknown) => {
        if (typeof image === "string" && image.trim()) {
          return [{ original_image_url: image, image_url: image, shopify_gid: null }];
        }

        if (!image || typeof image !== "object") {
          return [];
        }

        const record = image as Record<string, unknown>;
        const url = record.original_image_url ?? record.image_url ?? record.src ?? record.url;
        if (typeof url !== "string" || !url.trim()) {
          return [];
        }

        const shopifyGid = record.shopify_gid ?? record.gid ?? null;
        return [{
          ...record,
          original_image_url: url,
          image_url: url,
          shopify_gid: typeof shopifyGid === "string" && shopifyGid.trim() ? shopifyGid : null,
        }];
      })
    : [];

  const res = await fetch(`${baseUrl}/sp_product_data_update`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      metafields,
      images,
      id: Number(id),
      product_id: Number(id),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[product-update] webhook error", res.status, text);
    return Response.json({ error: `Webhook returned ${res.status}`, body: text }, { status: 502 });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return Response.json(data);
}
