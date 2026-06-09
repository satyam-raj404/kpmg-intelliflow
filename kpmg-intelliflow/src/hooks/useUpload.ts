import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { uploadFile, fetchBatchStatus } from "@/api/queries";
import type { BatchStatus, UploadResponse } from "@/api/types";
import { useApp } from "@/context/AppContext";

interface UploadProgress {
  pct: number;
  message: string;
}

export function useUpload() {
  const queryClient = useQueryClient();
  const { addActivity } = useApp();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({ pct: 0, message: "" });
  const esRef = useRef<EventSource | null>(null);
  const filenameRef = useRef<string>("");
  const loggedBatchRef = useRef<string | null>(null);

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
    mutationFn: (file: File) => {
      filenameRef.current = file.name;
      return uploadFile(file);
    },
    onSuccess: (data) => {
      setBatchId(data.batch_id);
      setProgress({ pct: 5, message: "Upload received, processing…" });
    },
    onError: (err) => {
      addActivity({
        type: "upload",
        label: "Data Upload",
        detail: `${filenameRef.current || "file"} — ${err.message || "Upload failed"}`,
        status: "failed",
      });
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

  // Log to history when batch completes or fails
  useEffect(() => {
    const status = batchQuery.data?.status;
    if (!status || !batchId || loggedBatchRef.current === batchId) return;
    if (status === "COMPLETED") {
      loggedBatchRef.current = batchId;
      const rows = batchQuery.data?.rows_accepted;
      addActivity({
        type: "upload",
        label: "Data Upload",
        detail: `${filenameRef.current}${rows ? ` — ${rows.toLocaleString()} rows loaded` : ""}`,
        status: "success",
      });
    } else if (status === "FAILED") {
      loggedBatchRef.current = batchId;
      addActivity({
        type: "upload",
        label: "Data Upload",
        detail: `${filenameRef.current} — ${batchQuery.data?.error_message || "Processing failed"}`,
        status: "failed",
      });
    }
  }, [batchQuery.data?.status, batchId, addActivity]);

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
