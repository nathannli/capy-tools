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

// extensions/ask-user.ts
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
var askUserSchema = Type.Object({
  question: Type.String({ description: "Free-form question to ask the user" }),
  context: Type.Optional(Type.String({ description: "Short context explaining why the answer is needed" }))
});
function safeKeyHint(keybinding, description) {
  try {
    return keyHint(keybinding, description);
  } catch {
    return `(${description})`;
  }
}
function fallbackText(result) {
  const content = result.content?.[0];
  return content?.type === "text" ? content.text : "";
}
function renderAskUserResult(result, { expanded, isPartial }, theme) {
  if (isPartial)
    return new Text(theme.fg("warning", "Waiting for user..."), 0, 0);
  const details = result.details;
  const fullText = fallbackText(result);
  if (!details)
    return new Text(fullText, 0, 0);
  if (expanded)
    return new Text(fullText, 0, 0);
  const hint = safeKeyHint("app.tools.expand", "to expand");
  const status = details.cancelled ? "cancelled" : "answered";
  return new Text(theme.fg(details.cancelled ? "warning" : "success", "ask user ") + theme.fg("accent", status) + theme.fg("muted", ` ${hint}`), 0, 0);
}
function askUserExtension(pi) {
  pi.registerTool({
    name: "ask_user",
    label: "ask_user",
    description: "Ask the user one free-form question and wait for their answer before continuing. No structured options are shown.",
    promptSnippet: "Ask the user a free-form question when necessary before continuing",
    promptGuidelines: [
      "Use ask_user sparingly when a free-form answer from the user is genuinely needed.",
      "Do not use ask_user for questions you can answer from repository context or available tools.",
      "Keep the question concise and include context only when it helps the user answer."
    ],
    parameters: askUserSchema,
    renderCall() {
      return new Container;
    },
    renderResult: renderAskUserResult,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const title = params.context ? `${params.question}

${params.context}` : params.question;
      const answer = await ctx.ui.input(title, "Type your answer");
      if (answer === undefined) {
        return {
          content: [{ type: "text", text: "User cancelled." }],
          details: { question: params.question, context: params.context, cancelled: true }
        };
      }
      return {
        content: [{ type: "text", text: `User answered: ${answer}` }],
        details: { question: params.question, context: params.context, answer, cancelled: false }
      };
    }
  });
}
export {
  askUserExtension as default
};
