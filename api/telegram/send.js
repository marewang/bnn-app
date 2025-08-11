export const config = { runtime: "nodejs" };

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    const { chatId, text } = await readJson(req);
    if (!chatId || !text) {
      return res.status(400).json({ error: "chatId dan text wajib diisi" });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "Env TELEGRAM_BOT_TOKEN belum diset di Vercel" });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    let data = {};
    try { data = await tgRes.json(); } catch {}
    if (!tgRes.ok || data.ok === false) {
      // JANGAN samarkan error — lempar apa adanya biar mudah debug
      const desc = (data && data.description) ? data.description : `Telegram HTTP ${tgRes.status}`;
      const code = tgRes.status === 400 ? 400 : 502; // 400 utk chat id salah, 502 utk error upstream
      return res.status(code).json({ error: desc, telegram: data });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
