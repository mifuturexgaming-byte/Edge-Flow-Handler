export const config = { runtime: "edge" };

// برگشت به نام قبلی برای اطمینان از کارکرد
const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const IGNORE = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", 
  "x-forwarded-port"
]);

export default async function handler(req) {
  if (!TARGET_BASE) {
    return new Response("Configuration missing", { status: 500 });
  }

  try {
    // استفاده از متد استاندارد برای استخراج مسیر
    const urlObj = new URL(req.url);
    const targetUrl = TARGET_BASE + urlObj.pathname + urlObj.search;

    const newHeaders = new Headers();
    let visitorIp = null;

    for (const [k, v] of req.headers) {
      const lowK = k.toLowerCase();
      if (IGNORE.has(lowK) || lowK.startsWith("x-vercel-")) continue;

      if (lowK === "x-real-ip") {
        visitorIp = v;
        continue;
      }
      if (lowK === "x-forwarded-for") {
        if (!visitorIp) visitorIp = v;
        continue;
      }
      newHeaders.set(k, v);
    }

    if (visitorIp) newHeaders.set("x-forwarded-for", visitorIp);

    // ارسال درخواست با تنظیمات بهینه
    return await fetch(targetUrl, {
      method: req.method,
      headers: newHeaders,
      body: (req.method !== "GET" && req.method !== "HEAD") ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

  } catch (err) {
    console.error("Bridge Error:", err.message);
    return new Response("Connection Failed", { status: 502 });
  }
}
