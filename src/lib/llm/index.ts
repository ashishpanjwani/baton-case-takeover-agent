import { AnthropicProvider } from "./anthropic";
import type { LLMProvider } from "./provider";

export type { LLMProvider } from "./provider";

/**
 * Returns the configured provider, or null when no credentials are available
 * (the app then runs in clearly-labelled demo mode).
 */
export function getProvider(): LLMProvider | null {
  const which = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (which === "demo") return null;
  if (which === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
    return new AnthropicProvider();
  }
  throw new Error(`Unknown LLM_PROVIDER: ${which}`);
}
