import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

// tsup's declaration bundler drops `type` from external export stars. Restore
// the source contract without adding schemas to the JavaScript entry point.
const sourcePath = new URL('../src/index.ts', import.meta.url);
const declarationPath = new URL('../dist/index.d.ts', import.meta.url);
const source = ts.createSourceFile(
  sourcePath.pathname,
  await readFile(sourcePath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const typeOnlyModules = new Set(
  source.statements
    .filter(
      (statement) =>
        ts.isExportDeclaration(statement) &&
        statement.isTypeOnly &&
        !statement.exportClause &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        !statement.moduleSpecifier.text.startsWith('.'),
    )
    .map((statement) => statement.moduleSpecifier.text),
);
let text = await readFile(declarationPath, 'utf8');
const declaration = ts.createSourceFile(
  declarationPath.pathname,
  text,
  ts.ScriptTarget.Latest,
  true,
);
for (const statement of [...declaration.statements].reverse()) {
  if (
    ts.isExportDeclaration(statement) &&
    !statement.isTypeOnly &&
    !statement.exportClause &&
    statement.moduleSpecifier &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    typeOnlyModules.has(statement.moduleSpecifier.text)
  ) {
    const offset = statement.getStart(declaration) + 'export'.length;
    text = `${text.slice(0, offset)} type${text.slice(offset)}`;
  }
}
await writeFile(declarationPath, text);
