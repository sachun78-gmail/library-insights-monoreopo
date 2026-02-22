import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Book } from "../lib/types";

const PAGE_SIZE = 20;

function extractBooks(data: any): Book[] {
  if (!data) return [];
  const docs = data.docs ?? data.response?.docs ?? (Array.isArray(data) ? data : []);
  return docs.map((d: any) => d?.doc ?? d) as Book[];
}

function getTotal(data: any): number {
  return data?.numFound ?? data?.response?.numFound ?? 0;
}

export function useSearch(keyword: string, type: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["search", keyword, type],
    queryFn: async ({ pageParam }) => {
      const data = await api.search(keyword, type, pageParam as number, PAGE_SIZE);
      return { books: extractBooks(data), total: getTotal(data) };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * PAGE_SIZE;
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    enabled: enabled && keyword.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
