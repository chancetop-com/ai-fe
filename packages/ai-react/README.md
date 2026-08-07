### ai react library

React hooks for `@connexup/ai-api`.

| Hook | Purpose |
|------|---------|
| `useAiLib` | Create and lifecycle-manage an `AiLib` instance |
| `useAiLibSubscription` | Subscribe to SSE events without losing messages between renders |
| `useSessionApi` | `SessionApi` client |
| `useAgentSession` | Session + streaming (`AiLib` + `SessionApi`) for chat apps |
| `useAgentApi` / `useBlobApi` / `useFileApi` | Other REST clients |

### useAiLib + subscription

```tsx
import { useAiLib, useAiLibSubscription } from '@connexup/ai-react';
import { isSseTextChunkEvent } from '@connexup/ai-api';

function Chat() {
  const aiLib = useAiLib({
    baseUrl: 'https://api.example.com',
    apiKey: 'your-api-key',
    sessionId: 'session-id',
  });

  useAiLibSubscription(aiLib, {
    onMessage: (event) => {
      if (isSseTextChunkEvent(event)) {
        console.log(event.content);
      }
    },
    onError: (error) => {
      console.error(error);
    },
  });

  return <button onClick={() => aiLib.sendMessage({ message: 'hello' })}>Send</button>;
}
```

`useAiLibSubscription` listens to `AiLib` directly instead of mirroring events into React state, so rapid SSE bursts are not collapsed into a single render.

### useAgentSession

Combines `SessionApi` REST calls with `AiLib` streaming. Used by `@connexup/ai-chat`.

```tsx
import { useAgentSession } from '@connexup/ai-react';

const {
  sessionId,
  setSessionId,
  createSession,
  sendMessage,
  setApiKey,
  listChatSessions,
  aiLib,
  sessionApi,
} = useAgentSession({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
});

await createSession({ agent_id: 'my-agent' });
sendMessage('hello');

// After refreshing the token:
setApiKey('new-api-key');
sendMessage('hello again', undefined, undefined, sessionId, 'new-api-key');
```

`sendMessage(message, variables?, attachments?, targetSessionId?, apiKeyOverride?)` — the last argument overrides the bearer token for that stream only.
