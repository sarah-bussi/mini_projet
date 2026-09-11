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
  let cleaned = String(content || "")
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

const responseSchema = {
  type: "object",
  properties: {
    analysis: {
      type: "object",
      properties: {
        verdict: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
        atsKeywords: { type: "array", items: { type: "string" } },
      },
      required: ["verdict", "strengths", "gaps", "atsKeywords"],
    },
    cvPatch: {
      type: "object",
      properties: {
        professionalTitle: { type: "string" },
        summary: { type: "string" },
        prioritySkills: { type: "array", items: { type: "string" } },
        experiences: {
          type: "array",
          items: {
            type: "object",
            properties: {
              employer: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
            required: ["employer", "bullets"],
          },
        },
        experienceOrder: { type: "array", items: { type: "string" } },
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
            },
            required: ["title", "summary"],
          },
        },
        projectOrder: { type: "array", items: { type: "string" } },
      },
      required: ["professionalTitle", "summary", "prioritySkills", "experiences", "experienceOrder", "projects", "projectOrder"],
    },
  },
  required: ["analysis", "cvPatch"],
};

function extractGeminiText(data: any) {
  const candidate = data?.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  return parts.map((part: any) => String(part?.text || "")).join("").trim();
}

async function callGemini(apiKey: string, model: string, prompt: string, strictSchema: boolean) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens: 4096,
    responseMimeType: "application/json",
  };
  if (strictSchema) generationConfig.responseSchema = responseSchema;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data?.error?.message || data?.message || "").slice(0, 500);
    if (response.status === 429) throw new Error("gemini_rate_limited");
    throw new Error(`gemini_${response.status}${message ? `:${message}` : ""}`);
  }

  const content = extractGeminiText(data);
  const finishReason = String(data?.candidates?.[0]?.finishReason || "");
  if (!content) {
    const blockReason = String(data?.promptFeedback?.blockReason || "");
    throw new Error(`empty_gemini_response${finishReason ? `:${finishReason}` : ""}${blockReason ? `:${blockReason}` : ""}`);
  }

  return { content, finishReason };
}

