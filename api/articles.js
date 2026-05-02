export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { articleData, profileContext, userApiKey } = req.body;
  if (!articleData || !profileContext) return res.status(400).json({ error: 'Missing articleData or profileContext' });

  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key configured' });

  const prompt = `You are a LinkedIn content strategist specializing in B2B thought leadership for senior analytics and AI leaders.

You are analyzing the LinkedIn article performance for ${profileContext?.positions?.[0]?.title || 'a senior leader'} with ${profileContext?.stats?.totalYearsExperience || 10} years of experience.

Article performance data:
${JSON.stringify(articleData, null, 2)}

Career profile context:
${JSON.stringify(profileContext, null, 2)}

Analyze using these 3 layers, then return ONLY valid JSON — no markdown, no explanation.

LAYER 1 — PERFORMANCE: Which articles got most views vs engagement. Calculate engagement rate per article (likes+comments+shares/views). Which topics drove most shares. Drop-off patterns (high views, low engagement = headline worked but content didn't). Best performing themes.

LAYER 2 — CONTENT GAPS: What topics have they NOT written about that their audience would highly value. For each gap tie it back to their specific career experience and cross-reference against current 2026 AI/analytics trends.

LAYER 3 — NEXT 3 ARTICLE IDEAS: Ranked by impact. At least one contrarian (challenges a common belief). At least one data-driven (leads with a specific number). Titles must be specific — never generic.

Return ONLY this JSON:
{
  "performance": {
    "keyInsight": "3-4 sentences covering engagement rates, top articles, drop-off patterns, and best themes — cite specific numbers",
    "bestThemes": ["theme1", "theme2", "theme3"],
    "dropOff": ["titles of articles with high views but <2% engagement"]
  },
  "gaps": [
    {
      "topic": "specific topic title",
      "whyAudience": "one sentence on why this audience wants it",
      "whyQualified": "one sentence tying to their specific career experience",
      "potential": "High or Medium or Low",
      "potentialReason": "one sentence on why that potential level"
    }
  ],
  "nextArticles": [
    {
      "rank": 1,
      "title": "specific compelling headline — not generic",
      "hook": "first sentence that stops the scroll",
      "whyNow": "why this topic matters specifically in 2026",
      "uniqueAngle": "what makes their version different from every other analytics article",
      "proofPoint": "specific achievement from their career that makes them credible to write this",
      "timeToWrite": "X hours"
    },
    {"rank": 2, "title": "...", "hook": "...", "whyNow": "...", "uniqueAngle": "...", "proofPoint": "...", "timeToWrite": "..."},
    {"rank": 3, "title": "...", "hook": "...", "whyNow": "...", "uniqueAngle": "...", "proofPoint": "...", "timeToWrite": "..."}
  ],
  "overallInsight": "2-3 sentences: bottom line on content strategy, what to do first and why"
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
      return res.status(500).json({ error: 'Claude API error', details: errText });
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return res.status(200).json({ analysis: JSON.parse(jsonMatch[0]) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
