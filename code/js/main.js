/* ═══════════════════════════════════════════════════════════════
   main.js — 롯데백화점 동탄점 B2B 기프트 컨시어지
   ---------------------------------------------------------------
   구조:
   [1] 전역 상태 변수
   [2] 유틸리티 함수 (toast, scroll 등)
   [3] 네비게이션 (모바일 메뉴)
   [4] 스크롤 애니메이션 (reveal)
   [5] 서비스 안내 탭
   [6] 선물 추천 마법사 (B2B / B2E)
   [7] 결과 렌더링 (패키지 카드, 패키징 프리뷰)
   [8] 단체복 마법사
   [9] 이벤트 필터
   [10] 모달 (예약 / 디지털 패스 / 상담)
   [11] 관리자 패널
   [12] 품의서·견적서 생성 (팝업 윈도우)
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════
   전역 상태 변수
   ══════════════════════════════════════════════════ */
var wState = {
  bizType:null, unitPrice:0, unitLabel:'', qty:0,
  b2b_purpose:[], b2b_target:null, b2b_value:[], b2b_cat:[], b2b_custom:[], b2b_comp:[],
  b2e_purpose:[], b2e_target:null, b2e_mood:[], b2e_extra:[]
};
var uState = { uniType:null, unitPrice:0, qty:0, uni_type:[], uni_fabric:null, uni_extra:[] };
var savedResults = [];
var sumType = 'b2b';

/* 어드민 CRM 데이터 - 전역 */
var CRM = [];
function loadCRM() {
  try { CRM = JSON.parse(localStorage.getItem('lotteCrm') || '[]'); }
  catch(e) { CRM = []; }
}
loadCRM();

/* 패스 관련 전역 */
var _pkgs    = [];
var _selPkg  = 1;
var visitData = {};
var dpStops  = [];
var dpDone   = [];

/* 패키징 프리뷰 전역 */
var previewState = { color:'#FFFFFF', ribbon:'새틴', logoImg:null };

/* ══════════════════════════════════════════════════
   유틸 함수
   ══════════════════════════════════════════════════ */
function fmt(n) { return '₩' + Math.round(n).toLocaleString('ko-KR'); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function getDisc(q) {
  if(q>=500) return 0.12; if(q>=200) return 0.10;
  if(q>=100) return 0.07; if(q>=50)  return 0.05;
  if(q>=30)  return 0.03; return 0;
}
var toastTmr;
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTmr);
  toastTmr = setTimeout(function(){ t.classList.remove('show'); }, 3500);
}
function scrollToWiz() {
  var w = document.getElementById('wizard');
  if (!w) return;
  w.scrollIntoView({ behavior:'smooth' });
  document.querySelectorAll('#wizard .wpanel').forEach(function(p){ p.classList.remove('active'); });
  var p0 = document.getElementById('wp-0');
  if (p0) p0.classList.add('active');
  updDots(0,'wd','wf',5);
}
function openMob()  { var n=document.getElementById('mobNav'); if(n){n.classList.add('open');document.body.style.overflow='hidden';} }
function closeMob() { var n=document.getElementById('mobNav'); if(n){n.classList.remove('open');document.body.style.overflow='';} }

/* Reveal 스크롤 */
var revObs = new IntersectionObserver(function(entries){
  entries.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold:0.07 });
document.querySelectorAll('.reveal').forEach(function(el){ revObs.observe(el); });

/* ══════════════════════════════════════════════════
   위저드 공통
   ══════════════════════════════════════════════════ */
function updDots(step, dp, fp, max) {
  for (var i=0; i<=max; i++) {
    var d = document.getElementById(dp+'-'+i);
    if (!d) continue;
    d.classList.remove('active','done');
    if (i < step) d.classList.add('done');
    else if (i === step) d.classList.add('active');
  }
  for (var i=0; i<max; i++) {
    var f = document.getElementById(fp+'-'+i);
    if (f) f.style.width = (i < step) ? '100%' : '0%';
  }
}

function gp(id, dot) {
  document.querySelectorAll('#wizard .wpanel').forEach(function(p){ p.classList.remove('active'); });
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  updDots(dot,'wd','wf',5);
  var w = document.getElementById('wizard');
  if (w) w.scrollIntoView({ behavior:'smooth', block:'start' });
}

// 패널별 자동 다음 단계 매핑 (복수 섹션 패널은 제외)
var PANEL_AUTO_NEXT = {
  'wp-b2b-1': function(){ gp('wp-b2b-2',2); },
  'wp-b2b-3': function(){ gp('wp-b2b-4',4); },
  'wp-b2e-1': function(){ gp('wp-b2e-2',2); },
  'wp-b2e-3': function(){ gp('wp-b2e-4',4); },
  'wp-b2e-4': function(){ gp('wp-b2e-5',5); },
  'wp-b2e-5': function(){ showSum('b2e'); }
};

function selectBiz(el, type) {
  document.querySelectorAll('#wizard .type-card, #wizard .tc').forEach(function(c){ c.classList.remove('sel'); });
  el.classList.add('sel');
  wState.bizType = type;
  setTimeout(wStep1, 250);
}

function wStep1() {
  if (!wState.bizType) { showToast('B2B 또는 B2E를 선택해 주세요'); return; }
  wState.bizType === 'B2B' ? gp('wp-b2b-1',1) : gp('wp-b2e-1',1);
}

function tChip(el, cat, val) {
  el.classList.toggle('sel');
  if (!wState[cat]) wState[cat] = [];
  var a = wState[cat], i = a.indexOf(val);
  if (i === -1) a.push(val); else a.splice(i,1);
  // 복수 선택 가능: 500ms 후 자동 다음 단계 (재클릭 시 타이머 리셋)
  var panel = el.closest('.wpanel');
  if (panel && PANEL_AUTO_NEXT[panel.id]) {
    clearTimeout(window._chipTimer);
    window._chipTimer = setTimeout(PANEL_AUTO_NEXT[panel.id], 500);
  }
}
function sChip(el, cat, val) {
  var panel = el.closest('.wpanel');
  panel.querySelectorAll('.chip, .bud-card').forEach(function(c){
    if ((c.getAttribute('onclick')||'').indexOf("'"+cat+"'") !== -1) c.classList.remove('sel');
  });
  el.classList.add('sel');
  wState[cat] = val;
}
function sBud(el, price, label) {
  el.closest('.wpanel').querySelectorAll('.bc, .bud-card').forEach(function(c){ c.classList.remove('sel'); });
  el.classList.add('sel');
  wState.unitPrice = parseInt(price);
  wState.unitLabel = label || price;
  calcTot();
  // 예산 선택 즉시 다음 단계
  var panel = el.closest('.wpanel');
  if (panel && PANEL_AUTO_NEXT[panel.id]) {
    setTimeout(PANEL_AUTO_NEXT[panel.id], 300);
  }
}

function calcTot() {
  var p = wState.unitPrice;
  var qEl = wState.bizType==='B2B' ? document.getElementById('gift-qty') : document.getElementById('b2e-qty');
  var q = qEl ? (parseInt(qEl.value)||0) : 0;
  wState.qty = q;
  if (!p || !q) return;
  var d = getDisc(q), sub = p*q, da = sub*d, tot = sub - da;
  var prevId = wState.bizType==='B2B' ? 'gift-tprev' : 'b2e-tprev';
  var prev = document.getElementById(prevId);
  if (prev) prev.classList.add('show');
  var ids = wState.bizType==='B2B'
    ? ['tp-u','tp-q','tp-d','tp-t']
    : ['tp2-u','tp2-q','tp2-d','tp2-t'];
  var setEl = function(id, txt){ var e=document.getElementById(id); if(e) e.textContent=txt; };
  setEl(ids[0], fmt(p)+'/인');
  setEl(ids[1], q+(wState.bizType==='B2B'?'개':'명'));
  setEl(ids[2], d>0 ? '-'+fmt(da)+' ('+Math.round(d*100)+'% 할인)' : '해당 없음');
  setEl(ids[3], fmt(tot));
}

function showSum(type) {
  sumType = type;
  var its = type === 'b2b' ? [
    {l:'유형',   v:'B2B — 거래처 선물'},
    {l:'목적',   v:(wState.b2b_purpose||[]).join(', ')},
    {l:'대상',   v:wState.b2b_target||''},
    {l:'수량',   v:wState.qty ? wState.qty+'개' : ''},
    {l:'단가',   v:wState.unitPrice ? fmt(wState.unitPrice) : ''},
    {l:'총액',   v:(wState.unitPrice&&wState.qty) ? fmt(wState.unitPrice*wState.qty*(1-getDisc(wState.qty))) : ''},
    {l:'카테고리',v:(wState.b2b_cat||[]).join(', ')}
  ] : [
    {l:'유형',   v:'B2E — 임직원 선물'},
    {l:'목적',   v:(wState.b2e_purpose||[]).join(', ')},
    {l:'대상',   v:wState.b2e_target||''},
    {l:'인원',   v:wState.qty ? wState.qty+'명' : ''},
    {l:'단가',   v:wState.unitPrice ? fmt(wState.unitPrice) : ''},
    {l:'총액',   v:(wState.unitPrice&&wState.qty) ? fmt(wState.unitPrice*wState.qty*(1-getDisc(wState.qty))) : ''},
    {l:'분위기', v:(wState.b2e_mood||[]).join(', ')}
  ];
  var html = its.filter(function(i){ return i.v; }).map(function(i){
    return '<div class="ws-i"><div class="ws-l">'+i.l+'</div><div class="ws-v">'+i.v+'</div></div>';
  }).join('');
  var el = document.getElementById('wiz-sum');
  if (el) el.innerHTML = html || '<div class="ws-i"><div class="ws-v">선택 정보 없음</div></div>';
  gp('wp-summary', 5);
  document.querySelectorAll('#wizard .wd').forEach(function(d){ d.classList.add('done'); d.classList.remove('active'); });
}
function backFromSum() {
  sumType === 'b2b' ? gp('wp-b2b-5',4) : gp('wp-b2e-5',4);
}

/* ══════════════════════════════════════════════════
   패키지 데이터 (실제 롯데 동탄점 브랜드)
   ══════════════════════════════════════════════════ */
