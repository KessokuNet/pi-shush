import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	applyTarget,
	block,
	DEFAULT_STATE,
	isOffRequest,
	matchModeInput,
	parseTarget,
	statusLine,
	type ShushState,
	type Target,
} from "./src/shush.ts";

const USAGE = "Usage: /shush [lite|full|ultra|on|off|status]";

function targetMessage(state: ShushState, target: Target): string | undefined {
	switch (target.kind) {
		case "status":
			return statusLine(state);
		case "help":
			return USAGE;
		case "unknown":
			return `Unknown level "${target.raw}". ${USAGE}`;
		default:
			return undefined;
	}
}

export default function shush(pi: ExtensionAPI) {
	let state: ShushState = { ...DEFAULT_STATE };

	pi.on("session_start", async () => {
		state = { ...DEFAULT_STATE };
	});

	pi.on("before_agent_start", async (event) => {
		const options = event.systemPromptOptions;
		if (!options) return;
		const text = block(state);
		if (text === undefined) {
			if (options.sections) delete options.sections.shush;
			return;
		}
		options.sections = { ...options.sections, shush: text };
	});

	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return { action: "continue" };

		if (isOffRequest(event.text) !== undefined) {
			const shared = isOffRequest(event.text) === "shared";
			state = applyTarget(state, { kind: "off" });
			if (ctx.hasUI) ctx.ui.notify("Shush off for this session", "info");
			// "normal mode" is shared with other prose-mode extensions, so let them see it too.
			return { action: shared ? "continue" : "handled" };
		}

		const mode = matchModeInput(event.text);
		if (mode === undefined) return { action: "continue" };
		state = applyTarget(state, mode === "on" ? { kind: "on" } : { kind: "set", level: mode });
		if (ctx.hasUI) ctx.ui.notify(statusLine(state), "info");
		return { action: "handled" };
	});

	pi.registerCommand("shush", {
		description: "Set output verbosity: lite, full (default), ultra, or off",
		getArgumentCompletions: (prefix) => {
			const values = ["lite", "full", "ultra", "on", "off", "status"];
			const matches = values.filter((value) => value.startsWith(prefix.toLowerCase()));
			return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const target = parseTarget(args);
			const message = targetMessage(state, target);
			state = applyTarget(state, target);
			if (ctx.hasUI) {
				ctx.ui.notify(message ?? statusLine(state), target.kind === "unknown" ? "warning" : "info");
			}
		},
	});
}
