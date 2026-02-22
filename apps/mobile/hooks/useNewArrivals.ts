import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Book } from "../lib/types";

function extractBooks(data: any): Book[] {
  if (!data) return [];
  // Normalize various response shapes from the library API
  const docs = data.docs ?? data.response?.docs ?? (Array.isArray(data) ? data : []);
  return docs.map((d: any) => d?.doc ?? d) as Book[];
}

export function useNewArrivals() {
  return useQuery<Book[]>({
    queryKey: ["new-arrivals"],
    queryFn: async () => {
      const data = await api.newArrivals();
      return extractBooks(data);
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });
}
