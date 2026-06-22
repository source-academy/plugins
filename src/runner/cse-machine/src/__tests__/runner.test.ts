import { test, expect } from "vitest";
import { CseMachinePlugin } from "..";
import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  RUNNER_ID,
  type CseSnapshot,
} from "@sourceacademy/common-cse-machine";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";

test("attaches to the cse channel and uses the runner id", () => {
  expect(CseMachinePlugin.channelAttach).toEqual([CSE_CHANNEL]);
});

test("sendSnapshots forwards a snapshots message over the channel", () => {
  const sent: unknown[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channel = { send: (m: unknown) => sent.push(m) } as unknown as IChannel<any>;
  const plugin = new CseMachinePlugin({} as IConduit, [channel]);

  const snapshots: CseSnapshot[] = [
    {
      stepIndex: 0,
      control: [],
      stash: [],
      environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
    },
  ];
  plugin.sendSnapshots(snapshots);

  expect(plugin.id).toBe(RUNNER_ID);
  expect(sent).toEqual([{ type: CSE_MESSAGE_TYPE_SNAPSHOTS, snapshots, totalSteps: 1 }]);
});
