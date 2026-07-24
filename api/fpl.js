const ALLOWED = ["bootstrap-static/", "fixtures/", "event-status/"];

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const path = String(req.query.path || "bootstrap-static/");
  const ok = ALLOWED.includes(path) || /^(element-summary|entry)\/\d+\/?$/.test(path);
  if (!ok) return res.status(400).json({ error: "path not allowed" });

  try {
    const upstream = await fetch(`https://fantasy.premierleague.com/api/${path}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "could not reach FPL" });
  }
};
