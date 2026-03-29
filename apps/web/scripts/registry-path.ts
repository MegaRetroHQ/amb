import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Каноническое расположение: корень проекта — `.cursor/agents/registry.json`.
 *
 * Скрипты лежат в `apps/web/scripts`, поэтому сначала поднимаемся на два уровня вверх к корню монорепо.
 * Дальше — варианты от `cwd`, если команду запускают из другого каталога.
 */
export async function resolveRegistryJsonPath(): Promise<string> {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  // apps/web/scripts → apps/web → apps → repo root
  const candidates = [
    path.resolve(scriptsDir, "..", "..", "..", ".cursor/agents/registry.json"),
    path.resolve(process.cwd(), ".cursor/agents/registry.json"),
    path.resolve(process.cwd(), "..", "..", ".cursor/agents/registry.json"),
  ];

  for (const candidate of candidates) {
    try {
      const st = await fs.stat(candidate);
      if (st.isFile()) return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `registry.json not found. Tried:\n${candidates.map((p) => `  - ${p}`).join("\n")}`
  );
}
