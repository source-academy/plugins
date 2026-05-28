import { Command } from "commander";
import packageJSON from "../package.json" with { type: "json" };
import fs from "fs/promises";
import { spawn } from "child_process";
const program = new Command();

export async function generateManifest() {
  await fs.mkdir("dist", { recursive: true });
  await Promise.all(
    packageJSON.workspaces.map(async workspace => {
      const manifest: Record<string, unknown> = {};
      const pluginType = workspace.split("/").slice(-3)[0];
      for await (const file of fs.glob(`${workspace}manifest.json`)) {
        const manifestFile = JSON.parse(await fs.readFile(file, "utf-8"));
        const folderName = file.split("/").slice(-2)[0];
        manifest[folderName] = manifestFile;
      }
      await fs.writeFile(`dist/${pluginType}.json`, JSON.stringify(manifest, null, 2));
    }),
  );
}
export async function spawnPromise(...args: Parameters<typeof spawn>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(...args);
    child.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
export async function build(extraArgs: string[] = []) {
  await Promise.all([
    generateManifest(),
    spawnPromise(
      "yarn",
      ["workspaces", "foreach", "-Apt", "--topological-dev", "run", "build", ...extraArgs],
      {
        stdio: "inherit",
      },
    ),
  ]);
}

// TO-DO: Add more options
const options = program.parse();
const extraArgs = options.args;
await build(extraArgs);
