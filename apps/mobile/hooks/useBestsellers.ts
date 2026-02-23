import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Book } from "../lib/types";

// 인기 대출: { response: { docs: [{ doc: {...} }, ...] } }
function extractPopularBooks(data: any): Book[] {
  if (!data) return [];
  const docs: any[] = data.response?.docs ?? [];
  return docs.map((d: any) => d?.doc ?? d) as Book[];
}

// 급상승: { response: { results: [{ result: { docs: [{ doc: {...} }, ...] } }] } }
function extractHotBooks(data: any): Book[] {
  if (!data) return [];
  const results: any[] = data.response?.results ?? [];
  const resultWithDocs = results.find(
    (r: any) => r.result?.docs?.length > 0
  );
  const docs: any[] = resultWithDocs?.result?.docs ?? [];
  return docs.map((item: any) => item.doc ?? item) as Book[];
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
      return extractPopularBooks(data);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useHotTrend(searchDt?: string) {
  return useQuery<Book[]>({
    queryKey: ["hot-trend", searchDt],
    queryFn: async () => {
      const data = await api.hotTrend(searchDt);
      return extractHotBooks(data);
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });
}
