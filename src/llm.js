// Provider abstraction: pick Claude or OpenAI from PRISM_* env vars.
// PRISM_PROVIDER = claude | openai   (default: claude)
// PRISM_API_KEY  = the API key        (required)
// PRISM_MODEL    = model id           (optional; sensible per-provider default)

const PROVIDER = (process.env.PRISM_PROVIDER || "claude").toLowerCase();
const API_KEY = process.env.PRISM_API_KEY;
const MODEL =
  process.env.PRISM_MODEL ||
  (PROVIDER === "openai" ? "gpt-4o" : "claude-opus-4-8");

function requireKey() {
  if (!API_KEY) throw new Error("PRISM_API_KEY is not set");
}

// Returns the model's text response to a {system, user} prompt.
export async function complete({ system, user }) {
  requireKey();
  if (PROVIDER === "openai") return openai({ system, user });
  if (PROVIDER === "claude") return claude({ system, user });
  throw new Error(`Unknown PRISM_PROVIDER: ${PROVIDER} (use claude | openai)`);
}

async function claude({ system, user }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: API_KEY });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function openai({ system, user }) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: API_KEY });
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0].message.content ?? "";
}

export const config = { PROVIDER, MODEL, hasKey: Boolean(API_KEY) };
