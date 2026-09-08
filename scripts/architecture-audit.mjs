import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const walk = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? walk(directory + '/' + entry.name) : [directory + '/' + entry.name],
    );
const sources = walk('src');
const production = sources.filter(
  (file) =>
    /\.(ts|tsx|css)$/.test(file) &&
    !file.includes('.test.') &&
    !file.startsWith('src/test/') &&
    !file.includes('/testing/'),
);
const group = (file) =>
  file.startsWith('src/features/') ? file.split('/').slice(1, 3).join('/') : file.split('/')[1];
const resolve = (file, spec) => {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  return [base, base + '.ts', base + '.tsx', base + '/index.ts'].find((candidate) =>
    production.includes(candidate),
  );
};
const files = [],
  edges = [],
  components = new Set(),
  events = new Set(),
  invariants = [],
  testLayers = {};
for (const file of production) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.trimEnd().split(/\r?\n/);
  const exports = [];
  if (!file.endsWith('.css')) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
        const module = statement.moduleSpecifier;
        if (module && ts.isStringLiteral(module)) {
          const target = resolve(file, module.text);
          if (target) {
            const typeOnly = ts.isImportDeclaration(statement)
              ? !!statement.importClause?.isTypeOnly ||
                !!(
                  statement.importClause?.namedBindings &&
                  ts.isNamedImports(statement.importClause.namedBindings) &&
                  statement.importClause.namedBindings.elements.length &&
                  statement.importClause.namedBindings.elements.every((item) => item.isTypeOnly)
                )
              : !!statement.isTypeOnly;
            edges.push({ from: file, to: target, typeOnly });
          }
        }
      }
      if (statement.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        if (statement.name) exports.push(statement.name.getText(source));
        if (ts.isVariableStatement(statement))
          for (const declaration of statement.declarationList.declarations)
            exports.push(declaration.name.getText(source));
      }
      if (
        ts.isExportDeclaration(statement) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      )
        exports.push(...statement.exportClause.elements.map((item) => item.name.text));
    }
    const visit = (node) => {
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          (ts.isVariableDeclaration(node) &&
            node.initializer &&
            (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))) &&
        node.name &&
        /^[A-Z]/.test(node.name.getText(source))
      ) {
        let rendersJSX = false;
        const inspect = (child) => {
          if (
            ts.isJsxElement(child) ||
            ts.isJsxSelfClosingElement(child) ||
            ts.isJsxFragment(child)
          )
            rendersJSX = true;
          ts.forEachChild(child, inspect);
        };
        inspect(node);
        if (rendersJSX) components.add(file + ':' + node.name.getText(source));
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const target = resolve(file, node.arguments[0].text);
        if (target) edges.push({ from: file, to: target, typeOnly: false, dynamic: true });
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (
          node.expression.text === 'record' &&
          node.arguments[2] &&
          ts.isStringLiteral(node.arguments[2])
        )
          events.add(node.arguments[2].text);
        if (
          file === 'src/domain/invariants.ts' &&
          node.expression.text === 'check' &&
          node.arguments[2] &&
          ts.isStringLiteral(node.arguments[2])
        )
          invariants.push(node.arguments[2].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  files.push({
    file,
    layer: group(file),
    physicalLines: lines.length,
    nonblankLines: lines.filter((line) => line.trim()).length,
    exports,
  });
}
const testFiles = [
  ...sources.filter((file) => file.includes('.test.')),
  ...walk('e2e').filter((file) => file.endsWith('.spec.ts')),
];
for (const file of testFiles) {
  const layer = file.startsWith('e2e/')
    ? 'Playwright'
    : file.includes('Contract.test')
      ? 'Gateway contracts'
      : file.startsWith('src/domain/')
        ? 'Domain policies and invariants'
        : file.startsWith('src/application/')
          ? 'Application transactions and read models'
          : file.startsWith('src/gateway/')
            ? 'Gateway and cross-domain state machines'
            : 'React integration and workspace reducers';
  (testLayers[layer] ??= []).push(file);
}
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const model = program.getSourceFile(path.resolve('src/domain/model.ts'));
const alias = model.statements.find(
  (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Command',
);
const commandType = checker.getTypeFromTypeNode(alias.type);
const commands = new Set();
for (const type of commandType.types ?? [commandType]) {
  const property = type.getProperty('type');
  if (!property) continue;
  const value = checker.getTypeOfSymbolAtLocation(property, alias);
  for (const variant of value.types ?? [value])
    if (variant.isStringLiteral()) commands.add(variant.value);
}
const eventSource = program.getSourceFile(path.resolve('src/domain/events.ts'));
const eventAlias = eventSource.statements.find(
  (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'DomainEventType',
);
const eventType = checker.getTypeFromTypeNode(eventAlias.type);
const domainEventTypes = (eventType.types ?? [eventType])
  .filter((type) => type.isStringLiteral())
  .map((type) => type.value)
  .sort();
const layerEdges = new Map();
for (const edge of edges.filter((edge) => !edge.typeOnly)) {
  const from = group(edge.from),
    to = group(edge.to);
  if (from !== to) {
    const key = from + ' -> ' + to;
    layerEdges.set(key, (layerEdges.get(key) ?? 0) + 1);
  }
}
const cycles = [];
const visited = new Set();
const adjacency = new Map();
for (const edge of edges.filter((edge) => !edge.typeOnly))
  (adjacency.get(edge.from) ?? adjacency.set(edge.from, []).get(edge.from)).push(edge.to);
function visit(file, stack) {
  if (stack.includes(file)) {
    cycles.push([...stack.slice(stack.indexOf(file)), file]);
    return;
  }
  if (visited.has(file)) return;
  for (const target of adjacency.get(file) ?? []) visit(target, [...stack, file]);
  visited.add(file);
}
for (const file of production) visit(file, []);
console.log(
  JSON.stringify(
    {
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      commitCount: Number(
        execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }),
      ),
      productionFiles: files.length,
      productionTypeScriptFiles: files.filter((file) => !file.file.endsWith('.css')).length,
      productionTypeScriptLOC: files
        .filter((file) => !file.file.endsWith('.css'))
        .reduce((sum, file) => sum + file.physicalLines, 0),
      reactComponents: [...components].sort(),
      featureDirectories: [
        ...new Set(
          files
            .filter((file) => file.file.startsWith('src/features/'))
            .map((file) => file.file.split('/')[2]),
        ),
      ].sort(),
      productionPhysicalLOC: files.reduce((sum, file) => sum + file.physicalLines, 0),
      productionNonblankLOC: files.reduce((sum, file) => sum + file.nonblankLines, 0),
      typescriptNonblankLOC: files
        .filter((file) => !file.file.endsWith('.css'))
        .reduce((sum, file) => sum + file.nonblankLines, 0),
      commands: [...commands].sort(),
      domainEventTypes,
      literalRecordedEventTypes: [...events].sort(),
      invariantRules: invariants,
      publicFeatureAPIs: files.filter(
        (file) => file.file.startsWith('src/features/') && file.file.endsWith('/index.ts'),
      ),
      largestModules: [...files].sort((a, b) => b.nonblankLines - a.nonblankLines).slice(0, 12),
      testLayers,
      layerEdges: Object.fromEntries([...layerEdges].sort()),
      runtimeImportCycles: cycles,
      files,
      edges,
    },
    null,
    2,
  ),
);
