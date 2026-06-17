/**
 * This script loads a template from the lib/templates directory and generates a new plugin in the src directory based on user input.
 * Run it using `yarn template` and follow the prompts to create a new plugin.
 */

import { input, select } from "@inquirer/prompts";
import pathlib from "path";
import fs from "fs/promises";
import { validateName, validatePluginName, generateDefaultPluginName } from "./utils.js";

/** The configuration for the plugin to be generated, based on user input
 * @property location The location of the plugin, which determines the template to be used. Can be "runner", "common", or "web".
 * @property type The type of the plugin, which determines the manifest configuration. Can be "external" or "installable".
 * @property name The name of the plugin, which is used for the package name and folder name. Should be in kebab-case.
 * @property description The description of the plugin, which is used in the package.json file.
 * @property pluginName The name of the plugin class, which is used in the template files. Should be in PascalCase. Only required for "runner" and "web" plugins.
 */
type Config = {
  location: "runner" | "common" | "web";
  type: "external" | "installable";
  name: string;
  description: string;
  pluginName?: string;
};

/**
 * Loads the configuration for the plugin to be generated.
 * @returns A promise to the configuration
 */
export async function getConfig(): Promise<Config> {
  const location = await select({
    message: "What kind of plugin should be created?",
    choices: [
      { name: "Runner", value: "runner" },
      { name: "Common", value: "common" },
      { name: "Web", value: "web" },
    ],
  });

  const type = await select({
    message: "What type of plugin should be created?",
    choices: [
      { name: "Installable", value: "installable" },
      { name: "External", value: "external" },
    ],
  });

  const name = await input({
    message: "What is the name of the plugin? (use kebab-case)",
    validate: validateName,
  });

  const description = await input({
    message: "What is the description of the plugin? (optional)",
    required: false,
    default: `An ${type} plugin for the ${location} environment.`,
  });

  let pluginName;
  if (location !== "common") {
    pluginName = await input({
      message: "What is the name of the plugin class? (use PascalCase)",
      required: false,
      default: generateDefaultPluginName(name, location),
      validate: validatePluginName,
    });
  } else {
    pluginName = undefined;
  }

  return { location, type, name, description, pluginName };
}

/**
 * Generates the template files for the specified plugin configuration.
 * @param config The configuration for the plugin to be generated
 */
export async function generateTemplate(config: Config) {
  const { location, type, name, pluginName } = config;

  // Copy the template files from the lib/templates directory to the src directory
  const templatePath = pathlib.join(import.meta.dirname, location);
  const bundlePath = pathlib.join(import.meta.dirname, "..", "..", "src", location, name);
  await fs.cp(templatePath, bundlePath, { recursive: true });

  // Update the package.json based on the plugin configuration.
  const packageJSON = pathlib.join(bundlePath, "package.json");
  const packageJSONContent = JSON.parse(await fs.readFile(packageJSON, "utf-8"));
  // The package name is in the format @sourceacademy/{location}-{name}
  packageJSONContent.name = `@sourceacademy/${location}-${name}`;
  packageJSONContent.description = config.description;
  if (type === "external") {
    // For external plugins, the main entry point is at index.js, instead of the default index.cjs
    packageJSONContent.exports["."].import = "./dist/index.js";
    packageJSONContent.module = "./dist/index.js";
  }
  await fs.writeFile(packageJSON, JSON.stringify(packageJSONContent, null, 2));

  // Update the manifest.json based on the plugin configuration.
  const manifestJSON = pathlib.join(bundlePath, "manifest.json");
  const manifestJSONContent = JSON.parse(await fs.readFile(manifestJSON, "utf-8"));
  // Update the manifest with the type ("installable" or "external"))
  manifestJSONContent.type = type;
  await fs.writeFile(manifestJSON, JSON.stringify(manifestJSONContent, null, 2));

  // For the runner and web templates, replace the placeholder PluginName with the actual plugin name in the template files.
  if (pluginName) {
    for await (const file of fs.glob(`${bundlePath}/**/*.ts`)) {
      const content = await fs.readFile(file, "utf-8");
      const updatedContent = content.replace(/PluginName/g, pluginName);
      await fs.writeFile(file, updatedContent);
    }
  }

  // For external plugins, update the Rollup config to use index.js as the entry point instead of index.cjs
  if (type === "external") {
    const indexFile = pathlib.join(bundlePath, "rollup.config.mjs");
    const indexFileContent = await fs.readFile(indexFile, "utf-8");
    const updatedIndexFileContent = indexFileContent.replace("index.cjs", "index.js");
    await fs.writeFile(indexFile, updatedIndexFileContent);
  }
}

const config = await getConfig();
await generateTemplate(config);
