# @connexup/ai-api

## 1.1.3

### Patch Changes

- Enforce single SSE slot: `#beginStream` aborts any in-flight POST stream or PUT events before opening the next connection
- Track `#inflightAbortController` and bump `#streamGeneration` on teardown to cancel in-flight fetch and ignore stale callbacks

## 1.1.2

### Patch Changes

- Always abort in-flight SSE before opening a replacement stream (POST -> PUT recovery)
- Ignore stale stream callbacks via generation guard to prevent duplicate event delivery

## 1.1.1

### Patch Changes

- Add `connectSessionEvents` for `PUT /api/sessions/events` session event replay
- Add `SseEnvironmentOutputChunkEvent` and `environment_output_chunk` to SSE types
- Add `eventsPath` / `ConnectSessionEventsOptions`; expose `buildSessionEventsUrl` in utils

## 1.1.0

### Minor Changes

- feat(ai-api): REST clients, unified APIException handling, SSE stream via fetch-event-source, setApiKey
- feat(ai-react): useAgentSession with setApiKey and per-request apiKey override
- feat(ai-chat): AiChat UI, session sidebar, refreshApiKey retry on SSE unauthorized

## 1.0.6

### Patch Changes

- feat: add aiLibOption onStateUpdate

## 1.0.5

### Patch Changes

- update params: support input accepted message type and error retry times

## 1.0.4

### Patch Changes

- optimize: options params

## 1.0.3

### Patch Changes

- update api url

## 1.0.2

### Patch Changes

- update README.md
