# v1.mope.io client notes

Findings from `v1.mope.io/client.pretty.js` (prettified `client.js`, game version 300).

## WebSocket
- Game servers come from `$config.gameServers` (top of the file), hosts under `*.mathstudyguides.com`
  (New York, Dallas, LA, Frankfurt, Paris, Sao Paulo, Shanghai, Singapore, Sydney).
- Latency probe: `wss://<host>/ping` (binary, `arraybuffer`). Client sends one byte `0xff`; server echoes `0xff`.
- Game connection: `wss://<host>` (no path), `binaryType = "arraybuffer"`. On open the client sends a
  session handshake using the server's `sessionId`; messages are `DataView` packets handled by a
  switch on the first byte (`_0x35fb88`), including game-state, camera, and session-info packets.
- Clean disconnect sends a single opcode byte. Reconnect reuses the stored `sessionId`.
- Account/auth server: `https://prod-accounts.mathstudyguides.com`; entry is gated by Cloudflare Turnstile.

## Assets
- Literal asset paths referenced in the client were fetched where they exist (`skins/`, `img/`, `shop/`, `assets/`).
- Most skin and ability image paths are built at runtime (`"skins/" + <biome>/<animal>/<skinName> + ".png"`),
  so they can't be enumerated statically; directory listing is disabled (404).
- Audio is loaded via `new Audio("audio/....mp3")` (e.g. `audio/tap.mp3`, `audio/click.mp3`); these returned 404 on `v1.mope.io`.
