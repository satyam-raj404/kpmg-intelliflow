import { useQuery } from "@tanstack/react-query";
import { fetchLifecycle, fetchAnomalies, fetchP2PEvents } from "@/api/queries";
import type { LifecycleData, AnomalyCount, P2PEventsResponse } from "@/api/types";

export function useLifecycle() {
  return useQuery<LifecycleData>({
    queryKey: ["p2p", "lifecycle"],
    queryFn: fetchLifecycle,
  });
}

export function useAnomalies() {
  return useQuery<AnomalyCount[]>({
    queryKey: ["p2p", "anomalies"],
    queryFn: fetchAnomalies,
  });
}

export function useP2PEvents(params?: { limit?: number; offset?: number; variant_class?: string }) {
  return useQuery<P2PEventsResponse>({
    queryKey: ["p2p", "events", params],
    queryFn: () => fetchP2PEvents(params),
  });
}
