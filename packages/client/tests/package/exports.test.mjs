import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

test('published declarations preserve type-only exports and usable runtime enums', async () => {
  // Keep resolution inside the package; no tsconfig paths back to source.
  const directory = await mkdtemp(new URL('./consumer-', import.meta.url));
  try {
    const path = join(directory, 'consumer.mts');
    await writeFile(
      path,
      `import { ApiKeySchema, OrderSide, OrderType, type ApiKeyCreds } from '@polymarket/client';
       const side: OrderSide = OrderSide.BUY;
       const orderType: OrderType = OrderType.GTC;
       const credentials: ApiKeyCreds | undefined = undefined;
       void [side, orderType, credentials];
       // @ts-expect-error Schemas are type-only exports, unavailable at runtime.
       ApiKeySchema.parse('not-a-key');
      `,
    );
    const program = ts.createProgram([path], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
      types: [],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.deepEqual(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      ),
      [],
    );
    const runtime = await import('../../dist/index.js');
    assert.equal(runtime.OrderSide.BUY, 'BUY');
    assert.equal(runtime.OrderType.GTC, 'GTC');
    assert.equal('ApiKeySchema' in runtime, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
