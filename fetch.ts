#!/usr/bin/env bun
// Usage: bun fetch.ts [--out dir] [--depth n] [path-or-url ...]
// Downloads the given paths (default "/") from v1.mope.io, then follows
// same-host references found in HTML/JS/CSS files, mirroring the site layout.
import { mkdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

const ORIGIN = "https://v1.mope.io";

const args = Bun.argv.slice(2);
let out = "mope-v1";
let maxDepth = 3;
const seeds: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = args[++i];
  else if (args[i] === "--depth") maxDepth = Number(args[++i]);
  else seeds.push(args[i]);
}
if (seeds.length === 0) seeds.push("/");

const TEXT_TYPES = /html|javascript|ecmascript|css/i;
const REF_RE = /(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)|["'`]((?:\/|\.\/)?[\w\-./]+\.(?:js|css|png|jpe?g|gif|svg|webp|mp3|ogg|wav|json|woff2?|ttf)(?:\?[^"'`]*)?)["'`]/gi;

function toUrl(ref: string, base: URL): URL | null {
  if (/^(data:|blob:|javascript:|mailto:|#)/i.test(ref)) return null;
  try {
    const u = new URL(ref, base);
    if (u.origin !== ORIGIN) return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

function localPath(u: URL): string {
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  const full = normalize(join(out, p));
  // guard against path traversal
  if (!full.startsWith(normalize(out))) throw new Error(`unsafe path: ${p}`);
  return full;
}

const seen = new Set<string>();
let queue: URL[] = seeds
  .map((s) => toUrl(s, new URL(ORIGIN + "/")))
  .filter((u): u is URL => u !== null);

for (let depth = 0; queue.length && depth <= maxDepth; depth++) {
  const next: URL[] = [];
  for (const url of queue) {
    const key = url.pathname + url.search;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`${res.status} ${url.pathname}`);
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      const body = await res.arrayBuffer();
      const dest = localPath(url);
      await mkdir(dirname(dest), { recursive: true });
      await Bun.write(dest, body);
      console.log(`saved ${url.pathname} -> ${dest} (${body.byteLength} bytes)`);

      if (TEXT_TYPES.test(type)) {
        const text = new TextDecoder().decode(body);
        for (const m of text.matchAll(REF_RE)) {
          const ref = m[1] ?? m[2] ?? m[3];
          const u = ref && toUrl(ref, url);
          if (u) next.push(u);
        }
      }
    } catch (err) {
      console.warn(`failed ${url.pathname}: ${(err as Error).message}`);
    }
  }
  queue = next;
}

console.log(`done: ${seen.size} files requested into ${out}/`);
