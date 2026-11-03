import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rel, sourceFiles } from '../scripts/wording-scan.mjs';

// 새 항목·안 읽음 표시는 이름 앞 점(CLAUDE.md '화면 모양', 회장님 2026-11-03).
// 배지·알약·칩·태그 모양 요소 안에 'NEW'·'새 글'·'신규'·'새 예약'·'안 읽음'만 든 것을 찾는다.
// 넉넉한 상세 화면 머리·홍보 카드처럼 목록 줄이 아닌 자리는 ALLOW에 '파일: 까닭'으로 적는다.
const ALLOW = {
  // 'path/to/file.html': '홍보 카드 머리말 — 목록 줄이 아님',
};

const pill = /<(\w+)[^>]*class(?:Name)?=["'{][^"'}]*\b(?:badge|pill|chip|tag|label-new|new-badge)[^"'}]*["'}][^>]*>\s*(NEW|New|new|새 ?글|신규|새 ?예약|새 ?항목|안 ?읽음)\s*<\/\1>/g;

export function newPills(text) {
  return [...text.matchAll(pill)].map((m) => ({ line: text.slice(0, m.index).split('\n').length, text: m[2] }));
}

test('검사 — 배지 모양 요소 안의 NEW·새 글은 잡고 점·수·다른 알약은 두지 않는다', () => {
  assert.equal(newPills('<span class="badge">NEW</span>').length, 1);
  assert.equal(newPills('<span className="pill text-xs">새 글</span>').length, 1);
  assert.equal(newPills('<span class="new-dot" aria-label="새 글"></span>').length, 0);
  assert.equal(newPills('<span class="badge">3</span>').length, 0);
  assert.equal(newPills('<span class="chip">리프팅</span>').length, 0);
});

test('목록 줄에 NEW·새 글 알약 배지를 쓰지 않는다 — 이름 앞 점으로', () => {
  const found = [];
  for (const file of sourceFiles()) {
    const r = rel(file);
    if (ALLOW[r]) continue;
    for (const p of newPills(fs.readFileSync(file, 'utf8'))) found.push(`${r}:${p.line} ${p.text}`);
  }
  assert.deepEqual(found, [], '이름 앞 점(약 8px 강조색, 없는 줄은 투명한 점)으로 바꾸거나 ALLOW에 까닭을 적어 주세요');
});
