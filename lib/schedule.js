// 戰神道場｜排行程：檢查玩家排法、算最佳排法（遊戲畫面、測試共用）
//
// 時間一律用「從 0 點起算的分鐘」：9:00 = 540。開始時間以 30 分鐘為一格。
// 一個任務：{ id, title, loc, dur, win: [[最早開始, 最晚結束], ...], value, must?, fixed? }
//   fixed：固定時間（例如晨會），只能排在 win[0][0]。
//   must：不排就重扣（value 的兩倍當罰分）。

export const STEP = 30;

export const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };

export function travel(level, a, b) {
  if (!a || !b || a === b) return 0;
  const t = level.travel || {};
  const v = t[`${a}|${b}`] ?? t[`${b}|${a}`];
  if (v === undefined) throw new Error(`沒有設定 ${a} 到 ${b} 的交通時間`);
  return v;
}

// 這個任務可以選的開始時間（30 分鐘一格）
export function startOptions(task) {
  const out = [];
  for (const [a, b] of task.win) {
    if (task.fixed) { out.push(a); continue; }
    for (let s = Math.ceil(a / STEP) * STEP; s + task.dur <= b; s += STEP) out.push(s);
  }
  return [...new Set(out)].sort((x, y) => x - y);
}

// 檢查玩家的排法。plan = { taskId: 開始分鐘 | null }
// 回傳 { ok, problems: [{ ids, msg }], score, value, penalty, items: [...依時間排序] }
export function evaluate(level, plan) {
  const problems = [];
  const items = [];
  for (const t of level.tasks) {
    const s = plan[t.id];
    if (s === null || s === undefined || s === '') continue;
    const start = Number(s);
    if (!startOptions(t).includes(start)) problems.push({ ids: [t.id], msg: `「${t.title}」${hm(start)} 開始不在對方可以的時間內` });
    items.push({ task: t, start, end: start + t.dur });
  }
  items.sort((a, b) => a.start - b.start || a.end - b.end);
  // 開場位置：店頭
  let prev = { loc: level.home, end: level.dayStart, task: null };
  for (const it of items) {
    const need = travel(level, prev.loc, it.task.loc);
    if (prev.task && it.start < prev.end) {
      problems.push({ ids: [prev.task.id, it.task.id], msg: `「${prev.task.title}」跟「${it.task.title}」時間重疊` });
    } else if (it.start < prev.end + need) {
      const from = prev.task ? `「${prev.task.title}」` : '早上從店頭';
      problems.push({ ids: [prev.task?.id, it.task.id].filter(Boolean), msg: `${from}到「${it.task.title}」要 ${need} 分鐘車程，來不及` });
    }
    prev = { loc: it.task.loc, end: Math.max(prev.end, it.end), task: it.task };
  }
  let value = 0;
  let penalty = 0;
  const placed = new Set(items.map((i) => i.task.id));
  for (const t of level.tasks) {
    if (placed.has(t.id)) value += t.value;
    else if (t.must) penalty += t.value * 2;
  }
  const ok = problems.length === 0;
  return { ok, problems, value, penalty, score: ok ? value - penalty : 0, items };
}

// 最佳排法：列舉「要排哪些、什麼順序」，每個順序用「能多早就多早」排（有時間窗時這樣最省）
export function solve(level) {
  const tasks = level.tasks;
  const n = tasks.length;
  let best = { score: -Infinity, plan: null, travelSum: Infinity };
  const used = new Array(n).fill(false);
  const order = [];

  function earliest(task, prevLoc, prevEnd) {
    const need = travel(level, prevLoc, task.loc);
    const ready = prevEnd + need;
    for (const s of startOptions(task)) if (s >= ready) return s;
    return null;
  }

  function record(plan, travelSum) {
    const r = evaluate(level, plan);
    if (!r.ok) return;
    if (r.score > best.score || (r.score === best.score && travelSum < best.travelSum)) {
      best = { score: r.score, plan: { ...plan }, travelSum };
    }
  }

  function dfs(prevLoc, prevEnd, plan, travelSum) {
    record(plan, travelSum);
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const t = tasks[i];
      const s = earliest(t, prevLoc, prevEnd);
      if (s === null) continue;
      used[i] = true; order.push(i);
      plan[t.id] = s;
      dfs(t.loc, s + t.dur, plan, travelSum + travel(level, prevLoc, t.loc));
      delete plan[t.id];
      used[i] = false; order.pop();
    }
  }
  dfs(level.home, level.dayStart, {}, 0);
  const full = {};
  for (const t of tasks) full[t.id] = best.plan && best.plan[t.id] !== undefined ? best.plan[t.id] : null;
  return { score: best.score, plan: full };
}
