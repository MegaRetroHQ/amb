"use client";

type DescriptionEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
};

export function DescriptionEditor({
  value,
  onChange,
  placeholder = "Description (Markdown: **bold**, *italic*, lists, links, code...)",
  minHeight = "12rem",
}: DescriptionEditorProps) {
  return (
    <textarea
      className="min-h-48 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      style={{ minHeight }}
    />
  );
}
