function getAuth() {
  const baseUrl = process.env.WEBHOOK_URL;
//   const baseUrl = process.env.WEBHOOK_URL_DEBUG;
  const username = process.env.N8N_WEBHOOK_USERNAME;
  const password = process.env.N8N_WEBHOOK_PASSWORD;
  return { baseUrl, username, password };
}

export async function GET() {
  const { baseUrl, username, password } = getAuth();

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  console.log("[prompt] GET request -> POST to n8n with method=get");

  const res = await fetch(`${baseUrl}/prompt`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method: "get" }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[prompt] GET error", res.status, text);
    return Response.json(
      { error: "Failed to fetch prompts", status: res.status, body: text },
      { status: 502 }
    );
  }

  const data = await res.json();
  console.log("[prompt] GET response", data);
  return Response.json(data);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { baseUrl, username, password } = getAuth();

  if (!baseUrl || !username || !password) {
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");

  const res = await fetch(`${baseUrl}/prompt`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method: "update", ...body }),
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json(
      { error: "Failed to update prompt", status: res.status, body: text },
      { status: 502 }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
