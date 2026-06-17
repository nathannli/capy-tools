import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// extensions/ask-question.ts
import { Type } from "@sinclair/typebox";
var questionSchema = Type.Object({
  question: Type.String({ description: "Question to ask the user" }),
  context: Type.Optional(Type.String({ description: "Short context explaining why the answer is needed" })),
  options: Type.Optional(Type.Array(Type.String({ description: "Suggested answer option" }))),
  allowFreeText: Type.Optional(Type.Boolean({ description: "Allow the user to enter a custom answer (default true)" }))
});
function askQuestionExtension(pi) {
  pi.registerTool({
    name: "ask_question",
    label: "ask_question",
    description: "Ask the user a focused question during execution. Supports suggested options and free-text answers.",
    promptSnippet: "Ask the user a focused question with optional choices",
    promptGuidelines: [
      "Use ask_question when a single user decision is required before proceeding.",
      "Prefer concise questions with a small set of meaningful options.",
      "Use ask_user instead when the question should be free-form without structured options."
    ],
    parameters: questionSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const allowFreeText = params.allowFreeText ?? true;
      const options = (params.options ?? []).filter((option) => option.trim().length > 0);
      const title = params.context ? `${params.question}

${params.context}` : params.question;
      let answer;
      if (options.length > 0) {
        const customOption = "Other / custom answer";
        const choice = await ctx.ui.select(title, allowFreeText ? [...options, customOption] : options);
        if (!choice)
          return { content: [{ type: "text", text: "User cancelled the question." }] };
        answer = choice === customOption ? await ctx.ui.input(params.question, "Type your answer") : choice;
      } else {
        answer = await ctx.ui.input(title, "Type your answer");
      }
      if (answer === undefined) {
        return { content: [{ type: "text", text: "User cancelled the question." }] };
      }
      return {
        content: [{ type: "text", text: `User answered: ${answer}` }],
        details: { answer }
      };
    }
  });
}
export {
  askQuestionExtension as default
};
