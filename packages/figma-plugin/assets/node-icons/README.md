# Figma node type icons

近似还原 Figma 图层面板（Layers）里常见节点类型图标，供插件 UI 使用。

| 文件 | `node.type` | 图层面板形态 |
|------|-------------|--------------|
| `frame.svg` | `FRAME`（`layoutMode === 'NONE'`） | `#` 井号 |
| `frame-auto-layout-horizontal.svg` | `FRAME`（`layoutMode === 'HORIZONTAL'`） | 两条横杠（横向 Auto Layout） |
| `frame-auto-layout-vertical.svg` | `FRAME`（`layoutMode === 'VERTICAL'`） | 两条竖杠（纵向 Auto Layout） |
| `group.svg` | `GROUP` | 虚线圆角矩形 |
| `component.svg` | `COMPONENT` | 实心四角菱形 |
| `instance.svg` | `INSTANCE` | 空心四角菱形 |
| `component-set.svg` | `COMPONENT_SET` | 叠菱形（Variants） |
| `text.svg` | `TEXT` | 字母 **T** |
| `rectangle.svg` | `RECTANGLE` | 圆角矩形框 |
| `ellipse.svg` | `ELLIPSE` | 圆 |
| `line.svg` | `LINE` | 斜线 |
| `vector.svg` | `VECTOR` | 钢笔路径 |
| `boolean.svg` | `BOOLEAN_OPERATION` | 两圆相交 |
| `star.svg` | `STAR` | 五角星 |
| `polygon.svg` | `POLYGON` | 六边形 |
| `section.svg` | `SECTION` | 四角括号 |
| `slice.svg` | `SLICE` | 切角矩形 |

颜色用 `currentColor`，可在 CSS 里设 `color`。

## Auto Layout 说明

**没有**单独的 `AUTO_LAYOUT_FRAME` 类型。启用 Auto Layout 后仍是 `FRAME`（或 `COMPONENT` / `INSTANCE`），用属性区分：

```ts
if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
  if (node.layoutMode === 'HORIZONTAL') // 横杠图标
  else if (node.layoutMode === 'VERTICAL') // 竖杠图标
  else if (node.layoutMode === 'GRID') // Grid Auto Layout
  else // layoutMode === 'NONE' → 普通 # 图标
}
```

图层面板图标还会随 **对齐方式**、**Absolute position** 微调，但 `node.type` 不变。

> 官方图标版权归 Figma；本目录为风格近似的自绘 SVG，非官方资源导出。
