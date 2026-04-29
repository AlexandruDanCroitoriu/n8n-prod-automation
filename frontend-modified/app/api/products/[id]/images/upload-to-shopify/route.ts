import {
  type ProductImage,
  uploadSingleProductImageToShopify,
} from "../../shopify-image-sync";

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

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  const body = await req.json();
  const image = body?.image as ProductImage | undefined;

  if (!image || typeof image !== "object") {
    return Response.json({ error: "Image payload is required" }, { status: 400 });
  }

  try {
    const result = await uploadSingleProductImageToShopify(
      Number(id),
      image,
      baseUrl,
      credentials,
    );

    return Response.json({
      image_url: image.original_image_url ?? image.image_url,
      shopify_img_gid: result.shopify_gid,
      shopify_gid: result.shopify_gid,
      data: result.uploadData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload image to Shopify";
    return Response.json({ error: message }, { status: 502 });
  }
}
