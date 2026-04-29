export const config = { runtime: "edge" };

// Use the new environment variable name
const API_URL = (process.env.AI_MODEL_ENDPOINT || "").replace(/\/$/, "");

const SKIP_LIST = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", 
  "x-forwarded-port"
]);

export default async function handler(request) {
  // If the variable is not set, it will fail
  if (!API_URL) {
    return new Response("Missing API Config", { status: 500 });
  }

  try {
    // Exact same logic as your working code but with different variable names
    const pathPosition = request.url.indexOf("/", 8);
    const targetPath = pathPosition === -1 ? "/" : request.url.slice(pathPosition);
    const finalUrl = API_URL + targetPath;

    const forwardHeaders = new Headers();
    let visitorIp = null;

    for (const [key, val] of request.headers) {
      const k = key.toLowerCase();
      if (SKIP_LIST.has(k) || k.startsWith("x-vercel-")) continue;

      if (k === "x-real-ip") {
        visitorIp = val;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!visitorIp) visitorIp = val;
        continue;
      }
      forwardHeaders.set(k, val);
    }

    if (visitorIp) forwardHeaders.set("x-forwarded-for", visitorIp);

    const { method, body } = request;

    return await fetch(finalUrl, {
      method,
      headers: forwardHeaders,
      body: (method !== "GET" && method !== "HEAD") ? body : undefined,
      duplex: "half",
      redirect: "manual",
    });

  } catch (err) {
    // Minimalistic error reporting
    console.error("Link error:", err.message);
    return new Response("Service Unavailable", { status: 502 });
  }
}
