// @ts-check

const pathlib = require('path');
const { defineConfig } = require('@yarnpkg/types');

module.exports = defineConfig({
  async constraints({ Yarn }) {
    for (const workspace of Yarn.workspaces()) {
      // Ignore the root workspace
      if (workspace.cwd === '.') continue;

      const normedPath = workspace.cwd.split(pathlib.sep).join(pathlib.posix.sep);

      // Check that the repository field for each workspace is correct
      workspace.set('repository', {
        type: "git",
        url: "git+https://github.com/source-academy/plugins",
        directory: normedPath
      });
    }
  }
});
