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

async function groqChat(apiKey: string, model: string, messages: Array<{role: string; content: string}>, jsonMode = false) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.12,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`groq_${response.status}`);
  return String(data?.choices?.[0]?.message?.content || "").trim();
}

function baseSearchQuery(payload: Record<string, unknown>) {
  return [payload.component, payload.problem, payload.details, payload.verifiedFacts, payload.technology]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 3500);
}

async function expandSearchQuery(apiKey: string, model: string, payload: Record<string, unknown>, standard: string) {
  const base = baseSearchQuery(payload);
  if (!base) return "accessibilité";
  try {
    const text = await groqChat(apiKey, model, [
      {
        role: "system",
        content: "Tu prépares uniquement une requête de recherche documentaire. Retourne une seule ligne courte de mots et expressions utiles, sans référence normative, sans explication, sans markdown.",
      },
      {
        role: "user",
        content: `Référentiel: ${standard}\nTechnologie: ${payload.technology || ""}\nComposant: ${payload.component || ""}\nSituation: ${payload.problem || ""}\nDétails: ${payload.details || ""}`,
      },
    ]);
    return `${base} ${text}`.slice(0, 5000);
  } catch {
    return base;
  }
}

async function retrieveCorpus(standard: string, query: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) throw new Error("supabase_service_missing");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/search_workspace_a11y`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_standard: standard, p_query: query, p_limit: 10 }),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(`retrieval_${response.status}`);
  return Array.isArray(data) ? data : [];
}

function candidateContext(candidates: any[]) {
  return candidates.slice(0, 10).map((item, index) => ({
    rank: index + 1,
    reference: String(item.reference || ""),
    type: String(item.reference_type || ""),
    document: String(item.document || ""),
    page: item.page ?? null,
    score: Number(item.score || 0),
    content: String(item.content || "").slice(0, 1800),
  }));
}

function safeReferences(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({ reference: String(item?.reference || "").trim(), reason: String(item?.reason || "").trim() }))
    .filter((item) => item.reference && allowed.has(item.reference));
}

function formatGroundedResult(result: any, standard: string, candidates: any[]) {
  const allowed = new Set(candidates.map((item) => String(item.reference || "")));
  const retained = safeReferences(result?.retainedReferences, allowed);
  const secondary = safeReferences(result?.secondaryReferences, allowed);
  const retainedText = retained.length
    ? retained.map((item) => `- ${standard} ${item.reference} — ${item.reason || "référence retenue"}`).join("\n")
    : `Aucune référence ${standard} retenue avec suffisamment de certitude.`;
  const secondaryText = secondary.length
    ? secondary.map((item) => `- ${standard} ${item.reference} — ${item.reason || "piste secondaire"}`).join("\n")
    : "Aucune référence secondaire retenue.";

  return `1. Diagnostic\n${result?.diagnostic || "Analyse insuffisante."}\n\n2. Références retenues\n${retainedText}\n\n3. Références écartées ou secondaires\n${secondaryText}\n\n4. Impact utilisateur\n${result?.userImpact || "À vérifier avec les usages et technologies d’assistance concernés."}\n\n5. Correction proposée\nExigence / objectif normatif :\n${result?.normativeRequirement || "À confirmer à partir des références retenues."}\n\nRecommandation technique :\n${result?.technicalRecommendation || "Aucune recommandation technique fiable sans contexte supplémentaire."}\n\n6. Comment vérifier\n${result?.verification || "Prévoir une vérification humaine et des tests adaptés."}\n\n7. Informations manquantes\n${result?.missingInformation || "Aucune information manquante explicitée."}\n\n8. Limites et validation humaine\n${result?.limits || "Cette analyse ne constitue pas un verdict de conformité."}\nValidation humaine obligatoire.\nNiveau de confiance : ${result?.confidence || "non renseigné"}.`;
}

async function runWorkspaceCopilot(apiKey: string, model: string, payload: Record<string, unknown>) {
  const standard = normativeTarget(String(payload.productType || "web"), String(payload.technology || ""));
  const searchQuery = await expandSearchQuery(apiKey, model, payload, standard);
  const candidates = await retrieveCorpus(standard, searchQuery);

  if (!candidates.length) {
    return {
      text: `1. Diagnostic\nLe corpus ${standard} du workspace n’a retourné aucune référence suffisamment proche.\n\n2. Références retenues\nAucune.\n\n3. Références écartées ou secondaires\nAucune.\n\n4. Impact utilisateur\nÀ déterminer après clarification de la situation.\n\n5. Correction proposée\nAucune correction normative proposée sans référence documentaire.\n\n6. Comment vérifier\nReformuler la situation, préciser le composant et les comportements observés, puis relancer la recherche.\n\n7. Informations manquantes\nContexte technique et comportement observé à préciser.\n\n8. Limites et validation humaine\nAucun verdict de conformité. Validation humaine obligatoire.`,
      engine: "workspace-post-evaluation-retrieval",
      standard,
      candidates: [],
    };
  }

  const context = candidateContext(candidates);
  const prompt = {
    productType: payload.productType || "web",
    technology: payload.technology || "",
    role: payload.role || "",
    outputType: payload.outputType || "test_scenario",
    inputMode: payload.inputMode || "situation",
    component: payload.component || "",
    problem: payload.problem || "",
    details: payload.details || "",
    verifiedFacts: payload.verifiedFacts || "",
    normativeStandard: standard,
    retrievedCandidates: context,
  };

  const content = await groqChat(apiKey, model, [
    {
      role: "system",
      content: `Tu es la version workspace post-évaluation d’A11Y Copilot. Tu dois rester entièrement ancré dans les références documentaires fournies. Tu ne dois JAMAIS inventer une référence ${standard}, une API de framework ou un fait non fourni. Une référence présente dans les candidats n’est pas automatiquement applicable. Distingue exigence normative et recommandation technique. Pour une capture, ne conclus pas sur des propriétés non observables visuellement. La validation humaine est toujours obligatoire. Réponds UNIQUEMENT en JSON valide avec exactement les clés: diagnostic, retainedReferences, secondaryReferences, userImpact, normativeRequirement, technicalRecommendation, verification, missingInformation, limits, confidence. retainedReferences et secondaryReferences sont des tableaux d’objets {reference, reason}; chaque reference doit provenir exactement des candidats fournis. confidence vaut Faible, Moyen ou Élevé.`,
    },
    { role: "user", content: JSON.stringify(prompt) },
  ], true);

  const result = JSON.parse(content);
  return {
    text: formatGroundedResult(result, standard, candidates),
    engine: "workspace-post-evaluation-retrieval",
    standard,
    searchQuery,
    candidates: context,
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadCvSource(source: string) {
  const file = source === "fr" ? "cv.html" : "cv-en.html";
  const rawUrl = `https://raw.githubusercontent.com/sarah-bussi/mini_projet/main/${file}`;
  const response = await fetch(rawUrl, { headers: { "User-Agent": "workspace-ai" } });
  if (!response.ok) throw new Error(`cv_source_${response.status}`);
  const html = await response.text();
  return { file, text: stripHtml(html).slice(0, 30000) };
}

