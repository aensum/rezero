// npm run wording — main과 갈라진 뒤 새로 쓰거나 바꾼 화면 글만 뽑아 UX 라이팅 점검표와 함께 보인다.
// 기준은 origin/main과의 merge-base. 다른 기준은 `npm run wording -- <커밋>`.
// 용어 사전(lib/ux-wording.mjs)에 걸리면 ✗, 버릇처럼 틀리는 모양(합쇼체·개발 용어·괄호·번역투·긴 글)은 △.
// 실패로 멈추지 않는다 — 뽑은 글을 한 줄씩 읽고 고치거나, 그대로 두는 사유를 보고에 적는다(.claude/skills/ux-writing).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root, screenFile, screenStrings, skipped } from './wording-scan.mjs';
import { wordingRules } from '../lib/ux-wording.mjs';

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
let base = process.argv[2];
if (!base) {
  try {
    base = git('merge-base', 'HEAD', 'origin/main').trim();
  } catch {
    base = git('merge-base', 'HEAD', 'main').trim();
  }
}

const changed = new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
]);
const files = [...changed].filter((f) => f && screenFile.test(f) && !skipped(f));

const habits = [
  { re: /[습입됩합랍봅]니다|십시오|[습입]니까|하시겠/, why: '합쇼체 — 버튼·안내·오류는 해요체(병원 소개 본문의 브랜드 말투면 그대로 두고 보고에 적기)' },
  { re: /서버|대기열|동기화|데이터|캐시|토큰|레코드|필드|파라미터|API|iframe|null|undefined/i, why: '개발 용어 — 사용자가 하는 일·보는 것으로' },
  { re: /\{[^}]*[가-힣][^}]*\}|\([^)]{12,}\)|[가-힣]\/[가-힣]/, why: '괄호·A/B — 본문으로 풀거나 가운뎃점' },
  { re: /(을|를) 통해|에 대한|에 있어서|하도록 하|되어지|진행하도록|가능합니다|할 수 있습니다/, why: '번역투·군더더기 — 짧은 우리말로' },
];

let total = 0;
let flagged = 0;
for (const file of files) {
  let before = [];
  try {
    before = screenStrings(file, git('show', `${base}:${file}`)).map((s) => s.text);
  } catch {
    // 새 파일
  }
  const seen = new Map();
  for (const t of before) seen.set(t, (seen.get(t) ?? 0) + 1);
  let now = [];
  try {
    now = screenStrings(path.join(root, file));
  } catch {
    continue; // 지운 파일
  }
  const added = now.filter((s) => {
    const n = seen.get(s.text) ?? 0;
    if (n > 0) {
      seen.set(s.text, n - 1);
      return false;
    }
    return true;
  });
  if (!added.length) continue;
  console.log(`\n${file}`);
  for (const s of added) {
    total += 1;
    const notes = [];
    for (const rule of wordingRules) {
      if (rule.avoid.test(s.text) && !rule.except?.test(s.text)) notes.push(`✗ ${rule.use} (${rule.ref}${rule.check === 'review' ? ' · 맥락 확인' : ''})`);
    }
    for (const h of habits) if (h.re.test(s.text)) notes.push(`△ ${h.why}`);
    if (s.text.length > 60) notes.push(`△ ${s.text.length}자 — 휴대폰 한 줄을 넘음, 한 문장에 한 가지`);
    if (notes.length) flagged += 1;
    console.log(`  ${String(s.line).padStart(5)}  ${s.text}`);
    for (const n of notes) console.log(`         ${n}`);
  }
}
console.log(`\n새 화면 글 ${total}개 · 다시 볼 글 ${flagged}개 — 나머지도 .claude/skills/ux-writing 점검표로 한 번씩 읽어 주세요.`);
