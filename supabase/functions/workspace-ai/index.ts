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

function mapRole(value: unknown) {
  const role = String(value || "").toLowerCase();
  if (role.includes("design")) return "designer";
  if (role.includes("dev")) return "developer";
  return "qa";
}

function mapOutputType(value: unknown) {
  const output = String(value || "");
  if (["handoff", "technical_fix", "test_scenario"].includes(output)) return output;
  return "test_scenario";
}

function formatRealCopilotResult(data: any) {
  const refs = Array.isArray(data?.retained_references) && data.retained_references.length
    ? data.retained_references.join(", ")
    : (data?.normative_reference || "Aucune référence retenue avec certitude");
  const assumptions = Array.isArray(data?.assumptions) && data.assumptions.length
    ? data.assumptions.map((item: string) => `- ${item}`).join("\n")
    : "- Aucune hypothèse explicitée.";
  const sources = Array.isArray(data?.sources) && data.sources.length
    ? data.sources.map((source: any) => `- ${source.document || source.source_type || "Source"} · ${source.reference || "référence non précisée"}${source.verified ? " · vérifiée" : ""}`).join("\n")
    : "- Aucune source retournée.";

  return `1. Diagnostic\n${data?.problem_summary || ""}\n\n2. Références retenues\nRéférentiel : ${data?.normative_standard || ""}\n${refs}\n${sources}\n\n3. Références écartées ou secondaires\n${assumptions}\n\n4. Impact utilisateur\n${data?.impact || ""}\n\n5. Correction proposée\n${data?.recommendation || ""}\nStatut : ${data?.recommendation_status || ""}\n\n6. Comment vérifier\n${data?.verification || ""}\n\n7. Informations manquantes\nConfiance documentaire : ${data?.confidence ?? "non renseignée"}\nConfiance d’observation : ${data?.observation_confidence || "non renseignée"}\nÉvidence normative : ${data?.normative_evidence || "non renseignée"}\n\n8. Limites et validation humaine\nValidation humaine requise : ${data?.human_validation_required === false ? "non" : "oui"}.\nGarde-fou : ${data?.guardrail_status || "non renseigné"}.`;
}

async function callRealCopilot(payload: Record<string, unknown>) {
  const backendUrl = (Deno.env.get("A11Y_BACKEND_URL") || "").replace(/\/$/, "");
  if (!backendUrl) return null;
  const backendKey = Deno.env.get("A11Y_BACKEND_KEY") || "";

  const inputMode = String(payload.inputMode || "situation");
  const details = String(payload.details || "");
  const verifiedFacts = String(payload.verifiedFacts || "");
  const context = [details, verifiedFacts ? `Informations déjà vérifiées : ${verifiedFacts}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const requestBody = {
    role: mapRole(payload.role),
    component: String(payload.component || payload.technology || "Composant à analyser"),
    context: context || null,
    technology: String(payload.technology || "") || null,
    problem: String(payload.problem || ""),
    output_type: mapOutputType(payload.outputType),
    input_mode: inputMode,
    code: inputMode === "code" ? details || null : null,
    language: "fr",
    screenshot_data_url: null,
    screenshot_name: null,
  };

  const response = await fetch(`${backendUrl}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(backendKey ? { "X-Workspace-Key": backendKey } : {}),
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("A11Y backend error", response.status, data);
    return json({ error: "a11y_backend_error", details: data }, 502);
  }

  return json({ text: formatRealCopilotResult(data), engine: "a11y-copilot-retrieval", raw: data });
}

function buildPrompt(mode: string, payload: Record<string, unknown>) {
  if (mode === "cv") {
    return `Adapte un CV à une offre sans inventer d'expérience, compétence, date ou résultat.\nPoste: ${payload.jobTitle || ""}\nEntreprise: ${payload.company || ""}\nOffre: ${payload.offer || ""}\nÀ mettre en avant: ${payload.focus || ""}\nBase factuelle autorisée: ${payload.facts || ""}\nRéponds en français avec: angle de candidature, résumé ciblé, compétences prioritaires, reformulations fondées uniquement sur les faits fournis, mots-clés à intégrer. Signale toute information manquante au lieu de l'inventer.`;
  }
  if (mode === "copilot") {
    return `Le backend expérimental A11Y Copilot n'est pas configuré. Analyse prudemment ce problème d'accessibilité sans inventer de référence normative.\nSituation: ${payload.problem || ""}\nTechnologie: ${payload.technology || ""}\nDétails: ${payload.details || ""}\nRéponds en huit sections : Diagnostic, Références retenues, Références écartées ou secondaires, Impact utilisateur, Correction proposée, Comment vérifier, Informations manquantes, Limites et validation humaine.`;
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

  const body = await request.json().catch(() => ({}));
  const mode = String(body.mode || "");
  const payload = body.payload || {};

  if (mode === "copilot") {
    const realResult = await callRealCopilot(payload);
    if (realResult) return realResult;
  }

  const apiKey = Deno.env.get("AI_API_KEY") || "";
  const model = Deno.env.get("AI_MODEL") || "openai/gpt-oss-20b";
  if (!apiKey) return json({ error: "ai_not_configured" }, 503);

  const prompt = buildPrompt(mode, payload);
  if (!prompt) return json({ error: "unsupported_mode" }, 400);

  const provider = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      messages: [
        { role: "system", content: "Réponds de façon structurée et n'invente pas de faits, références ou expériences." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await provider.json().catch(() => ({}));
  if (!provider.ok) return json({ error: "ai_provider_error" }, 502);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) return json({ error: "empty_ai_response" }, 502);
  return json({ text, model, engine: mode === "copilot" ? "llm-fallback" : "groq" });
});
