// Shared favorite libraries management module
// Used across book-modal and search pages

import { supabase } from '../lib/supabase';

export interface FavoriteLibraryInfo {
  lib_code: string;
  lib_name: string;
  address: string;
  tel?: string;
  latitude: string;
  longitude: string;
  homepage?: string;
}

// lib_code → FavoriteLibraryInfo
let favoriteMap: Map<string, FavoriteLibraryInfo> = new Map();
let loaded = false;

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function initFavoriteLibraries(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      favoriteMap.clear();
      loaded = true;
      return;
    }
    await loadFavoriteLibraries();
  } catch {
    loaded = true;
  }
}

async function loadFavoriteLibraries(): Promise<void> {
  try {
    const token = await getAuthToken();
    if (!token) return;
    const res = await fetch('/api/favorite-libraries', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    favoriteMap = new Map(
      (data.libraries || []).map((lib: any) => [lib.lib_code, {
        lib_code: lib.lib_code,
        lib_name: lib.lib_name,
        address: lib.address || '',
        tel: lib.tel || '',
        latitude: lib.latitude || '',
        longitude: lib.longitude || '',
        homepage: lib.homepage || '',
      }])
    );
  } catch {
    // ignore
  }
  loaded = true;
}

export function isFavoriteLibrary(libCode: string): boolean {
  return favoriteMap.has(libCode);
}

export function getFavoriteLibraries(): FavoriteLibraryInfo[] {
  return Array.from(favoriteMap.values());
}

export function getFavoriteLibraryCount(): number {
  return favoriteMap.size;
}

export function isFavLibrariesLoaded(): boolean {
  return loaded;
}

export async function toggleFavoriteLibrary(lib: {
  libCode: string;
  libName: string;
  address?: string;
  tel?: string;
  latitude?: string;
  longitude?: string;
  homepage?: string;
}): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return favoriteMap.has(lib.libCode);

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  if (favoriteMap.has(lib.libCode)) {
    // Remove
    try {
      await fetch('/api/favorite-libraries', {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ lib_code: lib.libCode }),
      });
      favoriteMap.delete(lib.libCode);
      return false;
    } catch {
      return true;
    }
  } else {
    // Add
    try {
      const res = await fetch('/api/favorite-libraries', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          lib_code: lib.libCode,
          lib_name: lib.libName,
          address: lib.address || '',
          tel: lib.tel || '',
          latitude: lib.latitude || '',
          longitude: lib.longitude || '',
          homepage: lib.homepage || '',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 400 && errData.error) {
          alert(errData.error);
        }
        return false;
      }
      favoriteMap.set(lib.libCode, {
        lib_code: lib.libCode,
        lib_name: lib.libName,
        address: lib.address || '',
        tel: lib.tel || '',
        latitude: lib.latitude || '',
        longitude: lib.longitude || '',
        homepage: lib.homepage || '',
      });
      return true;
    } catch {
      return false;
    }
  }
}
