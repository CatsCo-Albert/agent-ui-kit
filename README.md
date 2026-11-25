# agent-ui-kit

如何给你的界面加一个「Agent 可以直接操作」的组件，以及为什么大多数做法都会失败。

这里只有一个核心结论：**可操作性不是接线接出来的，是从定义里长出来的。**

用 `definePrimitive` 定义一次行为，用任意适配层渲染，组件就自动出现在 `snapshot` 里，可被 `query` 找到、被 `act` 操作。反过来，手写的 `<button>`、`<select>`、`<div onclick>` 永远不在里面——不是配置漏了，是它们从来没被登记过。

## 目录

- `prototype/` — 一个约 80 行的自定义组件，跑起来就能被 Agent 看见。可以直接复制走。
- `skills/agent-ui-kit/` — 步骤化的 skill，含三个真实踩过的坑。

## 30 秒验证

```bash
cd prototype
pnpm install
pnpm build
npx serve dist          # 或任意静态服务器
```

打开页面，然后在 console 里：

```js
// 页面已经挂好了 __probe，直接看
window.__probe.snapshot
```

会看到：

```json
[{ "ref": "c1", "component": "watch-toggle", "actions": ["setWatched", "toggle"] }]
```

那个 `watch-toggle` 不是 ui-sdk 自带的组件，是 `prototype/src/watch-toggle.ts` 里现写的。它能出现，只因为它走了 `definePrimitive`。

## 机制：为什么不用注册清单

ui-sdk 的观察层在组件挂载时自动把它写进注册表（`foundation/kernel` 里的 `watch()`），分配一个 `ref`，记录它的 `component` 名、`label`、以及从 `api` 推出来的 `actions`。

`definePrimitive` 定义的是行为——state、api、slots——适配层渲染时创建实例，实例一创建就进了注册表。所以没有第三件事要做。

这也解释了一个常见误解：很多人以为要让组件可操作，得写一个「注册表配置文件」或者在页面里手动调 `register`。不需要，而且写了也没用——真正决定可见性的是「渲染时有没有被 watch 到」。

## 一个可操作组件的最小形状

```ts
import { definePrimitive } from "@ui-sdk/core";

export const watchToggle = definePrimitive({
  name: "watch-toggle",                     // snapshot 里 component 字段的值
  options: { value: "boolean", defaultValue: "boolean", onValueChange: "callback" },
  state: (o) => ({ watched: o.value ?? o.defaultValue ?? false }),
  sync: (o) => (o.value === undefined ? {} : { watched: o.value }),
  api: (ctx) => ({
    setWatched: (next) => ctx.store.set({ watched: next }),
    toggle: () => ctx.store.set({ watched: !ctx.store.get().watched }),
  }),
  slots: (slot) => ({
    root: slot({
      attrs: (s) => ({ type: "button", role: "switch", "aria-checked": String(s.watched) }),
      press: ({ api }, event) => api.toggle({ event }),
    }),
  }),
});
```

三处决定 Agent 能看到什么：

1. `name` 决定 `component`。
2. `api` 的方法名决定 `actions`。想让 Agent 能「设为某值」而不只是「切换」，就必须有 `setWatched`——`toggle` 一个方法只能翻转，Agent 没法表达「设成 true」。
3. `attrs` 里的可访问名决定 `label`。Agent 优先按 label 定位，没有 label 就只能靠 ref，而 ref 换个渲染就变了。

## 适配层

```tsx
function WatchToggle(props) {
  const handle = usePrimitive(watchToggle, () => ({
    value: props.value,
    defaultValue: props.defaultValue,
    onValueChange: props.onValueChange,
  }));
  return usePart(handle, "root", () => ({ "aria-label": props.label }), {}, "button");
}
```

`usePrimitive` 拿 options 的 **getter**，不是值。传值的话 props 变化不会同步，受控模式就是假的。

## 站得住脚的边界

- **这只解决「能被发现和操作」。** 状态类的东西（页签选中、面板宽度、当前视图）如果只存在组件本地 state 里，`act` 按不出来，得把状态搬进共享 store 再用 `setValue` 这类 api 暴露。详见 skill。
- **ref 只在当前页面存活期有效。** 快照后立刻操作，不要缓存跨刷新。
- **label 会重复。** 两个「确定」按钮会让 `act` 报歧义。同一个页面里让每个可操作组件的 label 唯一，或者接受按 ref 定位。
- **`definePrimitive` 不是万能的。** 它管行为，不管样式和 DOM。你做出来的东西可不可用，仍然取决于你自己排的版。
