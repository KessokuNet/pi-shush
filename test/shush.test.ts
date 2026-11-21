import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import shush from "../index.ts";
import { DEFAULT_STATE, isOffRequest, matchModeInput, parseTarget } from "../src/shush.ts";

type PromptOptions = { sections?: Record<string, string> };
type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
type Command = { handler: (args: string, ctx: unknown) => Promise<void> };

function harness() {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, Command>();
	const api = {
		on: (name: string, handler: Handler) => {
			handlers.set(name, handler);
		},
		registerCommand: (name: string, command: Command) => {
			commands.set(name, command);
		},
	};
	shush(api as unknown as ExtensionAPI);

	const notify = vi.fn();
	const ctx = { hasUI: true, ui: { notify } };

	async function run(name: string, event: unknown) {
		const handler = handlers.get(name);
		if (!handler) throw new Error(`no handler for ${name}`);
		return handler(event, ctx);
	}

	async function prompt(sections?: Record<string, string>) {
		const options: PromptOptions = { sections };
		await run("before_agent_start", { systemPromptOptions: options });
		return options.sections;
	}

	async function command(args: string) {
		const registered = commands.get("shush");
		if (!registered) throw new Error("no /shush command");
		await registered.handler(args, ctx);
	}

	return { run, prompt, command, notify };
}

describe("shush extension", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("injects the full-level block on the first turn and keeps it stable", async () => {
		const app = harness();
		const first = await app.prompt();
		const second = await app.prompt(first);
		expect(first?.shush).toContain("level full");
		expect(second?.shush).toBe(first?.shush);
	});

	it("switches level with /shush lite", async () => {
		const app = harness();
		await app.prompt();
		await app.command("lite");
		const sections = await app.prompt();
		expect(sections?.shush).toContain("level lite");
		expect(app.notify).toHaveBeenLastCalledWith("shush lite", "info");
	});

	it("removes the section when turned off and restores it with /shush on", async () => {
		const app = harness();
		const sections = await app.prompt();
		await app.command("off");
		await app.prompt(sections);
		expect(sections).not.toHaveProperty("shush");

		await app.command("on");
		const restored = await app.prompt(sections);
		expect(restored?.shush).toContain("level full");
	});

	it("reports status without changing the level", async () => {
		const app = harness();
		await app.command("ultra");
		await app.command("status");
		expect(app.notify).toHaveBeenLastCalledWith("shush ultra", "info");
	});

	it("rejects unknown levels with the usage line", async () => {
		const app = harness();
		await app.command("loud");
		expect(app.notify).toHaveBeenLastCalledWith(expect.stringContaining("Unknown level \"loud\""), "warning");
	});

	it("handles 'stop shush' without spending a turn", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "stop shush" });
		expect(result).toEqual({ action: "handled" });
		expect(await app.prompt()).toBeUndefined();
	});

	it("passes 'normal mode' through so other prose modes turn off too", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "normal mode" });
		expect(result).toEqual({ action: "continue" });
		expect(await app.prompt()).toBeUndefined();
	});

	it("handles bare 'shush ultra' typed without the slash", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "shush ultra" });
		expect(result).toEqual({ action: "handled" });
		expect((await app.prompt())?.shush).toContain("level ultra");
	});

	it("leaves ordinary prose alone", async () => {
		const app = harness();
		const result = await app.run("input", { source: "interactive", text: "shush the background job output" });
		expect(result).toEqual({ action: "continue" });
	});

	it("resets to the default level on session start", async () => {
		const app = harness();
		await app.command("lite");
		await app.run("session_start", { reason: "new" });
		expect((await app.prompt())?.shush).toContain("level full");
	});
});

describe("parsing", () => {
	it("maps command arguments to targets", () => {
		expect(parseTarget("")).toEqual({ kind: "status" });
		expect(parseTarget("ultra")).toEqual({ kind: "set", level: "ultra" });
		expect(parseTarget("normal mode")).toEqual({ kind: "off" });
		expect(parseTarget("loud")).toEqual({ kind: "unknown", raw: "loud" });
	});

	it("recognizes only anchored off requests", () => {
		expect(isOffRequest("Stop shush.")).toBe("specific");
		expect(isOffRequest("normal mode")).toBe("shared");
		expect(isOffRequest("please stop shush now")).toBeUndefined();
	});

	it("recognizes mode input", () => {
		expect(matchModeInput("shush")).toBe("on");
		expect(matchModeInput("shush lite")).toBe("lite");
		expect(matchModeInput("shush lite please")).toBeUndefined();
	});

	it("defaults to full and enabled", () => {
		expect(DEFAULT_STATE).toEqual({ enabled: true, level: "full" });
	});
});
