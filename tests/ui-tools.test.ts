import { describe, expect, test } from "bun:test";
import askUserExtension from "../extensions/ask-user.ts";
import askQuestionExtension from "../extensions/ask-question.ts";
import askQuestionnaireExtension from "../extensions/ask-questionnaire.ts";
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
