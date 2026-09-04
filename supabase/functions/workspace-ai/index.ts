const ALLOWED_USER_ID = "c5a95986-040d-4a09-be72-3ef497c65fc9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function getUser(token: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

function buildPrompt(mode: string, payload: Record<string, unknown>) {
  if (mode === "cv") {
    return `Adapte un CV à une offre sans inventer d'expérience, compétence, date ou résultat.\nPoste: ${payload.jobTitle || ""}\nEntreprise: ${payload.company || ""}\nOffre: ${payload.offer || ""}\nÀ mettre en avant: ${payload.focus || ""}\nBase factuelle autorisée: ${payload.facts || ""}\nRéponds en français avec: angle de candidature, résumé ciblé, compétences prioritaires, reformulations fondées uniquement sur les faits fournis, mots-clés à intégrer. Signale toute information manquante au lieu de l'inventer.`;
  }
  if (mode === "copilot") {
    return `Analyse ce problème d'accessibilité numérique. Distingue faits, hypothèses et vérifications. N'affirme pas une conformité globale à partir d'une seule description.\nContexte: ${payload.context || ""}\nRéférentiel: ${payload.standard || ""}\nProblème: ${payload.problem || ""}\nDétails: ${payload.details || ""}\nRéponds en français avec: diagnostic, critères potentiellement concernés, tests à effectuer, corrections proposées, limites, niveau de confiance. Ne cite un numéro RGAA/WCAG précis que si tu es suffisamment certain.`;
  }
  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing_session" }, 401);

  const user = await getUser(token);
  if (!user?.id || user.id !== ALLOWED_USER_ID) return json({ error: "forbidden" }, 403);

  const apiKey = Deno.env.get("AI_API_KEY") || "";
  const model = Deno.env.get("AI_MODEL") || "openai/gpt-oss-20b";
  if (!apiKey) return json({ error: "ai_not_configured" }, 503);

  const body = await request.json().catch(() => ({}));
  const prompt = buildPrompt(body.mode || "", body.payload || {});
  if (!prompt) return json({ error: "unsupported_mode" }, 400);

  const provider = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Réponds de façon structurée, concise et professionnelle." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await provider.json().catch(() => ({}));
  if (!provider.ok) return json({ error: "ai_provider_error" }, 502);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) return json({ error: "empty_ai_response" }, 502);
  return json({ text, model });
});
