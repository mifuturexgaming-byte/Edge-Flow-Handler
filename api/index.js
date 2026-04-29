// Optimized for Edge Runtime (Global Low Latency)
export const config = { runtime: "edge" };

// Accessing the secure model endpoint from environment variables
const PROVIDER_API_BASE = (process.env.AI_MODEL_ENDPOINT || "").replace(/\/$/, "");

// Standard headers to be filtered for security and compliance
const MASKED_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", 
  "x-forwarded-port"
]);

export default async function serviceHandler(request) {
  // Check for configuration availability
  if (!PROVIDER_API_BASE) {
    return new Response("Service Configuration Missing", { status: 500 });
  }

  try {
    const { method, url, body } = request;
    const currentUrl = new URL(url);
    
    // Construct the remote service destination
    const destination = `${PROVIDER_API_BASE}${currentUrl.pathname}${currentUrl.search}`;

    const secureHeaders = new Headers();
    let sourceAddr = null;

    // Sanitize and relay incoming headers
    for (const [key, value] of request.headers.entries()) {
      const lowerKey = key.toLowerCase();
      
      // Skip Vercel internal headers and restricted hop-by-hop headers
      if (MASKED_HEADERS.has(lowerKey) || lowerKey.startsWith("x-vercel-")) continue;

      if (lowerKey === "x-real-ip" || lowerKey === "x-forwarded-for") {
        sourceAddr = sourceAddr || value;
      } else {
        secureHeaders.set(key, value);
      }
    }

    // Attach origin tracking if available
    if (sourceAddr) secureHeaders.set("x-forwarded-for", sourceAddr);

    const init = {
      method,
      headers: secureHeaders,
      body: !["GET", "HEAD"].includes(method) ? body : undefined,
      duplex: "half",
      redirect: "manual"
    };

    // Forward the request to the AI service provider
    return await fetch(destination, init);

  } catch (error) {
    console.error("Execution Exception:", error.message);
    return new Response("Service Connectivity Error", { status: 502 });
  }
}