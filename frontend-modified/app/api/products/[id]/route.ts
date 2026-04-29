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

function parseMaybeJson(value: unknown) {
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

function normalizeMetafields(value: unknown) {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const namespace = typeof record.namespace === "string" ? record.namespace : "custom";
    const key = typeof record.key === "string" ? record.key : "";
    if (!key) {
      return [];
    }

    return [{
      namespace,
      key,
      type: typeof record.type === "string" ? record.type : "single_line_text_field",
      value: String(record.value ?? ""),
    }];
  });
}

function normalizeProductPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const normalized = { ...(payload as Record<string, unknown>) };
  const metafields = normalizeMetafields(normalized.metafields);

  normalized.metafields = metafields;
  for (const field of metafields) {
    normalized[field.key] = field.value;
    normalized[`${field.namespace}.${field.key}`] = field.value;
  }

  normalized.images = normalizeImages(normalized.images);
  return normalized;
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

  const data = await res.json();

  if (Array.isArray(data)) {
    return Response.json(data.map(normalizeProductPayload));
  }

  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown[] }).data)) {
    return Response.json({
      ...(data as Record<string, unknown>),
      data: ((data as { data: unknown[] }).data).map(normalizeProductPayload),
    });
  }

  return Response.json(normalizeProductPayload(data));
}

