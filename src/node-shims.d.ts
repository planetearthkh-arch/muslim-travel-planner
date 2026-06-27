declare module 'node:test' {
  export default function test(name: string, fn: () => void): void;
}
declare module 'node:assert/strict' {
  const assert: {
    deepEqual(actual: unknown, expected: unknown): void;
    equal(actual: unknown, expected: unknown): void;
  };
  export default assert;
}
