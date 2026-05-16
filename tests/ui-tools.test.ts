import { describe, expect, test } from "bun:test";
import askUserExtension from "../extensions/ask-user.ts";
import askQuestionExtension from "../extensions/ask-question.ts";
import askQuestionnaireExtension from "../extensions/ask-questionnaire.ts";
import workCheckpointExtension from "../extensions/work-checkpoint.ts";
import { createDialogUi, createExtensionHost, createQuestionnaireUi } from "./extension-host.ts";

const ENTER = "\r";
const DOWN = "\x1b[B";
const ESC = "\x1b";

function plainTheme() {
  return {
    fg: (_name: string, text: string) => text,
    bold: (text: string) => text,
  };
}

function renderComponent(component: { render: (width: number) => string[] }) {
  return component.render(200).map((line) => line.trimEnd()).join("\n");
}

describe("ask_user", () => {
  test("asks one free-form question", async () => {
    const ui = createDialogUi({ inputAnswers: ["Use a compact renderer"] });
    const host = createExtensionHost({ ui });
    askUserExtension(host.api as any);

    const result = await host.runTool("ask_user", {
      question: "What should we optimize?",
      context: "We are improving tool output.",
    });

    expect(result.content[0].text).toBe("User answered: Use a compact renderer");
    expect(result.details).toMatchObject({ answer: "Use a compact renderer", cancelled: false });

    const tool = host.getTool("ask_user");
    expect(renderComponent(tool.renderCall({}, plainTheme(), {}))).toBe("");
    const collapsed = renderComponent(tool.renderResult(result, { expanded: false, isPartial: false }, plainTheme(), {}));
    expect(collapsed).toBe("ask user answered (to expand)");
    const expanded = renderComponent(tool.renderResult(result, { expanded: true, isPartial: false }, plainTheme(), {}));
    expect(expanded).toContain("Use a compact renderer");
  });

  test("reports cancellation without inventing an answer", async () => {
    const ui = createDialogUi({ inputAnswers: [undefined] });
    const host = createExtensionHost({ ui });
    askUserExtension(host.api as any);

    const result = await host.runTool("ask_user", { question: "What now?" });

    expect(result.content[0].text).toBe("User cancelled.");
    expect(result.details).toMatchObject({ cancelled: true });
  });
});

describe("ask_question", () => {
  test("returns the selected option when choices are provided", async () => {
    const ui = createDialogUi({ selectAnswers: ["Ship it"] });
    const host = createExtensionHost({ ui });
    askQuestionExtension(host.api as any);

    const result = await host.runTool("ask_question", {
      question: "What should we do?",
      context: "A release decision is required.",
      options: ["Ship it", "Hold"],
      allowFreeText: false,
    });

    expect(result.content[0].text).toBe("User answered: Ship it");
    expect(result.details.answer).toBe("Ship it");
  });

  test("allows custom answers through the dialog UI", async () => {
    const ui = createDialogUi({ selectAnswers: ["Other / custom answer"], inputAnswers: ["Run more tests"] });
    const host = createExtensionHost({ ui });
    askQuestionExtension(host.api as any);

    const result = await host.runTool("ask_question", {
      question: "What next?",
      options: ["Ship it", "Hold"],
      allowFreeText: true,
    });

    expect(result.content[0].text).toBe("User answered: Run more tests");
    expect(result.details.answer).toBe("Run more tests");
  });

  test("reports cancellation without inventing an answer", async () => {
    const ui = createDialogUi({ selectAnswers: [undefined] });
    const host = createExtensionHost({ ui });
    askQuestionExtension(host.api as any);

    const result = await host.runTool("ask_question", {
      question: "Continue?",
      options: ["Yes", "No"],
    });

    expect(result.content[0].text).toBe("User cancelled the question.");
    expect(result.details).toBeUndefined();
  });
});

