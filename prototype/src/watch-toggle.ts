/**
 * A primitive that does not exist in the ui-sdk library: a "watch" toggle that
 * the page can be told to flip.
 *
 * This file is the whole behaviour. It renders nothing — an adapter does that —
 * but it already decides four things an agent needs: what state exists, what
 * actions it accepts, what those actions are called, and what a person sees as
 * its label. `definePrimitive` puts the instance in the observation registry, so
 * the moment an adapter renders it, `snapshot` can see it.
 */

import { definePrimitive } from "@ui-sdk/core";

export const watchToggle = definePrimitive({
  name: "watch-toggle",

  // Options are the props a caller may pass; `value` is controlled, `defaultValue`
  // is the uncontrolled start. Declaring both is what lets an app own the state
  // when it wants to and ignore it when it does not.
  options: {
    value: "boolean",
    defaultValue: "boolean",
    onValueChange: "callback",
    disabled: "boolean",
  },

  state: (options) => ({
    watched: options.value ?? options.defaultValue ?? false,
    disabled: Boolean(options.disabled),
  }),

  // Without this a controlled value would drift: the prop changes, the state
  // does not follow.
  sync: (options) => (options.value === undefined ? {} : { watched: options.value }),

  api: (context) => ({
    setWatched: (next: boolean, details?: { event?: Event; reason?: string }) => {
      if (context.store.get().disabled) return;
      context.store.set({ watched: next });
      // The callback is how an app hears about a change it did not make. An
      // agent's press arrives through the same path as a person's.
      context.options.onValueChange?.(next, {
        reason: details?.reason ?? "toggle-press",
        event: details?.event,
      });
    },
    toggle: (details?: { event?: Event; reason?: string }) => {
      const next = !context.store.get().watched;
      context.store.set({ watched: next });
      context.options.onValueChange?.(next, {
        reason: details?.reason ?? "toggle-press",
        event: details?.event,
      });
    },
  }),

  slots: (slot) => ({
    root: slot({
      attrs: (state) => ({
        type: "button",
        role: "switch",
        "aria-checked": String(state.watched),
        "aria-disabled": state.disabled ? "true" : undefined,
        // `data-state` is what a stylesheet hooks, the same convention the
        // library's own components use.
        "data-state": state.watched ? "on" : "off",
      }),
      press: ({ api }, event) => api.toggle({ event }),
    }),
  }),
});

export type WatchToggleOptions = {
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (value: boolean, details: { reason: string; event?: Event }) => void;
  disabled?: boolean;
};
