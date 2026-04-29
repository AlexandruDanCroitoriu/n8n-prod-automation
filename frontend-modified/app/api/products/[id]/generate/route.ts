type ProductRecord = Record<string, unknown>;

type ProductMetafield = {
  namespace: string;
  key: string;
  type: string;
  value: string;
};

const METAFIELD_DEFINITIONS = [
  ["custom", "tabel_specificatii_tehnice_multiline", "multi_line_text_field"],
  ["custom", "showoff_1_richtext", "rich_text_field"],
  ["custom", "showoff_2_richtext", "rich_text_field"],
  ["custom", "showoff_3_richtext", "rich_text_field"],
  ["custom", "section_1_image", "file_reference"],
  ["custom", "section_1_title", "single_line_text_field"],
  ["custom", "section_2_title", "single_line_text_field"],
  ["custom", "section_1_description_rich", "rich_text_field"],
  ["custom", "section_2_description_rich", "rich_text_field"],
  ["custom", "section_2_image", "file_reference"],
] as const;

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

function extractJsonCandidate(value: string) {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^(?:```|~~~)[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*(?:```|~~~)$/);
  const unfenced = fencedMatch ? fencedMatch[1].trim() : trimmed;

  if (unfenced.startsWith("[") || unfenced.startsWith("{")) {
    return unfenced;
  }

  const objectIndex = unfenced.indexOf("{");
  const arrayIndex = unfenced.indexOf("[");
  const startIndex = [objectIndex, arrayIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];

  if (startIndex === undefined) {
    return unfenced;
  }

  const sliced = unfenced.slice(startIndex);
  const lastObjectIndex = sliced.lastIndexOf("}");
  const lastArrayIndex = sliced.lastIndexOf("]");
  const endIndex = Math.max(lastObjectIndex, lastArrayIndex);

  return endIndex >= 0 ? sliced.slice(0, endIndex + 1) : unfenced;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const candidate = extractJsonCandidate(value);

  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInQuotedStrings(candidate));
    } catch {
      return value;
    }
  }
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

function normalizeImages(value: unknown) {
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
  });
}

function getPreferredTextValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  for (const value of values) {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return "";
}

function normalizeMetafields(product: ProductRecord): ProductMetafield[] {
  const parsed = parseMaybeJson(product.metafields);
  const parsedMetafields = Array.isArray(parsed)
    ? parsed.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const namespace = typeof record.namespace === "string" ? record.namespace : "custom";
        const key = typeof record.key === "string" ? record.key : "";
        if (!key) return [];
        return [{
          namespace,
          key,
          type: typeof record.type === "string" ? record.type : "single_line_text_field",
          value: getPreferredTextValue(record.value),
        }];
      })
    : [];

  const knownKeys = new Set<string>(METAFIELD_DEFINITIONS.map(([, key]) => key));
  const extras = parsedMetafields.filter((field) => !knownKeys.has(field.key));
  const normalizedKnown = METAFIELD_DEFINITIONS.map(([namespace, key, type]) => {
    const existing = parsedMetafields.find((field) => field.namespace === namespace && field.key === key);
    const directValue = product[key] ?? product[`${namespace}.${key}`];

    return {
      namespace,
      key,
      type: existing?.type ?? type,
      value: getPreferredTextValue(directValue, existing?.value),
    };
  });

  return [...extras, ...normalizedKnown];
}

function extractGeneratedFields(payload: unknown, found: ProductRecord = {}) {
  const parsed = parseMaybeJson(payload);

  if (Array.isArray(parsed)) {
    const looksLikeMetafieldArray = parsed.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      return typeof (item as Record<string, unknown>).key === "string";
    });

    if (looksLikeMetafieldArray && parsed.length > 0) {
      found.metafields = parsed;
      found.metafields_json = parsed;
    }

    for (const item of parsed) {
      extractGeneratedFields(item, found);
    }
    return found;
  }

  if (!parsed || typeof parsed !== "object") {
    return found;
  }

  const record = parsed as Record<string, unknown>;
  const trackedKeys = [
    "title",
    "description",
    "metafields",
    "metafields_json",
    ...METAFIELD_DEFINITIONS.map(([, key]) => key),
  ];

  for (const key of trackedKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      found[key] = value;
    }

    if ((key === "metafields" || key === "metafields_json") && Array.isArray(value) && value.length > 0) {
      found[key] = value;
    }
  }

  const metafieldKey = typeof record.key === "string" ? record.key : "";
  const metafieldNamespace = typeof record.namespace === "string" ? record.namespace : "custom";
  const metafieldValue = getPreferredTextValue(record.value);

  if (metafieldKey && metafieldValue) {
    found[metafieldKey] = metafieldValue;
    found[`${metafieldNamespace}.${metafieldKey}`] = metafieldValue;
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      extractGeneratedFields(value, found);
    } else if (typeof value === "string" && (value.includes("{") || value.includes("["))) {
      extractGeneratedFields(value, found);
    }
  }

  return found;
}

export async function POST(
  _req: Request,
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

  const res = await fetch(`${baseUrl}/sp_product_data_generate`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ product_id: Number(id) }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[product-generate] webhook error", res.status, text);
    return Response.json({ error: `Webhook returned ${res.status}`, body: text }, { status: 502 });
  }

  const text = await res.text();
  const data = text ? parseMaybeJson(text) : {};

  try {
    const productRes = await fetch(`${baseUrl}/sp_product_data?id=${id}`, {
      method: "GET",
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (productRes.ok) {
      const productData = await productRes.json();
      const product = pickProductItem(productData);

      if (product) {
        const generatedFields = extractGeneratedFields(data);
        const mergedProduct = {
          ...product,
          ...generatedFields,
        };
        const normalizedImages = normalizeImages(mergedProduct.images);
        const normalizedMetafields = normalizeMetafields(mergedProduct);

        await fetch(`${baseUrl}/sp_product_data_update`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...mergedProduct,
            id: Number(id),
            product_id: Number(id),
            images: normalizedImages,
            metafields: JSON.stringify(normalizedMetafields),
            metafields_json: normalizedMetafields,
          }),
        });
      }
    }
  } catch (error) {
    console.error("[product-generate] normalization/update error", error);
  }

  return Response.json(data);
}
