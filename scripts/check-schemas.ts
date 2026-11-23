/**
 * Confirms each structured-output schema still compiles on the API, since a
 * schema that is too large fails only at request time ("The compiled grammar
 * is too large"). Each check is a tiny request (max_tokens 16); the total cost
 * is well under one cent. Needs ANTHROPIC_API_KEY.  Run: npm run check:schemas
 *
 * Also confirms the API accepts the investigating agent's tool definitions.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { anthropicModelsFromEnv, toolDefinitions } from "../src/lib/llm/anthropic";
import { emptyState, investigatorTools } from "../src/lib/agent/investigator";
import { DocumentAnalysisSchema, ReportPart1Schema, ReportPart2Schema } from "../src/lib/schemas";

const models = anthropicModelsFromEnv();
const checks: [string, z.ZodType, string][] = [
  ["Per-document analysis", DocumentAnalysisSchema, models.extraction],
  ["Report part 1 (overview, timeline, findings)", ReportPart1Schema, models.reasoning],
  ["Report part 2 (work status, recovery plan)", ReportPart2Schema, models.planning],
];
const client = new Anthropic();
let failed = 0;
for (const [name, schema, model] of checks) {
  try {
    await client.messages.create({
      model, max_tokens: 16, messages: [{ role: "user", content: "Output the JSON." }],
      output_config: { format: { type: "json_schema", schema: betaZodOutputFormat(schema).schema } },
    } as Parameters<typeof client.messages.create>[0]);
    console.log(`ok    ${name} · ${model}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name} · ${model}\n      ${e instanceof Error ? e.message : e}`);
  }
}
const tools = toolDefinitions(investigatorTools([], emptyState(), () => {}));
try {
  await client.beta.messages.create({
    model: models.reasoning, max_tokens: 16, tools, messages: [{ role: "user", content: "Reply with the word ok." }],
  });
  console.log(`ok    Agent tools (${tools.length}) · ${models.reasoning}`);
} catch (e) {
  failed++;
  console.log(`FAIL  Agent tools · ${models.reasoning}\n      ${e instanceof Error ? e.message : e}`);
}
process.exit(failed ? 1 : 0);
