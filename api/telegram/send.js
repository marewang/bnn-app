export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
    }
    const { chatId, text } = await req.json();
    if (!chatId || !text) {
      return new Response(JSON.stringify({ error: "chatId dan text wajib diisi" }), { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: "Env TELEGRAM_BOT_TOKEN belum diset di Vercel" }), { status: 500 });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
    });

    const data = await tgRes.json();
    if (!tgRes.ok || !data.ok) {
      return new Response(JSON.stringify({ error: data.description || "Gagal mengirim" }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Unexpected error" }), { status: 500 });
  }
}