/* 이런 선물은 어떠신가요 / 프리미엄 명절 선물 컬렉션 상품 카탈로그 */
var giftCatalog = {
  g1:{n:'청풍명월 1++ 한우 명작로스1호(2.4kg)', d:'1++ 등급 최상급 한우 · 프리미엄 명절 선물 컬렉션 · ₩499,500'},
  g2:{n:'동양축산 1++등급 한우마을 신선5호세트(2.0kg)', d:'냉장 직송 1++ 한우 부위별 구성 · 프리미엄 명절 선물 컬렉션 · ₩324,360'},
  g3:{n:'안성마춤농협 1+등급 한우 친환경 패키지 명품세트(1kg)', d:'친환경 패키지 한우 · 프리미엄 명절 선물 컬렉션 · ₩205,660'},
  g4:{n:'일품채 엘프르미에 배 세트(7.5kg / 배 9입)', d:'프리미엄 배 선물세트 · 프리미엄 명절 선물 컬렉션 · ₩173,850'},
  g5:{n:'정관장 홍삼정 240g (80일분, 스푼제거)', d:'대표 홍삼 농축액 · 프리미엄 명절 선물 컬렉션 · ₩220,000'},
  g6:{n:'썬키스트 캘리포니아 오렌지 세트(3kg)', d:'실속형 프리미엄 과일 · 프리미엄 명절 선물 컬렉션 · ₩89,000'},
  g7:{n:'종근당건강 락토핏 골드 + 비타민C 세트', d:'실속형 건강 선물 · 프리미엄 명절 선물 컬렉션 · ₩65,000'},
  g8:{n:'1++한우 갈비탕 6팩 실속세트', d:'간편 조리 1++ 한우 갈비탕 · 프리미엄 명절 선물 컬렉션 · ₩98,000'},
  s1:{n:'맛있는날 완도 활전복 정성 세트(160g내외 9미)', d:'프리미엄 보양식 · 이런 선물은 어떠신가요 · ₩114,000'},
  s2:{n:'맛딜 국내산 자포니카 민물장어 4-5인 선물세트', d:'고단백 보양식 · 이런 선물은 어떠신가요 · ₩118,800'},
  s3:{n:'오쏘몰 이뮨 30일분', d:'고함량 면역 비타민 · 이런 선물은 어떠신가요 · ₩109,800'}
};
function fromCatalog(keys) {
  return keys.map(function(k){ return giftCatalog[k]; });
}
var pkgItems = {
  /* ═══ 뷰티·향수 (여성) ═══ */
  beauty_female: {
    std:  fromCatalog(['g7','g6','s3']),
    prem: fromCatalog(['g4','s1','g5']),
    sig:  fromCatalog(['g1','g5','s2'])
  },
  /* ═══ 뷰티·향수 (남성) ═══ */
  beauty_male: {
    std:  fromCatalog(['g8','g6']),
    prem: fromCatalog(['g2','g5','s1']),
    sig:  fromCatalog(['g1','s2','g5'])
  },
  /* ═══ 구르메·식품 ═══ */
  gourmet: {
    std:  fromCatalog(['g8','g7','g4']),
    prem: fromCatalog(['g2','g4','s1']),
    sig:  fromCatalog(['g1','g5','s2'])
  },
  /* ═══ 건강·비타민·웰니스 ═══ */
  wellness: {
    std:  fromCatalog(['g7','s3']),
    prem: fromCatalog(['g5','s3','g6']),
    sig:  fromCatalog(['g5','s1','g1'])
  },
  /* ═══ B2B 프리미엄 임원 ═══ */
  premium: {
    std:  fromCatalog(['g8','g6']),
    prem: fromCatalog(['g2','g5','s1']),
    sig:  fromCatalog(['g1','s2','g5'])
  },
  /* ═══ B2E 실용 임직원 ═══ */
  practical: {
    std:  fromCatalog(['g7','g6','s3']),
    prem: fromCatalog(['g4','s2','g8']),
    sig:  fromCatalog(['g1','s1','g5'])
  },
  /* ═══ 기본 (fallback) ═══ */
  default: {
    std:  fromCatalog(['g7','g6','s3']),
    prem: fromCatalog(['g4','s1','g5']),
    sig:  fromCatalog(['g1','g5','s2'])
  }
};


function buildPackages(bp, qty, colKey) {
  var d   = getDisc(qty);
  var its = pkgItems[colKey] || pkgItems.default;
  return [
    { tier:'STANDARD',  badge:null,        feat:false, price:Math.round(bp*0.78), qty:qty, disc:d,                   tag:'가성비 추천', items:its.std  },
    { tier:'PREMIUM',   badge:'큐레이터 추천', feat:true,  price:bp,                qty:qty, disc:d,                   tag:'베스트셀러', items:its.prem },
    { tier:'SIGNATURE', badge:null,        feat:false, price:Math.round(bp*1.55), qty:qty, disc:Math.min(d+0.02,0.15),tag:'프레스티지', items:its.sig  }
  ];
}

function renderPkgCard(pk, i) {
  var sub = pk.price*pk.qty, da = Math.round(sub*pk.disc), tot = sub - da;
  var itemsHtml = pk.items.map(function(it){
    return '<div class="pkg-it"><div><span class="pkg-it-n">'+it.n+'</span><span class="pkg-it-d"> — '+it.d+'</span></div></div>';
  }).join('');
  var detailHtml = pk.items.map(function(it){
    return '<div class="pkg-det-it"><span class="pkg-det-n">'+it.n+'</span><span>'+it.d+'</span></div>';
  }).join('');
  return '<div class="pkg-c'+(pk.feat?' feat':'')+'" id="pkc-'+i+'">' +
    (pk.badge ? '<div class="pkg-bdg">'+pk.badge+'</div>' : '') +
    '<div class="pkg-tier">'+pk.tier+'</div>'+
    '<div class="pkg-price">'+fmt(pk.price)+'</div>'+
    '<div class="pkg-ps">/ 1인당 (VAT 별도)</div>'+
    '<div class="pkg-tag">'+pk.tag+'</div>'+
    '<div class="pkg-div"></div>'+
    '<div class="pkg-items">'+itemsHtml+'</div>'+
    '<div class="pkg-tot-row">'+
      '<div class="pkg-tot-l">총 '+pk.qty+'개</div>'+
      '<div>'+
        '<div class="pkg-tot-v">'+fmt(tot)+'</div>'+
        (pk.disc>0 ? '<div class="pkg-disc">-'+Math.round(pk.disc*100)+'% 할인 ('+fmt(da)+')</div>' : '')+
      '</div>'+
    '</div>'+
    '<button class="pkg-sb" onclick="selectPackage('+i+')">이 패키지 선택하기</button>'+
    '<button class="pkg-db" onclick="togglePkgDetail('+i+')">상세 구성 보기 ▾</button>'+
    '<div class="pkg-det" id="pkd-'+i+'">'+detailHtml+'</div>'+
  '</div>';
}

function togglePkgDetail(i) {
  var b = document.getElementById('pkd-'+i);
  var btn = b ? b.previousElementSibling : null;
  if (!b) return;
  if (b.classList.contains('open')) {
    b.classList.remove('open');
    if (btn) btn.textContent = '상세 구성 보기 ▾';
  } else {
    b.classList.add('open');
    if (btn) btn.textContent = '상세 구성 접기 ▲';
  }
}

function selectPackage(i) {
  window._selectedPkg = i;
  for (var j = 0; j < 3; j++) {
    var card = document.getElementById('pkc-'+j);
    if (!card) continue;
    card.style.outline = 'none';
    card.classList.remove('selected');
    if (j === i) card.classList.add('selected');
  }
  // 선택한 패키지 정보를 모달에 전달 후 상담 신청 모달 열기
  window._selectedPkgName = ['STANDARD','PREMIUM','SIGNATURE'][i];
  openCM();
}

/* ══════════════════════════════════════════════════
   genResult — 결과 생성
   ══════════════════════════════════════════════════ */
function genResult() {
  var p = wState.unitPrice, q = wState.qty;
  if (!p || !q) { showToast('예산과 수량을 입력해 주세요'); return; }

  /* 컬렉션 키 결정 */
  var key = 'default';
  if (wState.bizType === 'B2E') {
    var m = wState.b2e_mood || [];
    var tgt = wState.b2e_target || '';
    if (m.indexOf('건강·웰니스') !== -1) key = 'wellness';
    else if (m.indexOf('미식·구르메') !== -1) key = 'gourmet';
    else if (tgt.indexOf('임원') !== -1 || tgt.indexOf('경영진') !== -1) key = 'premium';
    else key = 'practical';
  } else {
    var v = wState.b2b_value||[], cat = wState.b2b_cat||[];
    var tgt = wState.b2b_target||'';
    if (v.indexOf('고급스러움·프리미엄') !== -1 || tgt.indexOf('임원') !== -1 || tgt.indexOf('VIP') !== -1) key = 'premium';
    else if (cat.indexOf('식품·F&B') !== -1 || cat.indexOf('건강·웰니스') !== -1) {
      /* 선물 가치가 건강이면 wellness, 식품이면 gourmet */
      if (cat.indexOf('건강·웰니스') !== -1) key = 'wellness';
      else key = 'gourmet';
    }
    else if (cat.indexOf('뷰티·스킨케어') !== -1) key = 'beauty_female';
    else if (cat.indexOf('패션·액세서리') !== -1) key = 'beauty_male';
    else key = 'default';
  }

  var d  = getDisc(q), sub = p*q, da = Math.round(sub*d), tot = sub - da;
  var target  = wState.b2b_target||wState.b2e_target||'';
  var purpose = (wState.b2b_purpose||wState.b2e_purpose||[]).join(', ');

  /* 헤더 갱신 */
  var $ = function(id){ return document.getElementById(id); };
  var setTxt = function(id, txt){ var e=$(id); if(e) e.textContent = txt; };
  setTxt('res-client-tag', (target?target+' 대상':'기업')+' · '+(purpose.split(',')[0]||'맞춤')+' 큐레이션');
  setTxt('res-kicker',     (wState.bizType||'B2B')+' · Curated · 롯데백화점 동탄점');
  setTxt('res-title',      '맞춤 선물 패키지 3종 — Standard / Premium / Signature');
  setTxt('res-story',      '롯데백화점 동탄점 입점 브랜드(조 말론, 샤넬, 딥티크, 몽블랑 등)에서 엄선한 큐레이션. 대량 할인 '+Math.round(d*100)+'% 적용.');

  /* 패키지 카드 */
  var pkgs = buildPackages(p, q, key);
  window._genPkgs     = pkgs;
  window._selectedPkg = 1;
  _pkgs = pkgs;
  var pg = $('pkg-grid');
  if (pg) pg.innerHTML = pkgs.map(function(pk,i){ return renderPkgCard(pk,i); }).join('');

  /* 큐레이터 코멘트 */
  var comments = {
    beauty_female: '"PREMIUM 패키지는 프리미엄 명절 선물 컬렉션의 한우·과일 세트와 보양식 큐레이션을 조합해, 트렌디하면서도 격조 있는 선물을 설계했습니다."',
    beauty_male:   '"PREMIUM 패키지는 프리미엄 명절 선물 컬렉션의 한우 세트와 보양식 큐레이션을 중심으로, 받는 분의 만족도가 높은 구성을 엄선했습니다."',
    premium:       '"PREMIUM 패키지는 프리미엄 명절 선물 컬렉션의 1++ 한우 세트와 보양식 큐레이션의 조합으로, 임원급 수신자에게 결코 실패하지 않는 격조 있는 구성입니다."',
    wellness:      '"PREMIUM 패키지는 정관장 홍삼정(프리미엄 명절 선물 컬렉션)과 오쏘몰 이뮨(이런 선물은 어떠신가요)의 조합으로, 건강을 챙기는 마음을 가장 직관적으로 전달합니다."',
    gourmet:       '"PREMIUM 패키지는 프리미엄 명절 선물 컬렉션의 한우·과일 세트와 보양식 큐레이션의 조합으로, \"받는 즉시 가족과 함께 즐기는\" 실질적 기쁨을 설계했습니다."',
    practical:     '"PREMIUM 패키지는 프리미엄 명절 선물 컬렉션의 실속 세트와 보양식 큐레이션의 조합으로, 임직원 누구나 부담 없이 받을 수 있는 실용 선물을 구성했습니다."',
    default:       '"PREMIUM 패키지는 프리미엄 명절 선물 컬렉션과 이런 선물은 어떠신가요 큐레이션을 기반으로, 취향을 가리지 않는 범용 프리미엄 구성입니다."'
  };
  setTxt('curator-text', comments[key] || comments.default);

  window._curResult = { p:p, q:q, total:tot, disc:da };

  /* 품의서 필드 자동 동기화 (상담 신청 폼에서 입력한 값 복사) */
  function syncRpt(rptId, srcId) {
    var rpt = $(rptId), src = $(srcId);
    if (rpt && src && src.value && !rpt.value) rpt.value = src.value;
  }
  syncRpt('rpt-company', 'cm-co');
  syncRpt('rpt-dept',    'cm-dept');
  syncRpt('rpt-name',    'cm-nm');
  // 상담 신청 폼 oninput → 품의서 자동 반영 (한 번만 바인딩)
  if (!window._rptSynced) {
    window._rptSynced = true;
    [['cm-co','rpt-company'],['cm-dept','rpt-dept'],['cm-nm','rpt-name']].forEach(function(pair){
      var src = $(pair[0]), rpt = $(pair[1]);
      if (src && rpt) src.addEventListener('input', function(){ if (!rpt._userEdited) rpt.value = src.value; });
      if (rpt) rpt.addEventListener('input', function(){ rpt._userEdited = true; });
    });
  }

  /* 결과 섹션 표시 */
  var rs = $('result-section');
  if (rs) {
    rs.classList.add('visible');
    updateCmpBtn();
    setTimeout(function(){ rs.scrollIntoView({behavior:'smooth'}); }, 120);
    setTimeout(function(){ if($('canvas-front')) renderAllCanvases(); }, 280);
  }
  showToast('동탄점 입점 브랜드로 3가지 패키지 견적이 완성됐습니다');
}

