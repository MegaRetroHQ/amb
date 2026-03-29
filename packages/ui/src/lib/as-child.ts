import type { ComponentRenderFn, HTMLProps } from "@base-ui/react/types"
import * as React from "react"

type RenderLike<State = unknown> =
  | React.ReactElement
  | ComponentRenderFn<HTMLProps, State>
  | undefined

/**
 * Radix-style `asChild` maps to Base UI `render` with a single element child.
 */
export function mergeAsChildRender<State = unknown>(
  asChild: boolean | undefined,
  render: RenderLike<State>,
  children: React.ReactNode
): {
  render: RenderLike<State>
  children: React.ReactNode
  slottedElement: React.ReactElement | undefined
} {
  if (render !== undefined) {
    return { render, children, slottedElement: undefined }
  }
  if (asChild && React.isValidElement(children)) {
    return {
      render: children,
      children: undefined,
      slottedElement: children,
    }
  }
  return { render: undefined, children, slottedElement: undefined }
}

/** When slotted element is not a native `<button>`, Base UI needs `nativeButton={false}`. */
export function inferNativeButtonFromSlot(
  slotted: React.ReactElement | undefined
): boolean | undefined {
  if (!slotted) return undefined
  if (typeof slotted.type === "string") {
    return slotted.type === "button"
  }
  const component = slotted.type as {
    displayName?: string
    name?: string
  }
  const componentName = component.displayName ?? component.name
  if (componentName === "Button") {
    return true
  }
  const slotProps = slotted.props
  if (
    slotProps !== null &&
    typeof slotProps === "object" &&
    "nativeButton" in slotProps
  ) {
    return Boolean(
      (slotProps as { nativeButton?: boolean }).nativeButton
    )
  }
  return false
}
