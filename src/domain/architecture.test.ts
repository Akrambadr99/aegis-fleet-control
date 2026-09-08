import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('keeps runtime domain dependencies acyclic', () => {
  const directory = join(process.cwd(), 'src', 'domain');
  const graph = new Map<string, string[]>();
  for (const name of readdirSync(directory).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
  )) {
    const source = ts.createSourceFile(
      name,
      readFileSync(join(directory, name), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const dependencies: string[] = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
      if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
      const module = statement.moduleSpecifier;
      if (module && ts.isStringLiteral(module) && module.text.startsWith('./'))
        dependencies.push(module.text.slice(2) + '.ts');
    }
    graph.set(name, dependencies);
  }
  const cycles: string[] = [];
  const complete = new Set<string>();
  function visit(name: string, path: string[]) {
    if (path.includes(name)) {
      cycles.push([...path, name].join(' -> '));
      return;
    }
    if (complete.has(name)) return;
    for (const next of graph.get(name) ?? []) visit(next, [...path, name]);
    complete.add(name);
  }
  for (const name of graph.keys()) visit(name, []);
  expect(cycles).toEqual([]);
});

it('keeps production domain modules independent of React, UI and infrastructure', () => {
  const directory = join(process.cwd(), 'src', 'domain');
  for (const name of readdirSync(directory).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
  )) {
    const source = ts.createSourceFile(
      name,
      readFileSync(join(directory, name), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const module = statement.moduleSpecifier;
      if (module && ts.isStringLiteral(module))
        expect(module.text, name).not.toMatch(/react|gateway|features|app\//);
    }
  }
});

it('prevents application infrastructure reversal and private cross-feature imports', () => {
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)],
    );
  for (const file of walk(join(process.cwd(), 'src')).filter(
    (file) => /\.tsx?$/.test(file) && !file.includes('.test.'),
  )) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const dependency = statement.moduleSpecifier.text;
      if (file.replaceAll('\\', '/').includes('/application/'))
        expect(dependency, file).not.toMatch(/gateway|features|react/);
      if (file.replaceAll('\\', '/').includes('/features/'))
        expect(dependency, file).not.toMatch(/^\.\.\/[^.][^/]*\//);
    }
  }
});
