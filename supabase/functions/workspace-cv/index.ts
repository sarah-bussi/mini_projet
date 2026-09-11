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

function parseJsonContent(content: string) {
  let cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    const repaired = cleaned
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(repaired);
  }
}

async function groqJson(apiKey: string, model: string, prompt: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      top_p: 0.9,
      max_completion_tokens: 1800,
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const groqMessage = String(data?.error?.message || data?.message || "").slice(0, 320);
    if (response.status === 429) throw new Error("groq_rate_limited");
    throw new Error(`groq_${response.status}${groqMessage ? `:${groqMessage}` : ""}`);
  }

  const message = data?.choices?.[0]?.message || {};
  const content = String(message?.content || "").trim();
  const finishReason = String(data?.choices?.[0]?.finish_reason || "");
  if (!content) throw new Error(`empty_ai_response${finishReason ? `:${finishReason}` : ""}`);

  try {
    return parseJsonContent(content);
  } catch {
    throw new Error("invalid_ai_json");
  }
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

function firstSection(html: string, ids: string[]) {
  for (const id of ids) {
    const section = sectionHtml(html, id);
    if (section) return section;
  }
  return "";
}

function extractH3(section: string) {
  const values: string[] = [];
  for (const match of section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const value = stripHtml(match[1]);
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

function clip(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function loadCv(source: string) {
  const file = source === "fr" ? "cv.html" : "cv-en.html";
  const url = `https://raw.githubusercontent.com/sarah-bussi/mini_projet/main/${file}`;
  const response = await fetch(url, { headers: { "User-Agent": "workspace-cv" } });
  if (!response.ok) throw new Error(`cv_source_${response.status}`);
  const html = await response.text();

  const experience = firstSection(html, ["experience"]);
  const projectsSection = firstSection(html, ["projects", "projets"]);
  const skills = firstSection(html, ["skills", "competences"]);
  const education = firstSection(html, ["education", "formation"]);
  const languages = firstSection(html, ["languages", "langues"]);

  const compactSource = [
    `EXPERIENCE: ${clip(stripHtml(experience), 3000)}`,
    `PROJECTS: ${clip(stripHtml(projectsSection), 1800)}`,
    `SKILLS: ${clip(stripHtml(skills), 1100)}`,
    `EDUCATION: ${clip(stripHtml(education), 700)}`,
    `LANGUAGES: ${clip(stripHtml(languages), 250)}`,
  ].join("\n");

  return {
    file,
    text: compactSource.slice(0, 7000),
    employers: extractH3(experience),
    projects: extractH3(projectsSection),
  };
}

function stringArray(value: unknown, max = 10) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, max);
}

function cleanPatch(raw: any, employers: string[], projects: string[]) {
  const allowedEmployers = new Set(employers);
  const allowedProjects = new Set(projects);

  const experiences = Array.isArray(raw?.experiences)
    ? raw.experiences
        .map((item: any) => ({
          employer: String(item?.employer || "").trim(),
          bullets: stringArray(item?.bullets, 6),
        }))
        .filter((item: any) => allowedEmployers.has(item.employer) && item.bullets.length)
        .slice(0, 3)
    : [];

  const projectItems = Array.isArray(raw?.projects)
    ? raw.projects
        .map((item: any) => ({
          title: String(item?.title || "").trim(),
          summary: String(item?.summary || "").trim(),
          highlights: [],
        }))
        .filter((item: any) => allowedProjects.has(item.title))
        .slice(0, 4)
    : [];

  return {
    professionalTitle: String(raw?.professionalTitle || "").trim(),
    summary: String(raw?.summary || "").trim(),
    prioritySkills: stringArray(raw?.prioritySkills, 8),
    experiences,
    experienceOrder: stringArray(raw?.experienceOrder, 8).filter((name) => allowedEmployers.has(name)),
    projects: projectItems,
    projectOrder: stringArray(raw?.projectOrder, 8).filter((name) => allowedProjects.has(name)),
  };
}

function buildPrompt(payload: Record<string, unknown>, cv: { file: string; text: string; employers: string[]; projects: string[] }) {
  const language = String(payload.outputLanguage || "en") === "fr" ? "français" : "anglais";
  const offer = clip(payload.offer, 3500);
  const focus = clip(payload.focus, 700);

  return `Tu es un éditeur de CV conservateur. Adapte le CV ci-dessous à l'offre, en ${language}, sans rien inventer.\n\nCV (${cv.file}):\n${cv.text}\n\nEMPLOYEURS EXACTS: ${JSON.stringify(cv.employers)}\nPROJETS EXACTS: ${JSON.stringify(cv.projects)}\n\nOFFRE CIBLE:\nPoste: ${clip(payload.jobTitle, 160)}\nEntreprise: ${clip(payload.company, 160)}\nDescription: ${offer}\nFocus: ${focus}\n\nRÈGLES ABSOLUES:\n- Zéro invention de compétence, responsabilité, date, résultat, niveau ou qualité.\n- Ne change jamais la nature d'une alternance, d'un stage ou d'un projet.\n- Employeurs et projets doivent être recopiés exactement depuis les listes autorisées.\n- Pas de lead, led, own, drive, manage, expert, senior ou proven ability sauf preuve explicite.\n- Maximum 4 forces, 4 écarts, 8 mots-clés, 3 expériences, 5 bullets par expérience et 4 projets.\n- Bullets concis. Résumé CV: 50 mots max. Résumé projet: 25 mots max.\n- Exigence non démontrée = gaps, jamais cvPatch.\n\nRéponds UNIQUEMENT avec un objet JSON valide de cette forme:\n{"analysis":{"verdict":"...","strengths":["..."],"gaps":["..."],"atsKeywords":["..."]},"cvPatch":{"professionalTitle":"...","summary":"...","prioritySkills":["..."],"experiences":[{"employer":"nom exact","bullets":["..."]}],"experienceOrder":["nom exact"],"projects":[{"title":"titre exact","summary":"..."}],"projectOrder":["titre exact"]}}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing_session" }, 401);

  const user = await getUser(token);
  if (!user?.id) return json({ error: "forbidden" }, 403);

  const apiKey = Deno.env.get("AI_API_KEY") || Deno.env.get("GROQ_API_KEY") || "";
  const model = Deno.env.get("AI_MODEL") || Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b";
  if (!apiKey) return json({ error: "ai_not_configured" }, 503);

  const payload = await request.json().catch(() => ({}));

  try {
    const source = String(payload.cvSource || "en") === "fr" ? "fr" : "en";
    const cv = await loadCv(source);
    const result = await groqJson(apiKey, model, buildPrompt(payload, cv));

    const analysis = {
      verdict: String(result?.analysis?.verdict || "").trim(),
      strengths: stringArray(result?.analysis?.strengths, 4),
      gaps: stringArray(result?.analysis?.gaps, 4),
      atsKeywords: stringArray(result?.analysis?.atsKeywords, 8),
    };
    const cvPatch = cleanPatch(result?.cvPatch || {}, cv.employers, cv.projects);

    return json({ analysis, cvPatch, source: cv.file, model, engine: "groq-low-reasoning-cv" });
  } catch (error) {
    console.error("workspace-cv", error);
    const rawDetail = String((error as Error)?.message || error);
    const detail = rawDetail === "groq_rate_limited"
      ? "Le service IA a atteint sa limite temporaire de requêtes. Réessaie dans quelques secondes."
      : rawDetail.startsWith("empty_ai_response")
        ? "Le modèle n'a pas produit de réponse exploitable. Réessaie une fois ; si cela persiste, le modèle configuré doit être remplacé."
        : rawDetail.slice(0, 500);
    return json({ error: `workspace_cv_failed:${detail}`, detail }, rawDetail === "groq_rate_limited" ? 429 : 502);
  }
});
