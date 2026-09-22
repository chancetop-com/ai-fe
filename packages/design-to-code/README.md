# @connexup/design-to-code

Phase 1：Figma 设计稿 → **antd + Tailwind 布局** → React / HTML。

## Connexup Admin Portal

目标文件：[Connexup Admin Portal Updates 2025](https://www.figma.com/design/bXm7dRd8TmCl94bBJTWj1B/Connexup-Admin-Portal-Updates---2025?node-id=3747-10096)

| 字段 | 值 |
|------|-----|
| File key | `bXm7dRd8TmCl94bBJTWj1B` |
| MVP node | `3747:10096` |

## Figma 命名规范（节选）

| Component 名称 | antd |
|----------------|------|
| `Button/Primary` | `<Button type="primary">` |
| `Button/Default` | `<Button>` |
| `Input/Search` | `<Input.Search />` |
| `Table` | `<Table />` |
| `Card` | `<Card />` |
| `Select` | `<Select />` |

## 本地试跑 fixture

```bash
pnpm --filter @connexup/design-to-code generate:sample
```

## View / Container 约定

- 插件产出 **`*View.tsx`**：纯静态 UI，无数据逻辑
- 后续 CLI 产出 **Container 页面**，注入 hooks / API