async function geminiJson(apiKey: string, model: string, prompt: string) {
  const first = await callGemini(apiKey, model, prompt, true);
  try {
    return parseJsonContent(first.content);
  } catch {
    const repairPrompt = `${prompt}\n\nIMPORTANT: la réponse précédente n'était pas exploitable. Renvoie maintenant UNIQUEMENT un objet JSON complet et valide, sans markdown ni commentaire. Respecte exactement les clés analysis et cvPatch. Réduis le texte si nécessaire afin que le JSON soit complet.`;
    const second = await callGemini(apiKey, model, repairPrompt, false);
    try {
      return parseJsonContent(second.content);
    } catch {
      throw new Error(`invalid_gemini_json:${second.finishReason || first.finishReason || "unknown"}`);
    }
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
    `EXPERIENCE: ${clip(stripHtml(experience), 3200)}`,
    `PROJECTS: ${clip(stripHtml(projectsSection), 2200)}`,
    `SKILLS: ${clip(stripHtml(skills), 1300)}`,
    `EDUCATION: ${clip(stripHtml(education), 850)}`,
    `LANGUAGES: ${clip(stripHtml(languages), 300)}`,
  ].join("\n");

  return {
    file,
    text: compactSource.slice(0, 8000),
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
        .slice(0, 4)
    : [];

  const projectItems = Array.isArray(raw?.projects)
    ? raw.projects
        .map((item: any) => ({
          title: String(item?.title || "").trim(),
          summary: String(item?.summary || "").trim(),
          highlights: [],
        }))
        .filter((item: any) => allowedProjects.has(item.title))
        .slice(0, 6)
    : [];

  return {
    professionalTitle: String(raw?.professionalTitle || "").trim(),
    summary: String(raw?.summary || "").trim(),
    prioritySkills: stringArray(raw?.prioritySkills, 10),
    experiences,
    experienceOrder: stringArray(raw?.experienceOrder, 10).filter((name) => allowedEmployers.has(name)),
    projects: projectItems,
    projectOrder: stringArray(raw?.projectOrder, 10).filter((name) => allowedProjects.has(name)),
  };
}

function buildPrompt(payload: Record<string, unknown>, cv: { file: string; text: string; employers: string[]; projects: string[] }) {
  const language = String(payload.outputLanguage || "en") === "fr" ? "français" : "anglais";
  const offer = clip(payload.offer, 5000);
  const focus = clip(payload.focus, 900);

  return `Tu es un éditeur de CV conservateur. Adapte le CV à l'offre en ${language}, sans rien inventer.\n\nCV SOURCE (${cv.file}):\n${cv.text}\n\nEMPLOYEURS AUTORISÉS: ${JSON.stringify(cv.employers)}\nPROJETS AUTORISÉS: ${JSON.stringify(cv.projects)}\n\nOFFRE CIBLE:\nPoste: ${clip(payload.jobTitle, 180)}\nEntreprise: ${clip(payload.company, 180)}\nDescription: ${offer}\nFocus: ${focus}\n\nRÈGLES ABSOLUES:\n- Zéro invention de compétence, responsabilité, date, résultat, niveau ou qualité.\n- Ne change jamais la nature d'une alternance, d'un stage ou d'un projet académique.\n- Employeurs et projets doivent être recopiés EXACTEMENT depuis les listes autorisées.\n- N'utilise pas lead, led, own, drive, manage, expert, senior ou proven ability sauf preuve explicite dans le CV source.\n- Toute exigence non démontrée va dans gaps, jamais dans cvPatch.\n- Maximum 4 forces, 4 écarts, 8 mots-clés ATS, 4 expériences, 5 bullets par expérience et 6 projets.\n- Résumé CV: 50 mots maximum. Bullets concis. Résumé projet: 25 mots maximum.\n- professionalTitle doit rester fidèle au niveau réel du profil et ne doit pas transformer le poste visé en expérience acquise.\n- Tu dois toujours renvoyer analysis et cvPatch, même si certains tableaux sont vides.\n- Retourne uniquement les informations demandées par le schéma JSON.`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "missing_session" }, 401);

  const user = await getUser(token);
  if (!user?.id) return json({ error: "forbidden" }, 403);

  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  const configuredModel = (Deno.env.get("GEMINI_MODEL") || "").trim();
  const deprecatedModels = new Set(["gemini-2.5-flash", "gemini-3.5-flash"]);
  const model = configuredModel && !deprecatedModels.has(configuredModel)
    ? configuredModel
    : "gemini-3.6-flash";
  if (!apiKey) return json({ error: "gemini_not_configured" }, 503);

  const payload = await request.json().catch(() => ({}));

  try {
    const source = String(payload.cvSource || "en") === "fr" ? "fr" : "en";
    const cv = await loadCv(source);
    const result = await geminiJson(apiKey, model, buildPrompt(payload, cv));

    const analysis = {
      verdict: String(result?.analysis?.verdict || "").trim(),
      strengths: stringArray(result?.analysis?.strengths, 4),
      gaps: stringArray(result?.analysis?.gaps, 4),
      atsKeywords: stringArray(result?.analysis?.atsKeywords, 8),
    };
    const cvPatch = cleanPatch(result?.cvPatch || {}, cv.employers, cv.projects);

    return json({ analysis, cvPatch, source: cv.file, model, engine: "gemini-structured-cv-v3" });
  } catch (error) {
    console.error("workspace-cv", error);
    const rawDetail = String((error as Error)?.message || error);
    const detail = rawDetail === "gemini_rate_limited"
      ? "Gemini a atteint une limite temporaire de requêtes. Réessaie dans quelques secondes."
      : rawDetail.startsWith("empty_gemini_response")
        ? "Gemini n'a pas produit de réponse exploitable pour cette requête."
        : rawDetail.startsWith("invalid_gemini_json")
          ? `Gemini a renvoyé une réponse JSON incomplète (${rawDetail.split(":")[1] || "raison inconnue"}).`
          : rawDetail.slice(0, 500);
    return json({ error: `workspace_cv_failed:${detail}`, detail }, rawDetail === "gemini_rate_limited" ? 429 : 502);
  }
});
