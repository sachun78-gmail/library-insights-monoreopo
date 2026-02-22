import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Book } from "../lib/types";

function extractBooks(data: any): Book[] {
  if (!data) return [];
  const docs = data.docs ?? data.response?.docs ?? (Array.isArray(data) ? data : []);
  return docs.map((d: any) => d?.doc ?? d) as Book[];
}

export interface BestsellerParams {
  startDt?: string;
  endDt?: string;
  gender?: string;
  from_age?: string;
  to_age?: string;
  region?: string;
  pageSize?: number;
}

export function useBestsellers(params: BestsellerParams) {
  return useQuery<Book[]>({
    queryKey: ["popular-books", params],
    queryFn: async () => {
      const data = await api.popularBooks(params);
      return extractBooks(data);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useHotTrend(searchDt?: string) {
  return useQuery({
    queryKey: ["hot-trend", searchDt],
    queryFn: () => api.hotTrend(searchDt),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });
}
