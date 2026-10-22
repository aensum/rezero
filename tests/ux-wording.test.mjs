import test from 'node:test';
import assert from 'node:assert/strict';
import { rel, sourceFiles, screenStrings } from '../scripts/wording-scan.mjs';
import { wordingRules } from '../lib/ux-wording.mjs';

// UX 라이팅 용어 사전(lib/ux-wording.mjs) — 의료광고 금지 표현과 회장님이 짚은 말을 화면에 다시 쓰지 않게 막는다.
// check: 'test' 줄만 여기서 막고, 'review' 줄은 npm run wording이 새 글에서만 짚는다.
const strings = sourceFiles().flatMap((file) => screenStrings(file).map((s) => ({ ...s, file: rel(file) })));

test('용어 사전 줄마다 쓰는 말·출처가 있고, 쓰는 말이 피하는 말에 걸리지 않는다', () => {
  assert.ok(wordingRules.length >= 20, '용어 사전이 비었어요');
  for (const rule of wordingRules) {
    assert.ok(rule.avoid instanceof RegExp, `${rule.use} — avoid는 정규식`);
    assert.ok(rule.use && rule.where && rule.ref, `${rule.avoid} — use·where·ref를 적어 주세요`);
    assert.ok(rule.check === 'test' || rule.check === 'review', `${rule.avoid} check`);
    for (const word of rule.use.split(/\s*[·,]\s*/)) {
      if (word && !/[…~]/.test(word)) assert.ok(!rule.avoid.test(word) || rule.except?.test(word), `${rule.avoid}의 쓰는 말 '${word}'이 피하는 말에 걸려요`);
    }
  }
});

test('화면 글 뽑기 — HTML 글·속성·스크립트 문자열은 잡고 주석·스타일은 뺀다', () => {
  const html = [
    '<!-- 완치 주석 -->',
    '<style>.a::after{content:"최고"}</style>',
    '<button aria-label="예약 버튼">지금 예약하기</button>',
    '<script>// 효과 보장 주석',
    'const msg = `상담 ${n}건`;</script>',
  ].join('\n');
  assert.deepEqual(screenStrings('sample.html', html), [
    { line: 3, text: '예약 버튼' },
    { line: 3, text: '지금 예약하기' },
    { line: 5, text: '상담 ' },
    { line: 5, text: '건' },
  ]);
  assert.deepEqual(screenStrings('a.tsx', 'const A = () => <p>예약 완료</p>; // 완치'), [{ line: 1, text: '예약 완료' }]);
});

test('사전이 의료광고 금지 표현을 잡는다', () => {
  const blocked = (text) => wordingRules.some((r) => r.check === 'test' && r.avoid.test(text) && !r.except?.test(text));
  for (const bad of ['여드름 완치', '효과 보장', '부산 최고의 피부과', '국내 유일 장비', '통증 없는 시술', '부작용 없이', '단 1회로 끝', '추천 시술']) {
    assert.ok(blocked(bad), `'${bad}'을 막아야 해요`);
  }
  for (const ok of ['진료 전 충분한 상담이 먼저입니다', '지금 예약하기', '새로고침', '달력', '12개월']) {
    assert.ok(!blocked(ok), `'${ok}'은 막지 않아요`);
  }
});

test('화면 글에 용어 사전의 피하는 말을 쓰지 않는다', () => {
  const found = [];
  for (const rule of wordingRules.filter((r) => r.check === 'test')) {
    for (const s of strings) {
      if (rule.avoid.test(s.text) && !rule.except?.test(s.text)) found.push(`${s.file}:${s.line} ${s.text.slice(0, 60)} → ${rule.use}`);
    }
  }
  assert.deepEqual(found, [], '용어 사전(lib/ux-wording.mjs)의 쓰는 말로 바꿔 주세요');
});
