// Shared bookmark (찜) management module
// Used across search.astro, index.astro, mybookshelf.astro

import { supabase } from '../lib/supabase';

let bookmarkedIsbns: Set<string> = new Set();
let currentUserId: string | null = null;
let loaded = false;

export async function initBookmarks(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      currentUserId = null;
      bookmarkedIsbns.clear();
      loaded = true;
      return;
    }
    currentUserId = user.id;
    await loadBookmarks();
  } catch {
    loaded = true;
  }
}

async function loadBookmarks(): Promise<void> {
  if (!currentUserId) return;
  try {
    const res = await fetch(`/api/bookmarks?userId=${currentUserId}`);
    const data = await res.json();
    bookmarkedIsbns = new Set((data.bookmarks || []).map((b: any) => b.isbn13));
  } catch {
    // ignore
  }
  loaded = true;
}

export function isBookmarked(isbn13: string): boolean {
  return bookmarkedIsbns.has(isbn13);
}

export function getUserId(): string | null {
  return currentUserId;
}

export function getBookmarkedIsbns(): string[] {
  return Array.from(bookmarkedIsbns);
}

export function isLoaded(): boolean {
  return loaded;
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

  if (bookmarkedIsbns.has(isbn)) {
    // Remove
    try {
      await fetch('/api/bookmarks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, isbn13: isbn }),
      });
      bookmarkedIsbns.delete(isbn);
      return false; // not bookmarked now
    } catch {
      return true; // still bookmarked
    }
  } else {
    // Add
    try {
      await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          isbn13: isbn,
          bookname: book.bookname || '',
          authors: book.authors || '',
          publisher: book.publisher || '',
          publication_year: book.publication_year || '',
          book_image_url: book.bookImageURL || '',
        }),
      });
      bookmarkedIsbns.add(isbn);
      return true; // bookmarked now
    } catch {
      return false; // not bookmarked
    }
  }
}

// Render a heart button for a book card
export function renderHeartButton(isbn13: string, extraClasses = ''): string {
  if (!isbn13) return '';
  const filled = bookmarkedIsbns.has(isbn13);
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
