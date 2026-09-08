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
