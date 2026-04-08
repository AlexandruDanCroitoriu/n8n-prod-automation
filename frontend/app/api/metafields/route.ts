export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const baseUrl = process.env.WEBHOOK_URL;
//   const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  console.log("[metafields] POST request", body);

  const res = await fetch(`${baseUrl}/metafields`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method: "get", ...body }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[metafields] POST error", res.status, text);
    return Response.json(
      { error: "Failed to fetch metafields", status: res.status, body: text },
      { status: 502 }
    );
  }

  const data = await res.json();
  console.log("[metafields] POST response", data);
  return Response.json(data);
}
