# Instructions for AI agents

## Commands

Use the scripts in `package.json`, not the tools directly. The repository is a Yarn (Plug'n'Play) workspace.

* Format: `yarn format` (Prettier; `yarn format:ci` lists unformatted files).
* Lint: `yarn lint`
* Test: `yarn test` (Vitest), e.g. `yarn vitest run src/web/e-stepper` for one package.
* Build: `yarn build`
* In a git worktree, run `yarn install` there first (the Plug'n'Play files are not in git).
* Every change to a published package needs a changeset in `.changeset/`. Never put an ignored package and a non-ignored one in the same changeset (see `ignore` in `.changeset/config.json`): the release step rejects it and nothing is deployed.
