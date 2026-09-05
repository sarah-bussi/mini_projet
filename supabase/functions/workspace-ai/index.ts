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

type JsonSchema = Record<string, unknown>;

async function groqChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  responseSchema: JsonSchema | null = null,
) {
  const body: Record<string, unknown> = { model, temperature: 0.05, messages };
  if (responseSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "workspace_response", strict: true, schema: responseSchema },
    };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(data?.error?.message || data?.message || JSON.stringify(data) || "unknown_groq_error").slice(0, 1500);
    const retryAfter = response.headers.get("retry-after");
    throw new Error(`groq_${response.status}${retryAfter ? `_retry_${retryAfter}` : ""}: ${detail}`);
  }
  const content = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!content) throw new Error("groq_empty_response");
  return content;
}

function baseSearchQuery(payload: Record<string, unknown>) {
  return [payload.component, payload.problem, payload.details, payload.verifiedFacts, payload.technology]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 3200);
}

async function retrieveCorpus(standard: string, query: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) throw new Error("supabase_service_missing");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/search_workspace_a11y`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_standard: standard, p_query: query, p_limit: 8 }),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    const detail = String(data?.message || data?.error || JSON.stringify(data) || "unknown_retrieval_error").slice(0, 1200);
    throw new Error(`retrieval_${response.status}: ${detail}`);
  }
  return Array.isArray(data) ? data : [];
}

function candidateContext(candidates: any[]) {
  return candidates.slice(0, 8).map((item, index) => ({
    rank: index + 1,
    reference: String(item.reference || ""),
    type: String(item.reference_type || ""),
    title: String(item.title || ""),
    document: String(item.document || ""),
    page: item.page ?? null,
    score: Number(item.score || 0),
    content: String(item.content || "").slice(0, 1200),
  }));
}

type CandidateDecision = "APPLICABLE" | "SECONDARY" | "NOT_APPLICABLE" | "NOT_ASSESSED";
type CandidateAssessment = {
  reference: string;
  decision: CandidateDecision;
  reason: string;
  missingPrecondition: string;
  supportQuote: string;
  coveredObject: string;
  preconditions: string;
  testedProperty: string;
  factMatch: string;
  grounded: boolean;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function quoteIsGrounded(quote: string, candidate: any) {
  const needle = normalizeText(quote);
  if (needle.length < 10) return false;
  const haystack = normalizeText(`${candidate.title || ""}\n${candidate.content || ""}`);
  return haystack.includes(needle);
}

function normalizeCandidateAssessments(value: unknown, candidates: any[]): CandidateAssessment[] {
  const items = Array.isArray(value) ? value : [];
  const candidateByRef = new Map(candidates.map((item) => [String(item.reference || ""), item]));
  const valid = new Set(["APPLICABLE", "SECONDARY", "NOT_APPLICABLE"]);
  const seen = new Set<string>();
  const out: CandidateAssessment[] = [];

  for (const item of items) {
    const reference = String(item?.reference || "").trim();
    let decision = String(item?.decision || "").trim().toUpperCase() as CandidateDecision;
    const candidate = candidateByRef.get(reference);
    if (!candidate || !valid.has(decision) || seen.has(reference)) continue;
    seen.add(reference);

    const supportQuote = String(item?.supportQuote || "").trim();
    const grounded = quoteIsGrounded(supportQuote, candidate);
    let reason = String(item?.reason || "").trim();
    let missingPrecondition = String(item?.missingPrecondition || "").trim();

    if (decision === "APPLICABLE" && !grounded) {
      decision = "SECONDARY";
      reason = `${reason || "Applicabilité potentielle."} Preuve textuelle exacte insuffisante pour retenir la référence comme applicable.`;
      missingPrecondition = missingPrecondition || "Vérifier la portée exacte dans le contenu documentaire récupéré.";
    }

    out.push({
      reference,
      decision,
      reason,
      missingPrecondition,
      supportQuote,
      coveredObject: String(item?.coveredObject || "").trim(),
      preconditions: String(item?.preconditions || "").trim(),
      testedProperty: String(item?.testedProperty || "").trim(),
      factMatch: String(item?.factMatch || "").trim(),
      grounded,
    });
  }

  for (const candidate of candidates) {
    const reference = String(candidate.reference || "");
    if (seen.has(reference)) continue;
    out.push({
      reference,
      decision: "NOT_ASSESSED",
      reason: "Candidat récupéré mais non évalué par le juge documentaire.",
      missingPrecondition: "Relancer ou examiner manuellement cette référence.",
      supportQuote: "",
      coveredObject: "",
      preconditions: "",
      testedProperty: "",
      factMatch: "",
      grounded: false,
    });
  }

  return out;
}

function scopedCandidates(context: any[], assessments: CandidateAssessment[], decision: CandidateDecision) {
  const refs = new Set(assessments.filter((item) => item.decision === decision).map((item) => item.reference));
  return context.filter((item) => refs.has(String(item.reference || "")));
}

const judgeSchema = {
  type: "object",
  properties: {
    assessments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          reference: { type: "string" },
          coveredObject: { type: "string" },
          preconditions: { type: "string" },
          testedProperty: { type: "string" },
          factMatch: { type: "string" },
          decision: { type: "string", enum: ["APPLICABLE", "SECONDARY", "NOT_APPLICABLE"] },
          reason: { type: "string" },
          missingPrecondition: { type: "string" },
          supportQuote: { type: "string" },
        },
        required: ["reference", "coveredObject", "preconditions", "testedProperty", "factMatch", "decision", "reason", "missingPrecondition", "supportQuote"],
        additionalProperties: false,
      },
    },
  },
  required: ["assessments"],
  additionalProperties: false,
};

const generationSchema = {
  type: "object",
  properties: {
    diagnostic: { type: "string" },
    userImpact: { type: "string" },
    normativeRequirement: { type: "string" },
    technicalRecommendation: { type: "string" },
    verification: { type: "string" },
    missingInformation: { type: "string" },
    limits: { type: "string" },
    confidence: { type: "string", enum: ["Faible", "Moyen", "Élevé"] },
  },
  required: ["diagnostic", "userImpact", "normativeRequirement", "technicalRecommendation", "verification", "missingInformation", "limits", "confidence"],
  additionalProperties: false,
};

async function judgeApplicability(apiKey: string, model: string, standard: string, payload: Record<string, unknown>, context: any[]) {
  const input = {
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
      content: `Tu es un juge d'applicabilité documentaire pour ${standard}. Évalue TOUS les candidats récupérés, sans rédiger le diagnostic final. Pour chaque candidat : identifie l'objet couvert, les préconditions, la propriété testée, confronte-les aux faits vérifiés, puis décide APPLICABLE, SECONDARY ou NOT_APPLICABLE. Une similarité lexicale ne suffit jamais. Le numéro d'une référence ne permet pas d'en déduire le sens : seul title/content fourni fait foi. verifiedFacts prime sur toute inférence. Distingue strictement absence, présence et pertinence/qualité d'une propriété. Un composant générique ne devient pas un champ, une image ou un script sans preuve. Si une précondition manque, jamais APPLICABLE. Pour supportQuote, copie un court extrait EXACT présent dans title ou content qui soutient ton analyse. N'utilise aucune connaissance normative externe.`,
    },
    { role: "user", content: JSON.stringify(input) },
  ], judgeSchema);

  return normalizeCandidateAssessments(JSON.parse(content)?.assessments, context);
}

async function generateGroundedAnswer(apiKey: string, model: string, standard: string, payload: Record<string, unknown>, applicable: any[], secondary: any[], assessments: CandidateAssessment[]) {
  const input = {
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
    applicabilityAssessments: assessments.map(({ reference, decision, reason, missingPrecondition, supportQuote, grounded }) => ({ reference, decision, reason, missingPrecondition, supportQuote, grounded })),
  };

  const content = await groqChat(apiKey, model, [
    {
      role: "system",
      content: `Tu rédiges la réponse finale d'un assistant accessibilité produit. Tu peux attribuer une exigence normative uniquement aux applicableReferences. Les secondaryReferences restent des pistes. Les références NOT_APPLICABLE ou NOT_ASSESSED ne doivent jamais justifier une exigence. Si applicableReferences est vide, n'invente aucun rattachement normatif. verifiedFacts prime sur toute inférence. Ne transforme jamais un problème d'identification en impossibilité d'opérer l'élément : si un élément est déclaré focusable et activable au clavier, ne prétends pas qu'il est impossible de l'actionner. Adapte la recommandation au rôle demandé (designer, developer ou qa) et à outputType. Une solution technique possible ne doit pas être présentée comme le mécanisme exact imposé par le référentiel. Pas de verdict automatique de conformité. Validation humaine obligatoire.`,
    },
    { role: "user", content: JSON.stringify(input) },
  ], generationSchema);

  return JSON.parse(content);
}

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatGroundedResult(result: any, standard: string, assessments: CandidateAssessment[]) {
  const retained = assessments.filter((item) => item.decision === "APPLICABLE");
  const secondary = assessments.filter((item) => item.decision === "SECONDARY");
  const rejected = assessments.filter((item) => item.decision === "NOT_APPLICABLE");
  const notAssessed = assessments.filter((item) => item.decision === "NOT_ASSESSED");

  const retainedText = retained.length
    ? retained.map((item) => `- ${standard} ${item.reference} — ${item.reason}${item.supportQuote ? `\n  Preuve : « ${item.supportQuote} »` : ""}`).join("\n")
    : `Aucune référence ${standard} suffisamment étayée.`;

  const other = [
    ...secondary.map((item) => `- ${standard} ${item.reference} secondaire — ${item.reason}${item.missingPrecondition ? ` Précondition à confirmer : ${item.missingPrecondition}` : ""}`),
    ...rejected.map((item) => `- ${standard} ${item.reference} écartée — ${item.reason}`),
    ...notAssessed.map((item) => `- ${standard} ${item.reference} non évaluée — contrôle manuel conseillé.`),
  ];

  const normativeRequirement = retained.length
    ? safeText(result?.normativeRequirement, "À confirmer à partir des références applicables retenues.")
    : "Aucune exigence normative attribuée : aucune référence applicable n'est suffisamment étayée.";

  let confidence = safeText(result?.confidence, "Faible");
  if (!retained.length && confidence === "Élevé") confidence = "Moyen";

  return `1. Diagnostic\n${safeText(result?.diagnostic, "Analyse insuffisante.")}\n\n2. Références retenues\n${retainedText}\n\n3. Références secondaires, écartées ou non évaluées\n${other.length ? other.join("\n") : "Aucune."}\n\n4. Impact utilisateur\n${safeText(result?.userImpact, "À vérifier avec les usages et technologies d'assistance concernés.")}\n\n5. Correction proposée\nExigence / objectif normatif :\n${normativeRequirement}\n\nRecommandation métier / technique :\n${safeText(result?.technicalRecommendation, "Aucune recommandation fiable sans contexte supplémentaire.")}\n\n6. Comment vérifier\n${safeText(result?.verification, "Prévoir une vérification humaine et des tests adaptés.")}\n\n7. Informations manquantes\n${safeText(result?.missingInformation, "Aucune information manquante explicitée.")}\n\n8. Limites et validation humaine\n${safeText(result?.limits, "Cette analyse ne constitue pas un verdict de conformité.")}\nValidation humaine obligatoire.\nNiveau de confiance : ${confidence}.`;
}

