import { Command } from "commander";
import packageJSON from "../package.json" with { type: "json" };
import fs from "fs/promises";
import { spawn } from "child_process";
const program = new Command();

export async function generateManifest() {
    await Promise.all(packageJSON.workspaces.map(async (workspace) => {
        const manifest: Record<string, unknown> = {};
        const pluginType = workspace.split("/").slice(-2)[0];
        for await (const file of fs.glob(`${workspace}/manifest.json`)) {
            const manifest = JSON.parse(await fs.readFile(file, "utf-8"));
            const folderName = file.split("/").slice(0, -1).join("/");
            manifest[folderName] = manifest;
        }
        await fs.writeFile(`dist/${pluginType}.json`, JSON.stringify(manifest, null, 2));
    }));
}

export async function build(extraArgs: string[] = []) {
    await Promise.all([
        generateManifest(),
        spawn("yarn", ["workspaces", "foreach", "-Apt", "run", "build", ...extraArgs], { stdio: "inherit" })
    ])
}

// TO-DO: Add more options
const options = program
  .parse();
const extraArgs = options.args;
await build(extraArgs);

