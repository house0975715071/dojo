// 戰神道場｜房仲實戰模擬：主程式（所有畫面與互動）
// 內容在 content/，計分在 lib/score.js，排行程在 lib/schedule.js，成績在 lib/store.js（只存在本機瀏覽器）。
import { startState, applyChoice, gradeOf, DRILL_POINTS } from './lib/score.js';
import * as Store from './lib/store.js';
import { evaluate, solve, startOptions, hm, travel } from './lib/schedule.js';
import LAWS, { CHECKED } from './content/laws.js';
import ROLES, { LEVELS, buildPrompt } from './content/roleplay.js';
import SCHED from './content/schedule.js';
import PLAN30, { WEEKS, COUNTERS } from './content/plan30.js';
import { DAY as PB_DAY, HABITS, MISTAKES } from './content/playbook.js';
import {
  EXAM_RULE, taskDone, dayStatus, weekGoals, dayNumber, todayISO, fieldKey, oralKey,
  pickExam, pickExamDrills, examStatus, emptyExam,
} from './lib/plan.js';

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CHAPTERS = [
  { n: 1, name: '開發', icon: '🔍', desc: '找到願意見你的屋主' },
  { n: 2, name: '委託', icon: '📝', desc: '把開價談對、把委託簽下來' },
  { n: 3, name: '買方', icon: '📞', desc: '問出真需求，約到對的人' },
  { n: 4, name: '帶看', icon: '🏠', desc: '誠實揭露，處理異議' },
  { n: 5, name: '收斡旋', icon: '🤝', desc: '引導出價，合法收斡旋' },
  { n: 6, name: '議價', icon: '⚖️', desc: '穩住雙方，見面談成交' },
  { n: 7, name: '簽約', icon: '✍️', desc: '守住服務費，成交再轉介' },
];
const CATS = ['開發', '委託', '買方', '帶看', '斡旋', '議價', '服務費', '法遵'];
const CAT_SLUG = { 開發: 'dev', 委託: 'list', 買方: 'buy', 帶看: 'show', 斡旋: 'offer', 議價: 'nego', 服務費: 'fee', 法遵: 'law' };
const SLUG_CAT = Object.fromEntries(Object.entries(CAT_SLUG).map(([k, v]) => [v, k]));
const TAG_LABEL = { best: '漂亮！', ok: '可以更好', bad: '踩雷了' };
const END_LABEL = { win: '成功', partial: '勉強過關', lose: '失敗' };

let SCENES = [];
let DRILLS = [];
const MISSING = [];
let data = Store.load();
const persist = () => Store.save(data);

let play = null;    // 正在玩的關卡（play.exam = 畢業考模式：不即時講評）
let drill = null;   // 正在玩的話術快打
let exdrill = null; // 畢業考筆試
let sched = null;   // 正在排的行程
let ai = { role: null, level: 'normal' };
let timed = false;
let timerId = null;
let lastRenderAt = 0;
const solved = {};  // 排行程最佳解快取

