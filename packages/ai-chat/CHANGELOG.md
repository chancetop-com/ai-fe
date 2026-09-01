# @connexup/ai-chat

## 1.1.8

### Patch Changes

- Restore history attachment parsing and `streaming` cleanup on stream close in `chat-state`
- Add session running reconnect via `PUT /api/sessions/events` on hydrate, refresh, and in-flight SSE disconnect recovery
- Fix `cancelTurn` when backend status stays `running` after 204; export `stopStream` from `useAiChat`

## 1.1.7

### Patch Changes

- Fix `cancelTurn` treating session as idle locally when backend status is still `running` after 204 (async cancel); stop calling `getStatus` immediately after cancel
- Track locally cancelled sessions to ignore stale `status_change: running` SSE events until `turn_complete`

## 1.1.6

### Patch Changes

- Add `variables` prop to `AiChat` and pass it through on `sendMessage`

## 1.1.5

### Patch Changes

- Add custom display message for `QUOTA_EXCEEDED` stream errors in `ErrorBlock`
- Export `DEFAULT_STREAM_ERROR_MESSAGES` and `resolveStreamErrorMessage` for reuse
- Align `formatApiError` quota messaging with stream error copy

## 1.1.4

### Patch Changes

- Parse history message attachments from `content` (image URLs, sandbox file markers) and render as images or file chips
- Stop thinking and tool in-progress UI when stream closes (cancel turn, disconnect, error) via `message.streaming`
- `ToolsBlock` respects `isStreaming` instead of mutating tool events on cancel

## 1.1.3

### Patch Changes

- Fix artifact drawer fullscreen layout and theme when portaled outside `.ai-chat`
- Add ghost button styles (`ai-chat-icon-btn`, `ai-chat-ghost-btn`) with hover backgrounds
- Fix artifact card file variant green border/background after scoped CSS reset
- Apply ghost button styles to tool JSON expand, copy, and Preview/Source tabs

## 1.1.2

### Patch Changes

- Add scoped CSS reset under `.ai-chat` to isolate from host global styles, including `hr` and markdown element resets

## 1.1.1

### Patch Changes

- Separate streaming state (`turn_complete`) from session state (`status_change`)
- Add `ErrorSegment` with styled error display at the end of stream messages
- Improve `cancelTurn` to close stream only and sync session status via `getStatus`

## 1.1.0

### Minor Changes

- feat(ai-chat): AiChat UI, session sidebar, refreshApiKey retry on SSE unauthorized

### Patch Changes

- Updated dependencies
  - @connexup/ai-api@1.1.0
  - @connexup/ai-react@1.1.0