function wizRestart() {
  wState = { bizType:null, unitPrice:0, unitLabel:'', qty:0, b2b_purpose:[], b2b_target:null, b2b_value:[], b2b_cat:[], b2b_custom:[], b2b_comp:[], b2e_purpose:[], b2e_target:null, b2e_mood:[], b2e_extra:[] };
  document.querySelectorAll('#wizard .chip.sel,#wizard .tc.sel,#wizard .type-card.sel,#wizard .bc.sel,#wizard .bud-card.sel').forEach(function(e){ e.classList.remove('sel'); });
  ['gift-tprev','b2e-tprev'].forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.remove('show'); });
  var rs = document.getElementById('result-section');
  if (rs) rs.classList.remove('visible');
  var cs = document.getElementById('compare-section');
  if (cs) cs.classList.remove('visible');
  gp('wp-0', 0);
  showToast('처음부터 다시 시작합니다');
}

/* 비교 저장 */
var savedResults = [];
function updateCmpBtn() {
  var b = document.getElementById('btn-cmp');
  if (b) b.textContent = '비교 보기 ('+savedResults.length+'/3)';
}
function addToCompare() {
  if (!window._curResult) { showToast('먼저 큐레이션 결과를 생성해 주세요'); return; }
  if (savedResults.length >= 3) { showToast('최대 3개까지 저장 가능합니다'); return; }
  savedResults.push({ pkgs: window._genPkgs||[], total:window._curResult.total, ts:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) });
  updateCmpBtn(); renderCmpGrid();
  showToast('비교 목록에 추가됐습니다 ('+savedResults.length+'/3)');
  if (savedResults.length === 1) showToast('설문을 다시 진행해 다른 조건도 비교해보세요!');
}
function saveResult() { addToCompare(); }
function toggleCompare() {
  var s = document.getElementById('compare-section');
  if (!savedResults.length) { showToast('비교 목록에 먼저 결과를 추가해 주세요'); return; }
  if (!s) return;
  s.classList.toggle('visible');
  if (s.classList.contains('visible')) {
    renderCmpGrid();
    s.scrollIntoView({behavior:'smooth'});
    var ca = document.getElementById('cmp-actions');
    if (ca) ca.style.display = 'flex';
  }
}
function renderCmpGrid() {
  var el = document.getElementById('cmp-grid'); if (!el) return;
  var html = '';
  for (var i = 0; i < 3; i++) {
    if (i < savedResults.length) {
      var r = savedResults[i];
      html += '<div class="cmp-col">'+
        '<div class="cmp-col-top"><span class="cmp-num">#'+(i+1)+' · '+r.ts+'</span><button class="cmp-del" onclick="delCmp('+i+')">✕</button></div>'+
        '<div class="cmp-title">동탄점 큐레이션 #'+(i+1)+'</div>'+
        '<div class="cmp-story" style="font-size:12px;color:#888;margin-bottom:10px">총액 '+fmt(r.total)+'</div>'+
        '<div class="cmp-prods">'+(r.pkgs||[]).map(function(p){
          var tot=Math.round(p.price*p.qty*(1-p.disc));
          return '<div class="cmp-prod"><span class="cmp-pname">'+p.tier+'</span><span class="cmp-pprice">'+fmt(tot)+'</span></div>';
        }).join('')+'</div></div>';
    } else {
      html += '<div class="cmp-empty">빈 슬롯 — 결과를 저장해 주세요</div>';
    }
  }
  el.innerHTML = html;
}
function delCmp(idx) { savedResults.splice(idx,1); updateCmpBtn(); renderCmpGrid(); showToast('삭제됐습니다'); }

/* ══════════════════════════════════════════════════
   단체복 위저드
   ══════════════════════════════════════════════════ */
function ugp(id, dot) {
  document.querySelectorAll('#uni-wiz .wpanel, #uniform-wiz .wpanel').forEach(function(p){ p.classList.remove('active'); });
  var el = document.getElementById(id); if (el) el.classList.add('active');
  updDots(dot, 'ud', 'uf', 4);
  var w = document.getElementById('uni-wiz') || document.getElementById('uniform-wiz');
  if (w) w.scrollIntoView({ behavior:'smooth', block:'start' });
}
function sUType(el, type) {
  document.querySelectorAll('#uni-wiz .type-card, #uni-wiz .tc, #uniform-wiz .type-card, #uniform-wiz .tc').forEach(function(c){ c.classList.remove('sel'); });
  el.classList.add('sel');
  uState.uniType = type;
}
function uStep1() {
  if (!uState.uniType) { showToast('단체복 유형을 선택해 주세요'); return; }
  ugp('up-1', 1);
}
function tUChip(el, cat, val) {
  el.classList.toggle('sel');
  if (!uState[cat]) uState[cat] = [];
  var a = uState[cat], i = a.indexOf(val);
  if (i === -1) a.push(val); else a.splice(i, 1);
}
function sUChip(el, cat, val) {
  var panel = el.closest('.wpanel');
  panel.querySelectorAll('.chip').forEach(function(c){
    if ((c.getAttribute('onclick')||'').indexOf("'"+cat+"'") !== -1) c.classList.remove('sel');
  });
  el.classList.add('sel');
  uState[cat] = val;
}
function sUBud(el, price) {
  el.closest('.wpanel').querySelectorAll('.bc, .bud-card').forEach(function(c){ c.classList.remove('sel'); });
  el.classList.add('sel');
  uState.unitPrice = parseInt(price);
  calcUniTot();
}
function calcUniTot() {
  var p = uState.unitPrice;
  var qEl = document.getElementById('uni-qty');
  var q = qEl ? (parseInt(qEl.value)||0) : 0;
  uState.qty = q;
  if (!p || !q) return;
  var d = getDisc(q), sub = p*q, da = sub*d, tot = sub - da;
  var setEl = function(id, txt){ var e=document.getElementById(id); if(e) e.textContent=txt; };
  var prev = document.getElementById('uni-tprev');
  if (prev) prev.classList.add('show');
  setEl('utp-u', fmt(p)+'/벌');
  setEl('utp-d', d>0 ? '-'+fmt(da)+' ('+Math.round(d*100)+'% 할인)' : '해당 없음');
  setEl('utp-t', fmt(tot));
  setEl('uf-q', q+'벌');
  setEl('uf-d', d>0 ? '-'+fmt(da) : '-');
  setEl('uf-t', fmt(tot));
}

/* 단체복 브랜드 데이터 */
var brDb = {
  sports: [
    {name:'Nike',          desc:'글로벌 1위. 드라이핏 기능성 소재, 팀 유니폼 라인업 풍부.',  tags:['드라이핏','흡습속건','팀 유니폼']},
    {name:'The North Face',desc:'아웃도어 명가. 등산·캠핑 동호회용 기능성 재킷 특화.',     tags:['아웃도어','방풍·방수','내구성']},
    {name:'K2',            desc:'국내 대표 아웃도어. 기업·동호회 커스텀 납품 경험 풍부.',   tags:['국내 브랜드','가성비','커스텀']},
    {name:'Jeep',          desc:'캐주얼 아웃도어 감성. 동호회·소모임 단체티로 인기.',       tags:['캐주얼','라이프스타일','소량 가능']},
    {name:'adidas',        desc:'트레포일 아이콘. 스포츠~스트리트 폭넓은 팀 유니폼.',       tags:['클라이마쿨','팀 유니폼','글로벌']},
    {name:'Puma',          desc:'유럽 감성 스포츠. 축구·러닝 동호회 퍼포먼스 특화.',        tags:['퍼포먼스','축구·러닝','유럽 감성']}
  ],
  corporate: [
    {name:'코오롱FnC',     desc:'프리미엄 기능성 소재 기업 유니폼. 브랜드 이미지 강화.',    tags:['프리미엄','기능성','B2B 전문']},
    {name:'Workway',       desc:'기업 유니폼 전문. 방오·방수 옵션, 로고 자수 다양.',        tags:['방오·방수','로고 자수','기업 맞춤']},
    {name:'신성통상',      desc:'탑텐 모기업. 대량 주문 원가 절감, 납기 안정.',             tags:['원가 절감','대량 주문','납기 안정']},
    {name:'패션그룹형지',  desc:'기업 유니폼·작업복 OEM. 빠른 납기 강점.',                 tags:['OEM','빠른 납기','대기업 경험']},
    {name:'형지어패럴',    desc:'관공서·기업 유니폼 납품 다수. 규격 사이즈 완비.',          tags:['관공서 납품','규격 사이즈','안정적']},
    {name:'딜라이트룸',    desc:'산업용 작업복 특화. 제조·물류 기업 대량 납품 경험.',       tags:['산업용','대량 납품','세금계산서']}
  ],
  casual: [
    {name:'무신사스탠다드',desc:'국내 MZ 대표 캐주얼. 소량(10벌~) 가능, 트렌디 디자인.',   tags:['트렌디','소량 가능','MZ세대']},
    {name:'Champion',      desc:'빈티지 캠퍼스 무드. 동호회·동문회 후디 인기.',             tags:['레트로','캠퍼스 무드','후디']},
    {name:'Dickies',       desc:'미국 워크웨어 레전드. 동호회 레트로 감성 단체복.',         tags:['워크웨어','레트로','스트리트']},
    {name:'MLB',           desc:'야구 캐주얼 대표. 단체 모자+티셔츠 세트 인기.',            tags:['야구 감성','캐주얼','모자 세트']},
    {name:'Carhartt',      desc:'아웃도어·공업계 동호회 재킷. 강력한 내구성.',              tags:['워크웨어','내구성','아웃도어']},
    {name:'Hanes',         desc:'미국 베이직 티셔츠 대명사. 소량~대량 모두 가능.',           tags:['베이직','합리적 가격','학교 행사']}
  ],
  event: [
    {name:'Gildan',        desc:'캐나다 대량 생산 전문. 행사 단체티 표준, 낮은 단가.',      tags:['대량 생산','저단가','빠른 납기']},
    {name:'Fruit of the Loom',desc:'미국 기본 티셔츠 대명사. 행사 스태프복 가성비 최고.', tags:['가성비','면 100%','행사 스태프']},
    {name:'무신사스탠다드',desc:'MZ 친숙 브랜드. 기업·행사 단체 패키지 주문 가능.',        tags:['MZ세대','트렌디','브랜드 인지도']},
    {name:'Champion',      desc:'레트로 캠퍼스 감성. 행사 단체티 차별화.',                  tags:['레트로','빈티지','행사 특화']},
    {name:'스탠스미스',    desc:'국내 이벤트 전문업체. 24시간 긴급 제작, 소량 특화.',       tags:['긴급 제작','당일 배송','소량 가능']},
    {name:'H&M Business',  desc:'글로벌 패스트패션 비즈니스 라인. 대규모 스태프복.',        tags:['글로벌','합리적 가격','대량 주문']}
  ],
  school: [
    {name:'Champion',      desc:'아이비리그 공식 납품. 학교 단체복·동문회 후디 정통.',      tags:['캠퍼스 정통','후디','아이비리그']},
    {name:'Russell Athletic',desc:'미국 대학 스포츠 의류 강자. 체육복·응원복 특화.',      tags:['대학 스포츠','체육복','내구성']},
    {name:'Hanes',         desc:'졸업·체육대회 단체티. 소량~대량 모두 가능.',               tags:['졸업·MT','합리적','소량 가능']},
    {name:'무신사스탠다드',desc:'동아리·동문 개성 있는 단체티로 차별화.',                  tags:['동아리','개성','스트리트']},
    {name:'프로스펙스',    desc:'국내 학생 스포츠 브랜드. 체육복·운동복 신뢰도 1위.',      tags:['국내','학교 체육복','가성비']},
    {name:'Jansport',      desc:'학생 브랜드. 졸업 여행·MT 재킷+가방 패키지 인기.',        tags:['MT·졸업여행','패키지','친숙함']}
  ],
  running: [
    {name:'Nike Running',  desc:'드라이핏 러닝 전문. 장거리 러닝크루 단체복 최적.',        tags:['드라이핏','러닝 전문','쿨링']},
    {name:'New Balance',   desc:'러닝 명가. NB 트레이닝 의류, 러닝크루 인기.',             tags:['러닝 명가','트레이닝','미국 감성']},
    {name:'2XU',           desc:'컴프레션 기어 전문. 마라톤·트라이애슬론 팀 유니폼.',      tags:['컴프레션','마라톤','고성능']},
    {name:'Asics',         desc:'일본 러닝 브랜드. 마라톤 대회 참가복으로 인기.',           tags:['일본 브랜드','마라톤','퍼포먼스']},
    {name:'Under Armour',  desc:'HeatGear 피팅 기술. 농구·축구 팀 트레이닝 유니폼.',      tags:['HeatGear','팀 스포츠','미국 브랜드']},
    {name:'Salomon',       desc:'산악 러닝 트레일 전문. 트레일러닝 단체 재킷.',             tags:['트레일런','산악 러닝','기능성 재킷']}
  ]
};

