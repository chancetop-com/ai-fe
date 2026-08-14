# @connexup/ai-chat

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
