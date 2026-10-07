import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// tsup's declaration bundler loses type-only stars and named re-exports.
// Restore external stars from source and align named exports with the emitted
// JavaScript. Parse the JavaScript without importing it or optional peer deps.
const packageRoot = new URL('../', import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL('package.json', packageRoot), 'utf8'),
);

for (const entry of Object.values(manifest.exports)) {
  const sourcePath = entry.types
    .replace('./dist/', './src/')
    .replace(/\.d\.ts$/, '.ts');
  const source = await parseFile(new URL(sourcePath, packageRoot));
  const runtime = await parseFile(new URL(entry.default, packageRoot));
  const declarationPath = new URL(entry.types, packageRoot);
  const declaration = await parseFile(declarationPath);
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
  const runtimeNames = new Set();
  for (const statement of runtime.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
      throw new Error(`Expected bundled named exports in ${entry.default}`);
    }
    for (const specifier of statement.exportClause.elements) {
      runtimeNames.add(specifier.name.text);
    }
  }

  let text = declaration.text;
  // Work backwards so inserting a modifier never shifts a later edit.
  for (const statement of [...declaration.statements].reverse()) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
    if (
      !statement.exportClause &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      typeOnlyModules.has(statement.moduleSpecifier.text)
    ) {
      const offset = statement.getStart(declaration) + 'export'.length;
      text = `${text.slice(0, offset)} type${text.slice(offset)}`;
    } else if (
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const specifier of [...statement.exportClause.elements].reverse()) {
        if (!specifier.isTypeOnly && !runtimeNames.has(specifier.name.text)) {
          const offset = specifier.getStart(declaration);
          text = `${text.slice(0, offset)}type ${text.slice(offset)}`;
        }
      }
    }
  }
  if (text !== declaration.text) await writeFile(declarationPath, text);
}

async function parseFile(path) {
  return ts.createSourceFile(
    fileURLToPath(path),
    await readFile(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}
