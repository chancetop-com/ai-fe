### frontend ai api library

SSE message streaming, REST session/agent/blob/file APIs, unified error handling, logging, and stream status management.

### Stream a message

```javascript
import { AiLib, isSseTextChunkEvent, isSseTurnCompleteEvent } from '@connexup/ai-api';

const aiLib = new AiLib({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
  sessionId: 'session-id',
});

const unsubscribe = aiLib.subscribe({
  onMessage: (event) => {
    if (isSseTextChunkEvent(event)) {
      console.log('text chunk:', event.content, event.is_final_chunk);
    }
    if (isSseTurnCompleteEvent(event)) {
      console.log('turn complete:', event.output);
    }
  },
  onError: (error) => {
    console.error(error);
  },
});

aiLib.sendMessage({
  message: '列出项目中的所有文件',
});

unsubscribe();
aiLib.destroy();
```

Update the token at runtime:

```javascript
aiLib.setApiKey('new-api-key');
aiLib.sendMessage({ message: 'hello', apiKey: 'one-off-key' }); // optional per-request override
```

### REST API usage

```javascript
import { SessionApi, APIException } from '@connexup/ai-api';

const sessionApi = new SessionApi({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
});

const { sessionId } = await sessionApi.createSession({
  agent_id: 'my-agent-123',
});

sessionApi.setApiKey('new-api-key');

try {
  await sessionApi.approveToolCall(sessionId, {
    call_id: 'call-1',
    decision: 'APPROVE',
  });
} catch (error) {
  if (error instanceof APIException) {
    console.log(error.statusCode, error.errorCode, error.message);
  }
}

const history = await sessionApi.getHistory(sessionId);
await sessionApi.closeSession(sessionId);
```

### Error handling

| Exception | When |
|-----------|------|
| `APIException` | HTTP response received with non-success status, invalid JSON body, or SSE `onopen` failure with a readable response |
| `NetworkConnectionException` | `fetch()` throws before a response is available (network down, CORS block, etc.) |

Helpers in `api-request`:

- `apiRequest()` — JSON REST helper; throws `APIException` on HTTP errors
- `assertOkResponse()` — validate a `Response`; throws `APIException` on failure
- `asAPIException()` — normalize unknown errors (duck typing by `name` + `statusCode`)
- `createAPIExceptionFromResponse()` — build `APIException` from `Response` + parsed body

**Note:** In cross-origin setups, the browser Network tab may show `401` while JavaScript only sees a failed `fetch()` (CORS). That case remains `NetworkConnectionException` until CORS is fixed or a same-origin proxy is used.

### SessionApi methods

- `createSession`
- `getHistory` / `getStatus`
- `approveToolCall` / `cancelTurn` / `closeSession`
- `loadTools` / `loadSkills` / `loadSubAgents`
- `generateAgentDraft`
- `listChatSessions` / `getChatSession` / `renameChatSession`
- `batchDeleteChatSessions` / `deleteChatSession`
- `setApiKey`

### SSE stream connection

- Method: `POST /api/sessions/messages/stream?agent-session-id={sessionId}`
- Body: `{ "message": "...", "variables": { ... }, "attachments": [ ... ] }`
- Headers: `Accept: text/event-stream`, `Authorization: Bearer {apiKey}` (optional)
- Event type is read from JSON payload `type`, not from the SSE `event:` field.

SSE error events (`type: "error"`) may include:

```json
{
  "type": "error",
  "errorCode": "UNAUTHORIZED",
  "message": "invalid api key",
  "detail": "optional detail or JSON string"
}
```
