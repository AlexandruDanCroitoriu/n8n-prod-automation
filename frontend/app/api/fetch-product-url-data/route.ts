export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const baseUrl = process.env.WEBHOOK_URL;
  // const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  const url = new URL(`${baseUrl}/fetch-product-url-data`);
  searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json(
      { error: "Failed to fetch product data", status: res.status, body: text },
      { status: 502 }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
