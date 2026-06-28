/**
 * list.js: Supporting lists in the Scheme style, using pairs made
 * up of two-element JavaScript arrays (vectors)
 * (Adapted to Typescript and the new Data type)
 *
 * @author Martin Henz
 */

import type { ArrayValue, Data, EmptyListValue } from "@sourceacademy/common-data-display";

/**
 * is_pair returns true iff arg is a two-element array
 * @param x - the argument to check
 * @returns true if x is a two-element array, false otherwise
 */
export function is_pair(x: Data): x is ArrayValue {
  return x.type === "array" && x.value.length === 2;
}

/**
 * head returns the first component of the given pair,
 * throws an exception if the argument is not a pair
 * @param xs - the pair to get the head of
 * @throws Error if xs is not a pair
 * @returns the first component of the pair
 */
export function head(xs: Data): Data {
  if (is_pair(xs)) {
    return xs.value[0];
  } else {
    throw new Error("head(xs) expects a pair as argument xs, but encountered " + xs);
  }
}

/**
 * tail returns the second component of the given pair
 * throws an exception if the argument is not a pair
 * @param xs - the pair to get the tail of
 * @throws an exception if xs is not a pair
 * @returns the second component of the pair
 */
export function tail(xs: Data): Data {
  if (is_pair(xs)) {
    return xs.value[1];
  } else {
    throw new Error("tail(xs) expects a pair as argument xs, but encountered " + xs);
  }
}

/**
 * is_list recurses down the list and checks that it ends with the empty list []
 * @param xs - the list to check
 * @returns true if xs is a list, false otherwise
 */
export function is_list(xs: Data): xs is ArrayValue | EmptyListValue {
  for (; ; xs = tail(xs)) {
    if (xs === null) {
      return true;
    } else if (!is_pair(xs)) {
      return false;
    }
  }
}

/**
 * map_list applies the given function to each element of the list and returns a new list with the results
 * @param f - the function to apply to each element of the list
 * @param xs - the list to map over
 * @returns a new list with the results of applying f to each element of xs
 */
export function map_list(f: (x: Data) => Data, xs: Data): Data {
  if (!is_list(xs)) {
    throw new Error("map_list(f, xs) expects a list as argument xs, but encountered " + xs);
  }
  if (xs.type === "null") {
    return xs;
  } else {
    return { type: "array", value: [f(head(xs)), map_list(f, tail(xs))] };
  }
}

/**
 * The length_list function computes the length of a list.
 * @param xs The list to compute the length of.
 * @returns The length of the list xs.
 * @throws Error if xs is not a list.
 */
export function length_list(xs: Data): number {
  if (!is_list(xs)) {
    throw new Error("length_list(xs) expects a list as argument xs, but encountered " + xs);
  }
  let length = 0;
  for (; ; xs = tail(xs)) {
    if (xs.type === "null") {
      return length;
    } else {
      length++;
    }
  }
}

/**
 * reduce_list applies a function to each element of a list, accumulating a result.
 * @param f The function to apply to each element of the list.
 * @param initial The initial value for the accumulator.
 * @param xs The list to reduce.
 * @returns The accumulated result after applying f to each element of xs.
 */
export function reduce_list<T>(f: (acc: T, x: Data) => T, initial: T, xs: Data): T {
  if (!is_list(xs)) {
    throw new Error(
      "reduce_list(f, initial, xs) expects a list as argument xs, but encountered " + xs,
    );
  }
  let acc = initial;
  for (; ; xs = tail(xs)) {
    if (xs.type === "null") {
      return acc;
    } else {
      acc = f(acc, head(xs));
    }
  }
}
