// 戰神道場｜30 天養成：任務判斷、週目標、畢業考（畫面、測試共用）
import { GRADES } from './score.js';

export const EXAM_RULE = {
  drills: 20,        // 筆試張數
  lawMin: 4,         // 其中法遵至少幾張
  seconds: 20,       // 每張秒數
  drillPass: 0.85,   // 筆試及格
  sceneMin: 'A',     // 實戰每關最低評等（而且 0 違規）
  schedPass: 90,     // 排行程及格（佔最佳解 %）
};

// 畢業考實戰：開發委託／買方帶看斡旋／議價簽約 三組各抽一關
export const EXAM_GROUPS = [[1, 2], [3, 4, 5], [6, 7]];

export const atLeast = (grade, min) => !!grade && GRADES.indexOf(grade) >= 0 && GRADES.indexOf(grade) <= GRADES.indexOf(min);

export function emptyPlan() {
  return { start: null, field: {}, ai: {}, oral: {}, counters: {} };
}
export function emptyExam() {
  return { picked: null, drill: null, scenes: {}, sched: null, oral: false, passedAt: null };
}

// 第幾天（從 1 開始；還沒開始回 0；最多 30）
export function dayNumber(startISO, now = new Date()) {
  if (!startISO) return 0;
  const [y, m, d] = startISO.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.round((today - start) / 86400000) + 1;
  return Math.max(1, Math.min(30, n));
}

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 一個遊戲任務完成沒
export function taskDone(task, data, drills) {
  const plan = data.plan || emptyPlan();
  switch (task.t) {
    case 'scene': { const r = data.scenes[task.id]; return atLeast(r && r.grade, task.min || 'A'); }
    case 'drill': {
      const ids = drills.filter((d) => d.cat === task.cat).map((d) => d.id);
      const good = ids.filter((id) => (data.drills.seen[id] || {}).best > 0).length;
      return ids.length > 0 && good >= Math.min(task.min || 4, ids.length);
    }
    case 'sched': { const r = data.schedule[task.id]; return !!r && r.max > 0 && r.best / r.max * 100 >= (task.pct || 90); }
    case 'law': return !!data.seenLaw;
    case 'ai': return !!plan.ai[`${task.role}-${task.level}`];
    case 'exam': return examStatus(data, drills).passed;
    default: return false;
  }
}

export const fieldKey = (day, i) => `d${day}-${i}`;
export const oralKey = (week, i) => `w${week}-${i}`;

export function dayStatus(day, data, drills, weeks) {
  const plan = data.plan || emptyPlan();
  const gameDone = day.game.filter((t) => taskDone(t, data, drills)).length;
  const fieldDone = day.field.filter((_, i) => plan.field[fieldKey(day.day, i)]).length;
  let oralTotal = 0; let oralDone = 0;
  if (day.review) {
    const wk = weeks.find((w) => w.n === day.review);
    oralTotal = wk ? wk.oral.length : 0;
    oralDone = wk ? wk.oral.filter((_, i) => plan.oral[oralKey(wk.n, i)]).length : 0;
  }
  const total = day.game.length + day.field.length + oralTotal;
  const done = gameDone + fieldDone + oralDone;
  return { gameDone, gameTotal: day.game.length, fieldDone, fieldTotal: day.field.length, oralDone, oralTotal, done, total, complete: total > 0 && done === total };
}

// 週目標：活動量累計
export function weekGoals(week, plan) {
  const c = (plan && plan.counters) || {};
  const row = (g, stretch) => ({ c: g.c, need: g.n, have: c[g.c] || 0, ok: (c[g.c] || 0) >= g.n, stretch });
  return [...week.goals.map((g) => row(g, false)), ...(week.stretch || []).map((g) => row(g, true))];
}

// 畢業考抽題（rnd 可換成固定亂數方便測試）
export function pickExam(scenes, levels, rnd = Math.random) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const sc = EXAM_GROUPS.map((chs) => scenes.filter((s) => chs.includes(s.chapter))).filter((g) => g.length).map((g) => pick(g).id);
  return { scenes: sc, sched: pick(levels).id };
}

export function pickExamDrills(drills, rnd = Math.random) {
  const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const law = shuffle(drills.filter((d) => d.cat === '法遵')).slice(0, EXAM_RULE.lawMin);
  const rest = shuffle(drills.filter((d) => d.cat !== '法遵')).slice(0, EXAM_RULE.drills - law.length);
  return shuffle([...law, ...rest]);
}

export function examStatus(data) {
  const ex = data.exam || emptyExam();
  const drillOk = !!ex.drill && ex.drill.total > 0 && ex.drill.score / ex.drill.total >= EXAM_RULE.drillPass;
  const ids = (ex.picked && ex.picked.scenes) || [];
  const sceneRows = ids.map((id) => {
    const r = ex.scenes[id];
    return { id, grade: r && r.grade, law: r ? r.law : null, ok: !!r && atLeast(r.grade, EXAM_RULE.sceneMin) && r.law === 100 };
  });
  const scenesOk = sceneRows.length > 0 && sceneRows.every((r) => r.ok);
  const schedPct = ex.sched && ex.sched.max > 0 ? Math.round(Math.max(0, ex.sched.score) / ex.sched.max * 100) : null;
  const schedOk = schedPct !== null && schedPct >= EXAM_RULE.schedPass;
  const oralOk = !!ex.oral;
  return { drillOk, sceneRows, scenesOk, schedPct, schedOk, oralOk, passed: drillOk && scenesOk && schedOk && oralOk };
}
