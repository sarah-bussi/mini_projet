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

function normativeTarget(productType: string, technology: string) {
  const tech = technology.toLowerCase();
  const mobileTech = ["flutter", "kotlin", "jetpack", "android", "ios", "swift", "react native"];
  return productType === "mobile" || mobileTech.some((item) => tech.includes(item)) ? "RAAM" : "RGAA";
}

function buildPrompt(mode: string, payload: Record<string, unknown>) {
  if (mode === "cv") {
    return `Adapte un CV à une offre sans inventer d'expérience, compétence, date ou résultat.\nPoste: ${payload.jobTitle || ""}\nEntreprise: ${payload.company || ""}\nOffre: ${payload.offer || ""}\nÀ mettre en avant: ${payload.focus || ""}\nBase factuelle autorisée: ${payload.facts || ""}\nRéponds en français avec: angle de candidature, résumé ciblé, compétences prioritaires, reformulations fondées uniquement sur les faits fournis, mots-clés à intégrer. Signale toute information manquante au lieu de l'inventer.`;
  }

  if (mode === "copilot") {
    const inputMode = String(payload.inputMode || "situation");
    const productType = String(payload.productType || "web");
    const technology = String(payload.technology || "");
    const role = String(payload.role || "Équipe produit");
    const target = normativeTarget(productType, technology);

    return `Tu es A11Y Copilot, prototype pédagogique de médiation normative en accessibilité numérique. Tu ne remplaces ni l'expertise humaine ni un audit et tu ne produis pas de verdict automatique de conformité.

Contexte déclaré :
- Mode d'entrée : ${inputMode}
- Produit : ${productType}
- Technologie / framework : ${technology}
- Métier / point de vue : ${role}
- Référentiel cible : ${target}
- Situation : ${payload.problem || ""}
- Détails / code : ${payload.details || ""}
- Informations déjà vérifiées : ${payload.verifiedFacts || ""}

Règles obligatoires :
1. Route le web vers le RGAA et le mobile vers le RAAM. React Native est mobile. Ne mélange pas les références RGAA et RAAM dans une même analyse sauf pour expliquer une différence de périmètre.
2. Distingue explicitement faits observés, hypothèses et vérifications encore nécessaires.
3. Une référence candidate n'est pas automatiquement applicable : ne cite un numéro précis que si le lien avec la situation est suffisamment solide. Sinon, indique qu'une vérification normative est nécessaire.
4. Ne présente jamais une recommandation de code ou d'API framework comme une exigence normative si elle n'est pas directement décrite par le référentiel.
5. N'invente jamais une propriété, API, composant ou comportement d'un framework par analogie. Si l'API exacte est incertaine, décris le mécanisme attendu et recommande la documentation officielle.
6. Pour une capture/maquette, limite-toi aux éléments observables visuellement. Ne conclus pas sur le focus réel, le nom accessible programmatique, les annonces lecteur d'écran ou le comportement dynamique.
7. Pour du code, tiens compte de la technologie déclarée et précise ce qui ne peut pas être conclu sans exécution ou test avec technologie d'assistance.
8. La validation humaine finale est obligatoire.

Réponds en français en EXACTEMENT huit sections numérotées :
1. Diagnostic
2. Références retenues
3. Références écartées ou secondaires
4. Impact utilisateur
5. Correction proposée
6. Comment vérifier
7. Informations manquantes
8. Limites et validation humaine

Dans "Références retenues", indique le référentiel utilisé (${target}) et explique brièvement pourquoi chaque référence est retenue. Dans "Références écartées ou secondaires", montre au moins les pistes proches mais non retenues si elles existent. Dans "Correction proposée", sépare exigence normative et recommandation technique. Reste pédagogique, traçable et prudent.`;
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
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content: "Tu es un copilote pédagogique d'accessibilité. Ne fabrique jamais une référence normative ou une API technique. Privilégie l'incertitude explicite à une affirmation non vérifiée.",
        },
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
