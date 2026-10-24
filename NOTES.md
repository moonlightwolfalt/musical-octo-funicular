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

## Asset path fix
The client requests images as `/assets/s/<season>/img/...` and `/assets/s/<season>/skins/...`
(`<season>` comes from the server handshake; seasons 1 and 2 exist on `v1.mope.io`). The bare
`img/...` and `skins/...` paths 404, which is why those files were missing until fetched with the season prefix.

## Protocol (decoded from `client.pretty.js`, game version 300)
All packets are binary: byte 0 is the opcode, then big-endian-style fields via `readUInt8/16/32`, `readString`
(helpers `_0x389af7` writer / `_0x1bd7e6` reader). Opcode constants are declared near line 2955.

Structured messages (classes with `static type`):

| Op | Dir | Fields |
|----|-----|--------|
| 0x01 | C->S | handshake: u32 `0x171c4d8c`, u32 gameVersion (300), u16 screenW, u16 screenH, u16 (dpr/zoom), string sessionId |
| 0x02 | S->C | session info: string sessionId, u8 gameMode, u8 season, string serverId, u8 isAlive, u16 n, then n static objects |
| 0x0b | C->S | clean disconnect (1 byte) |
| 0x11 | S->C | world/camera: five u16 (gameWidth, gameHeight, camX*4.., camY, camZoom/1000) |
| 0x18 | S->C | spawn/animal-choice screen: spectator flag, timeout, upgradeLevel, animal choices, string |
| 0x71 | C->S | play request: u16 w, u16 h, string name (sent after Turnstile token) |
| 0x72 | S->C | account/player info (strings + flags) |
| 0x73 | S->C | small status (2 bytes) |
| 0x67 | both | server prompt / reason string (JSON `{v:2}` handled specially); client replies with same opcode + string |
| 0xff | both | ping/pong (1 byte) |

Opcodes the client sends (besides the above): 0x38 (leave spectate), 0x3b (keep-alive/ability tick),
0x3c (input intensity: u8 dir, i16 value), 0x3d (UI button: u8 interface, u8 button), 0x42 (key state: u8 down, u8 key),
0x43 (string from localStorage, see below), 0x44 (u32 id), 0x3f/0x40 (ability/action).
Opcodes the client handles from the server: 2,3,4,6,8,10,11,14,16,17,18,19,23,24,25,56,58,59,62-65,67,69,72,
81-84,100,102,103,106-109,111-114,255 (world updates, entities, leaderboard, chat, disasters, etc).
The 0x43 packet sent on a random 10-15 s timer carries a localStorage-derived value (client integrity check).
