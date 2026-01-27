"use client";

import { JsonView, allExpanded } from "react-json-view-lite";
import type { StyleProps } from "react-json-view-lite";

type Props = {
  data: unknown;
  className?: string;
};

// Кастомные стили для тёмной темы
const customStyles: StyleProps = {
  container: "json-container",
  basicChildStyle: "json-child",
  label: "json-label",
  nullValue: "json-null",
  undefinedValue: "json-undefined",
  stringValue: "json-string",
  booleanValue: "json-boolean",
  numberValue: "json-number",
  otherValue: "json-other",
  punctuation: "json-punctuation",
  collapseIcon: "json-collapse-icon",
  expandIcon: "json-expand-icon",
  collapsedContent: "json-collapsed",
};

export function JsonViewer({ data, className }: Props) {
  try {
    // Если это строка, пытаемся распарсить как JSON
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        // Если не JSON, возвращаем как есть
        return <span className={className}>{data}</span>;
      }
    }

    return (
      <div className={`${className || ""} json-viewer-wrapper`}>
        <JsonView
          data={data}
          shouldExpandNode={allExpanded}
          style={customStyles}
        />
      </div>
    );
  } catch {
    // Fallback на обычный JSON.stringify
    return (
      <pre className={`${className || ""} font-mono text-sm whitespace-pre-wrap break-words text-foreground`}>
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
}
