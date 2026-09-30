import { expect, test } from 'vitest';

import { DATA_VISUALIZER_CHANNEL_ID, RUNNER_ID, WEB_ID } from '..';

test('runner and web ids are distinct', () => {
  expect(RUNNER_ID).not.toBe(WEB_ID);
});

test('has a stable channel id', () => {
  expect(DATA_VISUALIZER_CHANNEL_ID).toBe('__data_visualizer');
});
