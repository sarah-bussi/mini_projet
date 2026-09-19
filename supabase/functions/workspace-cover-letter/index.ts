const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}

async function getUser(token: string) {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL") || ""}/auth/v1/user`, {
    headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
}

function clip(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function extractText(data: any) {
  return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => String(p?.text || "")).join("").trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing_session" }, 401);
  const user = await getUser(token);
  if (!user?.id) return json({ error: "forbidden" }, 403);

  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  if (!apiKey) return json({ error: "gemini_not_configured" }, 503);
  const configured = (Deno.env.get("GEMINI_MODEL") || "").trim();
  const model = configured && !["gemini-2.5-flash", "gemini-3.5-flash"].includes(configured) ? configured : "gemini-3.6-flash";

  const payload = await request.json().catch(() => ({}));
  const toneMap: Record<string,string> = {
    natural: "naturel, professionnel, fluide et personnel, sans emphase artificielle",
    institutional: "institutionnel, précis et professionnel",
    formal: "très formel, sobre et administratif",
  };
  const lengthMap: Record<string,string> = { short: "350 à 450 mots", standard: "500 à 650 mots", developed: "650 à 800 mots" };

  const prompt = `Rédige une lettre de motivation en ${payload.outputLanguage === "en" ? "anglais" : "français"} pour Sarah Bussi.

POSTE: ${clip(payload.jobTitle, 180)}
ORGANISME: ${clip(payload.company, 180)}
OFFRE: ${clip(payload.offer, 6000)}

CV ADAPTÉ VALIDÉ PAR LA CANDIDATE — SOURCE DE VÉRITÉ:
${clip(payload.cvText, 8500)}

PRIORITÉS / FAITS COMPLÉMENTAIRES FOURNIS PAR LA CANDIDATE:
${clip(payload.cvFocus, 4500)}

ÉLÉMENTS PARTICULIERS POUR LA LETTRE:
${clip(payload.letterFocus, 2000)}

STYLE: ${toneMap[String(payload.tone)] || toneMap.natural}
LONGUEUR: ${lengthMap[String(payload.length)] || lengthMap.standard}

RÈGLES:
- Utilise uniquement les faits présents dans le CV adapté ou explicitement fournis dans les champs de contexte. N'invente aucun niveau, résultat, responsabilité, motivation biographique ou expérience.
- La lettre doit compléter le CV, pas le paraphraser ligne par ligne.
- Construis une progression: formation/profil -> expérience professionnelle pertinente -> mémoire/projets pertinents -> adéquation avec les missions -> motivation spécifique -> conclusion.
- Explique les compétences transférables par des faits concrets.
- Évite les clichés comme "passionnée depuis toujours", "profil idéal", "candidate parfaite", ainsi que les superlatifs non démontrés.
- Ne transforme pas une alternance, un stage ou un projet académique en emploi permanent.
- Pour A11y Copilot, si le CV parle d'évaluation auprès de professionnels, n'écris pas "tests utilisateurs".
- Ne mets pas d'adresse postale inventée, de date inventée ni d'objet si ces informations ne sont pas fournies.
- Commence par "Madame, Monsieur," (ou "Dear Sir or Madam," en anglais) et termine par une formule de politesse adaptée puis "Sarah Bussi".
- Retourne uniquement la lettre, sans markdown, sans titre ni commentaire.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 3000 },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(data?.error?.message || "").slice(0, 400);
      return json({ error: `gemini_${response.status}${message ? `:${message}` : ""}` }, response.status === 429 ? 429 : 502);
    }
    const letter = extractText(data);
    if (!letter) return json({ error: "empty_letter_response" }, 502);
    return json({ letter, model, engine: "gemini-cover-letter-v1" });
  } catch (error) {
    return json({ error: `cover_letter_failed:${String((error as Error)?.message || error).slice(0,400)}` }, 502);
  }
});