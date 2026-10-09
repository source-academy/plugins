/**
 * The values the step slider labels: 0, a round step apart, and always the last one (Blueprint's
 * own `labelStepSize` labels 0, s, 2s, ... and so can stop short of the end). A label that would
 * crowd the last one is left out.
 */
export function sliderLabels(last: number): number[] {
  const step = Math.max(1, Math.ceil(last / 10));
  const labels: number[] = [];
  for (let value = 0; value < last; value += step) labels.push(value);
  if (labels.length > 1 && last - labels[labels.length - 1] < step / 2) labels.pop();
  if (last > 0) labels.push(last);
  return labels.length > 0 ? labels : [0];
}