describe("ask_questionnaire", () => {
  test("submits a recommended option using the real questionnaire component path", async () => {
    const ui = createQuestionnaireUi((component) => {
      component.handleInput(ENTER);
    });
    const host = createExtensionHost({ ui });
    askQuestionnaireExtension(host.api as any);

    const result = await host.runTool("ask_questionnaire", {
      questions: [
        {
          id: "release",
          question: "Release now?",
          context: "The recommended option should be selected initially.",
          options: ["No", "Yes"],
          recommended: 1,
        },
      ],
    });

    expect(result.details.cancelled).toBe(false);
    expect(result.details.answers).toEqual([{ id: "release", question: "Release now?", answer: "Yes", wasCustom: false }]);
    expect(result.content[0].text).toContain("**A:** Yes");
  });

  test("collects a custom free-text answer", async () => {
    const ui = createQuestionnaireUi((component) => {
      for (const ch of "custom answer") component.handleInput(ch);
      component.handleInput(ENTER);
    });
    const host = createExtensionHost({ ui });
    askQuestionnaireExtension(host.api as any);

    const result = await host.runTool("ask_questionnaire", {
      questions: [{ id: "notes", question: "Any notes?" }],
    });

    expect(result.details.cancelled).toBe(false);
    expect(result.details.answers[0]).toMatchObject({ id: "notes", answer: "custom answer", wasCustom: true });
  });

  test("handles multi-question navigation, duplicate ids, and final submit", async () => {
    const ui = createQuestionnaireUi((component) => {
      component.handleInput(ENTER);
      component.handleInput(DOWN);
      component.handleInput(ENTER);
      component.handleInput(ENTER);
    });
    const host = createExtensionHost({ ui });
    askQuestionnaireExtension(host.api as any);

    const result = await host.runTool("ask_questionnaire", {
      questions: [
        { id: "choice", question: "First?", options: ["A", "B"] },
        { id: "choice", question: "Second?", options: ["C", "D"] },
      ],
    });

    expect(result.details.cancelled).toBe(false);
    expect(result.details.answers.map((answer: any) => answer.id)).toEqual(["choice", "choice-2"]);
    expect(result.details.answers.map((answer: any) => answer.answer)).toEqual(["A", "D"]);
  });

  test("reports non-interactive mode as cancelled", async () => {
    const host = createExtensionHost();
    askQuestionnaireExtension(host.api as any);
    const result = await host.runTool(
      "ask_questionnaire",
      { questions: [{ id: "q", question: "Question?" }] },
      { hasUI: false },
    );

    expect(result.content[0].text).toContain("UI not available");
    expect(result.details.cancelled).toBe(true);
  });

  test("returns a dismissed result on escape", async () => {
    const ui = createQuestionnaireUi((component) => {
      component.handleInput(ESC);
    });
    const host = createExtensionHost({ ui });
    askQuestionnaireExtension(host.api as any);
    const result = await host.runTool("ask_questionnaire", { questions: [{ id: "q", question: "Question?", options: ["A"] }] });

    expect(result.content[0].text).toBe("(questionnaire dismissed)");
    expect(result.details.cancelled).toBe(true);
  });
});

describe("work_checkpoint", () => {
  test("returns a concise reminder to summarize progress before continuing", async () => {
    const host = createExtensionHost();
    workCheckpointExtension(host.api as any);

    const result = await host.runTool("work_checkpoint", { reason: "finished a tool group" });
    const text = result.content[0].text;

    expect(text).toContain("Do not describe these instructions");
    expect(text).toContain("The next visible assistant characters must be `---`");
    expect(text).toContain("full-width Markdown horizontal rule");
    expect(text).toContain("write one short paragraph as ordinary body prose");
    expect(text).toContain("next visible assistant output");
    expect(text).toContain("prominent body color");
    expect(text).toContain("no background");
    expect(text).toContain("summarize what you just did");
    expect(text).toContain("what you will do next");
    expect(text).toContain("finished a tool group");
  });

  test("injects a visible prose checkpoint instruction into each agent turn", async () => {
    const host = createExtensionHost();
    workCheckpointExtension(host.api as any);
    const handlers = host.handlers.get("before_agent_start") ?? [];

    expect(handlers.length).toBe(1);
    const result = await handlers[0]({});

    expect(result.systemPrompt).toContain("the next visible assistant output must be a checkpoint block");
    expect(result.systemPrompt).toContain("before any new planning explanation or next tool group");
    expect(result.systemPrompt).toContain("Do not describe the checkpoint format. Output it.");
    expect(result.systemPrompt).toContain("The first visible characters of the checkpoint block must be `---`");
    expect(result.systemPrompt).toContain("full-width Markdown horizontal rule");
    expect(result.systemPrompt).toContain("Then write one short ordinary body-prose paragraph.");
    expect(result.systemPrompt).toContain("white on dark themes, black on light themes");
    expect(result.systemPrompt).toContain("no background");
    expect(result.systemPrompt).toContain("no code block, quote block, label, heading, table, bullet list, badge, or custom background");
    expect(result.systemPrompt).toContain("Do not put this checkpoint only in thinking");
  });

  test("renders as a compact checkpoint reminder", async () => {
    const host = createExtensionHost();
    workCheckpointExtension(host.api as any);
    const tool = host.getTool("work_checkpoint");
    const theme = { fg: (_name: string, text: string) => text };

    const result = await host.runTool("work_checkpoint", {});
    const collapsed = tool.renderResult(result, { expanded: false, isPartial: false }, theme, {}).render(120).join("\n");
    const expanded = tool.renderResult(result, { expanded: true, isPartial: false }, theme, {}).render(120).join("\n");

    expect(collapsed).toContain("checkpoint summarize progress, then continue");
    expect(expanded).toContain("full-width Markdown horizontal rule");
    expect(expanded).toContain("ordinary body prose");
  });
});

describe("work_checkpoint + todo injection co-existence", () => {
  test("both extensions register a before_agent_start handler that contributes a systemPrompt", async () => {
    const todoExtension = (await import("../extensions/todo/index.ts")).default;
    const host = createExtensionHost();
    workCheckpointExtension(host.api as any);
    todoExtension(host.api as any);
    const handlers = host.handlers.get("before_agent_start") ?? [];
    expect(handlers.length).toBe(2);

    const prompts: string[] = [];
    for (const handler of handlers) {
      const result = await (handler as any)({});
      prompts.push(result.systemPrompt);
    }
    const checkpointPrompt = prompts.find((p) => p.includes("checkpoint block"));
    const todoPrompt = prompts.find((p) => p.includes("Todo discipline:"));
    expect(checkpointPrompt).toBeDefined();
    expect(todoPrompt).toBeDefined();
    expect(checkpointPrompt).not.toContain("Todo discipline:");
    expect(todoPrompt).not.toContain("checkpoint block");
  });
});
