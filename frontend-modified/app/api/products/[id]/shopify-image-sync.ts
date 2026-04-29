type ProductRecord = Record<string, unknown>;

export type ProductImage = {
  original_image_url: string;
  image_url: string;
  shopify_gid: string | null;
  [key: string]: unknown;
};

function escapeControlCharsInQuotedStrings(input: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString && char === "\n") {
      result += "\\n";
      continue;
    }

    if (inString && char === "\r") {
      result += "\\r";
      continue;
    }

    if (inString && char === "\t") {
      result += "\\t";
      continue;
    }

    result += char;
  }

  return result;
}

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInQuotedStrings(text));
    } catch {
      return text;
    }
  }
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return parseJsonSafely(value);
}

export function getWebhookConfig() {
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

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getImageUrl(record: Record<string, unknown>): string | null {
  return (
    getStringValue(record.original_image_url) ??
    getStringValue(record.image_url) ??
    getStringValue(record.src) ??
    getStringValue(record.url)
  );
}

function getImageGid(record: Record<string, unknown>): string | null {
  return (
    getStringValue(record.shopify_img_gid) ??
    getStringValue(record.shopify_gid) ??
    getStringValue(record.image_file_gid) ??
    getStringValue(record.file_gid) ??
    getStringValue(record.gid)
  );
}

function pickProductItem(payload: unknown): ProductRecord | null {
  if (Array.isArray(payload)) {
    return payload.find((item): item is ProductRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))) ?? null;
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)) {
    return pickProductItem((payload as { data: unknown[] }).data);
  }

  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as ProductRecord)
    : null;
}

function normalizeImages(value: unknown): ProductImage[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((image) => {
    if (typeof image === "string" && image.trim()) {
      return [{ original_image_url: image, image_url: image, shopify_gid: null }];
    }

    if (!image || typeof image !== "object") {
      return [];
    }

    const record = image as Record<string, unknown>;
    const url = getImageUrl(record);
    if (!url) return [];

    return [{
      ...record,
      original_image_url: url,
      image_url: url,
      shopify_gid: getImageGid(record),
    }];
  });
}

function collectUploadedImageGids(payload: unknown, map = new Map<string, string>()) {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      collectUploadedImageGids(item, map);
    }
    return map;
  }

  if (!payload || typeof payload !== "object") {
    return map;
  }

  const record = payload as Record<string, unknown>;
  const url = getImageUrl(record);
  const gid = getImageGid(record);

  if (url && gid) {
    map.set(url, gid);
  }

  for (const value of Object.values(record)) {
    collectUploadedImageGids(value, map);
  }

  return map;
}

function extractSingleUploadedGid(payload: unknown, image: ProductImage): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const direct = getImageGid(payload as Record<string, unknown>);
    if (direct) {
      return direct;
    }
  }

  const gidsByUrl = collectUploadedImageGids(payload);
  return gidsByUrl.get(image.original_image_url) ?? Array.from(gidsByUrl.values())[0] ?? null;
}

export async function uploadSingleProductImageToShopify(
  productId: number,
  image: ProductImage,
  baseUrl: string,
  credentials: string
) {
  const uploadRes = await fetch(`${baseUrl}/sp_product_image_upload_to_shopify`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: productId,
      image,
      images: [image],
    }),
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Image upload failed (${uploadRes.status}): ${text}`);
  }

  const uploadText = await uploadRes.text();
  const uploadData = uploadText ? parseJsonSafely(uploadText) : null;
  const shopifyGid = extractSingleUploadedGid(uploadData, image);

  if (!shopifyGid) {
    throw new Error(`No Shopify GID was returned for image ${image.original_image_url}`);
  }

  return {
    shopify_gid: shopifyGid,
    uploadData,
  };
}

async function fetchProduct(productId: number, baseUrl: string, credentials: string) {
  const res = await fetch(`${baseUrl}/sp_product_data?id=${productId}`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Product fetch failed (${res.status}): ${text}`);
  }

  const text = await res.text();
  const data = text ? parseJsonSafely(text) : null;
  return pickProductItem(data);
}

async function uploadViaInternalRoute(productId: number, image: ProductImage, appOrigin: string) {
  const res = await fetch(`${appOrigin}/api/products/${productId}/images/upload-to-shopify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image }),
  });

  const text = await res.text();
  const data = text ? parseJsonSafely(text) : null;

  if (!res.ok) {
    const message = data && typeof data === "object" && !Array.isArray(data) && typeof (data as Record<string, unknown>).error === "string"
      ? String((data as Record<string, unknown>).error)
      : `Image upload route failed (${res.status})`;
    throw new Error(message);
  }

  const shopifyGid = data && typeof data === "object" && !Array.isArray(data)
    ? getImageGid(data as Record<string, unknown>)
    : null;

  if (!shopifyGid) {
    throw new Error(`No Shopify GID was returned for image ${image.original_image_url}`);
  }

  return { shopify_gid: shopifyGid, data };
}

export async function ensureProductImageGids(productId: number, baseUrl: string, credentials: string, appOrigin?: string) {
  const product = await fetchProduct(productId, baseUrl, credentials);
  if (!product) {
    throw new Error("Product not found");
  }

  const currentImages = normalizeImages(product.images);
  const missingImages = currentImages.filter((image) => !image.shopify_gid);

  if (missingImages.length === 0) {
    return { product, images: currentImages };
  }

  const mergedImages = [...currentImages];
  const uploadResults: Array<{ image_url: string; shopify_gid: string }> = [];

  for (const image of missingImages) {
    const result = appOrigin
      ? await uploadViaInternalRoute(productId, image, appOrigin)
      : await uploadSingleProductImageToShopify(productId, image, baseUrl, credentials);
    const index = mergedImages.findIndex((item) => item.original_image_url === image.original_image_url);

    if (index >= 0) {
      mergedImages[index] = {
        ...mergedImages[index],
        image_url: mergedImages[index].image_url || mergedImages[index].original_image_url,
        shopify_gid: result.shopify_gid,
      };
    }

    uploadResults.push({
      image_url: image.original_image_url,
      shopify_gid: result.shopify_gid,
    });
  }

  const refreshedProduct = (await fetchProduct(productId, baseUrl, credentials)) ?? product;
  const metafields = typeof refreshedProduct.metafields === "string"
    ? refreshedProduct.metafields
    : JSON.stringify(refreshedProduct.metafields ?? []);

  const persistRes = await fetch(`${baseUrl}/sp_product_data_update`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...refreshedProduct,
      id: productId,
      product_id: productId,
      images: mergedImages,
      metafields,
    }),
  });

  if (!persistRes.ok) {
    const text = await persistRes.text();
    throw new Error(`Image GID save failed (${persistRes.status}): ${text}`);
  }

  const stillMissing = mergedImages.filter((image) => !image.shopify_gid);
  if (stillMissing.length > 0) {
    throw new Error("Some product images are still missing Shopify image file GIDs after upload.");
  }

  return {
    product: {
      ...refreshedProduct,
      images: mergedImages,
    },
    images: mergedImages,
    uploadResults,
  };
}