function buildCvPrompt(payload: Record<string, unknown>, cvText: string, cvFile: string) {
  const outputLanguage = String(payload.outputLanguage || "en") === "fr" ? "français" : "anglais";
  return `Tu adaptes un CV existant à une offre d'emploi. Ton objectif est d'optimiser la pertinence du CV SANS augmenter artificiellement le niveau d'expérience ou de responsabilité.\n\nCV source: ${cvFile}\nCONTENU FACTUEL DU CV SOURCE:\n${cvText}\n\nOFFRE CIBLE:\nPoste: ${payload.jobTitle || ""}\nEntreprise: ${payload.company || ""}\nDescription: ${payload.offer || ""}\nÉléments à mettre en avant: ${payload.focus || ""}\nLangue de sortie: ${outputLanguage}.\n\nRÈGLES DE FIDÉLITÉ — PRIORITÉ ABSOLUE:\n- Chaque compétence, outil, technologie, responsabilité, méthode, résultat, niveau d'autonomie et contexte mentionné dans la proposition doit être explicitement démontré dans le CV source.\n- Tu peux condenser, réordonner et reformuler un fait existant, mais tu ne peux ni l'élargir ni l'intensifier.\n- N'utilise jamais des verbes ou titres qui augmentent le niveau de responsabilité. Exemples interdits sauf preuve explicite dans le CV: lead, led, own, owned, drive, drove, spearhead, manage, managed, oversee, expert, specialist, senior.\n- Ne transforme jamais une work-study placement, alternance, stage ou projet académique en poste d'ingénieur, internship de software engineering ou expérience équivalente si ce libellé n'existe pas dans la source.\n- Ne déduis jamais une compétence à partir d'une compétence voisine. Un outil, framework, technologie ou méthode doit apparaître explicitement dans le CV pour être utilisé comme mot-clé ATS.\n- Une qualité comportementale ne peut être présentée comme compétence acquise que si un fait du CV la démontre explicitement. Sinon, place-la dans les écarts ou formule-la comme élément à vérifier.\n- Conserve exactement les employeurs, intitulés contractuels et dates lorsqu'ils sont donnés. Un titre professionnel recommandé peut être proposé séparément, mais ne doit jamais remplacer rétroactivement les intitulés des expériences.\n- Si l'offre demande quelque chose qui n'est pas démontré, écris-le uniquement dans \"Écarts à ne pas inventer\".\n- N'affirme jamais \"proven ability\", \"strong stakeholder management\", \"global team experience\", \"tight-deadline experience\", \"software engineering experience\" ou équivalent sans preuve textuelle explicite.\n- Pour chaque reformulation d'expérience, reste au même niveau de responsabilité que la phrase source.\n- Si tu hésites entre une formulation plus attractive et une formulation plus fidèle, choisis toujours la formulation la plus fidèle.\n\nAUTO-CONTROLE AVANT RÉPONSE:\n1. Vérifie chaque nouveau mot-clé contre le CV source.\n2. Supprime toute affirmation qui ne peut pas être reliée à un passage explicite du CV source.\n3. Vérifie qu'aucun verbe n'a augmenté le niveau de responsabilité.\n4. Vérifie que le résumé ne contient aucune qualité ou expérience absente de la source.\n\nRéponds avec les sections suivantes:\n1. Verdict d'adéquation\n2. Titre professionnel recommandé\n3. Résumé professionnel ciblé\n4. Compétences à remonter en priorité\n5. Expériences à réordonner et reformulations proposées\n6. Projets / formation à mettre en avant\n7. Mots-clés ATS justifiés — pour chaque mot-clé, indique brièvement le fait source qui le justifie\n8. Écarts à ne pas inventer\n9. Version finale du contenu du CV, prête à réinjecter dans le template existant.\n\nImportant: la section 9 doit être un CV directement exploitable, pas une analyse. N'ajoute aucune information absente du CV source.`;
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
  const mode = String(body.mode || "");
  const payload = body.payload || {};

  try {
    if (mode === "copilot") {
      return json(await runWorkspaceCopilot(apiKey, model, payload));
    }
    if (mode === "cv") {
      const source = String(payload.cvSource || "en") === "fr" ? "fr" : "en";
      const cv = await loadCvSource(source);
      const text = await groqChat(apiKey, model, [
        { role: "system", content: "Tu es un éditeur de CV conservateur et strictement factuel. Tu peux optimiser l'ordre et la formulation, mais jamais augmenter le niveau de responsabilité, inventer une compétence ou transformer une expérience en quelque chose qu'elle n'est pas. Toute affirmation doit être démontrable mot pour mot ou par équivalence directe dans le CV source." },
        { role: "user", content: buildCvPrompt(payload, cv.text, cv.file) },
      ]);
      return json({ text, model, engine: "groq", source: cv.file });
    }
    return json({ error: "unsupported_mode" }, 400);
  } catch (error) {
    console.error("workspace-ai", error);
    return json({ error: "workspace_ai_failed", detail: String(error?.message || error) }, 502);
  }
});
