import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";

const askUserSchema = Type.Object({
  question: Type.String({ description: "Free-form question to ask the user" }),
  context: Type.Optional(Type.String({ description: "Short context explaining why the answer is needed" })),
});

type AskUserDetails = {
  question: string;
  context?: string;
  answer?: string;
  cancelled: boolean;
};

function safeKeyHint(keybinding: string, description: string): string {
  try {
    return keyHint(keybinding, description);
  } catch {
    return `(${description})`;
  }
}

function fallbackText(result: any): string {
  const content = result.content?.[0];
  return content?.type === "text" ? content.text : "";
}

function renderAskUserResult(result: any, { expanded, isPartial }: { expanded?: boolean; isPartial?: boolean }, theme: any) {
  if (isPartial) return new Text(theme.fg("warning", "Waiting for user..."), 0, 0);

  const details = result.details as AskUserDetails | undefined;
  const fullText = fallbackText(result);
  if (!details) return new Text(fullText, 0, 0);
  if (expanded) return new Text(fullText, 0, 0);

  const hint = safeKeyHint("app.tools.expand", "to expand");
  const status = details.cancelled ? "cancelled" : "answered";
  return new Text(theme.fg(details.cancelled ? "warning" : "success", "ask user ") + theme.fg("accent", status) + theme.fg("muted", ` ${hint}`), 0, 0);
}

export default function askUserExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ask_user",
    label: "ask_user",
    description: "Ask the user one free-form question and wait for their answer before continuing. No structured options are shown.",
    promptSnippet: "Ask the user a free-form question when necessary before continuing",
    promptGuidelines: [
      "Use ask_user sparingly when a free-form answer from the user is genuinely needed.",
      "Do not use ask_user for questions you can answer from repository context or available tools.",
      "Keep the question concise and include context only when it helps the user answer.",
    ],
    parameters: askUserSchema,
    renderCall() {
      return new Container();
    },
    renderResult: renderAskUserResult,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const title = params.context ? `${params.question}\n\n${params.context}` : params.question;
      const answer = await ctx.ui.input(title, "Type your answer");

      if (answer === undefined) {
        return {
          content: [{ type: "text" as const, text: "User cancelled." }],
          details: { question: params.question, context: params.context, cancelled: true } satisfies AskUserDetails,
        };
      }

      return {
        content: [{ type: "text" as const, text: `User answered: ${answer}` }],
        details: { question: params.question, context: params.context, answer, cancelled: false } satisfies AskUserDetails,
      };
    },
  });
}
