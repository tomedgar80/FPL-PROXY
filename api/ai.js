// Server-side Claude call for the AI judgement layer.
// Needs env var ANTHROPIC_API_KEY set in Vercel → Settings → Environment Variables.

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: "no_key" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const players = Array.isArray(body?.players) ? body.players.slice(0, 30) : [];
  if (!players.length) return res.status(400).json({ error: "no players" });

  const preseason = !!body.preseason;
  const list = players.map((p) => `${p.id}|${p.name}|${p.team}|${p.pos}`).join("\n");
  const focus = preseason
    ? "It is PRE-SEASON. Focus on confirmed transfers, expected starting roles, pre-season injuries, and whether a player has won or lost a starting spot."
    : "Focus on injuries, suspensions, press-conference hints and rotation patterns for the next gameweek.";

  const prompt = `You are the judgement layer of a Fantasy Premier League projection engine. Use web search for the LATEST Premier League news on these players (id|name|team|position):
${list}

${focus}

Respond with ONLY a JSON array, no markdown fences, no prose. One object per player you have a meaningful update for (omit the rest, max 15):
[{"id": <number>, "avail": <0-1 probability they feature>, "rotationRisk": <true|false>, "fixtureNudge": <-0.1 to 0.1>, "note": "<max 12 words>"}]
Be conservative: only adjust where there is a concrete, sourced reason.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "claude error" });

    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("["), e = clean.lastIndexOf("]");
    if (s === -1 || e === -1) return res.status(200).json({ adjustments: [] });
    return res.status(200).json({ adjustments: JSON.parse(clean.slice(s, e + 1)) });
  } catch (err) {
    return res.status(502).json({ error: "could not reach Claude" });
  }
};
