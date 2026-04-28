// Shared security helpers for AI-facing edge functions.
// HMAC nonces, rate limiting, IP binding, regex prefilters, output sanitization.

const ENCODER = new TextEncoder();

// ─────────────────────────────────────────────────────────────
// HMAC nonce — turn-binding signed token
// ─────────────────────────────────────────────────────────────

async function hmacSha256(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, ENCODER.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function makeNonce(
  sessionId: string,
  turnCount: number,
  secret: string,
): Promise<string> {
  return hmacSha256(secret, `${sessionId}|${turnCount}`);
}

export async function verifyNonce(
  sessionId: string,
  turnCount: number,
  nonce: string,
  secret: string,
): Promise<boolean> {
  const expected = await makeNonce(sessionId, turnCount, secret);
  // Constant-time-ish compare
  if (expected.length !== nonce.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ nonce.charCodeAt(i);
  }
  return diff === 0;
}

// ─────────────────────────────────────────────────────────────
// Origin allowlist
// ─────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set<string>([
  "https://ivanmanfredi.com",
  "https://www.ivanmanfredi.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

// ─────────────────────────────────────────────────────────────
// Input validation + injection prefilter
// ─────────────────────────────────────────────────────────────

export const MAX_USER_MESSAGE_LEN = 2000;
export const MAX_TURNS = 30;
export const RATE_LIMIT_PER_MIN = 10;

// Regex patterns flagging obvious prompt-injection / off-topic abuse.
// These run BEFORE Claude is called — match → return canned redirect.
const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget)\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)/i,
  /\b(reveal|show|tell|print|repeat)\s+(?:me\s+)?(?:your\s+)?(?:system\s+prompt|instructions|api\s*key|secret|token|canary)/i,
  /\bact\s+as\s+(?:a\s+)?(?:different|another|unrestricted|jailbroken|DAN|developer)/i,
  /\byou\s+are\s+(?:now|no\s+longer)\s+(?:a|an|not)\b/i,
  // Match: "what is your", "what are your", "what's your", "whats your"
  /\bwhat(?:'s|s|\s+is|\s+are)\s+your\s+(?:instructions|prompt|rules?|api\s*key|secret|token|canary|password)/i,
  // Direct probes without "your"
  /\b(?:your|the)\s+(?:api\s*key|secret|token|password|system\s+prompt)\b/i,
  /\brepeat\s+(?:everything|all|the|this)\s+(?:above|before|prior)/i,
  /BLUEPRINT-CANARY-7K9X/i, // canary echo from user side
];

export function detectInjection(message: string): { matched: boolean; pattern?: string } {
  for (const re of INJECTION_PATTERNS) {
    if (re.test(message)) {
      return { matched: true, pattern: re.toString() };
    }
  }
  return { matched: false };
}

// ─────────────────────────────────────────────────────────────
// Output sanitization
// ─────────────────────────────────────────────────────────────

const CANARY = "BLUEPRINT-CANARY-7K9X";

const SCRIPT_RX = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const IFRAME_RX = /<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi;
const EVENT_HANDLER_RX = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const STYLE_TAG_RX = /<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi;

export function detectCanary(text: string): boolean {
  return text.includes(CANARY);
}

export function sanitizeMessage(text: string): string {
  return text
    .replace(SCRIPT_RX, "")
    .replace(IFRAME_RX, "")
    .replace(STYLE_TAG_RX, "")
    .replace(EVENT_HANDLER_RX, "");
}

// ─────────────────────────────────────────────────────────────
// Anti-AI-tell cleanup — strip em-dashes, sycophantic openers, etc.
// Claude will slip these in even with a strict system prompt, so we
// scrub them server-side as defense-in-depth.
// ─────────────────────────────────────────────────────────────

const TELL_OPENERS_RX =
  /^(Great|Awesome|Got it|Perfect|Excellent|Wonderful|Fantastic|Absolutely|Certainly|Of course)[!.,]?\s+/gim;
const TELL_PHRASES_RX =
  /\b(I'?m here to help|let me know if|please feel free|happy to help)\b[^.!?\n]*[.!?]?\s*/gi;

export function stripAITells(text: string): string {
  return text
    // Em-dash with surrounding spaces → comma+space
    .replace(/\s*—\s*/g, ", ")
    // Em-dash without spaces (e.g. "word—word") → comma+space
    .replace(/—/g, ", ")
    // En-dash similarly
    .replace(/\s*–\s*/g, ", ")
    .replace(/–/g, ", ")
    // Sycophantic openers at start of any line
    .replace(TELL_OPENERS_RX, "")
    // Chatbot meta-phrases anywhere
    .replace(TELL_PHRASES_RX, "")
    // Collapse repeated commas / spaces from the substitutions
    .replace(/,\s*,/g, ",")
    .replace(/  +/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// IP extraction
// ─────────────────────────────────────────────────────────────

export function getClientIp(req: Request): string {
  // Supabase Edge Functions sit behind their own infra; trust X-Forwarded-For first hop.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// ─────────────────────────────────────────────────────────────
// Canned redirect message (returned without calling Claude)
// ─────────────────────────────────────────────────────────────

export const CANNED_REDIRECT_MESSAGE =
  "I can only help with your Blueprint intake. Let's continue with the questions.";

// ─────────────────────────────────────────────────────────────
// Constants exported for the edge function
// ─────────────────────────────────────────────────────────────

export const CONSTANTS = {
  CANARY,
  MAX_USER_MESSAGE_LEN,
  MAX_TURNS,
  RATE_LIMIT_PER_MIN,
  TOKEN_BUDGET_INPUT: 50000,
  TOKEN_BUDGET_OUTPUT: 10000,
  COOLDOWN_MS: 60000,
  RAPID_FIRE_THRESHOLD_MS: 30000,
  RAPID_FIRE_COUNT: 5,
} as const;
