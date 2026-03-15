"use client";

import { useState, useEffect, useCallback } from "react";
import type { Agent } from "@/lib/types";
import { useProjectId } from "@/lib/context/project-context";
import { withProjectId } from "@/lib/api/build-url";

export function useAgents() {
  const projectId = useProjectId();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(withProjectId(projectId, "/api/agents"));
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
  }, [projectId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, loading, error, refetch: fetchAgents };
}