function getBrandCategory() {
  var type = uState.uniType;
  if (type === 'corporate') return 'corporate';
  var marks = (uState.uni_mark||[]).join(' ');
  var types = (uState.uni_type||[]).join(' ');
  var extras = (uState.uni_extra||[]).join(' ');
  if (extras.indexOf('긴급') !== -1) return 'event';
  if (types.indexOf('바람막이') !== -1 || marks.indexOf('자수') !== -1) return 'sports';
  if (types.indexOf('후드') !== -1 || types.indexOf('맨투맨') !== -1) return 'school';
  return 'casual';
}

function renderBrands() {
  var cat = getBrandCategory();
  var list = brDb[cat] || brDb.casual;
  var catNames = {
    corporate:'기업 작업복 · 유니폼 추천 브랜드',
    sports:'스포츠 동호회 추천 브랜드',
    event:'행사 · 스태프복 추천 브랜드',
    casual:'캐주얼 · 소모임 단체복 추천 브랜드',
    school:'학교 · 동문회 단체복 추천 브랜드',
    running:'러닝 · 마라톤 동호회 추천 브랜드'
  };
  /* 브랜드 추천 레이블 */
  var lbl = document.querySelector('.br-rl');
  if (lbl) lbl.textContent = catNames[cat]||'추천 브랜드';

  /* 카드 렌더 — brand-cards-wrap 또는 br-cards 모두 지원 */
  var wrap = document.getElementById('brand-cards-wrap') || document.getElementById('br-cards');
  if (wrap) {
    wrap.innerHTML = list.map(function(b){
      return '<div class="br-card">' +
        '<div class="br-n">'+b.name+'</div>' +
        '<div class="br-d">'+b.desc+'</div>' +
        '<div class="br-tags">'+b.tags.map(function(t){ return '<span class="br-tag">'+t+'</span>'; }).join('')+'</div>' +
      '</div>';
    }).join('');
  }

  var noteMap = {
    corporate:'※ 상담 신청 시 브랜드별 실제 견적을 안내해 드립니다.',
    sports:'※ 스포츠 동호회는 흡습속건 소재와 팀 컬러 매칭이 핵심입니다.',
    event:'※ 행사 스태프복은 납기 일정이 가장 중요합니다. 긴급 제작(3~5일) 시 단가 20~30% 추가.',
    casual:'※ 소모임·캐주얼 단체복은 10벌 소량부터 제작 가능합니다.',
    school:'※ 학교·동문회 단체복은 기수 인쇄, 학교 로고 자수가 핵심입니다.',
    running:'※ 러닝 단체복은 흡습속건·통기성 소재 필수. 대회 4주 전 주문 권장.'
  };
  var note = document.getElementById('br-note') || document.getElementById('brand-note');
  if (note) note.textContent = noteMap[cat]||noteMap.casual;

  var ub = document.getElementById('uni-brands');
  if (ub) ub.classList.add('show');
}

function submitUni() {
  var p = uState.unitPrice, q = uState.qty;
  if (!p) { showToast('예산을 선택해 주세요'); return; }
  if (!q || q < 10) { showToast('수량을 10벌 이상 입력해 주세요'); return; }
  var d = getDisc(q), sub = p*q, da = Math.round(sub*d), tot = sub - da;
  var $ = function(id){ return document.getElementById(id); };
  var setT = function(id,v){ var e=$(id); if(e) e.textContent=v||'—'; };
  /* 결과 카드 채우기 */
  var typeLabel = uState.uniType==='corporate'?'기업 작업복·유니폼':'동호회·단체·행사복';
  setT('uri-type', typeLabel);
  setT('uri-cloth', (uState.uni_type||[]).join(', ') || '—');
  setT('uri-fabric', uState.uni_fabric || '—');
  setT('uri-mark', (uState.uni_mark||[]).join(', ') || '—');
  setT('uri-extra', (uState.uni_extra||[]).join(', ') || '없음');
  setT('uf-unit', '₩'+p.toLocaleString()+'/벌');
  setT('uf-qty', q+'벌');
  setT('uri-sub', '₩'+sub.toLocaleString());
  setT('uf-disc', d>0 ? '-₩'+da.toLocaleString()+' ('+Math.round(d*100)+'% 할인)' : '해당 없음');
  setT('uf-total', '₩'+tot.toLocaleString());
  var dn = $(  'uri-disc-note'); if(dn) dn.textContent = d>0 ? '대량 할인 '+Math.round(d*100)+'% 적용' : '';
  var tb = $('uri-type-badge'); if(tb) tb.textContent = typeLabel;
  /* 기존 호환 */
  calcUniTot();
  renderBrands();
  ugp('up-sum', 4);

  /* CRM 저장 */
  CRM.push({
    id:Date.now(), time:new Date().toLocaleString('ko-KR'),
    company:'', dept:'', contactName:'', phone:'', email:'', datetime:'', memo:'',
    bizType:'UNIFORM', purpose:'단체복 제작', target:uState.uniType||'',
    qty:q, unitPrice:p, total:tot, discountRate:Math.round(d*100)+'%',
    category:(uState.uni_type||[]).join(', '), status:'신규', adminMemo:''
  });
  localStorage.setItem('lotteCrm', JSON.stringify(CRM));
  showToast('단체복 견적이 완성됐습니다');
}

/* ══════════════════════════════════════════════════
   방문 예약 모달
   ══════════════════════════════════════════════════ */
function openVisitModal() {
  var pkgSel = document.getElementById('vm-pkg-sel');
  if (pkgSel) {
    if (_pkgs.length) {
      pkgSel.innerHTML = _pkgs.map(function(pk,i){
        return '<div class="vm-pkg-opt'+(i===_selPkg?' sel':'')+'" onclick="selVMPkg(this,'+i+')">'+
          '<div class="vm-pkg-ol">'+pk.tier+'</div>'+
          '<div class="vm-pkg-ov">'+fmt(pk.price)+'</div></div>';
      }).join('');
    } else {
      pkgSel.innerHTML = '<div style="font-size:12px;color:#aaa;padding:16px;grid-column:1/-1">패키지를 먼저 선택해 주세요</div>';
    }
  }
  var vf = document.getElementById('vm-form');   if(vf) vf.style.display='block';
  var vi = document.getElementById('vm-issued'); if(vi) vi.classList.remove('show');
  var ft = document.getElementById('vm-ft');     if(ft) ft.style.display='flex';
  var dateEl = document.getElementById('vm-date');
  if (dateEl && !dateEl.value) { var td=new Date(); td.setDate(td.getDate()+1); dateEl.value=td.toISOString().split('T')[0]; }
  var vm = document.getElementById('vm'); if(vm) vm.classList.add('open');
}
function selVMPkg(el, i) {
  document.querySelectorAll('.vm-pkg-opt').forEach(function(o){ o.classList.remove('sel'); });
  el.classList.add('sel'); _selPkg = i;
}
function closeVM() { var vm=document.getElementById('vm'); if(vm) vm.classList.remove('open'); }
function submitVisit() {
  var co = (document.getElementById('vm-company')||{}).value||'';
  var nm = (document.getElementById('vm-name')||{}).value||'';
  var ph = (document.getElementById('vm-phone')||{}).value||'';
  if (!co.trim()||!nm.trim()||!ph.trim()) { showToast('회사명, 담당자, 연락처는 필수입니다'); return; }
  var dt = (document.getElementById('vm-date')||{}).value||'';
  var tm = (document.getElementById('vm-time')||{}).value||'';
  var passNo = 'DT-B2B-'+Math.floor(100000+Math.random()*900000);
  visitData = { company:co, name:nm, phone:ph, date:dt, time:tm, passNo:passNo, pkgIdx:_selPkg };
  var el = document.getElementById('vm-pass-no'); if(el) el.textContent = passNo;
  var vf = document.getElementById('vm-form');   if(vf) vf.style.display='none';
  var vi = document.getElementById('vm-issued'); if(vi) vi.classList.add('show');
  var ft = document.getElementById('vm-ft');     if(ft) ft.style.display='none';
}

/* ══════════════════════════════════════════════════
   디지털 패스 / 워크스루
   ══════════════════════════════════════════════════ */
var storeDb = {
  '조 말론 런던': {floor:'2F',fbadge:'f2',zone:'Glam Space',time:'약 10분',next:'같은 층 샤넬/딥티크 카운터로 이동하세요'},
  '샤넬 뷰티':   {floor:'2F',fbadge:'f2',zone:'Glam Space',time:'약 8분', next:'2층 내 A.P.C. 복합매장으로 이동하세요'},
  '딥티크':      {floor:'2F',fbadge:'f2',zone:'Glam Space',time:'약 8분', next:'1층 럭셔리 부티크로 이동하세요'},
  '디올 뷰티':   {floor:'2F',fbadge:'f2',zone:'Glam Space',time:'약 8분', next:'2층 내 YSL 카운터로 이동하세요'},
  'YSL':         {floor:'2F',fbadge:'f2',zone:'Glam Space',time:'약 6분', next:'1층 꼼데가르송으로 이동하세요'},
  '비오템 옴므': {floor:'2F',fbadge:'f2',zone:'Glam Space',time:'약 6분', next:'2층 내 조 말론으로 이동하세요'},
  'A.P.C.':      {floor:'2F',fbadge:'f2',zone:'세계 최초 카페 복합',time:'약 10분',next:'3층 폴로 랄프로렌으로 이동하세요'},
  '꼼데가르송':  {floor:'1F',fbadge:'f1',zone:'1층 패션 잡화',time:'약 8분', next:'1층 몽블랑 부티크로 이동하세요'},
  '몽블랑':      {floor:'1F',fbadge:'f1',zone:'Luxury Boutique',time:'약 8분',next:'1층 VIP 컨시어지 데스크로 이동하세요'},
  '폴로 랄프로렌':{floor:'3F',fbadge:'f3',zone:'영패션',time:'약 10분',next:'2층 Glam Space로 이동하세요'},
  '비비안 웨스트우드':{floor:'2F',fbadge:'f2',zone:'패션 잡화',time:'약 8분',next:'2층 내 A.P.C.로 이동하세요'}
};
var floorOrder = {'3F':0,'2F':1,'1F':2,'B1F':3};

