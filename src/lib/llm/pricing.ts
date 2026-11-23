/**
 * List prices in USD per 1M tokens, used only to estimate run cost.
 * Thinking tokens are billed as output. Update when prices change.
 * Source: Anthropic pricing as of Nov 2026.
 */
interface Price { input: number; output: number; /** prompts above this many input tokens use the long rate */ longAbove?: number; longInput?: number; longOutput?: number }

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, longAbove: 100_000, longInput: 0.5, longOutput: 2.5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const long = p.longAbove !== undefined && inputTokens > p.longAbove;
  const inRate = long ? p.longInput! : p.input;
  const outRate = long ? p.longOutput! : p.output;
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
}
