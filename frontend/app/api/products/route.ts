export async function GET() {
  
  // const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const baseUrl = process.env.WEBHOOK_URL;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  const res = await fetch(`${baseUrl}/products`, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    return Response.json(
      { error: "Failed to fetch from n8n", status: res.status, body },
      { status: 502 }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