// ---------- 小工具 ----------
function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('已複製'); return; } catch { /* 改用舊方法 */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  toast(ok ? '已複製' : '複製失敗，請手動選取文字複製');
}
function view(html) {
  $app.innerHTML = html;
  lastRenderAt = performance.now();
}
function footer() {
  return `<footer class="note">情境、社區與人物皆為虛構；價格為遊戲數值，不是實價登錄。法規查證日 ${esc(CHECKED)}，以主管機關現行規定為準。<br>成績只存在這台裝置的瀏覽器，不會上傳。</footer>`;
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
function gradeBadge(g) { return g ? `<span class="badge g-${g}">${g}</span>` : '<span class="badge muted">－</span>'; }
function lawChips(codes) {
  return (codes || []).map((c) => `<a class="chip law" href="#/law/${esc(c)}">${esc(c)}</a>`).join(' ');
}
const sceneById = (id) => SCENES.find((s) => s.id === id);

// ---------- 首頁 ----------
function rankBlock() {
  const xp = Store.xpOf(data);
  const r = Store.rank(data);
  const pct = r.next ? Math.round((xp - r.min) / (r.next.min - r.min) * 100) : 100;
  return `<div class="card rankcard">
    <div class="big">${r.icon}</div>
    <div style="flex:1">
      <div><b>${esc(data.name || '新人')}</b>　段位：<b class="g-S">${esc(r.name)}</b>　<span class="muted small">經驗 ${xp}</span></div>
      <div class="bar" style="margin:6px 0"><i style="width:${pct}%"></i></div>
      <div class="muted small">${r.next ? `再 ${r.next.min - xp} 經驗升「${esc(r.next.name)}」` : '已經是最高段位'}</div>
    </div>
  </div>`;
}

function drillCatDone(cat) {
  const ids = DRILLS.filter((d) => d.cat === cat).map((d) => d.id);
  const good = ids.filter((id) => (data.drills.seen[id] || {}).best > 0).length;
  return { good, total: ids.length, done: ids.length > 0 && good >= Math.min(4, ids.length) };
}

function home() {
  view(`
    <section class="hero">
      <h1>⚔️ 戰神道場 <em>房仲實戰模擬</em></h1>
      <p class="muted">從開發、委託、帶看、收斡旋、議價到見面談成交——每一句話都有後果。選錯不扣錢，現場選錯扣的是案子。</p>
    </section>
    ${rankBlock()}
    ${MISSING.length ? `<div class="warn">還沒做好的內容：${esc(MISSING.join('、'))}（其他部分可以先玩）</div><br>` : ''}
    ${planCard()}
    <div class="grid">
      <a class="tile" href="#/map"><div class="ico">🎯</div><b>主線實戰</b><span>7 章 ${SCENES.length} 關，一個案子從開發走到交屋</span></a>
      <a class="tile" href="#/drill"><div class="ico">⚡</div><b>話術快打</b><span>${DRILLS.length} 張難接的話，選出最好的回法</span></a>
      <a class="tile" href="#/sched"><div class="ico">🗓️</div><b>排行程挑戰</b><span>${SCHED.length} 天的行程，跟電腦算的最佳排法比</span></a>
      <a class="tile" href="#/ai"><div class="ico">🤖</div><b>AI 對練</b><span>${ROLES.length} 種難搞客人，貼到 Claude 自由對話</span></a>
      <a class="tile" href="#/book"><div class="ico">📘</div><b>超級業務手冊</b><span>一天的節奏、7 個習慣、新人最常犯的 10 個錯</span></a>
      <a class="tile" href="#/exam"><div class="ico">🎓</div><b>畢業考</b><span>筆試、實戰、排行程、店長口試，全過才結業</span></a>
      <a class="tile" href="#/law"><div class="ico">⚖️</div><b>法規小抄</b><span>${LAWS.length} 條紅線，踩到就扣法遵分</span></a>
      <a class="tile" href="#/report"><div class="ico">📋</div><b>成績單</b><span>段位、弱項、一鍵複製給店長</span></a>
    </div>
    ${footer()}`);
}

// ---------- 30 天養成 ----------
const dayOf = (n) => PLAN30.find((d) => d.day === n);
const curDay = () => dayNumber(data.plan.start);

function taskHtml(t) {
  const mark = taskDone(t, data, DRILLS) ? '✅' : '⬜';
  switch (t.t) {
    case 'scene': {
      const sc = sceneById(t.id); const rec = data.scenes[t.id];
      return `<li>${mark} 實戰 <a href="#/scene/${t.id}">${esc(sc ? sc.title : t.id)}</a> 拿到 ${esc(t.min)} 以上${rec ? `（目前 <span class="g-${rec.grade}">${rec.grade}</span>）` : ''}</li>`;
    }
    case 'drill': {
      const d = drillCatDone(t.cat);
      return `<li>${mark} 話術快打 <a href="#/drill/run/${CAT_SLUG[t.cat]}">「${esc(t.cat)}」</a> 答對過 ${t.min} 張（目前 ${d.good}）</li>`;
    }
    case 'sched': {
      const lv = SCHED.find((x) => x.id === t.id); const rec = data.schedule[t.id];
      return `<li>${mark} 排行程 <a href="#/sched/${t.id}">「${esc(lv ? lv.title : t.id)}」</a> 拿到 ${t.pct}%${rec && rec.max ? `（目前 ${Math.round(Math.max(0, rec.best) / rec.max * 100)}%）` : ''}</li>`;
    }
    case 'law': return `<li>${mark} 讀完 <a href="#/law">法規小抄</a></li>`;
    case 'ai': {
      const r = ROLES.find((x) => x.id === t.role); const k = `${t.role}-${t.level}`;
      return `<li><label class="chk"><input type="checkbox" data-ai="${esc(k)}" ${data.plan.ai[k] ? 'checked' : ''}> AI 對練</label> <a href="#/ai/${esc(t.role)}/${esc(t.level)}">${esc(r ? r.icon : '')} ${esc(r ? r.title : t.role)}（${esc((LEVELS[t.level] || {}).name || t.level)}）</a> <span class="muted small">練完自己勾</span></li>`;
    }
    case 'exam': return `<li>${mark} <a href="#/exam">畢業考</a> 全部通過</li>`;
    default: return '';
  }
}

function countersHtml() {
  return `<div class="counters">${COUNTERS.map((c) => `<div class="cnt">
      <div class="small muted">${c.icon} ${esc(c.name)}</div>
      <div class="row cnt-row">
        <button class="btn sm" data-act="cnt" data-c="${c.id}" data-d="-1" aria-label="${esc(c.name)}減 1">−</button>
        <b class="num" id="cnt-${c.id}">${data.plan.counters[c.id] || 0}</b>
        <button class="btn sm primary" data-act="cnt" data-c="${c.id}" data-d="1" aria-label="${esc(c.name)}加 1">+1</button>
      </div></div>`).join('')}</div>`;
}

function goalsHtml(week) {
  return weekGoals(week, data.plan).map((g) => {
    const c = COUNTERS.find((x) => x.id === g.c);
    const pct = Math.min(100, Math.round(g.have / g.need * 100));
    return `<div class="goal"><div class="small goal-h"><span>${g.stretch ? '🌟 挑戰' : '🎯 必達'}｜${c.icon} ${esc(c.name)}（累計）</span><span class="${g.ok ? 'g-A' : ''}">${g.have} / ${g.need} ${c.unit}${g.ok ? ' ✔' : ''}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
}

function planCard() {
  if (!data.plan.start) {
    return `<div class="card plan"><h2>🔥 超級業務 30 天養成</h2>
      <p>每天一張任務卡：遊戲任務（系統自動打勾）＋現場任務（自己勾）＋一句要背的話。每週店長口試，第 29 天畢業考。</p>
      <p class="muted small">30 天的目標不是成交，是能獨立跑完「開發 → 委託 → 帶看 → 收斡旋」一整輪、0 次違規、通過畢業考。</p>
      <div class="row"><button class="btn primary" data-act="plan-start">今天開始第 1 天</button><a class="btn" href="#/plan">先看 30 天課表</a></div></div>`;
  }
  const n = curDay(); const d = dayOf(n);
  const st = dayStatus(d, data, DRILLS, WEEKS);
  const all = PLAN30.map((x) => dayStatus(x, data, DRILLS, WEEKS));
  const doneDays = all.filter((x) => x.complete).length;
  const behind = PLAN30.filter((x, i) => x.day < n && !all[i].complete).length;
  return `<div class="card plan"><h2>🔥 30 天養成｜第 ${n} 天：${esc(d.title)}</h2>
    <div class="bar" style="margin:4px 0 8px"><i style="width:${Math.round(doneDays / 30 * 100)}%"></i></div>
    <div class="small muted">已完成 ${doneDays} / 30 天${behind ? `｜<span style="color:#ffb3b3">前面還有 ${behind} 天沒做完</span>` : ''}</div>
    <p style="margin:10px 0 6px">今天：${st.done} / ${st.total} 項完成</p>
    <div class="keyline">🔑 ${esc(d.key)}</div>
    <div class="row" style="margin-top:12px"><a class="btn primary" href="#/plan/${n}">打開今天的任務 →</a><a class="btn" href="#/plan">30 天總覽</a></div></div>`;
}

function planView() {
  const n = curDay();
  const weeks = [...WEEKS, { n: 5, title: '畢業', why: '' }].map((w) => {
    const days = PLAN30.filter((d) => d.week === w.n).map((d) => {
      const st = dayStatus(d, data, DRILLS, WEEKS);
      const icon = st.complete ? '✅' : d.day === n ? '👉' : '⬜';
      return `<a class="dayrow ${d.day === n ? 'today' : ''}" href="#/plan/${d.day}"><span class="dn">${icon} 第 ${d.day} 天</span><span class="dt">${esc(d.title)}${d.review ? ' <span class="chip gold">週檢核</span>' : ''}</span><span class="muted small">${st.done}/${st.total}</span></a>`;
    }).join('');
    const goals = w.goals ? `<div style="margin:8px 0 10px">${goalsHtml(w)}</div>` : '';
    return `<div class="card"><h2>第 ${w.n} 週｜${esc(w.title)}</h2>${w.why ? `<p class="muted small">${esc(w.why)}</p>` : ''}${goals}<div class="days">${days}</div></div>`;
  }).join('');
  view(`<h1>🔥 超級業務 30 天養成</h1>
    <p class="muted">每天 = 遊戲任務（系統自動判斷）＋現場任務（自己勾）＋一句要背的話。活動量按「+1」就好，不用打字。</p>
    ${data.plan.start ? `<p class="small">開始日 ${esc(data.plan.start)}，今天是第 ${n} 天。</p>` : '<div class="row"><button class="btn primary" data-act="plan-start">今天開始第 1 天</button></div><br>'}
    <div class="card"><h3>📊 我的活動量（累計）</h3>${countersHtml()}</div>
    ${weeks}
    <div class="row"><a class="btn" href="#/book">📘 超級業務手冊</a><a class="btn" href="#/exam">🎓 畢業考</a></div>
    ${footer()}`);
}

function planDayView(n) {
  const d = dayOf(n);
  if (!d) { view('<p>沒有這一天。</p><a class="btn" href="#/plan">回 30 天總覽</a>'); return; }
  const st = dayStatus(d, data, DRILLS, WEEKS);
  const wk = WEEKS.find((w) => w.n === d.week);
  const rv = d.review ? WEEKS.find((w) => w.n === d.review) : null;
  const field = d.field.map((f, i) => {
    const k = fieldKey(d.day, i);
    return `<li><label class="chk"><input type="checkbox" data-field="${k}" ${data.plan.field[k] ? 'checked' : ''}> ${esc(f)}</label></li>`;
  }).join('');
  const oral = rv ? `<div class="card"><h3>🎤 店長口試（店長確認答對後勾）</h3><ol>${rv.oral.map((o, i) => {
      const k = oralKey(rv.n, i);
      return `<li><label class="chk"><input type="checkbox" data-oral="${k}" ${data.plan.oral[k] ? 'checked' : ''}> ${esc(o.q)}</label><details><summary class="small muted">看參考答案</summary><div class="small">${esc(o.a)}</div></details></li>`;
    }).join('')}</ol></div>
    <div class="card"><h3>📊 第 ${rv.n} 週活動量目標</h3>${goalsHtml(rv)}</div>` : '';
  const prev = dayOf(n - 1); const next = dayOf(n + 1);
  view(`<div class="row small"><a href="#/plan">← 30 天總覽</a>${wk ? `<span class="chip">第 ${wk.n} 週｜${esc(wk.title)}</span>` : '<span class="chip">畢業</span>'}${data.plan.start && curDay() === n ? '<span class="chip gold">今天</span>' : ''}</div>
    <h1>第 ${d.day} 天｜${esc(d.title)}</h1>
    <p class="muted">${st.done} / ${st.total} 項完成${st.complete ? '　✅ 這天完成了' : ''}</p>
    <div class="keyline">🔑 今天要背的一句：${esc(d.key)}</div><br>
    ${d.game.length ? `<div class="card"><h3>🎮 遊戲任務（系統自動打勾）</h3><ul class="tasks">${d.game.map(taskHtml).join('')}</ul></div>` : ''}
    <div class="card"><h3>🏃 現場任務（做完自己勾）</h3><ul class="tasks">${field}</ul></div>
    ${oral}
    <div class="card"><h3>📊 活動量（做一件按一下）</h3>${countersHtml()}</div>
    <div class="row">${prev ? `<a class="btn" href="#/plan/${prev.day}">← 第 ${prev.day} 天</a>` : ''}${next ? `<a class="btn primary" href="#/plan/${next.day}">第 ${next.day} 天 →</a>` : ''}</div>
    ${footer()}`);
}

// ---------- 超級業務手冊 ----------
function bookView() {
  view(`<h1>📘 超級業務手冊</h1>
    <p class="muted">超級業務不是天份，是每天把基本動作做滿。這本手冊是 30 天養成的底稿。</p>
    <div class="card"><h2>⏰ 一天的節奏</h2><ul class="timeline">${PB_DAY.map((x) => `<li><span class="t">${esc(x.t)}</span><span><b>${esc(x.what)}</b><br><span class="muted small">${esc(x.why)}</span></span></li>`).join('')}</ul></div>
    <div class="card"><h2>🏆 7 個習慣</h2><ol>${HABITS.map((x) => `<li><b>${esc(x.h)}</b><br><span class="muted small">${esc(x.d)}</span></li>`).join('')}</ol></div>
    <div class="card"><h2>🚫 新人最常犯的 10 個錯</h2><ol class="review">${MISTAKES.map((x) => `<li><div class="yours">❌ ${esc(x.m)} ${x.law ? lawChips([x.law]) : ''}</div><div class="alt">👉 ${esc(x.fix)}</div></li>`).join('')}</ol></div>
    <div class="row"><a class="btn primary" href="#/plan">回 30 天養成</a></div>
    ${footer()}`);
}

// ---------- 章節地圖 ----------
function mapView() {
  const html = CHAPTERS.map((ch) => {
    const list = SCENES.filter((s) => s.chapter === ch.n);
    const tiles = list.map((s) => {
      const rec = data.scenes[s.id];
      return `<a class="tile scene-tile" href="#/scene/${s.id}">
        ${gradeBadge(rec && rec.grade)}
        <div class="meta"><b>${esc(s.title)}</b><span>${esc(s.goal)}</span><br>
          ${(s.skills || []).map((k) => `<span class="chip">${esc(k)}</span>`).join(' ')}
          ${rec ? `<span class="chip gold">玩過 ${rec.plays} 次</span>` : ''}</div>
      </a>`;
    }).join('') || '<p class="muted small">這一章的關卡還在製作中。</p>';
    return `<section class="chapter"><h2>${ch.icon} 第 ${ch.n} 章 ${ch.name} <small>${ch.desc}</small></h2><div class="grid">${tiles}</div></section>`;
  }).join('');
  view(`<h1>🎯 主線實戰</h1>
    <p class="muted">同一間「中原星禾」三房車位，從 591 自售屋主的第一通電話，一路走到交屋。建議照順序玩。</p>
    ${html}${footer()}`);
}

// ---------- 對話關卡 ----------
function startScene(id, exam = false) {
  const sc = sceneById(id);
  if (!sc) { view(`<p>找不到這一關（${esc(id)}）。</p><a class="btn" href="#/map">回地圖</a>`); return; }
  play = { sc, st: startState(sc), log: [], result: null, prev: null, exam };
  enterNode(sc.start);
  renderScene(false);
}

function enterNode(id) {
  const n = play.sc.nodes[id];
  play.log.push({ t: 'npc', who: n.who, narr: n.narr, say: n.say, card: n.card, end: n.end });
}

function meterHtml(key, label, v, d) {
  const cls = key === 'law' && v < 100 ? 'law hurt' : key;
  const delta = d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>` : '';
  return `<div class="meter ${cls}"><label><span>${label}</span><span>${v}${delta}</span></label><div class="bar"><i style="width:${v}%"></i></div></div>`;
}

function npcHtml(e) {
  const c = e.who && e.who !== 'narr' ? play.sc.cast[e.who] : null;
  const card = e.card ? `<div class="info"><b>${esc(e.card.title)}</b><table>${e.card.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>` : '';
  const narr = e.narr ? `<div class="narr">${esc(e.narr)}</div>` : '';
  if (!c || !e.say) return `${narr}${e.say ? `<div class="narr">${esc(e.say)}</div>` : ''}${card}`;
  return `${narr}<div class="say"><div class="av" aria-hidden="true">${esc(c.avatar)}</div><div class="bubble"><div class="who">${esc(c.name)}</div>${esc(e.say)}${card}</div></div>`;
}

function renderScene(scroll) {
  const { sc, st } = play;
  const node = sc.nodes[st.node];
  const d = play.prev ? { trust: st.trust - play.prev.trust, deal: st.deal - play.prev.deal, law: st.law - play.prev.law } : {};
  const ch = CHAPTERS.find((c) => c.n === sc.chapter);
  let lastMe = -1;
  play.log.forEach((e, i) => { if (e.t === 'me') lastMe = i; });
  const log = play.log.map((e, i) => {
    if (e.t === 'npc') return npcHtml(e);
    if (e.t === 'me') return `<div class="say me" ${i === lastMe ? 'id="last-me"' : ''}><div class="av" aria-hidden="true">🙋</div><div class="bubble"><div class="who">我</div>${esc(e.text)}</div></div>`;
    if (play.exam) return ''; // 考試中不即時講評
    return `<div class="fb ${e.tag}"><span class="tagline">${TAG_LABEL[e.tag]}</span>${esc(e.fb)}</div>`;
  }).join('');
  const meters = play.exam
    ? '<div class="small" style="margin-top:6px;color:var(--gold2)">🎓 畢業考：不即時講評、不顯示分數變化，結束才看成績。</div>'
    : `<div class="meters">${meterHtml('trust', '信任', st.trust, d.trust)}${meterHtml('deal', '成交溫度', st.deal, d.deal)}${meterHtml('law', '法遵', st.law, d.law)}</div>`;
  let tail;
  if (node.end) {
    tail = `<div class="choices"><button class="btn primary" data-act="finish">看結算 →</button></div>`;
  } else {
    tail = `<div class="choices" role="group" aria-label="你要怎麼回">${node.choices.map((c, i) => `<button class="choice" data-act="choose" data-i="${i}"><span class="k">${i + 1}</span>${esc(c.text)}</button>`).join('')}</div>`;
  }
  view(`<div class="scene-head">
      <div class="row small">${play.exam ? '<a href="#/exam">← 畢業考</a><span class="chip gold">🎓 考試中</span>' : '<a href="#/map">← 地圖</a>'}<span class="chip">${ch.icon} 第 ${sc.chapter} 章 ${ch.name}</span></div>
      <h2 style="margin:4px 0 2px">${esc(sc.title)}</h2>
      <div class="muted small">🎯 ${esc(sc.goal)}</div>
      ${meters}
    </div>
    ${play.log.length <= 1 ? `<div class="card small">${esc(sc.brief)}</div>` : ''}
    <div class="log">${log}</div>${tail}`);
  if (scroll) {
    const el = document.getElementById('last-me');
    if (el) el.scrollIntoView({ block: 'start' });
  } else window.scrollTo(0, 0);
}

function choose(i) {
  const node = play.sc.nodes[play.st.node];
  const c = node && node.choices && node.choices[i];
  if (!c) return;
  play.prev = play.st;
  play.st = applyChoice(play.st, play.st.node, i, c);
  play.log.push({ t: 'me', text: c.text }, { t: 'fb', tag: c.tag, fb: c.fb });
  enterNode(play.st.node);
  renderScene(true);
}

function finishScene() {
  const { sc, st } = play;
  const end = sc.nodes[st.node].end;
  const g = gradeOf(end, st);
  play.result = { ...g, end, law: st.law };
  Store.recordScene(data, sc.id, play.result);
  if (play.exam) Store.recordExamScene(data, sc.id, play.result);
  persist();
  renderResult();
}

function renderResult() {
  const { sc, st, result } = play;
  const endNode = sc.nodes[st.node];
  const idx = SCENES.indexOf(sc);
  const next = SCENES[idx + 1];
  const review = st.picks.map((p) => {
    const n = sc.nodes[p.node]; const c = n.choices[p.idx];
    const best = n.choices.find((x) => x.tag === 'best');
    const said = n.say ? `${esc(n.say.slice(0, 42))}${n.say.length > 42 ? '…' : ''}` : esc((n.narr || '').slice(0, 42));
    return `<li><div class="muted small">${said}</div>
      <div class="yours"><span class="tagline g-${c.tag === 'best' ? 'A' : c.tag === 'ok' ? 'B' : 'C'}">${TAG_LABEL[c.tag]}</span> ${esc(c.text)}</div>
      ${c.tag !== 'best' && best ? `<div class="alt">👉 更好的說法：${esc(best.text)}<br><span class="muted">${esc(best.fb)}</span></div>` : ''}</li>`;
  }).join('');
  const d = sc.debrief || {};
  const examOk = result.law === 100 && ['S', 'A'].includes(result.grade);
  const nav = play.exam
    ? `<button class="btn" data-act="restart">重考這關</button><a class="btn primary" href="#/exam">回畢業考 →</a>`
    : `<button class="btn" data-act="restart">再玩一次</button>
      ${next ? `<a class="btn primary" href="#/scene/${next.id}">下一關：${esc(next.title)} →</a>` : '<a class="btn primary" href="#/report">看成績單 →</a>'}
      <a class="btn" href="#/map">回地圖</a>`;
  view(`${play.exam ? `<div class="${examOk ? 'keyline' : 'warn'}">🎓 畢業考實戰：${examOk ? '這關通過' : `這關沒過（要 ${EXAM_RULE.sceneMin} 以上且 0 違規），看完檢討可以重考`}</div><br>` : ''}
    <div class="card endbox">
      <div class="muted">${esc(sc.title)}｜${END_LABEL[result.end]}</div>
      <div class="bigg g-${result.grade}">${result.grade}</div>
      <div>${result.score} 分</div>
      ${result.law < 100 ? '<div class="small" style="color:#ffb3b3">⚠️ 這關踩到法規紅線，評等最高只能 B</div>' : ''}
      <div class="meters" style="text-align:left;margin-top:12px">${meterHtml('trust', '信任', st.trust)}${meterHtml('deal', '成交溫度', st.deal)}${meterHtml('law', '法遵', st.law)}</div>
    </div>
    <div class="card"><h3>結局</h3>${npcHtml({ who: endNode.who, narr: endNode.narr, say: endNode.say })}</div>
    <div class="card">
      <h3>🔑 這關要背的一句</h3>
      <div class="keyline">${esc(d.keyLine)}</div>
      <ul>${(d.points || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      ${d.law && d.law.length ? `<div class="small">相關法規：${lawChips(d.law)}</div>` : ''}
    </div>
    <div class="card"><h3>🔁 逐句檢討</h3><ol class="review">${review}</ol></div>
    <div class="row">${nav}</div>${footer()}`);
  window.scrollTo(0, 0);
}

// ---------- 話術快打 ----------
function drillMenu() {
  const wrong = Store.wrongDrills(data).filter((id) => DRILLS.some((d) => d.id === id));
  const cats = CATS.map((c) => {
    const st = drillCatDone(c);
    return `<a class="tile" href="#/drill/run/${CAT_SLUG[c]}"><b>${esc(c)}</b><span>${st.total} 張｜答對過 ${st.good} 張</span></a>`;
  }).join('');
  const rounds = data.drills.rounds.slice(-5).reverse().map((r) => `<li>${new Date(r.at).toLocaleDateString('zh-TW')}　${r.score} / ${r.total}</li>`).join('');
  view(`<h1>⚡ 話術快打</h1>
    <p class="muted">客人丟一句難接的話，從 4 個回法選最好的。一輪 10 張，答完看每個選項為什麼好、為什麼踩雷。</p>
    <div class="card row">
      <a class="btn primary" href="#/drill/run/all">全部隨機 10 張</a>
      <a class="btn ${wrong.length ? '' : 'disabled'}" href="#/drill/run/wrong" ${wrong.length ? '' : 'aria-disabled="true" tabindex="-1" style="pointer-events:none;opacity:.45"'}>練錯題本（${wrong.length}）</a>
      <label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" data-act="timed" ${timed ? 'checked' : ''}> 計時模式（每張 20 秒）</label>
    </div>
    <h2>分類練習</h2>
    <div class="grid">${cats}</div>
    ${rounds ? `<div class="card" style="margin-top:14px"><h3>最近 5 輪</h3><ul>${rounds}</ul></div>` : ''}
    ${footer()}`);
}

function startDrill(slug) {
  let pool;
  if (slug === 'all') pool = DRILLS;
  else if (slug === 'wrong') { const w = new Set(Store.wrongDrills(data)); pool = DRILLS.filter((d) => w.has(d.id)); }
  else pool = DRILLS.filter((d) => d.cat === SLUG_CAT[slug]);
  if (!pool.length) { view(`<p>這一類還沒有題目。</p><a class="btn" href="#/drill">回話術快打</a>`); return; }
  const cards = shuffle(pool).slice(0, 10).map((d) => ({ d, opts: shuffle(d.options.map((o, i) => ({ ...o, i }))) }));
  drill = { slug, cards, i: 0, score: 0, picked: null, misses: [] };
  renderDrill();
}

function renderDrill() {
  stopTimer();
  const { cards, i, picked } = drill;
  const { d, opts } = cards[i];
  const answered = picked !== null;
  const optHtml = opts.map((o, k) => {
    const cls = answered ? ` reveal-${o.tag}${picked === k ? ' picked' : ''}` : '';
    const why = answered ? `<span class="why"><b>${o.tag === 'best' ? '✅ 最好' : o.tag === 'ok' ? '🟡 普通' : '❌ 踩雷'}</b>　${esc(o.why)}</span>` : '';
    return `<button class="choice opt${cls}" data-act="drill-pick" data-i="${k}" ${answered ? 'disabled' : ''}><span class="k">${k + 1}</span>${esc(o.text)}${why}</button>`;
  }).join('');
  const last = i === cards.length - 1;
  view(`<div class="row small"><a href="#/drill">← 話術快打</a><span class="chip">${esc(d.cat)}</span><span class="muted">第 ${i + 1} / ${cards.length} 張｜${drill.score} 分</span></div>
    ${timed && !answered ? '<div class="timer"><i id="tbar" style="width:100%"></i></div>' : ''}
    <div class="card" style="margin-top:10px"><div class="drill-say">${esc(d.say)}</div></div>
    <div class="choices">${optHtml}</div>
    ${answered ? `${picked === -1 ? '<div class="fb bad" style="margin-top:10px"><span class="tagline">時間到</span>現場客人不會等你想三分鐘，關鍵句要背到反射。</div>' : ''}
      <div class="keyline">🔑 ${esc(d.keyLine)}</div>
      ${d.law && d.law.length ? `<div class="small" style="margin-top:6px">相關法規：${lawChips(d.law)}</div>` : ''}
      <div class="row" style="margin-top:14px"><button class="btn primary" data-act="drill-next">${last ? '看結果 →' : '下一張 →'}</button></div>` : ''}`);
  if (timed && !answered) {
    const t0 = performance.now(); const LIMIT = 20000;
    timerId = setInterval(() => {
      const left = LIMIT - (performance.now() - t0);
      const bar = document.getElementById('tbar');
      if (bar) bar.style.width = `${Math.max(0, left / LIMIT * 100)}%`;
      if (left <= 0) { stopTimer(); drillPick(-1); }
    }, 100);
  }
}

function drillPick(k) {
  if (drill.picked !== null) return;
  stopTimer();
  const card = drill.cards[drill.i];
  const tag = k === -1 ? 'bad' : card.opts[k].tag;
  drill.picked = k;
  drill.score += DRILL_POINTS[tag];
  if (tag !== 'best') drill.misses.push(card.d);
  Store.recordDrill(data, card.d.id, tag);
  persist();
  renderDrill();
}

function drillNext() {
  if (drill.i < drill.cards.length - 1) { drill.i++; drill.picked = null; renderDrill(); window.scrollTo(0, 0); return; }
  const total = drill.cards.length * DRILL_POINTS.best;
  Store.recordDrillRound(data, drill.score, total);
  persist();
  const pct = Math.round(drill.score / total * 100);
  const msg = pct >= 90 ? '反射動作等級，可以上場了。' : pct >= 70 ? '大方向對了，錯的那幾張再練一輪。' : '先別急著上場，把每張的關鍵句抄下來背。';
  view(`<div class="card endbox"><div class="muted">話術快打結果</div><div class="bigg ${pct >= 90 ? 'g-S' : pct >= 70 ? 'g-A' : pct >= 50 ? 'g-B' : 'g-C'}">${drill.score}</div><div>滿分 ${total}（${pct}%）</div><p class="muted" style="margin-top:8px">${msg}</p></div>
    ${drill.misses.length ? `<div class="card"><h3>這輪沒選到最好的</h3><ol>${drill.misses.map((d) => `<li><div>${esc(d.say)}</div><div class="keyline">🔑 ${esc(d.keyLine)}</div></li>`).join('')}</ol></div>` : ''}
    <div class="row"><a class="btn primary" href="#/drill/run/${drill.slug}" data-act="drill-again">再來一輪</a><a class="btn" href="#/drill/run/wrong">練錯題本</a><a class="btn" href="#/drill">回選單</a></div>${footer()}`);
  window.scrollTo(0, 0);
}

// ---------- 排行程 ----------
function bestOf(lv) {
  if (!solved[lv.id]) solved[lv.id] = solve(lv);
  return solved[lv.id];
}

function schedList() {
  const tiles = SCHED.map((lv) => {
    const rec = data.schedule[lv.id];
    return `<a class="tile" href="#/sched/${lv.id}"><div class="ico">🗓️</div><b>${esc(lv.title)}</b><span>${lv.tasks.length} 件事${rec ? `｜最佳 ${rec.best} / ${rec.max}` : ''}</span></a>`;
  }).join('');
  view(`<h1>🗓️ 排行程挑戰</h1>
    <p class="muted">每件事對方只有某些時段可以，地點散在中壢、內壢、青埔、桃園，還要算車程。排完交卷，跟電腦算出來的最佳排法比。</p>
    <div class="grid">${tiles}</div>${footer()}`);
}

function startSched(id, exam = false) {
  const lv = SCHED.find((x) => x.id === id);
  if (!lv) { view('<p>找不到這一天。</p><a class="btn" href="#/sched">回排行程</a>'); return; }
  const plan = {};
  for (const t of lv.tasks) plan[t.id] = t.fixed ? t.win[0][0] : null;
  sched = { lv, plan, done: false, exam };
  renderSched();
}

function winText(t) { return t.win.map(([a, b]) => t.fixed ? `${hm(a)} 固定` : `${hm(a)}～${hm(b)}`).join('、'); }

function timelineHtml(lv, plan, problems) {
  const bad = new Set(problems.flatMap((p) => p.ids));
  const items = lv.tasks.filter((t) => plan[t.id] !== null && plan[t.id] !== undefined)
    .map((t) => ({ t, s: Number(plan[t.id]) })).sort((a, b) => a.s - b.s);
  if (!items.length) return '<p class="muted small">還沒排任何事。</p>';
  let prev = lv.home;
  return `<ul class="timeline">${items.map(({ t, s }) => {
    const need = travel(lv, prev, t.loc);
    const car = need ? `<li class="car">🚗 ${esc(lv.locs[prev])} → ${esc(lv.locs[t.loc])}　約 ${need} 分鐘</li>` : '';
    prev = t.loc;
    return `${car}<li class="${bad.has(t.id) ? 'err' : ''}"><span class="t">${hm(s)}–${hm(s + t.dur)}</span><span>${bad.has(t.id) ? '⚠️ ' : ''}${esc(t.title)}<br><span class="muted small">${esc(lv.locs[t.loc])}</span></span></li>`;
  }).join('')}</ul>`;
}

function renderSched() {
  const { lv, plan } = sched;
  const r = evaluate(lv, plan);
  const bad = new Set(r.problems.flatMap((p) => p.ids));
  const tasks = lv.tasks.map((t) => {
    const opts = startOptions(t).map((s) => `<option value="${s}" ${Number(plan[t.id]) === s && plan[t.id] !== null ? 'selected' : ''}>${hm(s)}–${hm(s + t.dur)}</option>`).join('');
    return `<div class="task ${bad.has(t.id) ? 'bad' : ''}">
      <div><b>${esc(t.title)}</b>${t.must ? ' <span class="chip law">必辦</span>' : ''}<br><span class="stars" title="價值 ${t.value}">${'★'.repeat(Math.max(1, Math.round(t.value / 10)))}</span> <span class="muted small">${t.value} 分</span></div>
      <select data-task="${esc(t.id)}" ${t.fixed ? 'disabled' : ''} aria-label="${esc(t.title)} 的時間">
        ${t.fixed ? '' : `<option value="" ${plan[t.id] === null ? 'selected' : ''}>— 不排（禮貌改約）—</option>`}${opts}
      </select>
      <div class="tmeta">📍 ${esc(lv.locs[t.loc])}｜⏱ ${t.dur} 分鐘｜可以的時間：${winText(t)}<br>${esc(t.note)}</div>
    </div>`;
  }).join('');
  view(`<div class="row small">${sched.exam ? '<a href="#/exam">← 畢業考</a><span class="chip gold">🎓 考試中</span>' : '<a href="#/sched">← 排行程</a>'}</div>
    <h1>🗓️ ${esc(lv.title)}</h1>
    <div class="card small">${esc(lv.brief)}<br><span class="muted">從店頭出發，${hm(lv.dayStart)} 開始。交通時間是遊戲數值。</span></div>
    <div class="card"><h3>要排的事</h3>${tasks}</div>
    <div class="card" id="tl"><h3>你的一天</h3>${timelineHtml(lv, plan, r.problems)}
      ${r.problems.length ? `<ul class="problems">${r.problems.map((p) => `<li>${esc(p.msg)}</li>`).join('')}</ul>` : ''}
      <div class="row" style="margin-top:12px">
        <button class="btn primary" data-act="sched-submit" ${r.problems.length ? 'disabled' : ''}>交卷</button>
        <button class="btn" data-act="sched-reset">全部清空</button>
        <span class="muted small">${r.problems.length ? '有衝突的地方要先排開才能交卷' : `目前 ${r.value} 分${r.penalty ? `，必辦沒排扣 ${r.penalty}` : ''}`}</span>
      </div>
    </div>${footer()}`);
}

function submitSched() {
  const { lv, plan } = sched;
  const r = evaluate(lv, plan);
  if (!r.ok) return;
  const best = bestOf(lv);
  Store.recordSchedule(data, lv.id, r.score, best.score);
  if (sched.exam) Store.recordExamSched(data, r.score, best.score);
  persist();
  const pct = best.score > 0 ? Math.round(Math.max(0, r.score) / best.score * 100) : 0;
  const skipped = lv.tasks.filter((t) => best.plan[t.id] === null).map((t) => t.title);
  view(`<div class="row small"><a href="#/sched">← 排行程</a></div>
    <div class="card endbox"><div class="muted">${esc(lv.title)}</div>
      <div class="bigg ${pct >= 100 ? 'g-S' : pct >= 85 ? 'g-A' : pct >= 65 ? 'g-B' : 'g-C'}">${r.score}</div>
      <div>最佳排法 ${best.score} 分（你拿到 ${pct}%）</div>
      ${r.penalty ? `<p class="small" style="color:#ffb3b3">必辦的事沒排，扣了 ${r.penalty} 分。</p>` : ''}
    </div>
    <div class="card"><h3>你的排法</h3>${timelineHtml(lv, plan, [])}</div>
    <div class="card"><h3>✅ 最佳排法</h3>${timelineHtml(lv, best.plan, [])}
      ${skipped.length ? `<p class="small muted">最佳排法放掉的：${esc(skipped.join('、'))}（禮貌改約）</p>` : '<p class="small muted">最佳排法：全部排得進去。</p>'}</div>
    <div class="card"><h3>🔑 排行程的眉角</h3><ul>${lv.lessons.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>
    <div class="row">${sched.exam ? `<a class="btn" href="#/exam/sched">重考</a><a class="btn primary" href="#/exam">回畢業考 →</a>` : `<a class="btn" href="#/sched/${lv.id}">再排一次</a><a class="btn primary" href="#/sched">換一天</a>`}</div>${footer()}`);
  window.scrollTo(0, 0);
}

// ---------- AI 對練 ----------
function aiView() {
  const tiles = ROLES.map((r) => `<button class="tile" data-act="ai-role" data-id="${esc(r.id)}" style="${ai.role === r.id ? 'border-color:var(--gold)' : ''}"><div class="ico">${esc(r.icon)}</div><b>${esc(r.title)}</b><span>${esc(r.skill)}</span></button>`).join('');
  const role = ROLES.find((r) => r.id === ai.role);
  const panel = role ? `<div class="card" id="aipanel">
      <h2>${esc(role.icon)} ${esc(role.title)}</h2>
      <p class="small">🎯 ${esc(role.goal)}</p>
      <div class="row"><span class="small muted">難度</span><div class="seg">${Object.entries(LEVELS).map(([k, v]) => `<button data-act="ai-level" data-lv="${k}" class="${ai.level === k ? 'on' : ''}">${esc(v.name)}</button>`).join('')}</div>
        <span class="small muted">${esc(LEVELS[ai.level].desc)}</span></div>
      <ol class="small" style="margin-top:12px">
        <li>按「複製提示詞」。</li>
        <li>打開 Claude，開一個<b>新對話</b>，貼上送出——AI 會先用客人的身分講第一句。</li>
        <li>你就當在現場回話，一次講一段。練完打「<b>結束</b>」，AI 會跳出角色給你評分和示範話術。</li>
      </ol>
      <div class="warn">⚠️ 對練時<b>不要</b>打真實客戶的姓名、電話、門牌、謄本內容。情境用遊戲裡的就好。</div>
      <textarea class="prompt" readonly aria-label="AI 對練提示詞">${esc(buildPrompt(role, ai.level))}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="ai-copy">📋 複製提示詞</button></div>
    </div>` : '<p class="muted">先選一位客人。</p>';
  view(`<h1>🤖 AI 對練</h1>
    <p class="muted">選擇題練的是「知道」，AI 對練練的是「講得出來」。選一位客人，複製提示詞貼到 Claude，跟 AI 扮演的客人自由對話。不用另外付費、不用 API。</p>
    <div class="grid">${tiles}</div><br>${panel}${footer()}`);
  if (role) { const p = document.getElementById('aipanel'); if (p && ai.scroll) p.scrollIntoView({ block: 'start' }); }
  ai.scroll = false;
}

// ---------- 法規小抄 ----------
function lawView(code) {
  const cards = LAWS.map((l) => `<div class="card" id="law-${esc(l.code)}" style="${code === l.code ? 'border-color:var(--gold)' : ''}">
      <h3><span class="chip law">${esc(l.code)}</span> ${esc(l.title)}</h3>
      <p>${esc(l.rule)}</p>
      <div class="keyline">💬 ${esc(l.say)}</div>
      <p class="small muted" style="margin-top:8px">來源：${esc(l.src)}　<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">查原文</a></p>
    </div>`).join('');
  if (!data.seenLaw) { data.seenLaw = true; persist(); }
  view(`<h1>⚖️ 法規小抄</h1>
    <p class="muted">遊戲裡踩到這 10 條，法遵分會扣、評等最高只能 B。現場踩到，扣的是證照和公司招牌。查證日 ${esc(CHECKED)}，超過半年要重查。</p>
    ${cards}${footer()}`);
  if (code) { const el = document.getElementById(`law-${code}`); if (el) el.scrollIntoView({ block: 'start' }); }
}

// ---------- 成績單 ----------
function reportText() {
  const r = Store.rank(data);
  const xp = Store.xpOf(data);
  const lines = [`【戰神道場成績單】${data.name || '新人'}`, `段位：${r.icon}${r.name}（經驗 ${xp}）`, ''];
  const ps = planSummary();
  lines.push('▍30 天養成');
  lines.push(ps.n ? `第 ${ps.n} 天（開始日 ${data.plan.start}），已完成 ${ps.doneDays} / 30 天${ps.behind ? `，落後 ${ps.behind} 天` : ''}` : '還沒開始');
  lines.push(`活動量：${COUNTERS.map((x) => `${x.name} ${data.plan.counters[x.id] || 0} ${x.unit}`).join('、')}`);
  if (ps.week) lines.push(`第 ${ps.week.n} 週目標：${weekGoals(ps.week, data.plan).map((g) => `${(COUNTERS.find((x) => x.id === g.c) || {}).name} ${g.have}/${g.need}${g.ok ? '✔' : ''}${g.stretch ? '（挑戰）' : ''}`).join('、')}`);
  lines.push(`畢業考：${examStatus(data).passed ? '通過 🎓' : '未通過'}`);
  lines.push('', '▍主線實戰');
  for (const ch of CHAPTERS) {
    const list = SCENES.filter((s) => s.chapter === ch.n);
    if (!list.length) continue;
    lines.push(`${ch.name}：${list.map((s) => `${s.title} ${(data.scenes[s.id] || {}).grade || '－'}`).join('／')}`);
  }
  lines.push('', '▍話術快打（答對過／總張數）');
  lines.push(CATS.map((c) => { const d = drillCatDone(c); return `${c} ${d.good}/${d.total}`; }).join('、'));
  lines.push('', '▍排行程');
  for (const lv of SCHED) { const rec = data.schedule[lv.id]; lines.push(`${lv.title}：${rec ? `${rec.best}/${rec.max}` : '未挑戰'}`); }
  const weak = weakest();
  if (weak) lines.push('', `▍要加強：${weak}`);
  lines.push('', `（${new Date().toLocaleDateString('zh-TW')} 匯出）`);
  return lines.join('\n');
}

function planSummary() {
  const n = curDay();
  const all = PLAN30.map((x) => dayStatus(x, data, DRILLS, WEEKS));
  const doneDays = all.filter((x) => x.complete).length;
  const behind = n ? PLAN30.filter((x, i) => x.day < n && !all[i].complete).length : 0;
  const d = n ? dayOf(n) : null;
  const week = d ? WEEKS.find((w) => w.n === Math.min(4, d.week)) : null;
  return { n, doneDays, behind, week };
}

function weakest() {
  const out = [];
  const lawHit = SCENES.filter((s) => (data.scenes[s.id] || {}).lawMiss > 0).map((s) => s.title);
  if (lawHit.length) out.push(`踩過法規紅線的關卡（${lawHit.join('、')}）`);
  const cs = CATS.map((c) => ({ c, ...drillCatDone(c) })).filter((x) => x.total > 0);
  const tried = cs.filter((x) => DRILLS.some((d) => d.cat === x.c && data.drills.seen[d.id]));
  if (tried.length) {
    tried.sort((a, b) => a.good / a.total - b.good / b.total);
    if (tried[0].good / tried[0].total < 0.7) out.push(`話術快打「${tried[0].c}」`);
  }
  const lowScene = SCENES.filter((s) => ['C'].includes((data.scenes[s.id] || {}).grade)).map((s) => s.title);
  if (lowScene.length) out.push(`評等 C 的關卡（${lowScene.join('、')}）`);
  return out.join('；');
}

function reportView() {
  const r = Store.rank(data);
  const rows = SCENES.map((s) => {
    const rec = data.scenes[s.id];
    return `<tr><td>${s.chapter}</td><td><a href="#/scene/${s.id}">${esc(s.title)}</a></td><td>${gradeBadge(rec && rec.grade)}</td><td>${rec ? rec.score : '－'}</td><td>${rec ? rec.plays : 0}</td><td>${rec && rec.lawMiss ? `<span style="color:#ffb3b3">${rec.lawMiss}</span>` : '0'}</td></tr>`;
  }).join('');
  const drows = CATS.map((c) => { const d = drillCatDone(c); return `<tr><td>${esc(c)}</td><td>${d.good} / ${d.total}</td><td>${d.done ? '✅' : ''}</td></tr>`; }).join('');
  const srows = SCHED.map((lv) => { const rec = data.schedule[lv.id]; return `<tr><td>${esc(lv.title)}</td><td>${rec ? `${rec.best} / ${rec.max}` : '未挑戰'}</td></tr>`; }).join('');
  const weak = weakest();
  view(`<h1>📋 成績單</h1>
    <div class="card row"><label class="small muted" for="nm">名字（只存這台電腦）</label><input id="nm" class="name" data-act="name" maxlength="12" value="${esc(data.name)}" placeholder="例如：新人小明"></div>
    ${rankBlock()}
    ${weak ? `<div class="warn">📌 要加強：${esc(weak)}</div><br>` : ''}
    ${(() => { const ps = planSummary(); return `<div class="card"><h3>🔥 30 天養成</h3>
      <p class="small">${ps.n ? `第 ${ps.n} 天，已完成 ${ps.doneDays} / 30 天${ps.behind ? `，<span style="color:#ffb3b3">落後 ${ps.behind} 天</span>` : ''}` : '還沒開始'}　｜　畢業考：${examStatus(data).passed ? '✅ 通過' : '未通過'}</p>
      <div class="counters">${COUNTERS.map((x) => `<div class="cnt"><div class="small muted">${x.icon} ${esc(x.name)}</div><b class="num">${data.plan.counters[x.id] || 0}</b></div>`).join('')}</div>
      ${ps.week ? `<div style="margin-top:10px"><div class="small muted">第 ${ps.week.n} 週目標</div>${goalsHtml(ps.week)}</div>` : ''}
      <div class="row" style="margin-top:10px"><a class="btn" href="#/plan">打開 30 天養成</a></div></div>`; })()}
    <div class="card"><h3>主線實戰</h3><table class="score"><tr><th>章</th><th>關卡</th><th>評等</th><th>分數</th><th>次數</th><th>踩紅線</th></tr>${rows}</table></div>
    <div class="card"><h3>話術快打</h3><table class="score"><tr><th>分類</th><th>答對過</th><th>過關</th></tr>${drows}</table></div>
    <div class="card"><h3>排行程</h3><table class="score"><tr><th>題目</th><th>最佳</th></tr>${srows}</table></div>
    <div class="row">
      <button class="btn primary" data-act="copy-report">📋 複製成績單（貼給店長）</button>
      <button class="btn danger" data-act="reset-all">清除這台電腦的成績</button>
    </div>${footer()}`);
}

// ---------- 畢業考 ----------
function ensureExamPicked() {
  if (!data.exam.picked && SCENES.length && SCHED.length) { data.exam.picked = pickExam(SCENES, SCHED); persist(); }
}

function examRow(ok, title, detail, href, btn) {
  return `<div class="exrow"><div class="exmain"><b>${ok ? '✅' : '⬜'} ${title}</b><div class="small muted">${detail}</div></div>${href ? `<a class="btn ${ok ? '' : 'primary'}" href="${href}">${btn}</a>` : ''}</div>`;
}

function certText() {
  const s = examStatus(data);
  const c = data.plan.counters;
  const lines = [
    `【戰神道場｜結業成績單】${data.name || '新人'}`,
    `開始日：${data.plan.start || '－'}　結業日：${data.exam.passedAt ? new Date(data.exam.passedAt).toLocaleDateString('zh-TW') : '－'}`,
    `段位：${Store.rank(data).icon}${Store.rank(data).name}`,
    '',
    `筆試：${data.exam.drill ? `${data.exam.drill.score}/${data.exam.drill.total}（${Math.round(data.exam.drill.score / data.exam.drill.total * 100)}%）` : '未考'}`,
    `實戰：${s.sceneRows.map((r) => `${(sceneById(r.id) || {}).title || r.id} ${r.grade || '－'}${r.law !== null && r.law < 100 ? '（踩紅線）' : ''}`).join('／')}`,
    `排行程：${s.schedPct === null ? '未考' : `${s.schedPct}%`}`,
    `店長口試：${s.oralOk ? '通過' : '未通過'}`,
    '',
    `30 天活動量：${COUNTERS.map((x) => `${x.name} ${c[x.id] || 0} ${x.unit}`).join('、')}`,
  ];
  return lines.join('\n');
}

function examHub() {
  ensureExamPicked();
  const ex = data.exam;
  if (!ex.picked) { view('<p>關卡還沒載入完成，請重新整理。</p>'); return; }
  const s = examStatus(data);
  if (s.passed && !ex.passedAt) { ex.passedAt = Date.now(); persist(); }
  const pct = Math.round(EXAM_RULE.drillPass * 100);
  const drillDetail = ex.drill
    ? `最佳 ${ex.drill.score} / ${ex.drill.total}（${Math.round(ex.drill.score / ex.drill.total * 100)}%），及格 ${pct}%`
    : `${EXAM_RULE.drills} 張（法遵至少 ${EXAM_RULE.lawMin} 張），每張 ${EXAM_RULE.seconds} 秒，答完才公布，及格 ${pct}%`;
  const scenes = s.sceneRows.map((r) => {
    const sc = sceneById(r.id);
    const now = r.grade ? `目前 ${r.grade}${r.law < 100 ? '（踩到紅線）' : ''}。` : '';
    return examRow(r.ok, `實戰：${esc(sc ? sc.title : r.id)}`, `${now}要 ${EXAM_RULE.sceneMin} 以上且 0 違規；考試中不會即時講評`, `#/exam/scene/${r.id}`, r.grade ? '重考' : '開始');
  }).join('');
  const lv = SCHED.find((x) => x.id === ex.picked.sched);
  const oralQs = WEEKS.map((w) => w.oral[0]).concat([WEEKS[3].oral[2]]);
  view(`<h1>🎓 畢業考</h1>
    <p class="muted">四關全過才結業。題目已經抽好（每個人抽到的不一樣），沒過可以重考，系統記最好的那次。</p>
    ${s.passed ? `<div class="card endbox"><div class="bigg g-S">🎓</div><h2>恭喜結業！</h2><p class="muted">把結業成績單複製給店長。</p>
      <textarea class="prompt" readonly style="min-height:200px" aria-label="結業成績單">${esc(certText())}</textarea>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary" data-act="copy-cert">📋 複製結業成績單</button></div></div>` : ''}
    <div class="card">
      ${examRow(s.drillOk, '筆試：話術快打', drillDetail, '#/exam/drill', ex.drill ? '重考' : '開始')}
      ${scenes}
      ${examRow(s.schedOk, `排行程：${esc(lv ? lv.title : '')}`, `${s.schedPct === null ? '' : `目前 ${s.schedPct}%。`}要達最佳排法的 ${EXAM_RULE.schedPass}%`, '#/exam/sched', ex.sched ? '重考' : '開始')}
      <div class="exrow"><div class="exmain"><b>${s.oralOk ? '✅' : '⬜'} 店長口試</b><div class="small muted">店長從下面抽 3 題問，答對了由店長勾選</div>
        <ol class="small">${oralQs.map((o) => `<li>${esc(o.q)}<details><summary class="muted">參考答案</summary>${esc(o.a)}</details></li>`).join('')}</ol>
        <label class="chk"><input type="checkbox" data-exam-oral="1" ${ex.oral ? 'checked' : ''}> 店長確認口試通過</label></div></div>
    </div>
    <div class="row">
      ${s.passed ? '' : '<button class="btn" data-act="exam-repick">重新抽實戰題目</button>'}
      <a class="btn" href="#/plan">回 30 天養成</a>
    </div>
    ${footer()}`);
}

function startExamDrill() {
  if (!DRILLS.length) { view('<p>題庫還沒載入。</p><a class="btn" href="#/exam">回畢業考</a>'); return; }
  const cards = pickExamDrills(DRILLS).map((d) => ({ d, opts: shuffle(d.options.map((o, i) => ({ ...o, i }))) }));
  exdrill = { cards, i: 0, score: 0, misses: [] };
  renderExamDrill();
}

function renderExamDrill() {
  stopTimer();
  const { cards, i } = exdrill;
  const { d, opts } = cards[i];
  view(`<div class="row small"><a href="#/exam">← 畢業考</a><span class="chip gold">🎓 筆試</span><span class="muted">第 ${i + 1} / ${cards.length} 張</span></div>
    <div class="timer"><i id="tbar" style="width:100%"></i></div>
    <div class="card" style="margin-top:10px"><div class="drill-say">${esc(d.say)}</div></div>
    <div class="choices">${opts.map((o, k) => `<button class="choice" data-act="exd-pick" data-i="${k}"><span class="k">${k + 1}</span>${esc(o.text)}</button>`).join('')}</div>
    <p class="muted small" style="margin-top:10px">考試中不公布對錯，全部答完才看。</p>`);
  const t0 = performance.now(); const LIMIT = EXAM_RULE.seconds * 1000;
  timerId = setInterval(() => {
    const left = LIMIT - (performance.now() - t0);
    const bar = document.getElementById('tbar');
    if (bar) bar.style.width = `${Math.max(0, left / LIMIT * 100)}%`;
    if (left <= 0) { stopTimer(); exdPick(-1); }
  }, 100);
}

function exdPick(k) {
  if (!exdrill) return;
  stopTimer();
  const card = exdrill.cards[exdrill.i];
  const tag = k === -1 ? 'bad' : card.opts[k].tag;
  exdrill.score += DRILL_POINTS[tag];
  if (tag !== 'best') exdrill.misses.push({ d: card.d, timeout: k === -1 });
  if (exdrill.i < exdrill.cards.length - 1) { exdrill.i++; renderExamDrill(); return; }
  const total = exdrill.cards.length * DRILL_POINTS.best;
  Store.recordExamDrill(data, exdrill.score, total);
  persist();
  const pct = Math.round(exdrill.score / total * 100);
  const ok = exdrill.score / total >= EXAM_RULE.drillPass;
  const misses = exdrill.misses;
  exdrill = null;
  view(`<div class="card endbox"><div class="muted">🎓 畢業考筆試</div>
      <div class="bigg ${ok ? 'g-S' : 'g-C'}">${pct}%</div><div>${ok ? '通過' : `沒過（及格 ${Math.round(EXAM_RULE.drillPass * 100)}%）`}</div></div>
    ${misses.length ? `<div class="card"><h3>沒選到最好的</h3><ol>${misses.map((m) => `<li><div>${esc(m.d.say)}${m.timeout ? ' <span class="chip law">超時</span>' : ''}</div><div class="keyline">🔑 ${esc(m.d.keyLine)}</div></li>`).join('')}</ol></div>` : ''}
    <div class="row"><a class="btn" href="#/exam/drill">重考筆試</a><a class="btn primary" href="#/exam">回畢業考 →</a></div>${footer()}`);
  window.scrollTo(0, 0);
}

// ---------- 路由 ----------
// 原地重畫（勾選、+1 之後不要跳回頁首）
function rerender() {
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

function route() {
  stopTimer();
  const h = location.hash || '#/';
  const [p0, p1, p2] = h.replace(/^#\/?/, '').split('/').map((x) => decodeURIComponent(x || ''));
  document.querySelectorAll('.topnav a').forEach((a) => {
    a.classList.toggle('on', a.getAttribute('href').slice(2) === p0);
  });
  if (p0 === 'map') mapView();
  else if (p0 === 'plan' && p1) planDayView(Number(p1));
  else if (p0 === 'plan') planView();
  else if (p0 === 'book') bookView();
  else if (p0 === 'exam' && p1 === 'drill') startExamDrill();
  else if (p0 === 'exam' && p1 === 'scene') startScene(p2, true);
  else if (p0 === 'exam' && p1 === 'sched') { ensureExamPicked(); startSched(data.exam.picked && data.exam.picked.sched, true); }
  else if (p0 === 'exam') examHub();
  else if (p0 === 'scene') startScene(p1);
  else if (p0 === 'drill' && p1 === 'run') startDrill(p2 || 'all');
  else if (p0 === 'drill') drillMenu();
  else if (p0 === 'sched' && p1) startSched(p1);
  else if (p0 === 'sched') schedList();
  else if (p0 === 'ai') { if (p1 && ROLES.some((r) => r.id === p1)) { ai.role = p1; ai.scroll = true; } if (p2 && LEVELS[p2]) ai.level = p2; aiView(); }
  else if (p0 === 'law') lawView(p1);
  else if (p0 === 'report') reportView();
  else home();
  if (p0 !== 'law' || !p1) window.scrollTo(0, 0);
}

// ---------- 事件 ----------
document.addEventListener('click', (e) => {
  // 連到「現在這一頁」的連結（再來一輪、練錯題本、上方選單）瀏覽器不會換頁 → 自己重新開始
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.isConnected && a.getAttribute('href') === (location.hash || '#/')) { e.preventDefault(); route(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !el.isConnected) return;
  const act = el.dataset.act;
  // 剛換畫面 0.35 秒內的點擊不算（避免同一下點擊被新畫面的按鈕接到）
  if (['choose', 'drill-pick', 'finish', 'drill-next', 'exd-pick'].includes(act) && performance.now() - lastRenderAt < 350) return;
  switch (act) {
    case 'choose': choose(Number(el.dataset.i)); break;
    case 'finish': finishScene(); break;
    case 'restart': startScene(play.sc.id, play.exam); break;
    case 'drill-pick': drillPick(Number(el.dataset.i)); break;
    case 'drill-next': drillNext(); break;
    case 'sched-submit': submitSched(); break;
    case 'sched-reset': for (const t of sched.lv.tasks) sched.plan[t.id] = t.fixed ? t.win[0][0] : null; renderSched(); break;
    case 'ai-role': ai.role = el.dataset.id; ai.scroll = true; aiView(); break;
    case 'ai-level': ai.level = el.dataset.lv; aiView(); break;
    case 'ai-copy': { const role = ROLES.find((r) => r.id === ai.role); if (role) copyText(buildPrompt(role, ai.level)); break; }
    case 'copy-report': copyText(reportText()); break;
    case 'copy-cert': copyText(certText()); break;
    case 'exd-pick': exdPick(Number(el.dataset.i)); break;
    case 'plan-start': data.plan.start = todayISO(); persist(); toast('第 1 天開始！'); route(); break;
    case 'cnt': {
      const c = el.dataset.c; const v = Math.max(0, (data.plan.counters[c] || 0) + Number(el.dataset.d));
      data.plan.counters[c] = v; persist(); rerender(); break;
    }
    case 'exam-repick':
      if (window.confirm('重新抽實戰與排行程題目？已考過的實戰、排行程成績會清掉（筆試、口試保留）。')) {
        data.exam.picked = pickExam(SCENES, SCHED); data.exam.scenes = {}; data.exam.sched = null; persist(); examHub();
      }
      break;
    case 'reset-all':
      if (window.confirm('確定要清除這台電腦上的所有成績嗎？清掉就回不來了。')) { data = Store.resetAll(); toast('已清除'); reportView(); }
      break;
    case 'nav': break;
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('select[data-task]') && sched) {
    sched.plan[el.dataset.task] = el.value === '' ? null : Number(el.value);
    const y = window.scrollY;
    renderSched();
    window.scrollTo(0, y);
  } else if (el.matches('input[data-act="timed"]')) {
    timed = el.checked;
  } else if (el.matches('input[data-field]')) {
    data.plan.field[el.dataset.field] = el.checked; persist(); rerender();
  } else if (el.matches('input[data-ai]')) {
    data.plan.ai[el.dataset.ai] = el.checked; persist(); rerender();
  } else if (el.matches('input[data-oral]')) {
    data.plan.oral[el.dataset.oral] = el.checked; persist(); rerender();
  } else if (el.matches('input[data-exam-oral]')) {
    data.exam.oral = el.checked; persist(); rerender();
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('input[data-act="name"]')) { data.name = el.value.trim().slice(0, 12); persist(); }
});

// 鍵盤：1～4 選答案、Enter 下一步
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  const h = location.hash;
  const n = Number(e.key);
  if ((h.startsWith('#/scene/') || h.startsWith('#/exam/scene/')) && play && !play.result) {
    const node = play.sc.nodes[play.st.node];
    if (node.end && e.key === 'Enter') finishScene();
    else if (node.choices && n >= 1 && n <= node.choices.length) choose(n - 1);
  } else if (h === '#/exam/drill' && exdrill) {
    if (n >= 1 && n <= 4) exdPick(n - 1);
  } else if (h.startsWith('#/drill/run') && drill) {
    if (drill.picked === null && n >= 1 && n <= 4) drillPick(n - 1);
    else if (drill.picked !== null && e.key === 'Enter') drillNext();
  }
});

window.addEventListener('hashchange', route);

// ---------- 載入內容 ----------
async function loadContent() {
  const files = ['scenes-a', 'scenes-b', 'scenes-c'];
  const res = await Promise.allSettled(files.map((f) => import(`./content/${f}.js`)));
  res.forEach((r, i) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value.default)) SCENES.push(...r.value.default);
    else MISSING.push(`關卡包 ${files[i]}`);
  });
  SCENES.sort((a, b) => a.chapter - b.chapter || a.id.localeCompare(b.id, 'en', { numeric: true }));
  try { DRILLS = (await import('./content/drills.js')).default || []; } catch { MISSING.push('話術快打題庫'); }
}

loadContent().then(route);
