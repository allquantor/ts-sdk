import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

for (const [name, module, moduleResolution] of [
  ['NodeNext', ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
  ['Bundler', ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
]) {
  test(`published declarations preserve type-only exports and usable runtime values (${name})`, async () => {
    // Keep resolution inside the package; no tsconfig paths back to source.
    const directory = await mkdtemp(new URL('./consumer-', import.meta.url));
    try {
      const path = join(directory, 'consumer.mts');
      await writeFile(
        path,
        `import * as sdk from '@polymarket/client';
       import * as actions from '@polymarket/client/actions';
       const side: sdk.OrderSide = sdk.OrderSide.BUY;
       const orderType: sdk.OrderType = sdk.OrderType.GTC;
       const credentials: sdk.ApiKeyCreds | undefined = undefined;
       const client: sdk.BasePublicClient | undefined = undefined;
       const session: sdk.PerpsSession | undefined = undefined;
       const actionSession: actions.PerpsSession | undefined = undefined;
       const schemas: typeof sdk.ApiKeySchema | typeof sdk.ApiKeyCredsSchema |
         typeof sdk.ActivitySchema | typeof sdk.GammaMarketSchema |
         typeof sdk.PerpsInstrumentIdSchema | typeof sdk.RelayerTransactionTypeSchema |
         typeof sdk.PageSizeSchema | undefined = undefined;
       void [side, orderType, credentials, client, session, actionSession, schemas];
       void [sdk.createPublicClient, sdk.RequestRejectedError, actions.prepareMarketOrder];
       void [sdk.ActivityType, sdk.WalletType, sdk.PerpsSide, sdk.SignatureType];
       // @ts-expect-error Schemas are type-only exports, unavailable at runtime.
       sdk.ApiKeySchema.parse('not-a-key');
       // @ts-expect-error Type-only binding export.
       void sdk.ApiKeyCredsSchema;
       // @ts-expect-error Type-only binding export.
       void sdk.ActivitySchema;
       // @ts-expect-error Type-only binding export.
       void sdk.GammaMarketSchema;
       // @ts-expect-error Type-only binding export.
       void sdk.PerpsInstrumentIdSchema;
       // @ts-expect-error Type-only binding export.
       void sdk.RelayerTransactionTypeSchema;
       // @ts-expect-error Client constructors are not public runtime exports.
       void sdk.BasePublicClient;
       // @ts-expect-error Client constructors are not public runtime exports.
       void sdk.BaseSecureClient;
       // @ts-expect-error Type-only local export.
       void sdk.PageSizeSchema;
       // @ts-expect-error Type-only class re-export.
       void sdk.PerpsSession;
       // @ts-expect-error Type-only class re-export from the actions entry point.
       void actions.PerpsSession;
      `,
      );
      const program = ts.createProgram([path], {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        module,
        moduleResolution,
        target: ts.ScriptTarget.ESNext,
        types: [],
        verbatimModuleSyntax: true,
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
      assert.equal(typeof runtime.createPublicClient, 'function');
      assert.equal(typeof runtime.RequestRejectedError, 'function');
      for (const name of [
        'ApiKeySchema',
        'ApiKeyCredsSchema',
        'ActivitySchema',
        'GammaMarketSchema',
        'PerpsInstrumentIdSchema',
        'RelayerTransactionTypeSchema',
        'BasePublicClient',
        'BaseSecureClient',
        'PageSizeSchema',
        'PerpsSession',
      ]) {
        assert.equal(name in runtime, false, name);
      }
      const actions = await import('../../dist/actions/index.js');
      assert.equal(typeof actions.prepareMarketOrder, 'function');
      assert.equal('PerpsSession' in actions, false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
