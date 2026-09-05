declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

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
      temperature: 0.05,
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
        content: "Tu prépares uniquement une requête de recherche documentaire. Retourne une seule ligne courte de mots et expressions utiles, sans référence normative, sans numéro de critère, sans explication, sans markdown.",
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
    title: String(item.title || ""),
    document: String(item.document || ""),
    page: item.page ?? null,
    score: Number(item.score || 0),
    content: String(item.content || "").slice(0, 1800),
  }));
}

type CandidateDecision = "APPLICABLE" | "SECONDARY" | "NOT_APPLICABLE";

type CandidateAssessment = {
  reference: string;
  decision: CandidateDecision;
  reason: string;
  missingPrecondition: string;
  support: string;
};

function normalizeCandidateAssessments(value: unknown, candidates: any[]): CandidateAssessment[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(candidates.map((item) => String(item.reference || "")));
  const validDecisions = new Set<CandidateDecision>(["APPLICABLE", "SECONDARY", "NOT_APPLICABLE"]);
  const seen = new Set<string>();
  const normalized: CandidateAssessment[] = [];

  for (const item of value) {
    const reference = String(item?.reference || "").trim();
    const decision = String(item?.decision || "").trim().toUpperCase() as CandidateDecision;
    if (!reference || !allowed.has(reference) || !validDecisions.has(decision) || seen.has(reference)) continue;
    seen.add(reference);
    normalized.push({
      reference,
      decision,
      reason: String(item?.reason || "").trim(),
      missingPrecondition: String(item?.missingPrecondition || "").trim(),
      support: String(item?.support || "").trim(),
    });
  }

  return normalized;
}

function scopedCandidates(context: any[], assessments: CandidateAssessment[], decision: CandidateDecision) {
  const refs = new Set(assessments.filter((item) => item.decision === decision).map((item) => item.reference));
  return context.filter((item) => refs.has(String(item.reference || "")));
}

function formatGroundedResult(result: any, standard: string, assessments: CandidateAssessment[]) {
  const retained = assessments.filter((item) => item.decision === "APPLICABLE");
  const secondary = assessments.filter((item) => item.decision === "SECONDARY");
  const rejected = assessments.filter((item) => item.decision === "NOT_APPLICABLE");

  const retainedText = retained.length
    ? retained.map((item) => `- ${standard} ${item.reference} — ${item.reason || "référence applicable"}`).join("\n")
    : `Aucune référence ${standard} suffisamment étayée dans les candidats récupérés.`;

  const secondaryLines = [
    ...secondary.map((item) => `- ${standard} ${item.reference} — ${item.reason || "piste secondaire"}${item.missingPrecondition ? ` Précondition à confirmer : ${item.missingPrecondition}` : ""}`),
    ...rejected.map((item) => `- ${standard} ${item.reference} écartée — ${item.reason || "préconditions non établies"}`),
  ];

  const secondaryText = secondaryLines.length
    ? secondaryLines.join("\n")
    : "Aucune référence secondaire ou écartée renseignée.";

  const normativeRequirement = retained.length
    ? result?.normativeRequirement || "À confirmer strictement à partir des références applicables retenues."
    : "Aucune exigence normative attribuée : les candidats récupérés ne suffisent pas à étayer une référence applicable avec certitude.";

  return `1. Diagnostic\n${result?.diagnostic || "Analyse insuffisante."}\n\n2. Références retenues\n${retainedText}\n\n3. Références écartées ou secondaires\n${secondaryText}\n\n4. Impact utilisateur\n${result?.userImpact || "À vérifier avec les usages et technologies d’assistance concernés."}\n\n5. Correction proposée\nExigence / objectif normatif :\n${normativeRequirement}\n\nRecommandation technique :\n${result?.technicalRecommendation || "Aucune recommandation technique fiable sans contexte supplémentaire."}\n\n6. Comment vérifier\n${result?.verification || "Prévoir une vérification humaine et des tests adaptés."}\n\n7. Informations manquantes\n${result?.missingInformation || "Aucune information manquante explicitée."}\n\n8. Limites et validation humaine\n${result?.limits || "Cette analyse ne constitue pas un verdict de conformité."}\nValidation humaine obligatoire.\nNiveau de confiance : ${result?.confidence || "non renseigné"}.`;
}

