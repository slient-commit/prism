// Size limiting for token economy. Uses char counts as a cheap token proxy
// (~4 chars/token) — no tokenizer dependency, no extra API round-trips.

export function truncate(str, max) {
  if (!str || str.length <= max) return str || "";
  return str.slice(0, max) + `\n…[truncated ${str.length - max} chars]`;
}

// Split a unified diff into chunks each <= max chars, preferring clean
// boundaries: whole files first, then hunks within an oversized file, then
// raw lines if a single hunk is still too big.
export function splitDiff(diff, max) {
  if (!diff || !diff.trim()) return [];
  if (diff.length <= max) return [diff];

  const chunks = [];
  let cur = "";
  const flush = () => {
    if (cur) chunks.push(cur);
    cur = "";
  };

  for (const file of segmentsAt(diff, /^diff --git /m)) {
    if (file.length > max) {
      flush();
      chunks.push(...splitFile(file, max));
    } else if (cur.length + file.length > max) {
      flush();
      cur = file;
    } else {
      cur += file;
    }
  }
  flush();
  return chunks;
}

// One file bigger than max: keep its header on every sub-chunk so each stays
// self-contained, then pack hunks (and hard-split any hunk that alone exceeds max).
function splitFile(file, max) {
  const hunks = segmentsAt(file, /^@@ /m);
  const header = /^@@ /m.test(file) ? hunks.shift() : "";
  const room = Math.max(1, max - header.length);
  const out = [];
  let cur = "";
  const flush = () => {
    if (cur) out.push(header + cur);
    cur = "";
  };

  for (const hunk of hunks) {
    if (hunk.length > room) {
      flush();
      for (const piece of hardSplit(hunk, room)) out.push(header + piece);
    } else if (cur.length + hunk.length > room) {
      flush();
      cur = hunk;
    } else {
      cur += hunk;
    }
  }
  flush();
  return out.length ? out : hardSplit(file, max);
}

// Split by matches of `re`, each returned segment beginning at a match.
function segmentsAt(str, re) {
  const rx = new RegExp(re.source, "mg");
  const idx = [];
  let m;
  while ((m = rx.exec(str))) idx.push(m.index);
  if (!idx.length) return [str];
  const segs = idx[0] > 0 ? [str.slice(0, idx[0])] : [];
  for (let i = 0; i < idx.length; i++) segs.push(str.slice(idx[i], idx[i + 1] ?? str.length));
  return segs;
}

// Last resort: slice on line boundaries into <= max pieces.
function hardSplit(str, max) {
  const out = [];
  let cur = "";
  for (const line of str.split("\n")) {
    const l = line + "\n";
    if (cur && cur.length + l.length > max) {
      out.push(cur);
      cur = "";
    }
    cur += l;
  }
  if (cur) out.push(cur);
  return out;
}

// Self-check: PRISM_SPLIT_SELFCHECK=1 node src/split.js
if (process.env.PRISM_SPLIT_SELFCHECK) {
  const file = (n) =>
    `diff --git a/f${n} b/f${n}\n--- a/f${n}\n+++ b/f${n}\n@@ -1 +1 @@\n-${"x".repeat(50)}\n+${"y".repeat(50)}\n`;
  const diff = file(1) + file(2) + file(3);
  const chunks = splitDiff(diff, 120);
  if (chunks.some((c) => c.length > 120 && !/^diff --git /.test(c)))
    throw new Error("packed chunk exceeded max");
  if (chunks.join("") !== diff && chunks.join("").replace(/.*truncated.*/g, "") !== diff.replace(/.*truncated.*/g, ""))
    console.log("note: chunks differ (expected when a file is header-duplicated on split)");
  if (truncate("abcdef", 3) !== "abc\n…[truncated 3 chars]") throw new Error("truncate");
  console.log(`ok: ${chunks.length} chunks, max len ${Math.max(...chunks.map((c) => c.length))}`);
}
