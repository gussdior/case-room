import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

type Params = Omit<Anthropic.MessageCreateParamsNonStreaming, "tool_choice" | "stream">;

/**
 * Asks the model to answer through one tool.
 * This model doesn't accept a forced tool choice, so the tool is offered normally, the instructions
 * say to use it, and we ask once more if the first answer came back as plain text.
 */
export async function createWithTool(client: Anthropic, params: Params): Promise<Anthropic.Message> {
  const tool = params.tools?.[0];
  const name = tool && "name" in tool ? tool.name : "the tool";
  const rule = `\n\nAlways give your answer by calling the ${name} tool. Do not answer in plain text.`;
  const system = typeof params.system === "string" ? params.system + rule : params.system;
  const first = await client.messages.create({ ...params, system, tool_choice: { type: "auto" } });
  if (first.content.some((b) => b.type === "tool_use")) return first;
  return client.messages.create({
    ...params,
    system,
    tool_choice: { type: "auto" },
    messages: [
      ...params.messages,
      { role: "assistant", content: first.content.length ? first.content : [{ type: "text", text: "(no answer)" }] },
      { role: "user", content: `Call the ${name} tool now with your full answer.` },
    ],
  });
}
