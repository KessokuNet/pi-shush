export const LEVELS = ["lite", "full", "ultra"] as const;
export type Level = (typeof LEVELS)[number];

export type ShushState = {
	enabled: boolean;
	level: Level;
};

export type Target =
	| { kind: "set"; level: Level }
	| { kind: "on" }
	| { kind: "off" }
	| { kind: "status" }
	| { kind: "help" }
	| { kind: "unknown"; raw: string };

export const DEFAULT_STATE: ShushState = { enabled: true, level: "full" };

const LEVEL_GUIDANCE: Record<Level, string> = {
	lite: "Cut preamble, postamble, and tool narration. Explain normally otherwise.",
	full: "Apply the test to every sentence.",
	ultra: "One sentence when one suffices. Detail only on request. The quality floor still holds.",
};

const OFF_INPUT = /^(?:stop shush|shush off|normal mode)[.!]?$/i;
const MODE_INPUT = /^shush(?:\s+(lite|full|ultra))?[.!]?$/i;

export function isOffRequest(text: string): "specific" | "shared" | undefined {
	const match = OFF_INPUT.exec(text.trim());
	if (!match) return undefined;
	return /^normal mode/i.test(text.trim()) ? "shared" : "specific";
}

export function matchModeInput(text: string): Level | "on" | undefined {
	const match = MODE_INPUT.exec(text.trim());
	if (!match) return undefined;
	const level = match[1]?.toLowerCase();
	return level === undefined ? "on" : (level as Level);
}

export function parseTarget(args: string): Target {
	const raw = args.trim().toLowerCase();
	if (raw === "" || raw === "status") return { kind: "status" };
	if (raw === "help") return { kind: "help" };
	if (raw === "on" || raw === "enable") return { kind: "on" };
	if (raw === "off" || raw === "stop" || raw === "stop shush" || raw === "normal" || raw === "normal mode") {
		return { kind: "off" };
	}
	if ((LEVELS as readonly string[]).includes(raw)) return { kind: "set", level: raw as Level };
	return { kind: "unknown", raw: args.trim() };
}

export function applyTarget(state: ShushState, target: Target): ShushState {
	switch (target.kind) {
		case "set":
			return { enabled: true, level: target.level };
		case "on":
			return { enabled: true, level: state.level };
		case "off":
			return { enabled: false, level: state.level };
		default:
			return state;
	}
}

export function statusLine(state: ShushState): string {
	return state.enabled ? `shush ${state.level}` : "shush off";
}

export function block(state: ShushState): string | undefined {
	if (!state.enabled) return undefined;
	return [
		`Shush is active at level ${state.level}. Apply it to every response; read the shush skill for the full rules.`,
		"The test: every sentence must change what the reader does or believes next; otherwise cut it.",
		"Select, don't compress: full sentences, no fragments, no dropped articles.",
		"Delete preamble, tool-call narration, postamble option tours, and unrequested explanation.",
		"Sentence mechanics: ~20 words, active voice, one instruction per sentence, one term per meaning, short plain words, no stock idioms.",
		"Never cut: warnings before destructive actions, failing output, the key tradeoff at a decision point, or anything explicitly asked for.",
		'Off only on "stop shush" / "normal mode".',
		`Level: ${LEVEL_GUIDANCE[state.level]}`,
	].join("\n");
}
