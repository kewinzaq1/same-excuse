"use node";

// Action: the one place this app talks to the outside world.
// Actions run in Node, may call any API, and are not transactions. This one turns a
// rough note ("ran in rain almost didnt") into a card sentence with Claude.
import Anthropic from "@anthropic-ai/sdk";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { excuseLabel } from "./excuses";

const SYSTEM = `You write the one line on a card in an app where people post the small real thing they just did instead of using an excuse.
Rewrite the person's rough note as a card sentence:
- Under 100 characters. Plain words. First person. Past tense.
- Keep every fact they gave. Add none. No emoji, no hashtags, no exclamation marks.
- Dry, a little funny is fine. Never cheerleading, never advice.
- The excuse they beat is given. Do not restate it unless the note does.
Reply with the sentence only.`;

export const polish = action({
  args: { rough: v.string(), excuse: v.string() },
  handler: async (_ctx, { rough, excuse }) => {
    const note = rough.trim().slice(0, 300);
    if (note.length < 3) throw new Error("Write a few words first.");

    // The key lives on the Convex deployment (npx convex env set ANTHROPIC_API_KEY ...),
    // never in the browser.
    const client = new Anthropic();

    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5",
        max_tokens: 256,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Excuse beaten: ${excuseLabel(excuse)}\nRough note: ${note}`,
          },
        ],
      });

      if (response.stop_reason === "refusal") {
        throw new Error("Claude declined to rewrite that one. Post it in your own words.");
      }
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim()
        .replace(/^["“]|["”]$/g, "");
      if (!text) throw new Error("No sentence came back. Post it in your own words.");
      return { sentence: text.slice(0, 140), model: response.model };
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error("ANTHROPIC_API_KEY is not set on the deployment.");
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new Error("Claude is rate limited right now. Post it in your own words.");
      }
      throw error;
    }
  },
});
