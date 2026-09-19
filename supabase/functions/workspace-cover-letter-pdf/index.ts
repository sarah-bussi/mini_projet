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
function clip(v: unknown, n: number) { return String(v || "").trim().slice(0, n); }
function geminiText(data: any) {
  return (data?.candidates?.[0]?.content?.parts || []).map((p:any)=>String(p?.text||"")).join("").trim();
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i,"").trim();
  const user = token ? await getUser(token) : null;
  if (!user?.id) return json({ error: "forbidden" }, 403);

  const key = Deno.env.get("GEMINI_API_KEY") || "";
  if (!key) return json({ error: "gemini_not_configured" }, 503);
  const configured = (Deno.env.get("GEMINI_MODEL") || "").trim();
  const model = configured && !["gemini-2.5-flash","gemini-3.5-flash"].includes(configured) ? configured : "gemini-3.6-flash";

  try {
    const form = await request.formData();
    const file = form.get("cvFile");
    if (!(file instanceof File) || file.type !== "application/pdf") return json({ error: "pdf_required" }, 400);
    if (file.size > 8 * 1024 * 1024) return json({ error: "pdf_too_large" }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i,i+chunk));
    const base64 = btoa(binary);

    const toneMap: Record<string,string> = { natural:"naturel, professionnel, fluide et personnel", institutional:"institutionnel, précis et professionnel", formal:"très formel, sobre et administratif" };
    const lengthMap: Record<string,string> = { short:"350 à 450 mots", standard:"500 à 650 mots", developed:"650 à 800 mots" };
    const lang = String(form.get("outputLanguage")||"fr") === "en" ? "anglais" : "français";

    const prompt = `Analyse le CV PDF joint et rédige une lettre de motivation en ${lang} pour Sarah Bussi.

POSTE: ${clip(form.get("jobTitle"),180)}
ORGANISME: ${clip(form.get("company"),180)}
OFFRE: ${clip(form.get("offer"),7000)}
FAITS / PRIORITÉS COMPLÉMENTAIRES FOURNIS PAR LA CANDIDATE: ${clip(form.get("focus"),5000)}
STYLE: ${toneMap[String(form.get("tone"))] || toneMap.natural}
LONGUEUR: ${lengthMap[String(form.get("length"))] || lengthMap.standard}

RÈGLES ABSOLUES:
- Le CV PDF joint est la source principale. Utilise seulement ses faits et les faits explicitement fournis ci-dessus.
- N'invente aucune compétence, date, responsabilité, niveau de langue, résultat, motivation biographique ou expérience.
- Ne transforme jamais alternance, stage ou projet académique en emploi permanent.
- La lettre complète le CV sans le recopier. Construis une argumentation expliquant le fil conducteur du parcours et sa pertinence pour la mission.
- Relie les expériences et projets les plus pertinents aux missions de l'offre.
- Évite les clichés, les superlatifs non démontrés et les formulations génériques.
- Si une information utile n'est pas présente, omets-la.
- Commence par "Madame, Monsieur," (ou "Dear Sir or Madam," en anglais), termine par une formule adaptée puis "Sarah Bussi".
- Retourne uniquement la lettre finale, sans markdown ni commentaire.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-goog-api-key":key },
      body:JSON.stringify({
        contents:[{ role:"user", parts:[
          { inline_data:{ mime_type:"application/pdf", data:base64 } },
          { text:prompt }
        ]}],
        generationConfig:{ temperature:0.35, maxOutputTokens:3200 }
      })
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) return json({ error:`gemini_${response.status}:${clip(data?.error?.message,400)}` }, response.status===429?429:502);
    const letter = geminiText(data);
    if (!letter) return json({ error:"empty_letter_response" },502);
    return json({ letter, model, engine:"gemini-pdf-cover-letter-v1", cvCharacters:null });
  } catch(error) {
    return json({ error:`cover_letter_pdf_failed:${clip((error as Error)?.message || error,500)}` },502);
  }
});