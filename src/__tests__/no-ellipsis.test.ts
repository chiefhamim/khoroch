/// <reference types="node" />

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC_DIR = path.resolve(__dirname, '..');
const SELF_FILE = path.resolve(__filename);

const BANNED_ICON_NAMES = new Set([
  'more-horizontal',
  'more-vertical',
  'ellipsis',
  'circle-ellipsis',
  'ellipsis-horizontal',
  'ellipsis-vertical',
]);

// ProgressRing uses strokeDasharray only to draw one solid progress arc, not a dashed line.
const DASH_ALLOWED_FILES = new Set(['ProgressRing.tsx']);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'build') continue;
      collectSourceFiles(full, out);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      if (path.resolve(full) !== SELF_FILE) {
        out.push(full);
      }
    }
  }
  return out;
}

function formatLineCol(sf: ts.SourceFile, pos: number): string {
  const { line, character } = sf.getLineAndCharacterOfPosition(pos);
  return `${line + 1}:${character + 1}`;
}

function checkTextValue(text: string): string | null {
  if (text.includes('…')) {
    return 'contains U+2026 ellipsis character (…)' ;
  }
  if (text.includes('...')) {
    return 'contains three periods (...)' ;
  }
  const normalized = text.trim();
  if (BANNED_ICON_NAMES.has(normalized)) {
    return `contains banned icon name "${normalized}"`;
  }
  if (normalized === 'dashed' || normalized === 'dotted') {
    return `uses a ${normalized} border (separators are solid hairlines)`;
  }
  if (normalized === '•••') {
    return 'contains three-dot menu glyph (•••)';
  }
  return null;
}

describe('AGENTS.md §4b no-ellipsis & banned-icon enforcement', () => {
  it('finds zero ellipsis dots, U+2026, or banned three-dot icon names across src/**/*.ts(x) and src/i18n/*', () => {
    const files = collectSourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(20);

    const violations: string[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

      const visit = (node: ts.Node) => {
        if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)
        ) {
          const reason = checkTextValue(node.text);
          if (reason) {
            const rel = path.relative(SRC_DIR, filePath);
            violations.push(`${rel}:${formatLineCol(sf, node.getStart(sf))} ${reason} -> ${JSON.stringify(node.text)}`);
          }
        } else if (
          ts.isJsxAttribute(node) &&
          node.name.getText(sf) === 'strokeDasharray' &&
          !DASH_ALLOWED_FILES.has(path.basename(filePath))
        ) {
          const rel = path.relative(SRC_DIR, filePath);
          violations.push(`${rel}:${formatLineCol(sf, node.getStart(sf))} uses strokeDasharray (no dashed or dotted lines)`);
        } else if (ts.isJsxText(node)) {
          const reason = checkTextValue(node.getText(sf));
          if (reason) {
            const rel = path.relative(SRC_DIR, filePath);
            violations.push(`${rel}:${formatLineCol(sf, node.getStart(sf))} JSX text ${reason}`);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sf);
    }

    expect(violations).toEqual([]);
  });
});
