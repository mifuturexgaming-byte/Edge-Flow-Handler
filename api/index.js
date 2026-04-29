// Global Edge Runtime Configuration
export const config = { runtime: "edge" };

// Set your backend endpoint in Vercel Env as TARGET_DOMAIN
const upstreamServer = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

// Standard headers to exclude from the relay process
const forbiddenHeaders = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handleRequest(request) {
  // Validate configuration
  if (!upstreamServer) {
    return new Response("Configuration missing: TARGET_DOMAIN", { status: 500 });
  }

  try {
    // Extract path using the original logic
    const pathIdx = request.url.indexOf("/", 8);
    const finalDestination =
      pathIdx === -1 ? upstreamServer + "/" : upstreamServer + request.url.slice(pathIdx);

    const relayHeaders = new Headers();
    let remoteIp = null;

    for (const [key, val] of request.headers) {
      const lowerKey = key.toLowerCase();
      
      // Filter out internal and restricted headers
      if (forbiddenHeaders.has(lowerKey) || lowerKey.startsWith("x-vercel-")) continue;
      
      if (lowerKey === "x-real-ip") {
        remoteIp = val;
        continue;
      }
      if (lowerKey === "x-forwarded-for") {
        if (!remoteIp) remoteIp = val;
        continue;
      }
      relayHeaders.set(key, val);
    }

    if (remoteIp) relayHeaders.set("x-forwarded-for", remoteIp);

    const method = request.method;
    const isPayloadMethod = method !== "GET" && method !== "HEAD";

    // Standard fetch to the upstream source
    return await fetch(finalDestination, {
      method,
      headers: relayHeaders,
      body: isPayloadMethod ? request.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    console.error("Relay error:", err);
    return new Response("Service Unavailable", { status: 502 });
  }
}
