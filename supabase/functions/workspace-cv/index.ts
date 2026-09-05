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

async function groqJson(apiKey: string, model: string, messages: Array<{ role: string; content: string }>) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.08,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`groq_${response.status}`);
  const content = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!content) throw new Error("empty_ai_response");
  return JSON.parse(content);
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html: string) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionHtml(html: string, id: string) {
  const start = html.search(new RegExp(`<section[^>]*id=["']${id}["'][^>]*>`, "i"));
  if (start < 0) return "";
  const rest = html.slice(start);
  const next = rest.slice(1).search(/<section\b/i);
  return next >= 0 ? rest.slice(0, next + 1) : rest;
}

function extractH3(section: string) {
  const values: string[] = [];
  for (const match of section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const text = stripHtml(match[1]);
    if (text && !values.includes(text)) values.push(text);
  }
  return values;
}

async function loadCv(source: string) {
  const file = source === "fr" ? "cv.html" : "cv-en.html";
  const url = `https://raw.githubusercontent.com/sarah-bussi/mini_projet/main/${file}`;
  const response = await fetch(url, { headers: { "User-Agent": "workspace-cv" } });
  if (!response.ok) throw new Error(`cv_source_${response.status}`);
  const html = await response.text();
  return {
    file,
    text: stripHtml(html).slice(0, 32000),
    employers: extractH3(sectionHtml(html, "experience")),
    projects: extractH3(sectionHtml(html, "projects")),
  };
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20);
}

function cleanPatch(raw: any, employers: string[], projects: string[]) {
  const allowedEmployers = new Set(employers);
  const allowedProjects = new Set(projects);

  const experiences = Array.isArray(raw?.experiences)
    ? raw.experiences
        .map((item: any) => ({
          employer: String(item?.employer || "").trim(),
          bullets: stringArray(item?.bullets).slice(0, 8),
        }))
        .filter((item: any) => allowedEmployers.has(item.employer) && item.bullets.length)
    : [];

  const projectItems = Array.isArray(raw?.projects)
    ? raw.projects
        .map((item: any) => ({
          title: String(item?.title || "").trim(),
          summary: String(item?.summary || "").trim(),
          highlights: stringArray(item?.highlights).slice(0, 6),
        }))
        .filter((item: any) => allowedProjects.has(item.title))
    : [];

  return {
    professionalTitle: String(raw?.professionalTitle || "").trim(),
    summary: String(raw?.summary || "").trim(),
    prioritySkills: stringArray(raw?.prioritySkills).slice(0, 12),
    experiences,
    experienceOrder: stringArray(raw?.experienceOrder).filter((name) => allowedEmployers.has(name)),
    projects: projectItems,
    projectOrder: stringArray(raw?.projectOrder).filter((name) => allowedProjects.has(name)),
  };
}

function buildPrompt(payload: Record<string, unknown>, cv: { file: string; text: string; employers: string[]; projects: string[] }) {
  const language = String(payload.outputLanguage || "en") === "fr" ? "français" : "anglais";
  return `Tu adaptes un CV existant à une offre d'emploi. Tu dois optimiser sa pertinence tout en restant strictement factuel.\n\nCV SOURCE: ${cv.file}\n${cv.text}\n\nEMPLOYEURS AUTORISÉS, à recopier EXACTEMENT si utilisés:\n${JSON.stringify(cv.employers)}\n\nPROJETS AUTORISÉS, à recopier EXACTEMENT si utilisés:\n${JSON.stringify(cv.projects)}\n\nOFFRE CIBLE:\nPoste: ${payload.jobTitle || ""}\nEntreprise: ${payload.company || ""}\nDescription: ${payload.offer || ""}\nFocus facultatif: ${payload.focus || ""}\nLangue de sortie: ${language}.\n\nRÈGLES ABSOLUES:\n- N'invente aucune compétence, technologie, responsabilité, expérience, date, résultat, qualité comportementale ou niveau d'expertise.\n- Tu peux condenser, réordonner et reformuler, mais jamais élargir ou intensifier un fait.\n- Ne transforme jamais une alternance/work-study placement, un stage ou un projet académique en autre chose.\n- N'utilise pas lead/led/own/drive/spearhead/manage/oversee/expert/senior/proven ability sauf si ces mots sont explicitement justifiés dans le CV source.\n- Les noms d'employeurs et de projets dans cvPatch doivent provenir EXACTEMENT des listes autorisées ci-dessus.\n- Le résumé et les bullets doivent être prêts à être affichés dans un CV, sans markdown, sans tableaux et sans balises HTML.\n- Si une exigence de l'offre n'est pas démontrée, place-la dans gaps et NE l'ajoute jamais au cvPatch.\n\nRéponds UNIQUEMENT en JSON valide avec EXACTEMENT cette structure:\n{\n  "analysis": {\n    "verdict": "court verdict factuel",\n    "strengths": ["..."],\n    "gaps": ["..."],\n    "atsKeywords": ["mot-clé réellement justifié"]\n  },\n  "cvPatch": {\n    "professionalTitle": "titre professionnel recommandé ou titre source",\n    "summary": "résumé ciblé factuel",\n    "prioritySkills": ["..."],\n    "experiences": [{"employer": "nom exact autorisé", "bullets": ["..."]}],\n    "experienceOrder": ["noms exacts autorisés"],\n    "projects": [{"title": "titre exact autorisé", "summary": "...", "highlights": ["..."]}],\n    "projectOrder": ["titres exacts autorisés"]\n  }\n}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing_session" }, 401);

  const user = await getUser(token);
  if (!user?.id) return json({ error: "forbidden" }, 403);

  const apiKey = Deno.env.get("AI_API_KEY") || "";
  const model = Deno.env.get("AI_MODEL") || "openai/gpt-oss-20b";
  if (!apiKey) return json({ error: "ai_not_configured" }, 503);

  const payload = await request.json().catch(() => ({}));

  try {
    const source = String(payload.cvSource || "en") === "fr" ? "fr" : "en";
    const cv = await loadCv(source);
    const result = await groqJson(apiKey, model, [
      {
        role: "system",
        content: "Tu es un éditeur de CV conservateur. La fidélité au CV source prime toujours sur l'attractivité. Réponds uniquement en JSON valide selon le schéma demandé.",
      },
      { role: "user", content: buildPrompt(payload, cv) },
    ]);

    const analysis = {
      verdict: String(result?.analysis?.verdict || "").trim(),
      strengths: stringArray(result?.analysis?.strengths),
      gaps: stringArray(result?.analysis?.gaps),
      atsKeywords: stringArray(result?.analysis?.atsKeywords),
    };
    const cvPatch = cleanPatch(result?.cvPatch || {}, cv.employers, cv.projects);

    return json({ analysis, cvPatch, source: cv.file, model, engine: "groq-structured-cv" });
  } catch (error) {
    console.error("workspace-cv", error);
    return json({ error: "workspace_cv_failed", detail: String(error?.message || error) }, 502);
  }
});
