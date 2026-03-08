export type Agent = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  status: string;
  capabilities: unknown;
  createdAt: string;
  lastSeen: string | null;
};

export type Thread = {
  id: string;
  projectId: string;
  title: string;
  status: "open" | "closed" | "archived";
  createdAt: string;
};

export type Message = {
  id: string;
  projectId: string;
  threadId: string;
  fromAgentId: string;
  toAgentId: string | null;
  payload: unknown;
  status: string;
  retries: number;
  parentId: string | null;
  createdAt: string;
};