function buildStops(pkgIdx) {
  var pkg = _pkgs[pkgIdx] || _pkgs[1] || { items:[] };
  var found = {};
  (pkg.items||[]).forEach(function(it){
    Object.keys(storeDb).forEach(function(sname){
      if (it.n && it.n.indexOf(sname)!==-1 && !found[sname])
        found[sname] = { store:sname, item:it.n, desc:it.d, info:storeDb[sname] };
    });
  });
  var stops = Object.values(found).sort(function(a,b){
    return (floorOrder[a.info.floor]||99) - (floorOrder[b.info.floor]||99);
  });
  if (stops.length === 0) {
    stops.push({ store:'2층 Glam Space', item:'뷰티·향수 큐레이션', desc:'조 말론·샤넬·딥티크 브랜드 탐방', info:{floor:'2F',fbadge:'f2',zone:'Glam Space',time:'약 30분',next:'1층 럭셔리 부티크로 이동하세요'} });
    stops.push({ store:'1층 럭셔리 부티크', item:'패션 잡화 큐레이션', desc:'꼼데가르송·몽블랑', info:{floor:'1F',fbadge:'f1',zone:'Luxury Boutique',time:'약 20분',next:'VIP 컨시어지 데스크로 이동하세요'} });
  }
  stops.push({ store:'VIP 컨시어지 데스크', item:'최종 상담 및 주문 확정', desc:'전담 컨시어지와 최종 패키지 확인 및 발주', info:{floor:'1F',fbadge:'f1',zone:'VIP 서비스존',time:'',next:''} });
  return stops;
}

function renderQR(svgEl) {
  var pat=[[1,1,1,1,1,1,1,0,1,0,0,1,0,0,1,1,1,1,1,1,1],[1,0,0,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0,0,0,1],[1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],[1,0,1,1,1,0,1,0,0,0,0,1,1,0,1,0,1,1,1,0,1],[1,0,0,0,0,0,1,0,1,1,0,0,1,0,1,0,0,0,0,0,1],[1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0],[1,0,1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,0,1,1,1],[0,1,1,0,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0],[0,0,1,0,0,1,1,0,1,0,0,0,1,1,0,0,1,1,0,0,1],[1,1,0,0,1,0,0,0,0,1,1,0,0,1,1,0,0,1,0,1,1],[0,1,0,1,0,1,1,0,1,1,0,0,1,0,0,1,1,0,1,0,1],[1,0,1,0,0,0,0,1,0,0,1,1,0,0,1,0,0,1,1,0,0],[0,0,0,0,0,0,0,0,1,1,0,1,1,0,1,0,1,1,0,1,1],[1,1,1,1,1,1,1,0,0,0,1,1,0,0,1,0,0,0,1,0,0],[1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1,0,0,0,1,1],[1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,1,1,0,0,1,0],[1,0,1,1,1,0,1,1,1,0,1,1,0,1,0,0,1,0,1,1,0],[1,0,0,0,0,0,1,0,0,1,0,0,1,0,0,1,0,1,1,0,1],[1,1,1,1,1,1,1,0,1,0,0,1,1,0,1,1,0,0,0,1,0]];
  var cell=5, html='<rect width="110" height="110" fill="white"/>';
  pat.forEach(function(row,r){ row.forEach(function(v,col){ if(v) html+='<rect x="'+(3+col*cell)+'" y="'+(3+r*cell)+'" width="'+cell+'" height="'+cell+'" fill="#111"/>'; }); });
  svgEl.innerHTML = html;
}

function renderFloorMap(stops) {
  var svg = document.getElementById('dp-map-svg'); if(!svg) return;
  var floors = [{id:'3F',y:12,h:38,lbl:'3F'},{id:'2F',y:52,h:38,lbl:'2F'},{id:'1F',y:92,h:38,lbl:'1F'},{id:'B1F',y:132,h:38,lbl:'B1F'}];
  var storePos = {'2F-조 말론 런던':{x:160},'2F-샤넬 뷰티':{x:200},'2F-딥티크':{x:240},'2F-디올 뷰티':{x:280},'2F-YSL':{x:320},'2F-비오템 옴므':{x:360},'2F-A.P.C.':{x:400},'2F-비비안 웨스트우드':{x:440},'1F-꼼데가르송':{x:200},'1F-몽블랑':{x:280},'1F-VIP 컨시어지 데스크':{x:380},'3F-폴로 랄프로렌':{x:260},'2층 Glam Space':{x:300},'1층 럭셔리 부티크':{x:300}};
  var done = dpDone.length;
  var html = '';
  floors.forEach(function(fl){
    var isAct = stops.some(function(s){ return s.info.floor===fl.id; });
    html += '<rect x="50" y="'+fl.y+'" width="510" height="'+fl.h+'" rx="3" fill="'+(isAct?'#f9f9f9':'#fafafa')+'" stroke="#e8e8e8" stroke-width="0.75"/>';
    html += '<text x="18" y="'+(fl.y+fl.h/2+4)+'" fill="#bbb" font-size="10" font-family="sans-serif" text-anchor="middle">'+fl.lbl+'</text>';
    if (isAct) html += '<rect x="50" y="'+fl.y+'" width="3" height="'+fl.h+'" fill="#ddd" rx="1.5"/>';
  });
  var pts = [];
  stops.forEach(function(st,idx){
    var key = st.info.floor+'-'+st.store;
    var pos = storePos[key] || storePos[st.store] || {x:80+idx*55};
    var fd  = floors.find(function(f){ return f.id===st.info.floor; });
    if (fd) pts.push({x:pos.x, y:fd.y+fd.h/2, idx:idx});
  });
  if (pts.length>1) {
    var path = 'M'+pts[0].x+','+pts[0].y;
    for (var i=1;i<pts.length;i++) path+=' L'+pts[i].x+','+pts[i].y;
    html += '<path d="'+path+'" fill="none" stroke="#ddd" stroke-width="1.5" stroke-dasharray="4,3"/>';
    if (done>0) {
      var donePath = 'M'+pts[0].x+','+pts[0].y;
      for (var i=1;i<=Math.min(done,pts.length-1);i++) donePath+=' L'+pts[i].x+','+pts[i].y;
      html += '<path d="'+donePath+'" fill="none" stroke="#111" stroke-width="1.5"/>';
    }
  }
  pts.forEach(function(pt,idx){
    var dn=dpDone.indexOf(idx)!==-1, curr=idx===done;
    html += '<circle cx="'+pt.x+'" cy="'+pt.y+'" r="11" fill="'+(dn?'#111':'#fff')+'" stroke="'+(dn||curr?'#111':'#ddd')+'" stroke-width="'+(curr?'2':'1.5')+'"/>';
    html += '<text x="'+pt.x+'" y="'+(pt.y+4)+'" fill="'+(dn?'#fff':curr?'#111':'#bbb')+'" font-size="9" font-family="sans-serif" font-weight="700" text-anchor="middle">'+(dn?'✓':(idx+1))+'</text>';
    if (curr) html += '<circle cx="'+pt.x+'" cy="'+pt.y+'" r="15" fill="none" stroke="#111" stroke-width="0.75" opacity="0.3"/>';
  });
  svg.innerHTML = html;
}

