/**
 * Array helper functions
 */

/**
 * Polyfill for findLast - finds the last element in an array that satisfies the predicate
 * This is needed for older TypeScript/JavaScript versions that don't have native findLast
 */
export function findLast<T>(arr: T[], predicate: (item: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      return arr[i];
    }
  }
  return undefined;
}

/**
 * Find the last index of an element that satisfies the predicate
 */
export function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
}