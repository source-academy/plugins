import { exec, spawn, type ExecException } from 'child_process';
import fs from 'fs/promises';
import pathlib from 'path';
import { Command } from '@commander-js/extra-typings';
import { beforeEach, describe, expect, it, test, vi } from 'vitest';
import { copyDistFiles, generateManifest, runYarnUsingSpawn, transformSingle } from '../build.js';

const repoRoot = pathlib.resolve(import.meta.dirname, '..', '..');

vi.mock(import('fs/promises'), () => ({
  default: {
    cp: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  } as any,
}));

vi.mock(
  import('child_process'),
  () =>
    ({
      spawn: vi.fn(),
      exec: vi.fn(),
    }) as any,
);

vi.mock(import('@commander-js/extra-typings'), async actual => {
  const commander = await actual();

  return {
    ...commander,
    Command: vi.fn(commander.Command),
  } as any;
});

function mockExec(stdout: string, err: ExecException | null) {
  vi.mocked(exec).mockImplementationOnce((cmd, cb) => {
    (cb as (...args: any[]) => any)(err, stdout, '');
    return {} as any;
  });
}

/**
 * Utility function to "mock" the workspaces present in the repo
 */
function mockWorkspaces(workspaces: [string, string, 'external' | 'installable'][]) {
  const workspaceStrs: string[] = [];

  for (const [loc, name, type] of workspaces) {
    workspaceStrs.push(`{"location":"${loc}","name":"${name}"}`);
    const workspaceDir = pathlib.posix.join(repoRoot, loc);

    vi.doMock(import(`file://${workspaceDir}/package.json`), () => ({
      default: {
        name,
        description: `This is the ${name} plugin`,
      },
    }));

    vi.doMock(import(`file://${workspaceDir}/manifest.json`), () => ({
      default: {
        type,
      },
    }));
  }

  const workspaceStr = workspaces
    .map(([loc, name]) => `{"location":"${loc}","name":"${name}"}`)
    .join('\n');
  mockExec(workspaceStr, null);
}

/**
 * Checks if `fs.writeFile` was called with the given path and returns the string
 * that was written to the given path. Throws an error if `fs.writeFile` was never
 * called with the given path.
 */
const findCall = vi.defineHelper((path: string) => {
  const {
    mock: { calls },
  } = vi.mocked(fs.writeFile);

  const result = calls.find(([writtenPath]) => writtenPath === path);

  if (!result) {
    expect.fail(`fs.writeFile was not called with ${path}`);
  }

  return result[1] as string;
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('Commander should not have been called', () => {
  expect(Command).not.toHaveBeenCalled();
});

describe(generateManifest, () => {
  mockWorkspaces([
    ['src/common/test', '@sourceacademy/common-test', 'installable'],
    ['src/web/test', '@sourceacademy/web-test', 'external'],
    ['src/runner/test', '@sourceacademy/runner-test', 'installable'],
  ]);

  it('works', async () => {
    await generateManifest();

    expect(fs.mkdir).toHaveBeenCalledExactlyOnceWith(expect.any(String), { recursive: true });
    expect(exec).toHaveBeenCalledOnce();

    // once for each plugin type, once for plugin directory and once for
    // changeset
    expect(fs.writeFile).toHaveBeenCalledTimes(5);

    // Check for plugin directory
    const pluginDirectory = JSON.parse(findCall(pathlib.join(repoRoot, 'dist', 'directory.json')));
    expect(pluginDirectory).toHaveLength(1);
    expect(pluginDirectory[0]).toHaveProperty(
      'description',
      'This is the @sourceacademy/web-test plugin',
    );

    // Check commons directory
    const commonDirectory = JSON.parse(findCall(pathlib.join(repoRoot, 'dist', 'common.json')));
    expect(commonDirectory).toEqual({ test: { type: 'installable' } });

    // Check web directory
    const webDirectory = JSON.parse(findCall(pathlib.join(repoRoot, 'dist', 'web.json')));
    expect(webDirectory).toEqual({ test: { type: 'external' } });

    // Check runner directory
    const runnerDirectory = JSON.parse(findCall(pathlib.join(repoRoot, 'dist', 'runner.json')));
    expect(runnerDirectory).toEqual({ test: { type: 'installable' } });

    // Check for changeset
    const { ignore: ignoreList } = JSON.parse(
      findCall(pathlib.join(repoRoot, '.changeset', 'config.json')),
    );
    expect(ignoreList).toContain('@sourceacademy/web-test');
  });
});

describe(transformSingle, () => {
  it('works', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(`
      module.exports = {
        foo: () => 'foo',
        bar: () => {
          const value = require('value');
          return value;
        }
      }
    `);

    await expect(transformSingle('path.js')).resolves.toBeUndefined();
    expect(fs.readFile).toHaveBeenCalledOnce();

    const transformedContents = findCall('path.js');
    const dataUri = 'data:text/javascript,' + encodeURIComponent(transformedContents);
    const { default: func } = await import(dataUri);

    expect(func).toBeInstanceOf(Function);

    const { foo, bar } = func((p: string) => p === 'value');

    expect(foo()).toEqual('foo');
    expect(bar()).toEqual(true);
  });
});

describe(runYarnUsingSpawn, () => {
  function mockSpawn(retCode: number) {
    vi.mocked(spawn).mockImplementationOnce(
      () =>
        ({
          on(handler: string, listener: (...args: any[]) => any) {
            if (handler === 'close') {
              listener(retCode);
            }
            return this;
          },
        }) as any,
    );
  }

  it('calls yarn when not on windows', async () => {
    mockSpawn(0);
    vi.spyOn(process, 'platform', 'get').mockReturnValueOnce('openbsd');

    await runYarnUsingSpawn();
    expect(spawn).toHaveBeenCalledExactlyOnceWith('yarn', [], expect.any(Object));
  });

  it('calls yarn.cmd when on windows', async () => {
    mockSpawn(0);
    vi.spyOn(process, 'platform', 'get').mockReturnValueOnce('win32');

    await runYarnUsingSpawn();
    expect(spawn).toHaveBeenCalledExactlyOnceWith('yarn.cmd', [], expect.any(Object));
  });

  it('rejects with the error code', async () => {
    mockSpawn(1);

    await expect(runYarnUsingSpawn()).rejects.toThrow('Process exited with code 1');
  });
});

describe(copyDistFiles, () => {
  mockWorkspaces([
    ['src/common/test', '@sourceacademy/common-test', 'installable'],
    ['src/web/test', '@sourceacademy/web-test', 'external'],
    ['src/runner/test', '@sourceacademy/runner-test', 'installable'],
  ]);

  it('works', async () => {
    const manifest = await generateManifest();
    await copyDistFiles(manifest);

    // Only copies external plugins
    expect(fs.cp).toHaveBeenCalledExactlyOnceWith(
      pathlib.join(repoRoot, 'src', 'web', 'test', 'dist'),
      pathlib.join(repoRoot, 'dist', 'web', 'test'),
      { recursive: true },
    );
  });
});
