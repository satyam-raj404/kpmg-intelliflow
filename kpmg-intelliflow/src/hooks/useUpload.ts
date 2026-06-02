import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { uploadFile, fetchBatchStatus } from "@/api/queries";
import type { BatchStatus, UploadResponse } from "@/api/types";

interface UploadProgress {
  pct: number;
  message: string;
}

export function useUpload() {
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({ pct: 0, message: "" });
  const esRef = useRef<EventSource | null>(null);

  // SSE progress listener
  useEffect(() => {
    if (!batchId) return;
    const es = new EventSource("/api/stream");
    esRef.current = es;
    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "UPLOAD_PROGRESS" && data.batch_id === batchId) {
          setProgress({ pct: data.pct, message: data.message });
        }
        if (data.type === "KPI_REFRESH") {
          queryClient.invalidateQueries({ queryKey: ["kpi"] });
          queryClient.invalidateQueries({ queryKey: ["charts"] });
        }
      } catch {}
    });
    return () => es.close();
  }, [batchId, queryClient]);

  const mutation = useMutation<UploadResponse, Error, File>({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      setBatchId(data.batch_id);
      setProgress({ pct: 5, message: "Upload received, processing…" });
    },
  });

  // Poll batch status while PROCESSING
  const batchQuery = useQuery<BatchStatus>({
    queryKey: ["batch", batchId],
    queryFn: () => fetchBatchStatus(batchId!),
    enabled: !!batchId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PROCESSING" ? 2000 : false;
    },
  });

  const reset = () => {
    setBatchId(null);
    setProgress({ pct: 0, message: "" });
    esRef.current?.close();
  };

  return {
    upload: mutation.mutate,
    isUploading: mutation.isPending || batchQuery.data?.status === "PROCESSING",
    progress,
    batch: batchQuery.data ?? null,
    error: mutation.error?.message ?? batchQuery.data?.error_message ?? null,
    reset,
  };
}
