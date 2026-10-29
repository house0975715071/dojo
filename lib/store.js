// 戰神道場｜成績本（只存在這台裝置的瀏覽器；不上傳、不連網）
// 讀寫失敗（無痕視窗、被擋）時照樣能玩，只是不會記住。
import { GRADES, GRADE_XP, rankOf } from './score.js';
import { emptyPlan, emptyExam } from './plan.js';

const KEY = 'dojo.v1';

function blank() {
  return { name: '', scenes: {}, drills: { seen: {}, rounds: [] }, schedule: {}, plan: emptyPlan(), exam: emptyExam(), seenLaw: false, created: Date.now() };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const d = JSON.parse(raw);
    const b = blank();
    const p = d.plan || {};
    return {
      ...b, ...d,
      scenes: d.scenes || {},
      drills: { seen: (d.drills && d.drills.seen) || {}, rounds: (d.drills && d.drills.rounds) || [] },
      schedule: d.schedule || {},
      plan: { ...emptyPlan(), ...p, field: p.field || {}, ai: p.ai || {}, oral: p.oral || {}, counters: p.counters || {} },
      exam: { ...emptyExam(), ...(d.exam || {}), scenes: (d.exam && d.exam.scenes) || {} },
    };
  } catch { return blank(); }
}

// 畢業考：每一部分保留最好的那次
export function recordExamDrill(d, score, total) {
  const cur = d.exam.drill;
  if (!cur || score / total > cur.score / cur.total) d.exam.drill = { score, total, at: Date.now() };
  return d;
}
export function recordExamScene(d, id, result) {
  const cur = d.exam.scenes[id];
  const better = !cur
    || (result.law === 100 && cur.law < 100)
    || (result.law >= cur.law && GRADES.indexOf(result.grade) < GRADES.indexOf(cur.grade));
  if (better) d.exam.scenes[id] = { grade: result.grade, score: result.score, law: result.law, at: Date.now() };
  return d;
}
export function recordExamSched(d, score, max) {
  const cur = d.exam.sched;
  if (!cur || score > cur.score) d.exam.sched = { score, max, at: Date.now() };
  return d;
}

export function save(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch { /* 忽略 */ }
  return blank();
}

// 關卡成績：保留最好的評等與分數
export function recordScene(d, id, result) {
  const cur = d.scenes[id] || { plays: 0 };
  const better = !cur.grade
    || GRADES.indexOf(result.grade) < GRADES.indexOf(cur.grade)
    || (result.grade === cur.grade && result.score > (cur.score || 0));
  d.scenes[id] = {
    plays: cur.plays + 1,
    grade: better ? result.grade : cur.grade,
    score: better ? result.score : cur.score,
    end: better ? result.end : cur.end,
    lawMiss: (cur.lawMiss || 0) + (result.law < 100 ? 1 : 0),
    last: Date.now(),
  };
  return d;
}

// 話術卡：記每張卡最近一次的結果；答錯的進錯題本
export function recordDrill(d, id, tag) {
  const cur = d.drills.seen[id] || { n: 0, best: 0 };
  d.drills.seen[id] = { n: cur.n + 1, best: cur.best + (tag === 'best' ? 1 : 0), last: tag };
  return d;
}

export function recordDrillRound(d, score, total) {
  d.drills.rounds.push({ at: Date.now(), score, total });
  if (d.drills.rounds.length > 50) d.drills.rounds = d.drills.rounds.slice(-50);
  return d;
}

export function wrongDrills(d) {
  return Object.entries(d.drills.seen).filter(([, v]) => v.last !== 'best').map(([id]) => id);
}

export function recordSchedule(d, id, score, max) {
  const cur = d.schedule[id] || { best: 0, plays: 0 };
  d.schedule[id] = { best: Math.max(cur.best, score), max, plays: cur.plays + 1, last: Date.now() };
  return d;
}

// 經驗值：關卡最佳評等 + 話術卡答對過的張數 × 3 + 排行程最佳 / 滿分 × 40
export function xpOf(d) {
  let xp = 0;
  for (const v of Object.values(d.scenes)) xp += GRADE_XP[v.grade] || 0;
  xp += Object.values(d.drills.seen).filter((v) => v.best > 0).length * 3;
  for (const v of Object.values(d.schedule)) if (v.max > 0) xp += Math.round(Math.max(0, v.best) / v.max * 40);
  return xp;
}

export function rank(d) { return rankOf(xpOf(d)); }
