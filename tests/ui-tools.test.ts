import { describe, expect, test } from "bun:test";
import questionExtension from "../extensions/question.ts";
import questionnaireExtension from "../extensions/questionnaire.ts";
import { createDialogUi, createExtensionHost, createQuestionnaireUi } from "./extension-host.ts";

const ENTER = "\r";
const DOWN = "\x1b[B";
const ESC = "\x1b";

describe("question", () => {
  test("returns the selected option when choices are provided", async () => {
    const ui = createDialogUi({ selectAnswers: ["Ship it"] });
    const host = createExtensionHost({ ui });
    questionExtension(host.api as any);

    const result = await host.runTool("question", {
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
    questionExtension(host.api as any);

    const result = await host.runTool("question", {
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
    questionExtension(host.api as any);

    const result = await host.runTool("question", {
      question: "Continue?",
      options: ["Yes", "No"],
    });

    expect(result.content[0].text).toBe("User cancelled the question.");
    expect(result.details).toBeUndefined();
  });
});

describe("questionnaire", () => {
  test("submits a recommended option using the real questionnaire component path", async () => {
    const ui = createQuestionnaireUi((component) => {
      component.handleInput(ENTER);
    });
    const host = createExtensionHost({ ui });
    questionnaireExtension(host.api as any);

    const result = await host.runTool("questionnaire", {
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
    questionnaireExtension(host.api as any);

    const result = await host.runTool("questionnaire", {
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
    questionnaireExtension(host.api as any);

    const result = await host.runTool("questionnaire", {
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
    questionnaireExtension(host.api as any);
    const result = await host.runTool(
      "questionnaire",
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
    questionnaireExtension(host.api as any);
    const result = await host.runTool("questionnaire", { questions: [{ id: "q", question: "Question?", options: ["A"] }] });

    expect(result.content[0].text).toBe("(questionnaire dismissed)");
    expect(result.details.cancelled).toBe(true);
  });
});
