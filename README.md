# pi-shush

A pi port of [SeanL128/shush](https://github.com/SeanL128/shush), a Claude Code plugin that turns down a model's verbosity by cutting which sentences exist rather than compressing the grammar they are written in.

The skill text is unchanged. The packaging is translated to pi idioms: the Claude Code `SessionStart` hook that injects the always-on block becomes an extension that adds a `shush` section to the system prompt, and the `/shush` command sets the level through extension state instead of conversational memory.

## Install

```sh
pi install /path/to/pi-shush
```

Or try it for one run without touching settings:

```sh
pi -e /path/to/pi-shush
```

## Use

| Input | Effect |
|---|---|
| `/shush` or `/shush status` | Show the current level |
| `/shush lite` | Cut preamble, postamble, and tool narration; explanations stay |
| `/shush full` | Apply the sentence test to every line (default) |
| `/shush ultra` | One sentence when one suffices; detail only on request |
| `/shush off`, `stop shush`, `normal mode` | Disable until re-enabled |
| `/shush on` or a bare `shush` | Re-enable at the last level |
| `/shush help` | Usage line |

The level resets to `full` at the start of every session, matching the upstream plugin's always-on behavior. `/skill:shush` loads the full skill text at any time; the injected section carries the short form.

## How it works

- `index.ts` registers a `before_agent_start` handler that writes the active level into `systemPromptOptions.sections.shush`. Pi diffs prompt sections, so an unchanged level costs nothing after the first turn and a level switch patches one section.
- The `input` handler recognizes `stop shush`, `normal mode`, and a bare `shush [level]` before they reach the model, so switching costs no tokens and does not depend on the model noticing.
- `skills/shush/SKILL.md` is copied verbatim from upstream and keeps the quality floor: destructive-action warnings, failing output, the key tradeoff at a decision point, and anything explicitly asked for survive every level.

## Development

```sh
npm install
npm run typecheck
npm test
```

## Credit

Skill, rules, and wording by [Sean Lindsay](https://seanlindsay.xyz), MIT licensed. This repository is only the pi packaging.
