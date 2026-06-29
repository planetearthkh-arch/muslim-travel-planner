declare module 'node:test' {
  export default function test(name: string, fn: () => void): void;
}
declare module 'node:assert/strict' {
  const assert: {
    deepEqual(actual: unknown, expected: unknown): void;
    equal(actual: unknown, expected: unknown): void;
    match(actual: string, expected: RegExp): void;
    doesNotMatch(actual: string, expected: RegExp): void;
    throws(fn: () => void, expected?: RegExp): void;
  };
  export default assert;
}
