### ai-fe

Monorepo for Connexup AI frontend packages.

| Package | Description |
|---------|-------------|
| [`@connexup/ai-api`](./packages/ai-api) | SSE streaming (`AiLib`), REST clients, error types |
| [`@connexup/ai-react`](./packages/ai-react) | React hooks for `ai-api` |
| [`@connexup/ai-chat`](./packages/ai-chat) | Chat UI (`AiChat`, `useAiChat`) |
| [`examples/sse-demo`](./examples/sse-demo) | Vite demo app |

### Quick start

```bash
pnpm install
pnpm --filter @connexup/ai-api run build
pnpm --filter @connexup/ai-react run build
pnpm --filter @connexup/ai-chat run build
pnpm --filter core-fe-sse-demo run dev
```

### Workspace scripts

```bash
pnpm --filter @connexup/ai-api run build
pnpm --filter @connexup/ai-chat run typecheck
```
