import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { MonthlyRecommend } from "../lib/types";

export function useRecommend() {
  return useQuery<MonthlyRecommend>({
    queryKey: ["monthly-recommend"],
    queryFn: () => api.monthlyRecommend(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
