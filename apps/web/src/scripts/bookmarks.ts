// Shared bookmark (찜) management module
// Used across search.astro, index.astro, mybookshelf.astro

import { supabase } from '../lib/supabase';

// isbn13 → reading_status ('to_read' | 'reading' | 'read') 매핑
let bookmarkedMap: Map<string, string> = new Map();
let currentUserId: string | null = null;
let loaded = false;

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function initBookmarks(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      currentUserId = null;
      bookmarkedMap.clear();
      loaded = true;
      return;
    }
    currentUserId = session.user.id;
    await loadBookmarks();
  } catch {
    loaded = true;
  }
}

async function loadBookmarks(): Promise<void> {
  if (!currentUserId) return;
  try {
    const token = await getAuthToken();
    if (!token) return;
    const res = await fetch('/api/bookmarks', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    bookmarkedMap = new Map(
      (data.bookmarks || []).map((b: any) => [b.isbn13, b.reading_status || 'to_read'])
    );
  } catch {
    // ignore
  }
  loaded = true;
}

export function isBookmarked(isbn13: string): boolean {
  return bookmarkedMap.has(isbn13);
}

export function getUserId(): string | null {
  return currentUserId;
}

export function getBookmarkedIsbns(): string[] {
  return Array.from(bookmarkedMap.keys());
}

export function isLoaded(): boolean {
  return loaded;
}

export function getReadingStatus(isbn13: string): string | null {
  return bookmarkedMap.get(isbn13) ?? null;
}

export async function updateReadingStatus(
  isbn13: string,
  status: 'to_read' | 'reading' | 'read'
): Promise<boolean> {
  if (!currentUserId) return false;
  const token = await getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/bookmarks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isbn13, reading_status: status }),
    });
    if (!res.ok) return false;
    bookmarkedMap.set(isbn13, status);
    return true;
  } catch {
    return false;
  }
}

export async function toggleBookmark(book: {
  isbn13: string;
  bookname?: string;
  authors?: string;
  publisher?: string;
  publication_year?: string;
  bookImageURL?: string;
}): Promise<boolean> {
  if (!currentUserId) return false;

  const isbn = book.isbn13;
  if (!isbn) return false;

  const token = await getAuthToken();
  if (!token) return false;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  if (bookmarkedMap.has(isbn)) {
    // Remove
    try {
      await fetch('/api/bookmarks', {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ isbn13: isbn }),
      });
      bookmarkedMap.delete(isbn);
      return false; // not bookmarked now
    } catch {
      return true; // still bookmarked
    }
  } else {
    // Add
    try {
      await fetch('/api/bookmarks', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          isbn13: isbn,
          bookname: book.bookname || '',
          authors: book.authors || '',
          publisher: book.publisher || '',
          publication_year: book.publication_year || '',
          book_image_url: book.bookImageURL || '',
          reading_status: 'to_read',
        }),
      });
      bookmarkedMap.set(isbn, 'to_read');
      return true; // bookmarked now
    } catch {
      return false; // not bookmarked
    }
  }
}

// Render a heart button for a book card
export function renderHeartButton(isbn13: string, extraClasses = ''): string {
  if (!isbn13) return '';
  const filled = bookmarkedMap.has(isbn13);
  return `
    <button
      class="bookmark-btn ${extraClasses} flex items-center justify-center w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      data-isbn="${isbn13}"
      title="${filled ? '찜 해제' : '찜하기'}"
    >
      <span class="material-symbols-outlined text-lg ${filled ? 'text-red-500' : 'text-charcoal/30 dark:text-white/30'}" style="font-variation-settings: 'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24;">
        favorite
      </span>
    </button>
  `;
}
