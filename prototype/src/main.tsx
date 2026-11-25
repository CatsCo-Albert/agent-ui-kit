/**
 * Renders the custom primitive with the Solid adapter and reports what the
 * observation registry sees.
 *
 * The point of this file is the second half: after mounting, it asks the ui-sdk
 * agent for a snapshot. If the watch toggle appears there, the component is
 * agent-operable — not because anything registered it by name, but because it
 * was defined with `definePrimitive` and rendered by an adapter that watches it.
 */

import { render } from "@solidjs/web";
import { createSignal } from "solid-js";
import { createAgent } from "@ui-sdk/core/agent";
import { usePrimitive, usePart, type PartProps } from "@ui-sdk/solid/primitive";
import type { StateOf } from "@ui-sdk/core";
import { watchToggle } from "./watch-toggle";

function WatchToggle(props: {
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (value: boolean, details: { reason: string }) => void;
  label?: string;
}) {
  const handle = usePrimitive(watchToggle, () => ({
    value: props.value,
    defaultValue: props.defaultValue,
    onValueChange: props.onValueChange,
  }));

  // `aria-label` is what the snapshot reports as this component's label, so the
  // agent can address it by name instead of by ref.
  // Text content, not only aria-label: that is what the registry reads as the
  // component's label, and the label is how an agent addresses it by name.
  return usePart(handle, "root", () => ({
    "aria-label": props.label ?? "关注",
  }), { children: props.label ?? "关注" }, "button");
}

function App() {
  const [watched, setWatched] = createSignal(false);
  const [changes, setChanges] = createSignal<string[]>([]);

  return (
    <div>
      <WatchToggle
        value={watched()}
        label="关注"
        onValueChange={(next, details) => {
          setWatched(next);
          setChanges((prev) => [...prev, `${next ? "on" : "off"}:${details.reason}`]);
        }}
      />
      <output id="state">{watched() ? "on" : "off"}</output>
      <output id="changes">{changes().join(",")}</output>
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);

// Let the mount settle, then ask the agent what it can see.
setTimeout(async () => {
  const agent = createAgent({ allow: () => true });
  const snapshot = agent.snapshot();
  (window as any).__probe = {
    snapshot,
    // The registry is the single source of truth: if the toggle is in here, an
    // external agent can query it and act on it.
    toggleEntry: snapshot.find(
      (entry: any) => entry.label === "关注" || entry.component === "watch-toggle"
    ) ?? null,
  };
}, 200);
