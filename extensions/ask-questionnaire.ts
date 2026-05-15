/**
 * Questionnaire Extension
 *
 * A multi-question TUI questionnaire tool for pi. Presents questions with
 * suggested options, free-text input, tab-based navigation, and a submit
 * review screen.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, Text, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";

interface Question {
	id: string;
	question: string;
	context?: string;
	options: string[];
	recommended?: number;
}

interface Answer {
	id: string;
	question: string;
	answer: string;
	wasCustom: boolean;
}

interface QuestionnaireResult {
	questions: Question[];
	answers: Answer[];
	cancelled: boolean;
}

export default function askQuestionnaireExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_questionnaire",
		label: "ask_questionnaire",
		description:
			"Ask the user one or more questions via a UI questionnaire. " +
			"Each question can have suggested options, but always includes free-text input. " +
			"Use `recommended` to mark the best option (shown with star, cursor defaults to it). " +
			"Batch related questions into one call. Returns Q&A records.",
		promptSnippet: "Ask the user one or more questions in a multi-question TUI questionnaire",
		promptGuidelines: [
			"Use ask_questionnaire when multiple related user decisions are needed before proceeding.",
			"Batch related questions into one ask_questionnaire call instead of asking repeatedly.",
			"Use ask_question for a single structured question; use ask_user for one free-form question without structured options.",
		],
		parameters: Type.Object({
			questions: Type.Array(
				Type.Object({
					id: Type.String({ description: "Short identifier, e.g. 'scope', 'priority'" }),
					question: Type.String({ description: "The question to ask" }),
					context: Type.Optional(Type.String({ description: "Background info (trade-offs, details)" })),
					options: Type.Optional(Type.Array(Type.String(), { description: "Suggested answers" })),
					recommended: Type.Optional(Type.Integer({ minimum: 0, description: "0-based index of the recommended option. Shown with a star and cursor defaults to it." })),
				}),
				{ minItems: 1 },
			),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text" as const, text: "Error: UI not available (running in non-interactive mode)" }],
					details: { questions: [], answers: [], cancelled: true } as QuestionnaireResult,
				};
			}

			const seenIds = new Set<string>();
			const questions: Question[] = params.questions.map((q, i) => {
				let id = q.id;
				if (seenIds.has(id)) id = `${id}-${i + 1}`;
				seenIds.add(id);
				const opts = q.options ?? [];
				const rec = q.recommended !== undefined && q.recommended >= 0 && q.recommended < opts.length ? q.recommended : undefined;
				return { ...q, id, options: opts, recommended: rec };
			});

			const isMulti = questions.length > 1;
			const totalTabs = questions.length + 1;

			const result = await ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
				let currentTab = 0;
				let optionIndex = 0;
				let inputMode = false;
				let inputQuestionId: string | null = null;
				let cachedLines: string[] | undefined;
				const answers = new Map<string, Answer>();
				const drafts = new Map<string, string>();

				const editorTheme: EditorTheme = {
					borderColor: (s) => theme.fg("accent", s),
					selectList: {
						selectedPrefix: (t) => theme.fg("accent", t),
						selectedText: (t) => theme.fg("accent", t),
						description: (t) => theme.fg("muted", t),
						scrollInfo: (t) => theme.fg("dim", t),
						noMatch: (t) => theme.fg("warning", t),
					},
				};
				const editor = new Editor(tui, editorTheme);

				function refresh() {
					cachedLines = undefined;
					tui.requestRender();
				}

				function submit(cancelled: boolean) {
					const ordered = questions.map((q) => answers.get(q.id)).filter((a): a is Answer => !!a);
					done({ questions, answers: ordered, cancelled });
				}

				function currentQuestion(): Question | undefined {
					return questions[currentTab];
				}

				function displayOptions(): Array<{ label: string; isCustom?: boolean }> {
					const q = currentQuestion();
					if (!q) return [];
					const opts: Array<{ label: string; isCustom?: boolean }> = q.options.map((o) => ({ label: o }));
					opts.push({ label: "Write your own answer...", isCustom: true });
					return opts;
				}

				function allAnswered(): boolean {
					return questions.every((q) => answers.has(q.id));
				}

				function enterQuestion(q: Question) {
					const existing = answers.get(q.id);
					const draft = drafts.get(q.id);
					if (q.options.length === 0) {
						inputMode = true;
						inputQuestionId = q.id;
						editor.setText(draft ?? (existing?.wasCustom ? existing.answer : ""));
					} else if (existing?.wasCustom) {
						optionIndex = q.options.length;
					} else if (existing && !existing.wasCustom) {
						const idx = q.options.indexOf(existing.answer);
						optionIndex = idx >= 0 ? idx : 0;
					} else {
						optionIndex = q.recommended ?? 0;
					}
				}

				function advanceAfterAnswer() {
					if (!isMulti) {
						submit(false);
						return;
					}
					if (currentTab < questions.length - 1) currentTab++;
					else currentTab = questions.length;
					const nextQ = currentQuestion();
					if (nextQ) enterQuestion(nextQ);
					else optionIndex = 0;
					refresh();
				}

				function saveAnswer(qId: string, value: string, wasCustom: boolean) {
					const q = questions.find((qq) => qq.id === qId);
					answers.set(qId, { id: qId, question: q?.question ?? qId, answer: value, wasCustom });
				}

				editor.onSubmit = (value) => {
					if (!inputQuestionId) return;
					const trimmed = value.trim();
					if (!trimmed) {
						refresh();
						return;
					}
					drafts.delete(inputQuestionId);
					saveAnswer(inputQuestionId, trimmed, true);
					inputMode = false;
					inputQuestionId = null;
					editor.setText("");
					advanceAfterAnswer();
				};

				function exitEditor() {
					if (inputQuestionId) {
						const text = editor.getText();
						if (text.trim()) drafts.set(inputQuestionId, text);
						else drafts.delete(inputQuestionId);
					}
					inputMode = false;
					inputQuestionId = null;
					editor.setText("");
				}

				enterQuestion(questions[0]);

				function handleInput(data: string) {
					if (inputMode) {
						if (matchesKey(data, Key.escape)) {
							const q = currentQuestion();
							if (q && q.options.length === 0 && !isMulti) submit(true);
							else {
								exitEditor();
								refresh();
							}
							return;
						}
						if (isMulti && (matchesKey(data, Key.tab) || matchesKey(data, Key.shift("tab")))) {
							exitEditor();
							if (matchesKey(data, Key.tab)) currentTab = (currentTab + 1) % totalTabs;
							else currentTab = (currentTab - 1 + totalTabs) % totalTabs;
							const nq = currentQuestion();
							if (nq) enterQuestion(nq);
							else optionIndex = 0;
							refresh();
							return;
						}
						editor.handleInput(data);
						refresh();
						return;
					}

					const q = currentQuestion();
					const opts = displayOptions();

					if (isMulti) {
						if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
							currentTab = (currentTab + 1) % totalTabs;
							const nq = currentQuestion();
							if (nq) enterQuestion(nq);
							else optionIndex = 0;
							refresh();
							return;
						}
						if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
							currentTab = (currentTab - 1 + totalTabs) % totalTabs;
							const nq = currentQuestion();
							if (nq) enterQuestion(nq);
							else optionIndex = 0;
							refresh();
							return;
						}
					}

					if (currentTab === questions.length) {
						if (matchesKey(data, Key.enter) && allAnswered()) submit(false);
						else if (matchesKey(data, Key.escape)) submit(true);
						return;
					}

					if (matchesKey(data, Key.up)) {
						optionIndex = Math.max(0, optionIndex - 1);
						refresh();
						return;
					}
					if (matchesKey(data, Key.down)) {
						optionIndex = Math.min(opts.length - 1, optionIndex + 1);
						refresh();
						return;
					}

					if (matchesKey(data, Key.enter) && q) {
						if (q.options.length === 0 || opts[optionIndex]?.isCustom) {
							inputMode = true;
							inputQuestionId = q.id;
							const draft = drafts.get(q.id);
							const existing = answers.get(q.id);
							editor.setText(draft ?? (existing?.wasCustom ? existing.answer : ""));
							refresh();
							return;
						}
						const opt = opts[optionIndex];
						saveAnswer(q.id, opt.label, false);
						advanceAfterAnswer();
						return;
					}

					if (matchesKey(data, Key.escape)) submit(true);
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;

					const lines: string[] = [];
					const q = currentQuestion();
					const opts = displayOptions();
					const add = (s: string) => lines.push(truncateToWidth(s, width));
					const addWrapped = (s: string) => lines.push(...wrapTextWithAnsi(s, width));

					add(theme.fg("accent", "-".repeat(width)));

					if (isMulti) {
						const tabs: string[] = ["<- "];
						for (let i = 0; i < questions.length; i++) {
							const isActive = i === currentTab;
							const isAnswered = answers.has(questions[i].id);
							const label = questions[i].id;
							const box = isAnswered ? "[x]" : "[ ]";
							const color = isAnswered ? "success" : "muted";
							const text = ` ${box} ${label} `;
							tabs.push(`${isActive ? theme.bg("selectedBg", theme.fg("text", text)) : theme.fg(color, text)} `);
						}
						const canSubmit = allAnswered();
						const isSubmitTab = currentTab === questions.length;
						const submitText = " Submit ";
						tabs.push(`${isSubmitTab ? theme.bg("selectedBg", theme.fg("text", submitText)) : theme.fg(canSubmit ? "success" : "dim", submitText)} ->`);
						add(` ${tabs.join("")}`);
						lines.push("");
					}

					function renderOptions() {
						for (let i = 0; i < opts.length; i++) {
							const opt = opts[i];
							const selected = i === optionIndex;
							const prefix = selected ? theme.fg("accent", "> ") : "  ";
							const color = selected ? "accent" : "text";
							const isRecommended = !opt.isCustom && q && q.recommended === i;
							const recTag = isRecommended ? theme.fg("success", " *") : "";
							add(prefix + theme.fg(color, `${i + 1}. ${opt.label}`) + recTag);
						}
					}

					if (inputMode && q) {
						addWrapped(theme.fg("text", ` ${q.question}`));
						if (q.context) addWrapped(theme.fg("muted", ` ${q.context}`));
						lines.push("");
						if (q.options.length > 0) {
							renderOptions();
							lines.push("");
						}
						add(theme.fg("muted", " Your answer:"));
						for (const line of editor.render(width - 2)) add(` ${line}`);
						lines.push("");
						add(theme.fg("dim", " Enter to submit - Esc to cancel"));
					} else if (currentTab === questions.length) {
						add(theme.fg("accent", theme.bold(" Ready to submit")));
						lines.push("");
						for (const question of questions) {
							const answer = answers.get(question.id);
							if (answer) {
								const prefix = answer.wasCustom ? "(wrote) " : "";
								add(`${theme.fg("muted", ` ${question.id}: `)}${theme.fg("text", prefix + answer.answer)}`);
							} else {
								add(`${theme.fg("muted", ` ${question.id}: `)}${theme.fg("warning", "(unanswered)")}`);
							}
						}
						lines.push("");
						if (allAnswered()) add(theme.fg("success", " Press Enter to submit"));
						else add(theme.fg("warning", ` Unanswered: ${questions.filter((qq) => !answers.has(qq.id)).map((qq) => qq.id).join(", ")}`));
					} else if (q) {
						addWrapped(theme.fg("text", ` ${q.question}`));
						if (q.context) addWrapped(theme.fg("muted", ` ${q.context}`));
						const existing = answers.get(q.id);
						if (existing) {
							const prefix = existing.wasCustom ? "(wrote) " : "";
							add(theme.fg("dim", ` Current: ${prefix}${existing.answer}`));
						}
						lines.push("");
						if (q.options.length > 0) renderOptions();
						else add(theme.fg("muted", " Press Enter to write your answer"));
					}

					lines.push("");
					if (!inputMode) {
						add(theme.fg("dim", isMulti ? " Tab/left/right navigate - up/down select - Enter confirm - Esc cancel" : " up/down navigate - Enter select - Esc cancel"));
					}
					add(theme.fg("accent", "-".repeat(width)));

					cachedLines = lines;
					return lines;
				}

				return {
					render,
					invalidate: () => { cachedLines = undefined; },
					handleInput,
				};
			});

			if (result.cancelled) {
				return {
					content: [{ type: "text" as const, text: "(questionnaire dismissed)" }],
					details: result,
				};
			}

			const records = result.answers.map((a) => {
				const q = questions.find((qq) => qq.id === a.id);
				const lines = [`**Q:** ${a.question}`];
				if (q?.context) lines.push(`\n${q.context}`);
				if (q && q.options.length > 0) lines.push(`\nOptions: ${q.options.join(" / ")}`);
				lines.push(`\n**A:** ${a.answer}`);
				return lines.filter(Boolean).join("");
			});

			return {
				content: [{ type: "text" as const, text: records.join("\n\n---\n\n") }],
				details: result,
			};
		},

		renderCall(args, theme) {
			const qs = (args.questions as Array<{ id: string; question: string }>) || [];
			const count = qs.length;
			const labels = qs.map((q) => q.id).join(", ");
			let text = theme.fg("toolTitle", theme.bold("ask_questionnaire "));
			text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
			if (labels) text += theme.fg("dim", ` (${truncateToWidth(labels, 40)})`);
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as QuestionnaireResult | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}
			if (details.cancelled) return new Text(theme.fg("warning", "(dismissed)"), 0, 0);
			const lines = details.answers.map((a) => {
				const prefix = a.wasCustom ? "(wrote) " : "";
				return `${theme.fg("success", "ok ")}${theme.fg("accent", a.id)}: ${theme.fg("muted", prefix)}${a.answer}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