function renderWalkList() {
  var list = document.getElementById('dp-walk-list'); if(!list) return;
  var total=dpStops.length, doneCount=dpDone.length;
  var pct = total>0 ? Math.round(doneCount/total*100) : 0;
  var setEl = function(id,txt){ var e=document.getElementById(id); if(e) e.textContent=txt; };
  var pf = document.getElementById('dp-prg-fill'); if(pf) pf.style.width=pct+'%';
  setEl('dp-prg-n', doneCount);
  var pill = document.getElementById('dp-prog-pill');
  if (pill) { pill.textContent=doneCount+' / '+total+' 완료'; pill.classList.toggle('done',doneCount===total&&total>0); }
  var dots = document.getElementById('dp-prg-dots');
  if (dots) dots.innerHTML = dpStops.map(function(s,i){ return '<div class="dp-prg-dot'+(dpDone.indexOf(i)!==-1?' done':'')+'" title="'+(i+1)+'. '+s.store+'"></div>'; }).join('');
  var nextStop = dpStops[doneCount];
  setEl('dp-prg-hint', nextStop?'다음: '+nextStop.store:'모두 완료');
  list.innerHTML = dpStops.map(function(st,i){
    var done=dpDone.indexOf(i)!==-1, curr=i===doneCount, isLast=i===dpStops.length-1;
    return '<div class="dp-stop">'+
      '<div class="dp-stop-col">'+
        '<div class="dp-stop-num'+(done?' done':curr?' curr':'')+'">'+(done?'✓':(i+1))+'</div>'+
        (!isLast?'<div class="dp-stop-line-w"><div class="dp-stop-line'+(done?' done':'')+'"></div></div>':'')+
      '</div>'+
      '<div class="dp-stop-body">'+
        '<div class="dp-stop-card'+(done?' done':curr?' curr':'')+'">'+
          '<div class="dp-frow"><span class="dp-fb '+st.info.fbadge+'">'+st.info.floor+'</span><span class="dp-fzone">'+st.info.zone+'</span></div>'+
          '<div class="dp-stor">'+esc(st.store)+'</div>'+
          '<div class="dp-itm-txt">'+esc(st.item)+' <span style="color:#bbb">— '+esc(st.desc)+'</span></div>'+
          '<div class="dp-stop-meta">'+
            (st.info.time?'<span class="dp-time">예상 소요 '+st.info.time+'</span>':'<span></span>')+
            (done?'<span class="dp-done-tag">확인 완료 ✓</span>':'<button class="dp-chk-btn'+(curr?' curr-b':'')+'" onclick="checkStop('+i+')">'+(curr?'확인 완료 체크':'이전 단계 먼저 완료하세요')+'</button>')+
          '</div>'+
          ((!done&&st.info.next)?'<div class="dp-trans"><span class="dp-trans-ic">→</span>'+esc(st.info.next)+'</div>':'')+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
  var ds = document.getElementById('dp-done-sec');
  if (ds) {
    if (doneCount===total&&total>0) { ds.classList.add('show'); ds.scrollIntoView({behavior:'smooth',block:'nearest'}); }
    else ds.classList.remove('show');
  }
  renderFloorMap(dpStops);
}

function checkStop(i) {
  if (i !== dpDone.length) { showToast('앞 매장을 먼저 체크해 주세요'); return; }
  dpDone.push(i);
  showToast((i+1)+'. '+dpStops[i].store+' 확인 완료 ✓');
  renderWalkList();
}

function openDP() {
  _pkgs = window._genPkgs || _pkgs || [];
  dpStops = buildStops(_selPkg);
  dpDone  = [];
  var setEl = function(id,txt){ var e=document.getElementById(id); if(e) e.textContent=txt; };
  setEl('dpc-name',    visitData.name||'—');
  setEl('dpc-company', visitData.company||'—');
  setEl('dpc-pkg',     _pkgs[_selPkg]?_pkgs[_selPkg].tier:'—');
  setEl('dpc-date',    (visitData.date||'')+(visitData.time?' '+visitData.time:''));
  setEl('dpc-no',      visitData.passNo||'DT-B2B-DEMO');
  setEl('dp-visit-info', visitData.date?visitData.date+' '+visitData.time:'');
  setEl('dp-map-badge', '총 '+dpStops.length+'개 매장');
  var qrSvg = document.getElementById('dp-qr-svg'); if(qrSvg) renderQR(qrSvg);
  renderWalkList();
  var dp = document.getElementById('dp'); if(dp) dp.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDP() { var dp=document.getElementById('dp'); if(dp) dp.classList.remove('open'); document.body.style.overflow=''; }

/* ══════════════════════════════════════════════════
   컨시어지 상담 모달
   ══════════════════════════════════════════════════ */
function openSummerGift(name) {
  window._summerPickName = name;
  var csi = document.getElementById('sg-csi');
  if (csi) csi.innerHTML = '<div class="cm-cii"><strong>선택 상품</strong>'+name+'</div>';
  ['sg-budget','sg-qty'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  var sg = document.getElementById('sg'); if(sg) sg.classList.add('open');
}
function closeSG() { var sg=document.getElementById('sg'); if(sg) sg.classList.remove('open'); }
function sgNext(type) {
  var name = window._summerPickName || '';
  var b = (document.getElementById('sg-budget')||{}).value||'';
  var q = (document.getElementById('sg-qty')||{}).value||'';
  window._summerPick = { name: name, budget: b, qty: q };
  closeSG();
  var cs  = document.getElementById('cm-cs');
  var csi = document.getElementById('cm-csi');
  if (cs && csi) {
    csi.innerHTML = [
      {l:'선택 상품', v:name},
      {l:'총예산', v:b?fmt(Number(b))+'원':''},
      {l:'총수량', v:q?q+'개':''}
    ].filter(function(i){ return i.v; }).map(function(i){
      return '<div class="cm-cii"><strong>'+i.l+'</strong>'+i.v+'</div>';
    }).join('');
    cs.style.display = 'block';
  }
  openCM(type || 'consult');
}
function openCM(type) {
  window._cmType = type || 'consult'; // 'consult' or 'order'
  var cs  = document.getElementById('cm-cs');
  var csi = document.getElementById('cm-csi');
  if (window._summerPick) {
    // 큐레이터 픽에서 진입한 경우 — 위에서 채운 정보 유지
  } else if (wState.bizType && cs && csi) {
    var p=wState.unitPrice, q=wState.qty, tot=p&&q?fmt(p*q*(1-getDisc(q))):'';
    csi.innerHTML = [
      {l:'선택 패키지', v:window._selectedPkgName||''},
      {l:'유형', v:wState.bizType},
      {l:'목적', v:(wState.b2b_purpose||wState.b2e_purpose||[]).join(', ')},
      {l:'수량', v:q?(q+(wState.bizType==='B2B'?'개':'명')):''},
      {l:'예상총액', v:tot}
    ].filter(function(i){ return i.v; }).map(function(i){
      return '<div class="cm-cii"><strong>'+i.l+'</strong>'+i.v+'</div>';
    }).join('');
    cs.style.display = 'block';
  } else if (cs) { cs.style.display = 'none'; }
  if (visitData.company) { var e=document.getElementById('cm-co'); if(e) e.value=visitData.company; }
  if (visitData.name)    { var e=document.getElementById('cm-nm'); if(e) e.value=visitData.name; }
  if (visitData.phone)   { var e=document.getElementById('cm-ph'); if(e) e.value=visitData.phone; }
  var cm = document.getElementById('cm'); if(cm) cm.classList.add('open');
  // 모달 제목 & 버튼 텍스트 변경
  var hdt = cm ? cm.querySelector('.cm-hdt') : null;
  var submitBtn = document.getElementById('cm-submit-btn');
  if (window._cmType === 'order') {
    if (hdt) hdt.textContent = '온라인 주문 신청';
    if (submitBtn) submitBtn.textContent = '주문 신청하기';
  } else {
    if (hdt) hdt.textContent = '컨시어지 상담 신청';
    if (submitBtn) submitBtn.textContent = '상담 신청하기';
  }
}
function closeCM() { var cm=document.getElementById('cm'); if(cm) cm.classList.remove('open'); }
function submitCM() {
  var co = (document.getElementById('cm-co')||{}).value||'';
  var nm = (document.getElementById('cm-nm')||{}).value||'';
  var ph = (document.getElementById('cm-ph')||{}).value||'';
  if (!co.trim()||!nm.trim()||!ph.trim()) { showToast('회사명, 담당자 성함, 연락처는 필수입니다'); return; }
  var p=wState.unitPrice, q=wState.qty, d=getDisc(q), tot=p&&q?p*q*(1-d):0;
  var rec = {
    id:Date.now(), time:new Date().toLocaleString('ko-KR'),
    company:co.trim(),
    dept:   (document.getElementById('cm-dept')||{}).value||'',
    contactName:nm.trim(), phone:ph.trim(),
    email:  (document.getElementById('cm-em')||{}).value||'',
    datetime:(document.getElementById('cm-dt')||{}).value||'',
    memo:   (document.getElementById('cm-mo')||{}).value||'',
    selectedPackage:window._selectedPkgName||'',
    bizType:wState.bizType||'B2B', purpose:(wState.b2b_purpose||wState.b2e_purpose||[]).join(', '),
    target:wState.b2b_target||wState.b2e_target||'',
    qty:q||0, unitPrice:p||0, total:tot, discountRate:Math.round(d*100)+'%',
    category:(wState.b2b_cat||wState.b2e_mood||[]).join(', '),
    status: window._cmType==='order' ? '주문접수' : '신규', adminMemo:''
  };
  if (window._summerPick) {
    var sp = window._summerPick;
    if (!rec.selectedPackage) rec.selectedPackage = sp.name;
    rec.memo = '[얼리썸머 픽: '+sp.name+', 총예산:'+(sp.budget?fmt(Number(sp.budget))+'원':'-')+', 총수량:'+(sp.qty?sp.qty+'개':'-')+'] ' + rec.memo;
    window._summerPick = null;
  }
  CRM.push(rec);
  localStorage.setItem('lotteCrm', JSON.stringify(CRM));
  // 품의서 필드에 값 자동 복사 (사용자가 직접 수정하지 않은 경우에만)
  var rptMap = [['cm-co','rpt-company'],['cm-dept','rpt-dept'],['cm-nm','rpt-name']];
  rptMap.forEach(function(pair){
    var src=document.getElementById(pair[0]), rpt=document.getElementById(pair[1]);
    if (src && rpt && src.value && !rpt._userEdited) rpt.value = src.value;
  });
  closeCM();
  ['cm-co','cm-dept','cm-nm','cm-ph','cm-em','cm-dt','cm-mo'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  var msg = window._cmType==='order' ? '주문 신청이 완료됐습니다. 24시간 내 확인 후 연락드립니다.' : '상담 신청이 완료됐습니다. 24시간 내 연락드립니다.';
  showToast(msg);
}

/* ══════════════════════════════════════════════════
   비교 섹션 CTA — 기존 데이터로 즉시 처리
   ══════════════════════════════════════════════════ */
function cmpQuickConsult() {
  var p = wState.unitPrice, q = wState.qty;
  var d = p && q ? getDisc(q) : 0;
  var tot = p && q ? Math.round(p * q * (1 - d)) : 0;
  var co = (document.getElementById('cm-co')||{}).value ||
           (document.getElementById('rpt-company')||{}).value || '';
  var nm = (document.getElementById('cm-nm')||{}).value ||
           (document.getElementById('rpt-name')||{}).value || '';
  var ph = (document.getElementById('cm-ph')||{}).value || '';
  if (!co || !nm) {
    // 데이터 없으면 상담 모달 오픈
    window._cmType = 'consult';
    openCM();
    return;
  }
  var rec = {
    id: Date.now(), time: new Date().toLocaleString('ko-KR'),
    company: co,
    dept: (document.getElementById('cm-dept')||{}).value || (document.getElementById('rpt-dept')||{}).value || '',
    contactName: nm, phone: ph,
    email: (document.getElementById('cm-em')||{}).value || '',
    selectedPackage: window._selectedPkgName || '',
    bizType: wState.bizType || 'B2B',
    purpose: (wState.b2b_purpose || wState.b2e_purpose || []).join(', '),
    target: wState.b2b_target || wState.b2e_target || '',
    qty: q || 0, unitPrice: p || 0, total: tot,
    discountRate: Math.round(d * 100) + '%',
    category: (wState.b2b_cat || wState.b2e_mood || []).join(', '),
    status: '신규', adminMemo: ''
  };
  CRM.push(rec);
  localStorage.setItem('lotteCrm', JSON.stringify(CRM));
  showToast('상담 신청이 완료됐습니다. 24시간 내 연락드립니다.');
}

function cmpQuickOrder() {
  var p = wState.unitPrice, q = wState.qty;
  var d = p && q ? getDisc(q) : 0;
  var co = (document.getElementById('cm-co')||{}).value ||
           (document.getElementById('rpt-company')||{}).value || '';
  var orderData = {
    packageName: window._selectedPkgName || '맞춤 선물 패키지',
    bizType: wState.bizType || 'B2B',
    purpose: (wState.b2b_purpose || wState.b2e_purpose || []).join(', '),
    qty: q || 0,
    unitPrice: p || 0,
    discountRate: Math.round(d * 100),
    company: co,
    dept: (document.getElementById('cm-dept')||{}).value || (document.getElementById('rpt-dept')||{}).value || '',
    name: (document.getElementById('cm-nm')||{}).value || (document.getElementById('rpt-name')||{}).value || '',
    phone: (document.getElementById('cm-ph')||{}).value || '',
    email: (document.getElementById('cm-em')||{}).value || ''
  };
  localStorage.setItem('lotteOrderData', JSON.stringify(orderData));
  window.location.href = 'order.html';
}

function openAdmin() {
  document.getElementById('ap').classList.add('open');
  var ls=document.getElementById('ap-ls'), sh=document.getElementById('ap-sh');
  if(ls) ls.style.display='flex';
  if(sh) sh.classList.remove('open');
  var pw=document.getElementById('ap-pw'); if(pw) pw.value='';
  var err=document.getElementById('ap-err'); if(err) err.classList.remove('show');
}
function closeAdmin() { var ap=document.getElementById('ap'); if(ap) ap.classList.remove('open'); }
function apOut() {
  var ls=document.getElementById('ap-ls'), sh=document.getElementById('ap-sh');
  if(ls) ls.style.display='flex'; if(sh) sh.classList.remove('open');
  var pw=document.getElementById('ap-pw'); if(pw) pw.value='';
}
function apLogin() {
  var pw=document.getElementById('ap-pw');
  if (pw && pw.value==='0000') {
    var ls=document.getElementById('ap-ls'), sh=document.getElementById('ap-sh');
    if(ls) ls.style.display='none'; if(sh) sh.classList.add('open');
    var err=document.getElementById('ap-err'); if(err) err.classList.remove('show');
    loadCRM(); refreshAP(); startClk();
  } else {
    var err=document.getElementById('ap-err'); if(err) err.classList.add('show');
    var pw2=document.getElementById('ap-pw'); if(pw2) pw2.value='';
  }
}
function startClk() {
  function tick() {
    var el=document.getElementById('ap-clk');
    if(el) el.textContent=new Date().toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  tick(); setInterval(tick, 15000);
}
function apPage(pid, btn) {
  document.querySelectorAll('.ap-pg').forEach(function(p){ p.classList.remove('active'); });
  var el=document.getElementById(pid); if(el) el.classList.add('active');
  document.querySelectorAll('.ap-ni').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  refreshAP();
}
function refreshAP() {
  loadCRM();
  var bdg=document.getElementById('ap-badge'); if(bdg) bdg.textContent=CRM.length;
  var b2b=CRM.filter(function(d){ return d.bizType==='B2B'; }).length;
  var b2e=CRM.filter(function(d){ return d.bizType==='B2E'; }).length;
  var uni=CRM.filter(function(d){ return d.bizType==='UNIFORM'; }).length;
  var tot=CRM.reduce(function(s,d){ return s+(d.total||0); }, 0);
  var sg=document.getElementById('ap-sg');
  if (sg) sg.innerHTML =
    '<div class="ap-sc"><div class="ap-sv">'+CRM.length+'</div><div class="ap-sl">총 상담 신청</div></div>'+
    '<div class="ap-sc"><div class="ap-sv">'+b2b+'</div><div class="ap-sl">B2B 거래처</div></div>'+
    '<div class="ap-sc"><div class="ap-sv">'+b2e+'</div><div class="ap-sl">B2E 임직원</div></div>'+
    '<div class="ap-sc"><div class="ap-sv" style="font-size:18px">'+fmt(tot)+'</div><div class="ap-sl">누적 총액</div></div>';
  renderApDash(); renderApTable();
}
function renderApDash() {
  var tb=document.getElementById('ap-dash-tbody'); if(!tb) return;
  var rec=CRM.slice(-8).reverse();
  if (!rec.length) { tb.innerHTML='<tr class="er"><td colspan="7">아직 상담 신청 데이터가 없습니다</td></tr>'; return; }
  tb.innerHTML = rec.map(function(d,i){
    return '<tr onclick="openDD('+d.id+')" style="cursor:pointer">'+
      '<td>'+(CRM.length-i)+'</td>'+
      '<td style="font-size:11px;white-space:nowrap">'+esc(d.time.split(' ').slice(0,2).join(' '))+'</td>'+
      '<td><strong>'+esc(d.company||'—')+'</strong></td>'+
      '<td>'+esc(d.contactName||'—')+'</td>'+
      '<td><span class="tp '+(d.bizType==='B2B'?'b2b':d.bizType==='UNIFORM'?'uni':'b2e')+'">'+esc(d.bizType)+'</span></td>'+
      '<td>'+(d.selectedPackage||'—')+'</td>'+
      '<td>'+(d.total?fmt(d.total):'—')+'</td>'+
      '<td><span class="sp '+(d.status==='신규'?'new':d.status==='검토중'?'rev':d.status==='확정'?'con':'com')+'">'+esc(d.status)+'</span></td>'+
    '</tr>';
  }).join('');
}
function renderApTable() {
  var q=(document.getElementById('ap-search')||{}).value||'';
  var ft=(document.getElementById('ap-ft')||{}).value||'';
  var fs=(document.getElementById('ap-fs')||{}).value||'';
  var fl=CRM.filter(function(d){
    var mq=!q||(d.company||'').indexOf(q)!==-1||(d.contactName||'').indexOf(q)!==-1;
    return mq&&(!ft||d.bizType===ft)&&(!fs||d.status===fs);
  });
  var cnt=document.getElementById('ap-cnt'); if(cnt) cnt.textContent='('+fl.length+'건)';
  var tb=document.getElementById('ap-list-tbody'); if(!tb) return;
  if (!fl.length) { tb.innerHTML='<tr class="er"><td colspan="10">데이터가 없습니다</td></tr>'; return; }
  tb.innerHTML = fl.slice().reverse().map(function(d,i){
    return '<tr onclick="openDD('+d.id+')" style="cursor:pointer">'+
      '<td>'+(fl.length-i)+'</td>'+
      '<td style="font-size:11px;white-space:nowrap">'+esc(d.time.split(' ').slice(0,2).join(' '))+'</td>'+
      '<td><strong>'+esc(d.company||'—')+'</strong></td>'+
      '<td>'+esc(d.contactName||'—')+'</td>'+
      '<td>'+esc(d.phone||'—')+'</td>'+
      '<td><span class="tp '+(d.bizType==='B2B'?'b2b':d.bizType==='UNIFORM'?'uni':'b2e')+'">'+esc(d.bizType)+'</span></td>'+
      '<td>'+(d.selectedPackage||'—')+'</td>'+
      '<td>'+(d.qty||'—')+'</td>'+
      '<td>'+(d.total?fmt(d.total):'—')+'</td>'+
      '<td><span class="sp '+(d.status==='신규'?'new':d.status==='검토중'?'rev':d.status==='확정'?'con':'com')+'">'+esc(d.status)+'</span></td>'+
      '<td><button style="font-size:10px;background:#111;color:#fff;border:none;padding:4px 10px;font-family:inherit" onclick="event.stopPropagation();openDD('+d.id+')">상세</button></td>'+
    '</tr>';
  }).join('');
}
function openDD(id) {
  loadCRM();
  var d=CRM.find(function(r){ return r.id===id; }); if(!d) return;
  var dt=document.getElementById('dd-t'); if(dt) dt.textContent=esc(d.company||'상담 상세')+' 상세';
  var df=function(l,v){ return '<div class="dd-f"><span class="dd-fl">'+l+'</span><span class="dd-fv">'+(v||'—')+'</span></div>'; };
  var bd=document.getElementById('dd-bd'); if(!bd) return;
  bd.innerHTML =
    '<div class="dd-sec"><div class="dd-st">고객 정보</div>'+
      df('회사명',esc(d.company))+df('담당자',esc(d.contactName))+
      df('연락처','<a href="tel:'+esc(d.phone||'')+'" style="color:#111">'+esc(d.phone||'—')+'</a>')+
      df('이메일',esc(d.email))+df('희망일시',esc(d.datetime))+'</div>'+
    '<div class="dd-sec"><div class="dd-st">큐레이션</div>'+
      df('유형','<span class="tp '+(d.bizType==='B2B'?'b2b':d.bizType==='UNIFORM'?'uni':'b2e')+'">'+esc(d.bizType)+'</span>')+
      df('목적',esc(d.purpose))+df('대상',esc(d.target))+
      df('수량',(d.qty||'—')+'개')+df('단가',d.unitPrice?fmt(d.unitPrice):'—')+df('할인율',esc(d.discountRate))+
      '<div class="dd-totbox"><div style="font-size:10px;color:#555">예상 총 금액</div><div style="font-size:20px;font-weight:700;color:#fff;margin-top:2px">'+(d.total?fmt(d.total):'미입력')+'</div></div></div>'+
    '<div class="dd-sec"><div class="dd-st">상태</div>'+
      '<select class="dd-sel" onchange="updStatus('+id+',this.value)">'+
        ['신규','검토중','확정','완료'].map(function(s){ return '<option'+(d.status===s?' selected':'')+'>'+s+'</option>'; }).join('')+
      '</select></div>'+
    '<div class="dd-sec"><div class="dd-st">내부 메모</div>'+
      '<textarea class="dd-ta" id="ddta-'+id+'" placeholder="내부 메모를 입력하세요">'+esc(d.adminMemo||'')+'</textarea>'+
      '<button class="dd-save" onclick="saveMemo('+id+')">메모 저장</button></div>';
  var dd=document.getElementById('dd'); if(dd) dd.classList.add('open');
}
function closeDD() { var dd=document.getElementById('dd'); if(dd) dd.classList.remove('open'); }
function updStatus(id, st) {
  loadCRM();
  var d=CRM.find(function(r){ return r.id===id; }); if(!d) return;
  d.status=st; localStorage.setItem('lotteCrm',JSON.stringify(CRM));
  refreshAP(); showToast('상태: ['+st+']');
}
function saveMemo(id) {
  loadCRM();
  var d=CRM.find(function(r){ return r.id===id; }); if(!d) return;
  var el=document.getElementById('ddta-'+id);
  d.adminMemo=el?el.value:''; localStorage.setItem('lotteCrm',JSON.stringify(CRM));
  showToast('메모 저장됐습니다');
}
function exportCSV() {
  loadCRM();
  var rows=[['#','시각','회사명','담당자','연락처','이메일','유형','목적','수량','단가','총액','할인율','상태','메모']];
  CRM.forEach(function(d,i){ rows.push([i+1,d.time,d.company,d.contactName,d.phone,d.email,d.bizType,d.purpose,d.qty,d.unitPrice,d.total,d.discountRate,d.status,d.adminMemo]); });
  var csv=rows.map(function(r){ return r.map(function(v){ return '"'+(v||'').toString().replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download='lotte_dongtan_crm.csv'; a.click();
  showToast('CSV 다운로드 완료');
}

/* ══════════════════════════════════════════════════
   서비스 안내 탭
   ══════════════════════════════════════════════════ */
function switchGuideTab(btn, tabId) {
  document.querySelectorAll('.gtab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.guide-section').forEach(function(s){ s.classList.remove('active'); });
  btn.classList.add('active');
  var t=document.getElementById(tabId); if(t) t.classList.add('active');
  var g=document.getElementById('guide'); if(g) g.scrollIntoView({behavior:'smooth',block:'start'});
}
function submitGuideContact() {
  var email=(document.getElementById('guide-email')||{}).value||'';
  var topic=(document.getElementById('guide-topic')||{}).value||'';
  if (!email||email.indexOf('@')===-1) { showToast('올바른 이메일을 입력해 주세요'); return; }
  CRM.push({ id:Date.now(), time:new Date().toLocaleString('ko-KR'), company:email, dept:'', contactName:email, phone:'', email:email, datetime:'', memo:topic, bizType:'INQUIRY', purpose:topic||'서비스 안내 문의', target:email, qty:0, unitPrice:0, total:0, discountRate:'0%', category:topic, status:'신규', adminMemo:'' });
  localStorage.setItem('lotteCrm',JSON.stringify(CRM));
  showToast('상담 신청이 접수됐습니다. 24시간 내 연락드리겠습니다.');
  var el=document.getElementById('guide-email'); if(el) el.value='';
}

/* ══════════════════════════════════════════════════
   패키징 프리뷰
   ══════════════════════════════════════════════════ */
function drawBoxCanvas(canvasId, angle) {
  var canvas=document.getElementById(canvasId); if(!canvas) return;
  var ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  ctx.clearRect(0,0,w,h);
  var bg=previewState.color, isDark=(bg==='#1a1a1a');
  var textColor=isDark?'#fff':'#111', accentColor=isDark?'#C4AA8F':'#888';
  ctx.fillStyle='#f5f5f5'; ctx.fillRect(0,0,w,h);
  if (angle==='front') {
    var bx=w*.22,by=h*.18,bw=w*.56,bh=h*.62;
    ctx.shadowColor='rgba(0,0,0,.1)';ctx.shadowBlur=16;ctx.shadowOffsetY=5;
    ctx.fillStyle=bg;ctx.fillRect(bx,by,bw,bh);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle=isDark?'rgba(255,255,255,.12)':'#e0e0e0';ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh);
    if(previewState.ribbon!=='없음'){
      ctx.strokeStyle=previewState.ribbon==='새틴'?'#C4AA8F':'#8B4513';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(bx+bw/2,by);ctx.lineTo(bx+bw/2,by+bh);ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx,by+bh/2);ctx.lineTo(bx+bw,by+bh/2);ctx.stroke();
      ctx.beginPath();ctx.arc(bx+bw/2,by+bh/2,7,0,Math.PI*2);
      ctx.fillStyle=previewState.ribbon==='새틴'?'#C4AA8F':'#8B4513';ctx.fill();
    }
    if(previewState.logoImg){
      var lw=Math.min(70,bw*.4),lh=lw*.5;
      ctx.globalAlpha=.8;ctx.drawImage(previewState.logoImg,bx+(bw-lw)/2,by+bh*.58,lw,lh);ctx.globalAlpha=1;
    } else {
      ctx.fillStyle=accentColor;ctx.font='bold 9px Arial';ctx.textAlign='center';
      ctx.fillText('LOTTE DONGTAN',bx+bw/2,by+bh*.72);
    }
    ctx.fillStyle=textColor;ctx.font='600 10px Arial';ctx.textAlign='center';
    ctx.fillText('Premium Gift',bx+bw/2,by+bh*.38);
  } else if (angle==='open') {
    var bx=w*.15,by=h*.25,bw=w*.7,bh=h*.55;
    ctx.save();ctx.translate(bx,by);ctx.rotate(-.33);
    ctx.shadowColor='rgba(0,0,0,.07)';ctx.shadowBlur=10;
    ctx.fillStyle=bg;ctx.fillRect(0,0,bw,bh*.38);
    ctx.strokeStyle=isDark?'rgba(255,255,255,.1)':'#e0e0e0';ctx.lineWidth=1;ctx.strokeRect(0,0,bw,bh*.38);
    ctx.shadowBlur=0;ctx.restore();
    ctx.shadowColor='rgba(0,0,0,.1)';ctx.shadowBlur=14;ctx.shadowOffsetY=4;
    ctx.fillStyle=bg;ctx.fillRect(bx,by+bh*.25,bw,bh*.7);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle=isDark?'rgba(255,255,255,.1)':'#e0e0e0';ctx.lineWidth=1;ctx.strokeRect(bx,by+bh*.25,bw,bh*.7);
    var ix=bx+bw*.1,iy=by+bh*.32,iw=bw*.76,ih=bh*.55;
    ctx.fillStyle=isDark?'#2a2a2a':'#f8f8f8';ctx.fillRect(ix,iy,iw,ih);
    ctx.fillStyle=accentColor;ctx.fillRect(ix+iw*.05,iy+ih*.1,iw*.32,ih*.75);ctx.fillRect(ix+iw*.42,iy+ih*.1,iw*.32,ih*.75);
  } else {
    var bx=w*.2,by=h*.12,bw=w*.6,bh=h*.62;
    ctx.shadowColor='rgba(0,0,0,.12)';ctx.shadowBlur=18;ctx.shadowOffsetY=7;
    ctx.fillStyle=bg;ctx.fillRect(bx,by,bw,bh);ctx.shadowBlur=0;
    ctx.strokeStyle=isDark?'rgba(255,255,255,.12)':'#e0e0e0';ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh);
    if(previewState.ribbon!=='없음'){
      ctx.strokeStyle='#C4AA8F';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(bx+bw/2,by);ctx.lineTo(bx+bw/2,by+bh);ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx,by+bh*.42);ctx.lineTo(bx+bw,by+bh*.42);ctx.stroke();
      ctx.fillStyle='#C4AA8F';
      ctx.beginPath();ctx.moveTo(bx+bw/2,by+bh*.38);ctx.quadraticCurveTo(bx+bw*.37,by+bh*.28,bx+bw*.3,by+bh*.38);ctx.fill();
      ctx.beginPath();ctx.moveTo(bx+bw/2,by+bh*.38);ctx.quadraticCurveTo(bx+bw*.63,by+bh*.28,bx+bw*.7,by+bh*.38);ctx.fill();
    }
    ctx.strokeStyle='#bbb';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(bx+bw*.28,by);ctx.lineTo(bx+bw*.37,by-h*.06);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx+bw*.72,by);ctx.lineTo(bx+bw*.63,by-h*.06);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx+bw*.37,by-h*.06);ctx.lineTo(bx+bw*.63,by-h*.06);ctx.stroke();
  }
}
function renderAllCanvases() { drawBoxCanvas('canvas-front','front'); drawBoxCanvas('canvas-open','open'); drawBoxCanvas('canvas-hand','hand'); }
function selectColor(el, color) { document.querySelectorAll('.color-swatch').forEach(function(s){ s.classList.remove('active'); }); el.classList.add('active'); previewState.color=color; renderAllCanvases(); }
function selectRibbon(el, type) { document.querySelectorAll('.ribbon-btn').forEach(function(b){ b.classList.remove('active'); }); el.classList.add('active'); previewState.ribbon=type; renderAllCanvases(); }
function handleLogoUpload(input) {
  if(!input.files||!input.files[0]) return;
  var reader=new FileReader();
  reader.onload=function(e){ var img=new Image(); img.onload=function(){ previewState.logoImg=img; renderAllCanvases(); }; img.src=e.target.result; };
  reader.readAsDataURL(input.files[0]);
}

/* ══════════════════════════════════════════════════
   품의서 / 견적서
   ══════════════════════════════════════════════════ */
function generateReport() {
  var co=(document.getElementById('rpt-company')||{}).value||'(주)귀사';
  var dept=(document.getElementById('rpt-dept')||{}).value||'총무팀';
  var nm=(document.getElementById('rpt-name')||{}).value||'담당자';
  var dt=(document.getElementById('rpt-date')||{}).value||new Date().toLocaleDateString('ko-KR');
  var pkgs=window._genPkgs;
  if(!pkgs||!pkgs.length){showToast('먼저 패키지를 생성해 주세요');return;}
  var si=window._selectedPkg!==undefined?window._selectedPkg:1;
  var sp=pkgs[si], tot=Math.round(sp.price*sp.qty*(1-sp.disc));
  var rowHtml=pkgs.map(function(p,i){var s=p.price*p.qty,da=Math.round(s*p.disc),t=s-da;return'<tr style="background:'+(i===si?'#f9f9f9':'#fff')+'"><td style="font-weight:700;padding:10px 14px">'+p.tier+(i===si?' ★':'')+'</td><td style="padding:10px 14px">₩'+p.price.toLocaleString()+'</td><td style="padding:10px 14px">'+p.qty+'개</td><td style="padding:10px 14px">₩'+s.toLocaleString()+'</td><td style="padding:10px 14px;color:#2a7a4f">'+(da>0?'-₩'+da.toLocaleString()+' ('+Math.round(p.disc*100)+'%)':'—')+'</td><td style="padding:10px 14px;font-weight:700">₩'+t.toLocaleString()+'</td><td style="padding:10px 14px">'+(i===si?'★ 선택됨':'')+'</td></tr>';}).join('');
  var w=window.open('','_blank','width=880,height=1100');
  if(!w){showToast('팝업 차단을 해제해 주세요');return;}
  w.document.write('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>기업 선물 품의서 — '+co+'</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Malgun Gothic","Nanum Gothic",sans-serif;font-size:13px;color:#111;padding:40px;max-width:820px;margin:0 auto}h1{font-size:22px;font-weight:700;margin-bottom:6px}.sub{font-size:11px;color:#888;margin-bottom:32px}.sec{margin-bottom:28px}.sec-t{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e8e8e8}.ig{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ii{padding:10px 14px;background:#f5f5f5}.il{font-size:10px;color:#888;margin-bottom:4px}.iv{font-size:13px;font-weight:700}table{width:100%;border-collapse:collapse;font-size:12px}th{padding:10px 14px;background:#111;color:#fff;text-align:left;font-weight:700;font-size:11px}.hl{background:#f9f9f9;border:1px solid #e8e8e8;border-left:3px solid #111;padding:16px 20px;margin:20px 0;font-size:12px;color:#444;line-height:1.8;font-style:italic}.tot{background:#111;color:#fff;padding:20px 24px;margin-top:20px;display:flex;justify-content:space-between;align-items:center}.tl{font-size:11px;color:rgba(255,255,255,.55)}.tv{font-size:24px;font-weight:700}.sch{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e8e8e8;margin-top:12px}.si{background:#fff;padding:12px;text-align:center}.ss{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.sl{font-size:12px;font-weight:700}.sd{font-size:10px;color:#888;margin-top:2px}.ft{margin-top:48px;padding-top:20px;border-top:1px solid #e8e8e8;display:flex;justify-content:space-between;font-size:10px;color:#aaa}@media print{body{padding:24px}.np{display:none}}</style></head><body>'+
    '<div class="sub">기업 선물 품의서 · 롯데백화점 동탄점 B2B 큐레이션</div><h1>기업 선물 구매 품의서</h1><div style="height:24px"></div>'+
    '<div class="sec"><div class="sec-t">기본 정보</div><div class="ig"><div class="ii"><div class="il">회사명</div><div class="iv">'+co+'</div></div><div class="ii"><div class="il">부서명</div><div class="iv">'+dept+'</div></div><div class="ii"><div class="il">담당자</div><div class="iv">'+nm+'</div></div><div class="ii"><div class="il">품의 예정일</div><div class="iv">'+dt+'</div></div><div class="ii"><div class="il">수량</div><div class="iv">'+sp.qty+'개</div></div><div class="ii"><div class="il">공급</div><div class="iv">롯데백화점 동탄점 (1577-0001)</div></div></div></div>'+
    '<div class="sec"><div class="sec-t">큐레이터 선정 배경</div><div class="hl">"롯데백화점 동탄점 입점 브랜드(조 말론, 샤넬, 딥티크, 몽블랑 등)를 카카오 선물하기 인기 순위 기반으로 엄선한 큐레이션입니다."<br><span style="font-size:11px;color:#888">— 롯데백화점 동탄점 선물 큐레이터 팀</span></div></div>'+
    '<div class="sec"><div class="sec-t">패키지 비교 견적표</div><table><thead><tr><th>패키지</th><th>단가</th><th>수량</th><th>소계</th><th>할인</th><th>최종 금액</th><th>선택</th></tr></thead><tbody>'+rowHtml+'</tbody></table></div>'+
    '<div class="tot"><div class="tl">선택 패키지 최종 금액<br><span style="font-size:11px;color:rgba(255,255,255,.45)">'+sp.tier+' · '+sp.qty+'개 · 할인 '+Math.round(sp.disc*100)+'% 적용</span></div><div class="tv">₩'+tot.toLocaleString()+'</div></div>'+
    '<div class="sec" style="margin-top:28px"><div class="sec-t">예상 납기 일정</div><div class="sch"><div class="si"><div class="ss">Step 01</div><div class="sl">상담 확정</div><div class="sd">D+1</div></div><div class="si"><div class="ss">Step 02</div><div class="sl">디자인 시안</div><div class="sd">D+3</div></div><div class="si"><div class="ss">Step 03</div><div class="sl">제작 진행</div><div class="sd">D+4~10</div></div><div class="si"><div class="ss">Step 04</div><div class="sl">검수·배송</div><div class="sd">D+11~14</div></div></div></div>'+
    '<div class="hl" style="margin-top:16px">세금계산서는 계약 완료 후 발행됩니다. 롯데백화점 동탄점 B2B 담당 (1577-0001)으로 문의하시면 최종 견적 및 계약서를 발송해 드립니다.</div>'+
    '<div class="ft"><div>롯데백화점 동탄점 B2B 기프트 컨시어지</div><div>생성일: '+new Date().toLocaleDateString('ko-KR')+'</div></div>'+
    '<div class="np" style="text-align:center;margin-top:32px"><button onclick="window.print()" style="background:#111;color:#fff;border:none;padding:12px 28px;font-size:13px;font-family:inherit">인쇄 / PDF 저장</button></div>'+
  '</body></html>');
  w.document.close();
}

function generateCSVReport() {
  var pkgs=window._genPkgs;
  if(!pkgs||!pkgs.length){showToast('먼저 패키지를 생성해 주세요');return;}
  var rows=[['패키지','단가(1인)','수량','소계','할인금액','할인율','최종금액','구성 아이템']];
  pkgs.forEach(function(p){var s=p.price*p.qty,da=Math.round(s*p.disc),t=s-da;rows.push([p.tier,p.price,p.qty,s,da,Math.round(p.disc*100)+'%',t,p.items.map(function(it){return it.n}).join(' / ')]);});
  var csv=rows.map(function(r){return r.map(function(v){return'"'+(v||'').toString().replace(/"/g,'""')+'"'}).join(',')}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='롯데동탄_기업선물_견적서.csv';a.click();
  showToast('Excel 견적서 다운로드 완료');
}


function filterEv(btn, cat) {
  document.querySelectorAll('.efbtn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.mini-card,.slide').forEach(function(card){
    var show = cat === 'all' || card.getAttribute('data-cat') === cat;
    card.style.display = show ? '' : 'none';
  });
}

function scrollToWizard() {
  var w = document.getElementById('wizard');
  if (!w) return;
  w.scrollIntoView({ behavior:'smooth' });
  document.querySelectorAll('#wizard .wpanel').forEach(function(p){ p.classList.remove('active'); });
  var p0 = document.getElementById('wp-0');
  if (p0) p0.classList.add('active');
  updDots(0,'wd','wf',5);
}
</script>
