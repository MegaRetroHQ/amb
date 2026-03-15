"use client";

import { useState, useEffect, useCallback } from "react";
import type { Agent } from "@/lib/types";

function withProjectId(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  const projectId = new URLSearchParams(window.location.search).get("projectId");
  if (!projectId) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}projectId=${encodeURIComponent(projectId)}`;
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(withProjectId("/api/agents"));
      const json = await res.json();
      if (json.data) {
        setAgents(json.data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, loading, error, refetch: fetchAgents };
}
