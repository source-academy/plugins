// list.js: Supporting lists in the Scheme style, using pairs made
//          up of two-element JavaScript array (vector)
// (Adapted to Typescript)

// Author: Martin Henz

// is_pair returns true iff arg is a two-element array
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_pair(x: unknown): x is [unknown, unknown] {
  return Array.isArray(x) && x.length === 2;
}

// head returns the first component of the given pair,
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function head(xs: unknown): unknown {
  if (is_pair(xs)) {
    return xs[0];
  } else {
    throw new Error("head(xs) expects a pair as argument xs, but encountered " + xs);
  }
}

// tail returns the second component of the given pair
// throws an exception if the argument is not a pair
// LOW-LEVEL FUNCTION, NOT SOURCE
export function tail(xs: unknown): unknown {
  if (is_pair(xs)) {
    return xs[1];
  } else {
    throw new Error("tail(xs) expects a pair as argument xs, but encountered " + xs);
  }
}

// is_list recurses down the list and checks that it ends with the empty list []
// does not throw Value exceptions
// LOW-LEVEL FUNCTION, NOT SOURCE
export function is_list(xs: unknown): boolean {
  for (; ; xs = tail(xs)) {
    if (xs === null) {
      return true;
    } else if (!is_pair(xs)) {
      return false;
    }
  }
}
