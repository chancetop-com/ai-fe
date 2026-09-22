# Connex Figma Plugin (Phase 1: antd)

## 开发

```bash
pnpm install
pnpm --filter @connexup/figma-plugin build
```

> `figma-plugin` 构建会直接打包 `design-to-code/src` 最新源码，不需要单独先 build `design-to-code`。

## 在 Figma 中加载

> **manifest 有改动时必须重新 Import**，仅 Reload 不会更新 `capabilities`。

1. 构建：`pnpm --filter @connexup/figma-plugin build`
2. Figma Desktop → **Plugins → Development → Remove** 旧版插件（若有）
3. **Import plugin from manifest** → 选 **`packages/figma-plugin/dist/manifest.json`**
4. 列表里应看到 **「Connex Design to Code v0.1.1」**（带版本号说明 manifest 已更新）

## 两种运行方式

### 方式 A：Design 模式（推荐调试）

1. 确保不在 Dev Mode（右上角切回 Design，或 `Shift+D`）
2. **Plugins → Development → Connex Design to Code v0.1.1**
3. 选中 Frame → 点导出

### 方式 B：Dev Mode Inspect 面板

1. 进入 Dev Mode（`Shift+D`）
2. 右侧 **Inspect** 区域 → **Plugins** 标签
3. 点击 **Connex Design to Code v0.1.1**

需要 manifest 含：

```json
"editorType": ["figma", "dev"],
"capabilities": ["inspect"]
```

若仍报 `Plugin not compatible to run in dev handoff panel`，说明 Figma 还在用旧 manifest → 执行上面的 **Remove + 重新 Import**。

## 验证 80% 准确率

1. 导出 React，保存为 `AdminPortalPageView.tsx`
2. 在业务项目中引入 antd，对比设计稿
3. 记录需手改的行数 / 节点数，计算覆盖率
