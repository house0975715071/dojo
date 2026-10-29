// 戰神道場｜排行程挑戰（3 題）
// 時間用「從 0 點起算的分鐘」：9:00 = 540、12:00 = 720、18:00 = 1080。
// 交通時間是遊戲數值（開車、離峰），不是導航實測。

const LOCS = {
  store: '店頭（中原商圈）',
  xinghe: '中原星禾（主線物件）',
  neili: '內壢',
  qingpu: '青埔',
  taoyuan: '桃園區',
  station: '中壢火車站（代書事務所）',
};

const TRAVEL = {
  'store|xinghe': 10, 'store|neili': 15, 'store|qingpu': 25, 'store|taoyuan': 35, 'store|station': 15,
  'xinghe|neili': 15, 'xinghe|qingpu': 25, 'xinghe|taoyuan': 35, 'xinghe|station': 15,
  'neili|qingpu': 30, 'neili|taoyuan': 25, 'neili|station': 10,
  'qingpu|taoyuan': 30, 'qingpu|station': 20,
  'taoyuan|station': 30,
};

export default [
  {
    id: 'day1',
    title: '新人的星期六',
    brief: '週六早上 9 點晨會，今天手上有 6 件事。每件事對方都只有某些時段可以，地點散在中壢、內壢、青埔、桃園。全部排進去是有可能的——前提是順序對。',
    home: 'store', dayStart: 540, dayEnd: 1260, locs: LOCS, travel: TRAVEL,
    tasks: [
      { id: 'meet', title: '店務晨會', who: '全店', loc: 'store', dur: 30, win: [[540, 570]], value: 10, must: true, fixed: true, note: '9:00 固定，不能缺席。' },
      { id: 'show1', title: '帶看：首購夫妻看三房', who: '首購夫妻', loc: 'xinghe', dur: 60, win: [[600, 720]], value: 30, note: '小孩下午要睡午覺，只能 10:00～12:00。' },
      { id: 'sign', title: '內壢透天屋主簽委託', who: '透天屋主', loc: 'neili', dur: 60, win: [[840, 1020]], value: 40, note: '本週最重要的事。屋主 14:00～17:00 在家，時段很寬。' },
      { id: 'fsbo', title: '拜訪青埔 591 自售屋主', who: '自售屋主', loc: 'qingpu', dur: 45, win: [[780, 960]], value: 20, note: '屋主 13:00～16:00 有空，第一次見面。' },
      { id: 'inv', title: '帶看：投資客看桃園套房', who: '投資客', loc: 'taoyuan', dur: 45, win: [[840, 930]], value: 15, note: '投資客只有 14:00～15:30，殺價兇、成交機率低。' },
      { id: 'dm', title: '中原商圈掃街發 DM', who: '自己', loc: 'store', dur: 60, win: [[570, 1260]], value: 10, note: '什麼時候都可以，填空檔。' },
      { id: 'call', title: '電話回報屋主大哥進度', who: '屋主大哥', loc: 'store', dur: 30, win: [[1140, 1260]], value: 15, note: '答應每週六晚上回報，說到要做到。' },
    ],
    lessons: [
      '最重要的事不一定排最早：簽委託的屋主時段最寬，留到後面；時段最窄的人先排。',
      '同一區的約串在一起，跑青埔、桃園、內壢要算車程，排成一條線不要來回折返。',
      '掃街、開發電話是「填空檔」的工作，不要拿黃金時段去做。',
    ],
  },
  {
    id: 'day2',
    title: '斡旋今天中午到期',
    brief: '星期三。首購夫妻的斡旋中午 12:00 到期，一定要在之前讓屋主回覆；下午 2 點在代書事務所用印。晚上兩個約撞在一起，你得取捨。',
    home: 'store', dayStart: 540, dayEnd: 1260, locs: LOCS, travel: TRAVEL,
    tasks: [
      { id: 'coach', title: '店長一對一', who: '店長', loc: 'store', dur: 30, win: [[540, 570]], value: 10, must: true, fixed: true, note: '9:00 固定。' },
      { id: 'report', title: '斡旋到期前，當面回報屋主', who: '屋主大哥、大姐', loc: 'xinghe', dur: 60, win: [[570, 720]], value: 40, must: true, note: '斡旋 12:00 到期，一定要在之前讓屋主回覆。' },
      { id: 'show2', title: '買方二看帶娘家媽媽', who: '首購夫妻＋娘家媽媽', loc: 'xinghe', dur: 60, win: [[600, 750]], value: 30, note: '媽媽只有上午能來（10:00～12:30）。跟屋主同一個社區。' },
      { id: 'sign', title: '代書事務所用印', who: '另一組買賣雙方', loc: 'station', dur: 90, win: [[840, 930]], value: 40, must: true, fixed: true, note: '14:00 固定，雙方和代書都約好了。' },
      { id: 'photo', title: '青埔新委託拍照', who: '自己', loc: 'qingpu', dur: 60, win: [[780, 1050]], value: 20, note: '要趁有陽光拍（13:00～17:30）。' },
      { id: 'leads', title: '591 自售屋主開發電話', who: '自己', loc: 'store', dur: 60, win: [[540, 1260]], value: 10, note: '在店裡打，什麼時候都可以。' },
      { id: 'fsbo2', title: '拜訪青埔屋主（想換屋）', who: '青埔屋主', loc: 'qingpu', dur: 60, win: [[1080, 1200]], value: 25, note: '下班後 18:00～20:00 才有空，可能變委託。' },
      { id: 'show3', title: '帶看：桃園區兩房', who: '上班族買方', loc: 'taoyuan', dur: 45, win: [[1110, 1200]], value: 20, note: '18:30～20:00，第一次看。' },
    ],
    lessons: [
      '有期限的事（斡旋到期）永遠第一順位，排在最前面、留好緩衝。',
      '同一個社區的兩件事（回報屋主、帶二看）接在一起，零車程。',
      '兩個約撞在一起時，選「成交機率高、後續價值大」的那個，另一個禮貌改約，不要兩個都遲到。',
    ],
  },
  {
    id: 'day3',
    title: '週末旺日：五組帶看',
    brief: '週日旺日，五組買方要看房，傍晚 18:30 還有一場已經約好的見面談。全部塞得下嗎？哪一件該放掉？',
    home: 'store', dayStart: 540, dayEnd: 1260, locs: LOCS, travel: TRAVEL,
    tasks: [
      { id: 'meet', title: '旺日晨會', who: '全店', loc: 'store', dur: 30, win: [[540, 570]], value: 10, must: true, fixed: true, note: '9:00 固定。' },
      { id: 'a', title: '帶看：首購夫妻（中原）', who: '首購夫妻', loc: 'xinghe', dur: 60, win: [[600, 720]], value: 25, note: '10:00～12:00。' },
      { id: 'b', title: '帶看：換屋家庭（青埔）', who: '換屋家庭', loc: 'qingpu', dur: 60, win: [[600, 780]], value: 25, note: '10:00～13:00。' },
      { id: 'c', title: '帶看：投資客（桃園區）', who: '投資客', loc: 'taoyuan', dur: 45, win: [[780, 900]], value: 10, note: '13:00～15:00，只想撿便宜。' },
      { id: 'd', title: '帶看：退休夫妻（內壢）', who: '退休夫妻', loc: 'neili', dur: 60, win: [[840, 1020]], value: 20, note: '14:00～17:00。' },
      { id: 'h', title: '拜訪社區管委會主委', who: '管委會主委', loc: 'xinghe', dur: 30, win: [[900, 1080]], value: 10, note: '15:00～18:00，社區經營，長期有用。' },
      { id: 'e', title: '帶看：外地上班族（中壢站）', who: '上班族', loc: 'station', dur: 45, win: [[1020, 1140]], value: 20, note: '17:00～19:00，剛下班。' },
      { id: 'f', title: '見面談（已約好）', who: '屋主＋買方', loc: 'store', dur: 120, win: [[1110, 1230]], value: 50, must: true, fixed: true, note: '18:30 固定，雙方都會到，不能遲到。' },
      { id: 'g', title: '店頭附近掃街', who: '自己', loc: 'store', dur: 60, win: [[570, 1260]], value: 5, note: '什麼時候都可以。' },
    ],
    lessons: [
      '旺日把同一區的帶看排成一條線：中原 → 青埔 → 桃園 → 內壢 → 中原 → 中壢站 → 店頭。',
      '見面談前不要排太滿：見面談是今天價值最高的事，提早回店準備資料、調整心情。',
      '價值最低的事（掃街）是第一個被犧牲的，不要讓它擠掉帶看。',
    ],
  },
];
