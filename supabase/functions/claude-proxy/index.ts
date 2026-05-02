// supabase/functions/claude-proxy/index.ts
//
// Proxy seguro entre Victoria (perrosdelaisla.github.io) y la API de Claude.
// La API key vive como secret de Supabase (ANTHROPIC_API_KEY), nunca en el repo.

import "@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGIN = "https://perrosdelaisla.github.io";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // 1. Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Origin estricto
  const origin = req.headers.get("origin") ?? "";
  if (origin !== ALLOWED_ORIGIN) {
    return jsonResponse({ error: "Origen no permitido" }, 403);
  }

  // 3. Solo POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  // 4. API key configurada
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY no configurada en el entorno");
    return jsonResponse({ error: "Configuracion del servidor incompleta" }, 500);
  }

  // 5. Body JSON con `text`
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalido" }, 400);
  }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return jsonResponse({ error: "Falta el campo 'text' (string no vacio)" }, 400);
  }

  // 6. Llamada a Claude
  let claudeRes: Response;
  try {
    claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: text }],
      }),
    });
  } catch (err) {
    console.error("Error de red al llamar a Claude API:", err);
    return jsonResponse({ error: "Error de red al contactar la API" }, 502);
  }

  if (!claudeRes.ok) {
    const errBody = await claudeRes.text();
    console.error(`Claude API error ${claudeRes.status}:`, errBody);
    // 401/403 → no exponemos detalles (problema de config nuestro)
    if (claudeRes.status === 401 || claudeRes.status === 403) {
      return jsonResponse({ error: "Configuracion del servidor invalida" }, 500);
    }
    // 429 → propagamos rate limit
    if (claudeRes.status === 429) {
      return jsonResponse({ error: "Demasiadas peticiones, intenta en unos segundos" }, 429);
    }
    // resto → 502
    return jsonResponse({ error: "Error de la API upstream", status: claudeRes.status }, 502);
  }

  const data = await claudeRes.json();
  const reply = Array.isArray(data?.content)
    ? data.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
    : "";

  return jsonResponse({
    reply,
    model: data.model,
    stop_reason: data.stop_reason,
    usage: data.usage,
  });
});
