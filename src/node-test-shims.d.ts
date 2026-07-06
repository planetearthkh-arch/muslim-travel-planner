declare module 'node:assert/strict' {
  interface StrictAssert {
    match(actual: string, expected: RegExp, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
  }

  const assert: StrictAssert;
  export default assert;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:test' {
  type TestCallback = () => void | Promise<void>;

  export default function test(name: string, callback: TestCallback): void;
}
