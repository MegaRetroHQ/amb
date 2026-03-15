"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command"
import {
  MessageSquareIcon,
  InboxIcon,
  AlertTriangleIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  KeyboardIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
  SendIcon,
  BookOpenIcon,
  HelpCircleIcon,
} from "lucide-react"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (tab: "messages" | "inbox" | "dlq") => void
  onNewThread: () => void
  onRefresh: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onNewThread,
  onRefresh,
}: CommandPaletteProps) {
  const router = useRouter()
  const runCommand = useCallback(
    (command: () => void) => {
      onOpenChange(false)
      command()
    },
    [onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No command found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => onNavigate("messages"))}>
            <MessageSquareIcon className="size-4" />
            <span>Messages</span>
            <CommandShortcut>1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate("inbox"))}>
            <InboxIcon className="size-4" />
            <span>Inbox</span>
            <CommandShortcut>2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate("dlq"))}>
            <AlertTriangleIcon className="size-4" />
            <span>Error queue (DLQ)</span>
            <CommandShortcut>3</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(onNewThread)}>
            <PlusIcon className="size-4" />
            <span>New thread</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onRefresh)}>
            <RefreshCwIcon className="size-4" />
            <span>Refresh</span>
            <CommandShortcut>R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {})}>
            <SearchIcon className="size-4" />
            <span>Search</span>
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => window.open("/api-docs", "_blank", "noopener,noreferrer"))
            }
          >
            <BookOpenIcon className="size-4" />
            <span>API docs (Swagger)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/help"))}
          >
            <HelpCircleIcon className="size-4" />
            <span>Help</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Selection">
          <CommandItem disabled>
            <ArrowUpIcon className="size-4" />
            <span>Previous item</span>
            <CommandShortcut>K / ↑</CommandShortcut>
          </CommandItem>
          <CommandItem disabled>
            <ArrowDownIcon className="size-4" />
            <span>Next item</span>
            <CommandShortcut>J / ↓</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Messages">
          <CommandItem disabled>
            <CheckIcon className="size-4" />
            <span>Ack message</span>
            <CommandShortcut>A</CommandShortcut>
          </CommandItem>
          <CommandItem disabled>
            <SendIcon className="size-4" />
            <span>Send message</span>
            <CommandShortcut>⌘ Enter</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

// Hook to open command palette via ⌘K
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      // ? to show shortcuts
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        if (!isInput) {
          e.preventDefault()
          setOpen(true)
        }
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return { open, setOpen }
}
