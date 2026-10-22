// 화면 글 뽑기 — 소스 파일에서 한글이 든 화면 글만 꺼낸다(주석은 빠짐).
// HTML: 태그 사이 글과 사람이 읽는 속성(alt·title·aria-label·placeholder·value·content), <script> 안은 스크립트로 읽음.
// 스크립트(js·mjs·ts·tsx·jsx): TypeScript AST로 문자열·템플릿 조각·JSX 글.
// 쓰는 곳: tests/ux-wording.test.mjs(용어 사전 검사), scripts/wording-diff.mjs(새로 쓴 화면 글 점검).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { wordingSkip } from '../lib/ux-wording.mjs';

export const root = path.resolve(import.meta.dirname, '..');
const hangul = /[가-힣]/;
export const screenFile = /\.(html?|[cm]?[jt]sx?)$/;

export const rel = (file) => path.relative(root, file).split(path.sep).join('/');
export const skipped = (relPath) => wordingSkip.some((s) => (s.endsWith('/') ? relPath.startsWith(s) : relPath === s));

export function sourceFiles(dir = root) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const r = rel(full) + (entry.isDirectory() ? '/' : '');
    if (skipped(r)) return [];
    if (entry.isDirectory()) return sourceFiles(full);
    return screenFile.test(entry.name) ? [full] : [];
  });
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function scriptStrings(file, text, lineOffset = 0) {
  if (!hangul.test(text)) return [];
  const kind = /x$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$|\.html?$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found = [];
  const visit = (node) => {
    let value = null;
    if (ts.isStringLiteralLike(node)) value = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) value = node.text;
    else if (ts.isJsxText(node)) value = node.text.replace(/\s+/g, ' ').trim();
    if (value && hangul.test(value)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      found.push({ line: line + 1 + lineOffset, text: value });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const readable = /\b(alt|title|aria-label|placeholder|value|content|label)\s*=\s*("([^"]*)"|'([^']*)')/gi;

function htmlStrings(file, text) {
  if (!hangul.test(text)) return [];
  const found = [];
  // 주석은 같은 길이의 공백으로 지워 줄 번호를 지킨다.
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let body = text.replace(/<!--[\s\S]*?-->/g, blank);
  body = body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, code, close, index) => {
    found.push(...scriptStrings(file, code, lineAt(body, index + open.length) - 1));
    return open + blank(code) + close;
  });
  body = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, blank);
  for (const tag of body.matchAll(/<[^>]+>/g)) {
    for (const attr of tag[0].matchAll(readable)) {
      const value = (attr[3] ?? attr[4]).trim();
      if (hangul.test(value)) found.push({ line: lineAt(body, tag.index + attr.index), text: value });
    }
  }
  for (const piece of body.matchAll(/>([^<]+)</g)) {
    const value = piece[1].replace(/\s+/g, ' ').trim();
    if (hangul.test(value)) found.push({ line: lineAt(body, piece.index + 1 + piece[1].search(/\S/)), text: value });
  }
  return found.sort((a, b) => a.line - b.line);
}

/** 파일에서 한글이 든 화면 글을 [{ line, text }]로. text는 따옴표·태그를 뺀 글. */
export function screenStrings(file, text = fs.readFileSync(file, 'utf8')) {
  return /\.html?$/.test(file) ? htmlStrings(file, text) : scriptStrings(file, text);
}
