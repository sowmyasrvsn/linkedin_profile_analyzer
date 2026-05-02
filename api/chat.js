// Simple in-memory rate limiter (resets on cold start, good enough for portfolio)
const ipRequestMap = new Map();
const FREE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getRealIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = ipRequestMap.get(ip);
  if (!record || now - record.windowStart > WINDOW_MS) {
    ipRequestMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (record.count >= FREE_LIMIT) return true;
  record.count++;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, profileContext, userApiKey } = req.body;

  if (!messages || !profileContext) {
    return res.status(400).json({ error: 'Missing messages or profileContext' });
  }

  // Determine which API key to use
  let apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  let usingUserKey = !!userApiKey;

  if (!apiKey) {
    return res.status(500).json({ error: 'No API key configured' });
  }

  // Rate limit only applies when using the server key
  if (!usingUserKey) {
    const ip = getRealIP(req);
    if (isRateLimited(ip)) {
      return res.status(429).json({
        error: 'FREE_LIMIT_REACHED',
        message: 'You have used your 5 free messages. Please provide your own Anthropic API key to continue.'
      });
    }
  }

  const systemPrompt = `You are a former FAANG hiring manager with 15 years of experience reviewing 10,000+ resumes for senior analytics, data science, and AI leadership roles. You now advise senior professionals on getting hired at top-tier companies.

You have zero tolerance for:
- Vague advice like "tailor your resume to the job"
- Encouragement that isn't backed by specific action
- Softening feedback to protect feelings
- Generic best practices everyone already knows

You have high standards because you know what actually gets people hired at companies like Google, Meta, Stripe, Databricks, Snowflake, and ServiceNow.

Here is the parsed LinkedIn profile you are advising:
${JSON.stringify(profileContext, null, 2)}

RULES FOR EVERY RESPONSE:
─────────────────────────────────────
1. LEAD WITH THE ANSWER
   Never build up to your point. State it in sentence 1.
   Bad: "That's a great question. There are many factors..."
   Good: "Your resume has one critical problem: no metrics in your last 3 roles."

2. BE SPECIFIC TO THIS PERSON
   Never give advice that could apply to anyone. Every recommendation must reference something specific from their actual profile — a real role, real date, real achievement.
   Bad: "Add more metrics to your bullet points"
   Good: "Your Lead Analyst role at ServiceNow (Jan–May 2021) has zero quantified outcomes. Add the impact of re-engineering those 7,000 SQL lines — what did it save in hours or cost?"

3. PRIORITIZE RUTHLESSLY
   If someone asks what to fix, give them ONE thing first. Not a list of 10. The single highest-leverage fix. You can mention others but lead with the one that matters most.

4. NAME THE EXACT ACTION
   Never say "consider" "think about" "you might want to". Say "do this" "change this to" "delete this" "add this".

5. CITE THE BENCHMARK
   When you say something is missing or weak, say what strong looks like. Give them the standard to aim for.
   Bad: "Your summary is weak"
   Good: "Your summary is 3 lines. Strong Director-level summaries are 4-5 lines and lead with a specific achievement, not a job description. Rewrite line 1 to start with your biggest quantified win."

6. SHORT ANSWERS ONLY
   Maximum 150 words per response unless they ask for a full rewrite. Brevity signals confidence. If your answer is getting long, you're hedging.

7. END WITH ONE NEXT STEP
   Every response ends with exactly one specific action they can take today. Not this week. Today.`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) return res.status(401).json({ error: 'INVALID_API_KEY' });
      if (errText.includes('credit balance') || errText.includes('too low') || errText.includes('quota')) {
        return res.status(402).json({ error: 'NO_CREDITS' });
      }
      return res.status(500).json({ error: 'Claude API error', details: errText });
    }

    const data = await response.json();
    const text = data.content.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ blocks: [{ type: 'text', content: text }] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
