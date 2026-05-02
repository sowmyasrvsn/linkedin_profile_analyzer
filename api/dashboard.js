export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { profileContext, userApiKey } = req.body;
  if (!profileContext) return res.status(400).json({ error: 'Missing profileContext' });

  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key configured' });

  const prompt = `You are a brutally honest senior executive coach with 20 years experience advising Directors, VPs and C-suite leaders at Fortune 500 tech companies.

Analyze this LinkedIn profile and return a complete career dashboard as valid JSON only — no markdown fences, no explanation, just the raw JSON object.

Profile:
${JSON.stringify(profileContext, null, 2)}

For the career section, use this 3-layer framework:
LAYER 1 — THE FACTS (insights field): State only what the data shows. Total years, roles, companies, seniority progression, avg tenure vs peers, avg time to promote, time in current role.
LAYER 2 — THE GAPS (coaching array): Compare against what a strong candidate for the NEXT level up looks like. For each gap use this exact format: "GAP: [name] | WHY IT MATTERS: [one sentence] | SEVERITY: Critical/Moderate/Minor | HOW TO CLOSE IT: [one specific action]". Say "you need to" not "consider". Do not soften.
LAYER 3 — THE PRIORITY ACTION (feedback field): The single most impactful thing they can do in 90 days. Name the exact action, the exact outcome, and why it beats every other option. Be specific to their actual profile.

Return ONLY this JSON structure:
{
  "career": {
    "kpis": [
      {"label": "Total Experience", "value": "Xyr", "sub": "years in industry", "trend": "up"},
      {"label": "Roles Held", "value": "X", "sub": "across X companies", "trend": "neutral"},
      {"label": "Avg Tenure", "value": "Xyr Xmo", "sub": "Xyr above/below 2.1yr tech industry avg — compare against Director/VP peers specifically", "trend": "up or down or neutral"},
      {"label": "Avg Time to Promote", "value": "Xyr Xmo", "sub": "faster/slower than 21mo tech median for their peer group (Director/VP/IC level)", "trend": "up or neutral"},
      {"label": "Time in Current Role", "value": "Xyr Xmo", "sub": "current company name", "trend": "neutral"}
    ],
    "insights": "LAYER 1 — facts only, 3-4 sentences with specific numbers from the profile",
    "coaching": ["LAYER 2 gap 1 in the GAP format above", "gap 2", "gap 3"],
    "feedback": "LAYER 3 — the single priority action, specific to this profile, 3-4 sentences"
  },
  "skills": {
    "strengths": ["skill1", "skill2", "skill3", "skill4", "skill5"],
    "gaps": ["gap1", "gap2", "gap3", "gap4"],
    "chartData": [{"name": "Category", "value": 35}, {"name": "Category2", "value": 25}, {"name": "Category3", "value": 20}, {"name": "Category4", "value": 20}],
    "insights": "2-3 sentences about the skill profile inferred from titles and descriptions.",
    "coaching": ["specific skill action 1", "action 2", "action 3"],
    "feedback": "Direct, blunt assessment — what is strong and what is the single most critical skill gap."
  },
  "recommendations": {
    "themes": [{"theme": "Theme Name", "description": "what this theme reveals about the person", "quote": "example phrase or empty string"}],
    "insights": "Analysis of recommendation patterns, or note that paste input lacks recommendations and ZIP export is needed.",
    "coaching": ["how to get better recommendations", "what to ask recommenders to highlight", "how many to target"],
    "feedback": "Direct take on the recommendation profile."
  },
  "aiJobs": {
    "seniority": "Entry/Mid/Senior/Staff/Executive",
    "roles": [
      {"title": "AI Role Title", "fit_score": 85, "why": "1-2 sentences tied to actual background", "skills_match": ["s1", "s2", "s3"], "skills_gap": ["g1", "g2"]},
      {"title": "AI Role Title 2", "fit_score": 78, "why": "...", "skills_match": ["s1", "s2"], "skills_gap": ["g1", "g2"]},
      {"title": "AI Role Title 3", "fit_score": 70, "why": "...", "skills_match": ["s1", "s2"], "skills_gap": ["g1", "g2"]}
    ],
    "insights": "Overview of AI-era positioning based on actual background.",
    "coaching": ["specific AI transition step 1", "step 2", "step 3"],
    "feedback": "Direct take on AI readiness and biggest opportunity."
  },
  "recruiterTips": {
    "tips": [
      {"category": "Headline", "tip": "specific tip for their situation", "detail": "why this matters and exactly how to do it", "priority": "high"},
      {"category": "Summary", "tip": "...", "detail": "...", "priority": "high"},
      {"category": "Experience", "tip": "...", "detail": "...", "priority": "high"},
      {"category": "Keywords", "tip": "...", "detail": "...", "priority": "medium"},
      {"category": "Activity", "tip": "...", "detail": "...", "priority": "medium"},
      {"category": "Network", "tip": "...", "detail": "...", "priority": "low"}
    ],
    "insights": "Overall assessment of profile discoverability and recruiter appeal."
  }
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) return res.status(401).json({ error: 'INVALID_API_KEY' });
      let detail = errText;
      try { detail = JSON.parse(errText)?.error?.message || errText; } catch {}
      return res.status(500).json({ error: `Claude API error: ${detail}` });
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const dashboard = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ dashboard });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
