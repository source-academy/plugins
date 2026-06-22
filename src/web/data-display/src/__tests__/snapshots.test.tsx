import { expect, test } from "vitest";
import makeDataVisualizerTabFrom from "../SideContentDataVisualizer";
import { render } from "@testing-library/react";
import DataVisualizer from "../dataVisualizer";
import type { Data, Step } from "../dataVisualizerTypes";

const MOCK_CONFIG = {
  sicpTextbookName: "SICP JS Section 2.2",
  sicpTextbookUrl: "https://sourceacademy.org/sicpjs/2.2.html",
  functionCallText: "draw_data(x1, x2, ..., xn)",
};

test("loading screen (english)", () => {
  const result = makeDataVisualizerTabFrom("playground", MOCK_CONFIG).body;
  const { container } = render(result);
  expect(container).toMatchSnapshot();
});

test("actual konva render", async () => {
  const result = await new Promise<Step[]>(resolve => {
    DataVisualizer.init(steps => {
      if (steps.length == 3) {
        resolve(steps);
      }
    });
    DataVisualizer.drawData([["1", "2"]]);
    DataVisualizer.drawData([[null]]);
    const arr: Data[] = [1, 2];
    arr[1] = arr;
    DataVisualizer.drawData([arr]);
  });
  const containers = result.map(c => render(c).container);
  const urls = containers.map(c => (c.querySelector("canvas") as HTMLCanvasElement).toDataURL());
  expect(urls).toMatchSnapshot();
});
