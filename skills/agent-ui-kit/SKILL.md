---
name: agent-ui-kit
description: 给一个 ui-sdk 应用新增「Agent 可直接操作」的组件，或诊断「组件存在但 Agent 看不见/点不动」。当任务是新增自定义可操作组件、把现有手写控件变成可被 snapshot/query/act 发现、或排查 act 报歧义/无反应时使用。
---

# 新增一个 Agent 可操作的组件

## 先判断是哪一类问题

问清楚再动手，三类解法完全不同：

1. **要新增一个组件** — 走 `definePrimitive`，见下方步骤。
2. **组件已在页面上，但 snapshot 看不见** — 它多半是手写的原生标签。手写 DOM 不在观察注册表里，没有配置项能补救，只能换成走 primitive 的渲染。
3. **snapshot 能看见，但 act 按不动** — 组件把状态存在自己的局部 state 里，`press` 只能触发一次事件，改不了那个状态。要把它搬进共享 store，并用一个 `setValue` 之类的 api 暴露出来。

## 步骤一：定义行为

新建一个 `.ts`，只写行为不写 DOM：

```ts
import { definePrimitive } from "@ui-sdk/core";

export const watchToggle = definePrimitive({
  name: "watch-toggle",
  options: { value: "boolean", defaultValue: "boolean", onValueChange: "callback" },
  state: (o) => ({ watched: o.value ?? o.defaultValue ?? false }),
  sync: (o) => (o.value === undefined ? {} : { watched: o.value }),
  api: (ctx) => ({
    setWatched: (next: boolean) => ctx.store.set({ watched: next }),
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

三个字段决定 Agent 看到什么，别搞错：

- `name` → snapshot 的 `component`
- `api` 的方法名 → snapshot 的 `actions`
- `attrs` 引出的可访问名 → snapshot 的 `label`

`api` 里同时给「设成某值」和「翻转」两个方法。只给 `toggle` 的话，Agent 没法表达「设成 true」，只能在已知当前状态时翻转，而它读到的是快照，可能已经过期。

## 步骤二：用适配层渲染

```tsx
import { usePrimitive, usePart } from "@ui-sdk/solid/primitive";

function WatchToggle(props) {
  const handle = usePrimitive(watchToggle, () => ({
    value: props.value,
    defaultValue: props.defaultValue,
    onValueChange: props.onValueChange,
  }));
  return usePart(handle, "root", () => ({ "aria-label": "关注" }), { children: "关注" }, "button");
}
```

`usePrimitive` 第二个参数必须是 **getter**。传值则受控模式是假的：props 变了，state 不跟。

## 步骤三：验证

在浏览器里取快照，看三件事：

```js
const { createAgent } = await import("@ui-sdk/core/agent");
createAgent({ allow: () => true }).snapshot();
```

期望形状：

```json
[{ "ref": "c1", "component": "watch-toggle", "actions": ["setWatched", "toggle"], "label": "关注" }]
```

`component`、`actions`、`label` 三者缺一都要回去查对应的字段。尤其 `label` —— 见下方坑二。

## 实测踩过的坑

**坑一：受控 Input 只接 `value`，会出现「能输入、退格无效」。**
`value` 配 `onValueChange` 一起用。只给 value 时组件每次渲染都把值写回旧值，退格被立刻回滚，看起来像键盘坏了。

**坑二：只给 `aria-label` 拿不到 label。**
实测：`usePart(..., () => ({ "aria-label": "关注" }), {}, "button")` 的快照里没有 `label` 字段。要同时在 part props 里传文本内容（`{ children: "关注" }`），注册表读的是元素的文本，`aria-label` 不足以让它出现在快照的 label 上。没有 label 的组件，Agent 只能靠 ref 定位，而 ref 会随渲染顺序变化。

**坑三：Vite 插件名不是 `@solidjs/vite-plugin-solid`。**
Solid 2 用 `@solidjs/vite-plugin@3.0.1`。装错名字时构建直接报 `ERR_MODULE_NOT_FOUND`，而且报错指向 config 文件，不像依赖问题。

**坑四：`max-width` 会吞掉范围值。**
如果组件暴露了一个 0–100 的宽度或比例，而外层容器有 `max-w-[520px]`，那么设 40% 和设 60% 渲染出来一样宽。Agent 会认为操作成功而实际无变化。设完值要回读实际渲染尺寸比对。

## 边界

- 这套只管「能被发现和操作」。样式、布局、可读性仍然是写代码的人的责任。
- `ref` 只在页面存活期内有效，快照后立刻操作，不要跨刷新缓存。
- 同一页面里 label 要唯一。两个「确定」会让 act 报歧义，那时只能按 ref 定位。
- 状态类（页签、面板比例、当前视图）不能只靠 `press`。搬进 store，加一个带校验的补丁类型，组件只从 store 读，然后测试断言「补丁生效」和「UI 实际读到」是同一个值 —— 补丁写了但组件不读，是另一类缺陷，测试必须成对断言。