async function judgeApplicability(apiKey: string, model: string, standard: string, payload: Record<string, unknown>, context: any[]) {
  const judgeInput = {
    productType: payload.productType || "web",
    technology: payload.technology || "",
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
      content: `Tu es uniquement un juge d'applicabilité documentaire pour ${standard}. Tu ne rédiges PAS le diagnostic final, PAS l'impact utilisateur, PAS la correction.

Ta seule tâche est d'évaluer les candidats fournis à partir de leurs champs reference, title et content et des faits du cas.

Règles obligatoires :
- Une similarité lexicale ne suffit jamais à rendre une référence applicable.
- N'invente jamais le sens d'un critère ou test.
- N'attribue jamais à une référence une exigence absente de son title/content.
- Les faits de verifiedFacts ont priorité sur toute inférence.
- Respecte les préconditions du candidat et distingue strictement ABSENCE, PRÉSENCE et PERTINENCE/QUALITÉ d'une propriété.
- Si une précondition nécessaire n'est pas établie, classe SECONDARY ou NOT_APPLICABLE, jamais APPLICABLE.
- Si un candidat traite d'un autre type de composant ou d'une autre condition, classe NOT_APPLICABLE.
- Pour RGAA, les numéros WCAG présents dans le contenu sont des mappings externes et ne sont jamais des références RGAA.

Décisions autorisées :
APPLICABLE = le texte documentaire couvre directement le problème et toutes ses préconditions sont établies par les faits.
SECONDARY = le candidat peut devenir pertinent mais une précondition importante reste à vérifier, ou il est seulement connexe.
NOT_APPLICABLE = le contenu documentaire ne couvre pas le problème observé ou ses préconditions sont absentes/contredites.

Réponds UNIQUEMENT en JSON valide avec exactement la clé assessments, tableau d'objets :
{reference, decision, reason, missingPrecondition, support}
- reference : valeur exacte d'un candidat ;
- decision : APPLICABLE, SECONDARY ou NOT_APPLICABLE ;
- reason : justification courte par rapport aux faits ;
- missingPrecondition : précondition manquante, chaîne vide si aucune ;
- support : paraphrase fidèle de ce que title/content permet réellement d'affirmer.
Évalue les candidats utiles, notamment tous ceux que tu serais tenté de retenir.`,
    },
    { role: "user", content: JSON.stringify(judgeInput) },
  ], true);

  const parsed = JSON.parse(content);
  return normalizeCandidateAssessments(parsed?.assessments, context);
}

async function generateGroundedAnswer(apiKey: string, model: string, standard: string, payload: Record<string, unknown>, applicable: any[], secondary: any[], assessments: CandidateAssessment[]) {
  const generationInput = {
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
    applicableReferences: applicable,
    secondaryReferences: secondary,
    applicabilityAssessments: assessments,
  };

  const content = await groqChat(apiKey, model, [
    {
      role: "system",
      content: `Tu rédiges la réponse finale d'A11Y Copilot à partir d'un jugement d'applicabilité déjà effectué.

Règles absolues :
- Tu peux attribuer une exigence normative UNIQUEMENT aux références présentes dans applicableReferences.
- Les références NOT_APPLICABLE ne te sont pas fournies comme contenu documentaire et ne doivent jamais devenir des références retenues.
- Les références secondaryReferences doivent rester secondaires et ne peuvent pas être présentées comme exigence certaine tant que leur précondition manque.
- Si applicableReferences est vide, écris qu'aucune référence ${standard} suffisamment étayée n'a été trouvée et n'invente aucun rattachement normatif.
- N'invente jamais le contenu d'un critère ou test.
- Les faits de verifiedFacts ont priorité sur toute inférence.
- Une conséquence utilisateur ne doit jamais contredire les faits vérifiés.
- Si un élément est déclaré focusable et activable au clavier, ne dis jamais que son activation ou l'action est impossible au clavier.
- Distingue toujours identification/compréhension, opérabilité, focus, nom accessible et autres dimensions.
- Une recommandation technique peut proposer une solution possible, mais ne doit pas être présentée comme imposée par le référentiel si le texte documentaire ne l'impose pas.
- Pour une capture, ne conclus pas sur des propriétés non observables visuellement.
- La validation humaine reste obligatoire.

Réponds UNIQUEMENT en JSON valide avec exactement les clés : diagnostic, userImpact, normativeRequirement, technicalRecommendation, verification, missingInformation, limits, confidence.
confidence vaut Faible, Moyen ou Élevé.`,
    },
    { role: "user", content: JSON.stringify(generationInput) },
  ], true);

  return JSON.parse(content);
}

