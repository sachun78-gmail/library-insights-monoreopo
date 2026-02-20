/**
 * Cloudflare Cache API wrapper
 * 로컬 개발 환경에서는 caches가 없으므로 graceful fallback (캐시 없이 동작)
 */

function getCache(): Cache | null {
  try {
    return (caches as any).default ?? null;
  } catch {
    return null;
  }
}

export async function getCachedResponse(cacheKey: string): Promise<Response | null> {
  const cache = getCache();
  if (!cache) return null;

  try {
    const cached = await cache.match(new Request(cacheKey));
    return cached ?? null;
  } catch {
    return null;
  }
}

export async function setCachedResponse(
  cacheKey: string,
  data: any,
  ttlSeconds: number,
): Promise<void> {
  const cache = getCache();
  if (!cache) return;

  try {
    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${ttlSeconds}`,
      },
    });
    await cache.put(new Request(cacheKey), response);
  } catch {
    // 캐시 저장 실패는 무시
  }
}
