### AI Chat

AI chat component library with **native HTML + Tailwind CSS** (built into the package), powered by `@connexup/ai-api` and `@connexup/ai-react`.

### Install

```bash
pnpm add @connexup/ai-chat @connexup/ai-react @connexup/ai-api lucide-react react-markdown remark-gfm
```

### Usage

```tsx
import { AiChat } from '@connexup/ai-chat';
import '@connexup/ai-chat/styles.css';

export function App() {
  return (
    <AiChat
      baseUrl="https://api.example.com"
      apiKey="your-api-key"
      accessAgents={agents}
      createSessionRequest={{ agent_id: 'my-agent-123' }}
      refreshApiKey={async () => {
        // Return a new API key when SSE reports invalid credentials.
        return await fetchNewApiKey();
      }}
    />
  );
}
```

**Styles:** Import `@connexup/ai-chat/styles.css` once. Tailwind utilities are pre-compiled and scoped under `.ai-chat`, so they won't conflict with your app's Tailwind (if you use one).

If your app also uses Tailwind, pick **one** approach:

- Import `@connexup/ai-chat/styles.css` (recommended), or
- Add the package to your `content` scan — don't do both.

### Key props

| Prop | Description |
|------|-------------|
| `baseUrl` | API base URL |
| `apiKey` | Bearer token for API requests |
| `accessAgents` | Agent list for the agent selector |
| `sessionId` | Optional initial session to open |
| `createSessionRequest` | Default payload when creating a session |
| `defaultAgentId` | Agent selected before the user picks one |
| `loadHistoryOnConnect` | Load history when `sessionId` is provided |
| `refreshApiKey` | `() => Promise<string>` — refresh token and retry send on SSE unauthorized |
| `showSessionSidebar` | Show chat session sidebar (default `true`) |
| `showAgentSelector` | Show agent picker (default `true`) |

### Token refresh on SSE unauthorized

When the stream returns an SSE error event:

```json
{
  "type": "error",
  "errorCode": "UNAUTHORIZED",
  "message": "invalid api key"
}
```

and `refreshApiKey` is provided, `useAiChat` will:

1. Call `refreshApiKey()` to obtain a new key
2. Update `AiLib` / `SessionApi` via `setApiKey`
3. Retry the same message once (per send)

If refresh fails or no `refreshApiKey` is passed, the error is shown in the chat as usual.

### Error messages

`formatApiError` maps HTTP-style errors for display:

| Condition | Message |
|-----------|---------|
| `APIException` status `401` | `Unauthorized` |
| `APIException` status `429` | `The token limit has been used up. Please try again tomorrow` |
| Other | Server `message` or fallback |

REST errors from `@connexup/ai-api` are thrown as `APIException` when an HTTP response is available. Pure network / CORS failures surface as `NetworkConnectionException` (no status code in JS).

### Headless hook

```tsx
import { useAiChat } from '@connexup/ai-chat';

const {
  chatState,
  sendMessage,
  approveToolCall,
  startNewChat,
  openChatSession,
  chatSessions,
} = useAiChat({
  baseUrl,
  apiKey,
  sessionId,
  refreshApiKey: async () => nextApiKey,
});
```

### Development

```bash
pnpm --filter @connexup/ai-chat run dev:css   # watch Tailwind
pnpm --filter @connexup/ai-chat run dev       # watch TS
```

See also `examples/sse-demo` for a full Vite demo.