async function runWorkspaceCopilot(apiKey: string, model: string, payload: Record<string, unknown>) {
  const standard = normativeTarget(String(payload.productType || "web"), String(payload.technology || ""));
  const searchQuery = await expandSearchQuery(apiKey, model, payload, standard);
  const candidates = await retrieveCorpus(standard, searchQuery);

  if (!candidates.length) {
    return {
      text: `1. Diagnostic\nLe corpus ${standard} du workspace n’a retourné aucune référence suffisamment proche.\n\n2. Références retenues\nAucune.\n\n3. Références écartées ou secondaires\nAucune.\n\n4. Impact utilisateur\nÀ déterminer après clarification de la situation.\n\n5. Correction proposée\nAucune correction normative proposée sans référence documentaire.\n\n6. Comment vérifier\nReformuler la situation, préciser le composant et les comportements observés, puis relancer la recherche.\n\n7. Informations manquantes\nContexte technique et comportement observé à préciser.\n\n8. Limites et validation humaine\nAucun verdict de conformité. Validation humaine obligatoire.`,
      engine: "workspace-post-evaluation-two-pass",
      standard,
      candidates: [],
      candidateAssessments: [],
    };
  }

  const context = candidateContext(candidates);
  const assessments = await judgeApplicability(apiKey, model, standard, payload, context);
  const applicable = scopedCandidates(context, assessments, "APPLICABLE");
  const secondary = scopedCandidates(context, assessments, "SECONDARY");
  const result = await generateGroundedAnswer(apiKey, model, standard, payload, applicable, secondary, assessments);

  return {
    text: formatGroundedResult(result, standard, assessments),
    engine: "workspace-post-evaluation-two-pass",
    standard,
    searchQuery,
    candidates: context,
    candidateAssessments: assessments,
    applicableCandidates: applicable,
    secondaryCandidates: secondary,
  };
}

function buildCvPrompt(payload: Record<string, unknown>) {
  return `Adapte un CV à une offre sans inventer d'expérience, compétence, date ou résultat.\nPoste: ${payload.jobTitle || ""}\nEntreprise: ${payload.company || ""}\nOffre: ${payload.offer || ""}\nÀ mettre en avant: ${payload.focus || ""}\nBase factuelle autorisée: ${payload.facts || ""}\nRéponds en français avec: angle de candidature, résumé ciblé, compétences prioritaires, reformulations fondées uniquement sur les faits fournis, mots-clés à intégrer. Signale toute information manquante au lieu de l'inventer.`;
}

Deno.serve(async (request: Request) => {
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
    if (mode === "copilot") return json(await runWorkspaceCopilot(apiKey, model, payload));
    if (mode === "cv") {
      const text = await groqChat(apiKey, model, [
        { role: "system", content: "N’invente aucune expérience, compétence, date ou résultat. Signale ce qui manque." },
        { role: "user", content: buildCvPrompt(payload) },
      ]);
      return json({ text, model, engine: "groq" });
    }
    return json({ error: "unsupported_mode" }, 400);
  } catch (error) {
    console.error("workspace-ai", error);
    const detail = error instanceof Error ? error.message : String(error);
    return json({ error: "workspace_ai_failed", detail }, 502);
  }
});