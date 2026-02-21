const DEFAULT_TIMEOUT_MS = 5000;

function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  const fromImportMeta = (import.meta.env as any)[key];
  if (fromImportMeta) {
    return fromImportMeta;
  }
  return process.env[key];
}

function resolveProxyBaseUrl(baseUrl: string, port?: string): string {
  const baseWithProtocol = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
  const parsed = new URL(baseWithProtocol);

  if (port && !parsed.port) {
    parsed.port = port;
  }

  return parsed.toString().replace(/\/+$/, '');
}

export async function fetchLibraryProxy(
  locals: any,
  endpoint: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<any> {
  const baseUrl = getEnvVar(locals, 'LIB_PROXY_BASE_URL');
  const proxyPort = getEnvVar(locals, 'LIB_PROXY_PORT');
  const sharedSecret = getEnvVar(locals, 'LIB_PROXY_SHARED_SECRET');

  if (!baseUrl || !sharedSecret) {
    const missing = [
      !baseUrl ? 'LIB_PROXY_BASE_URL' : null,
      !sharedSecret ? 'LIB_PROXY_SHARED_SECRET' : null,
    ]
      .filter(Boolean)
      .join(', ');
    throw new Error(`Library proxy not configured: missing ${missing}`);
  }

  const normalizedBase = resolveProxyBaseUrl(baseUrl, proxyPort);
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }

  const requestUrl = `${normalizedBase}${normalizedEndpoint}${query.toString() ? `?${query.toString()}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'x-proxy-key': sharedSecret,
      },
      signal: controller.signal,
    });
    const rawText = await response.text();
    let data: any = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        const preview = rawText.slice(0, 200).replace(/\s+/g, ' ').trim();
        throw new Error(
          `Library proxy returned non-JSON response (status ${response.status}) from ${requestUrl}: ${preview}`
        );
      }
    }

    if (!response.ok) {
      const message = data?.error || `Library proxy request failed: ${response.status}`;
      throw new Error(`${message} (${requestUrl})`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}
