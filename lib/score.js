// 戰神道場｜計分規則（遊戲畫面、檢查器、測試共用這一份，算法只寫一次）
//
// 信任、成交溫度：0～100；法遵：從 100 開始只扣不加。
// 關卡分數 = 結局分（win 40／partial 25／lose 10）＋ 信任 × 0.25 ＋ 成交溫度 × 0.2 ＋ 法遵 × 0.15
// 評等：S ≥ 90、A ≥ 80、B ≥ 65、C 以下；法遵不是 100 → 最高 B；結局 lose → 最高 C。

export const END_POINTS = { win: 40, partial: 25, lose: 10 };
export const GRADES = ['S', 'A', 'B', 'C'];

export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function startState(scene) {
  const init = scene.init || {};
  return {
    node: scene.start,
    trust: clamp(Number(init.trust ?? 40)),
    deal: clamp(Number(init.deal ?? 30)),
    law: 100,
    picks: [],          // { node, idx, tag, law }
  };
}

// 套用一個選項，回傳新狀態（不改舊的）
export function applyChoice(state, nodeId, idx, choice) {
  return {
    node: choice.next,
    trust: clamp(state.trust + (Number(choice.trust) || 0)),
    deal: clamp(state.deal + (Number(choice.deal) || 0)),
    law: clamp(state.law + Math.min(0, Number(choice.law) || 0)),
    picks: [...state.picks, { node: nodeId, idx, tag: choice.tag, law: Number(choice.law) || 0 }],
  };
}

export function sceneScore(end, s) {
  const base = END_POINTS[end] ?? 10;
  const raw = base + s.trust * 0.25 + s.deal * 0.2 + s.law * 0.15;
  return Math.round(raw);
}

export function gradeOf(end, s) {
  const score = sceneScore(end, s);
  let g = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : 'C';
  const cap = (max) => { if (GRADES.indexOf(g) < GRADES.indexOf(max)) g = max; };
  if (s.law < 100) cap('B');
  if (end === 'lose') cap('C');
  return { score, grade: g };
}

// 話術快打：best 得 10 分、ok 得 5 分、bad 0 分
export const DRILL_POINTS = { best: 10, ok: 5, bad: 0 };

// 段位：用「通關關卡數 × 評等」＋「話術快打累積答對」算
export const RANKS = [
  { min: 0, name: '見習生', icon: '🌱' },
  { min: 60, name: '新進業務', icon: '🔰' },
  { min: 180, name: '正式業務', icon: '💼' },
  { min: 360, name: '資深業務', icon: '🏅' },
  { min: 600, name: '店長級', icon: '🏆' },
  { min: 900, name: '戰神', icon: '⚔️' },
];
export const GRADE_XP = { S: 60, A: 45, B: 30, C: 10 };

export function rankOf(xp) {
  let r = RANKS[0];
  for (const x of RANKS) if (xp >= x.min) r = x;
  const next = RANKS[RANKS.indexOf(r) + 1] || null;
  return { ...r, next };
}