async function runWorkspaceCopilot(apiKey: string, model: string, payload: Record<string, unknown>) {
  const standard = normativeTarget(String(payload.productType || "web"), String(payload.technology || ""));
  const searchQuery = baseSearchQuery(payload) || "accessibilité";
  const candidates = await retrieveCorpus(standard, searchQuery);

  if (!candidates.length) {
    return {
      text: `1. Diagnostic\nLe corpus ${standard} n'a retourné aucune référence suffisamment proche.\n\n2. Références retenues\nAucune.\n\n3. Références secondaires, écartées ou non évaluées\nAucune.\n\n4. Impact utilisateur\nÀ déterminer après clarification.\n\n5. Correction proposée\nAucune correction normative sans référence documentaire.\n\n6. Comment vérifier\nPréciser le composant, le comportement observé et les faits vérifiés puis relancer.\n\n7. Informations manquantes\nContexte technique et comportement observé à préciser.\n\n8. Limites et validation humaine\nAucun verdict de conformité. Validation humaine obligatoire.`,
      engine: "workspace-a11y-product-two-pass-v4",
      standard,
      searchQuery,
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
    engine: "workspace-a11y-product-two-pass-v4",
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
        { role: "system", content: "N'invente aucune expérience, compétence, date ou résultat. Signale ce qui manque." },
        { role: "user", content: buildCvPrompt(payload) },
      ]);
      return json({ text, model, engine: "groq" });
    }
    return json({ error: "unsupported_mode" }, 400);
  } catch (error) {
    console.error("workspace-ai", error);
    const detail = error instanceof Error ? error.message : String(error);
    const status = detail.startsWith("groq_429") ? 429 : 502;
    return json({ error: "workspace_ai_failed", detail }, status);
  }
});
