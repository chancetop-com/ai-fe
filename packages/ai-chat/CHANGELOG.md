# @connexup/ai-chat

## 1.1.11

### Patch Changes

- Fix duplicated streaming text and SSE replay race: `replayArmRef` synchronous bubble clear, `mergeStreamingText` with prefix/suffix overlap, fix `text_chunk` merge when text segment is not last
- On `turn_complete`, replace agent text segment with authoritative `event.output`; render streaming replies as plain text, markdown after turn completes
- Skip reconnect on stream close after `turn_complete`; force-disconnect live POST SSE before `connectSessionEvents` to avoid concurrent `stream` + `events` connections
- Fix recovery suppress flag stuck after intentional POST teardown; recover turn on transient SSE errors, not only on disconnect
- Collapse `ThinkingBlock` by default; remove auto-expand during streaming
- Updated dependencies
  - @connexup/ai-api@1.1.2

## 1.1.10

### Patch Changes

- Fix duplicated streaming text when SSE reconnects replay turn events on top of POST-streamed content
- Clear active agent bubble before `connectSessionEvents`; align hydration with core-ai `ensureTrailingAgentBubble`
- Fix streaming UI: session-level last-message indicator, `ThinkingBlock` spinner, and `text_chunk` streaming lifecycle

## 1.1.9

### Patch Changes

- Fix markdown `[text](url)` links losing `href` in `prepareAgentMarkdown`
- Set `sessionStatus: idle` on `turn_complete`; ignore stale `status_change: running` when no active turn
- Handle server-side cancel via `cancelledSessionIdsRef`; filter SSE events by session id
- Support `environment_output_chunk` and `turn_complete.output` backfill for empty replies
- Refresh sidebar after turn complete; watchdog error-status handling
- Export `ArtifactFilePreview`, `buildArtifactShareUrl`, `FileApi`, `useFileApi`
- Updated dependencies
  - @connexup/ai-api@1.1.1
  - @connexup/ai-react@1.1.1

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
