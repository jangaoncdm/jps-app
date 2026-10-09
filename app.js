/* JPS app.js — BUILD JPS v0.6.0-M5 b008
 * Set API_URL to the Apps Script /exec deployment URL. POSTs go as text/plain
 * (GAS cannot answer CORS preflights; text/plain avoids one; body still arrives in postData).
 */
'use strict';
var API_URL = 'https://script.google.com/macros/s/AKfycbzoft5NDa9cSsR7QexjilMA_Uv2FWujkJqaWnYTLn8yY32pSit1EuQ5iBxS1nRJHR4b2g/exec';
var BUILD = 'JPS v0.6.0-M5 b008';

var SPECIES = [
  { v:'cow', te:'ఆవు', en:'Cow', pic:'🐄' }, { v:'buffalo', te:'గేదె', en:'Buffalo', pic:'🐃' },
  { v:'sheep', te:'గొర్రె', en:'Sheep', pic:'🐑' }, { v:'goat', te:'మేక', en:'Goat', pic:'🐐' },
  { v:'poultry', te:'కోడి', en:'Poultry', pic:'🐔' }, { v:'dog', te:'కుక్క', en:'Dog', pic:'🐕' },
  { v:'other', te:'ఇతర', en:'Other', pic:'🐾' }
];
var SYMPTOMS = [
  { v:'fever', te:'జ్వరం', en:'Fever' }, { v:'not_eating', te:'మేత తినడం లేదు', en:'Not eating' },
  { v:'injury', te:'గాయం / రక్తస్రావం', en:'Injury / bleeding' }, { v:'bloat', te:'కడుపు ఉబ్బరం', en:'Bloat' },
  { v:'delivery', te:'ఈత సమస్య', en:'Calving problem' }, { v:'mastitis', te:'పొదుగు వాపు', en:'Mastitis' },
  { v:'skin', te:'చర్మ వ్యాధి / గడ్డలు', en:'Skin disease' }, { v:'diarrhea', te:'విరేచనాలు', en:'Diarrhea' },
  { v:'other', te:'ఇతర సమస్య', en:'Other' }
];
// backend still records a symptom per case; derive it from the chosen catalogue service
var SERVICE2SYMPTOM = {
  'EMG-01':'delivery', 'EMG-02':'bloat', 'EMG-03':'other', 'EMG-04':'injury', 'EMG-05':'other',
  'TRT-01':'fever', 'TRT-02':'mastitis', 'TRT-03':'injury', 'TRT-04':'diarrhea', 'TRT-05':'skin'
};
var STATUS_TE = { NEW:'కొత్తది', ASSIGNED:'డాక్టర్ చూస్తున్నారు', VISIT_SCHEDULED:'సందర్శన ఖరారు',
  RESOLVED:'పరిష్కారమైంది', ESCALATED:'1962కి పంపారు', CANCELLED:'రద్దు చేయబడింది' };
var STATUS_EN = { NEW:'New', ASSIGNED:'With doctor', VISIT_SCHEDULED:'Visit scheduled',
  RESOLVED:'Resolved', ESCALATED:'Escalated 1962', CANCELLED:'Cancelled' };
var EVENT_TE = { CREATED:'అభ్యర్థన నమోదైంది · Filed', CLAIMED:'డాక్టర్ తీసుకున్నారు · Doctor assigned',
  CALL_LOGGED:'డాక్టర్ కాల్ చేశారు · Doctor called', ADVICE_CLOSED:'సలహాతో పరిష్కారం · Resolved with advice',
  VISIT_SCHEDULED:'సందర్శన ఖరారు · Visit scheduled', VISIT_DONE:'సందర్శన పూర్తి · Visit completed',
  ESCALATED_1962:'1962/MVCకి పంపారు · Escalated', CANCELLED:'రద్దు · Cancelled',
  PRESCRIPTION:'మందుల చీటీ · Prescription', VIDEO_CALL:'వీడియో కాల్ · Video call' };
// Dosage vocabulary — mirrors Domain.gs DOSE_FREQ/DOSE_TIMING (the backend is the validator).
var DOSE_FREQ = [
  { v:'1-0-0', en:'Once daily (morning)', te:'రోజుకు ఒకసారి (ఉదయం)' },
  { v:'0-0-1', en:'Once daily (night)',   te:'రోజుకు ఒకసారి (రాత్రి)' },
  { v:'1-0-1', en:'Twice daily',          te:'రోజుకు రెండుసార్లు' },
  { v:'1-1-1', en:'Three times daily',    te:'రోజుకు మూడుసార్లు' },
  { v:'STAT',  en:'Single dose now',      te:'ఇప్పుడు ఒక్కసారి' },
  { v:'SOS',   en:'Only if needed',       te:'అవసరమైతే మాత్రమే' }
];
var DOSE_TIMING = [
  { v:'after',  en:'After feed',  te:'మేత తర్వాత' },
  { v:'before', en:'Before feed', te:'మేతకు ముందు' },
  { v:'any',    en:'Any time',    te:'ఎప్పుడైనా' }
];
var RX_ROUTES = ['Oral','IM','IV','SC','Topical','Intramammary','Intrauterine'];
var SLOTS = [
  { v:'morning', te:'ఉదయం', en:'Morning' },
  { v:'afternoon', te:'మధ్యాహ్నం', en:'Afternoon' },
  { v:'evening', te:'సాయంత్రం', en:'Evening' }
];

var S = {
  token: localStorage.getItem('jps_token') || '',
  user: JSON.parse(localStorage.getItem('jps_user') || 'null'),
  lang: localStorage.getItem('jps_lang') || 'both',
  meta: null, masters: null, lastRev: 0, poll: null
};
function saveAuth(token, user) {
  S.token = token; S.user = user;
  localStorage.setItem('jps_token', token);
  localStorage.setItem('jps_user', JSON.stringify(user));
}
function logout() {
  localStorage.removeItem('jps_token'); localStorage.removeItem('jps_user');
  S.token = ''; S.user = null; location.hash = '#identify';
}

// ---------------------------------------------------------------- language
function setLang(l) {
  S.lang = l; localStorage.setItem('jps_lang', l);
  var b = document.getElementById('langbtn');
  if (b) b.textContent = l === 'te' ? 'తె' : (l === 'en' ? 'EN' : 'తె·EN');
}
function T(te, en) { // plain text in the chosen language
  if (S.lang === 'te') return te;
  if (S.lang === 'en') return en;
  return te + ' · ' + en;
}
function TL(te, en) { // label HTML: Telugu with a small English line in 'both'
  if (S.lang === 'te') return esc(te);
  if (S.lang === 'en') return esc(en);
  return esc(te) + ' <span class="en">' + esc(en) + '</span>';
}

function api(action, payload, _retry) {
  payload = payload || {};
  if (S.token) payload.token = S.token;
  return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, payload: payload }) })
    .then(function (r) { return r.text(); })
    .then(function (txt) {
      // Right after a backend deploy Apps Script serves a warm-up HTML page instead of
      // JSON for the first call. Retrying once turns "Cannot reach server" on the first
      // farmer's screen into a half-second pause.
      try { return JSON.parse(txt); }
      catch (e) {
        if (_retry) throw new Error('Server is waking up. Please try again in a moment.');
        return new Promise(function (res) { setTimeout(res, 1200); })
          .then(function () { return api(action, payload, 1); })
          .then(function (d) { return { ok: true, data: d, rev: S.lastRev, _done: 1 }; });
      }
    })
    .then(function (j) {
      if (j._done) return j.data;
      if (j.rev) S.lastRev = j.rev;
      if (!j.ok) { var e = new Error(j.error.message); e.code = j.error.code; throw e; }
      return j.data;
    });
}
function loadMasters() {
  if (S.masters) return Promise.resolve(S.masters);
  return api('meta.masters', {}).then(function (m) { S.masters = m; return m; });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function el(id) { return document.getElementById(id); }
/* A toast for actions with no screen of their own. */
function toast(msg) {
  var t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'on';
  clearTimeout(t._h);
  t._h = setTimeout(function () { t.className = ''; }, 1900);
}

/* Spin inside the button while the request is in flight, so a slow village network
   never looks like a dead tap. */
function busy(b, p) {
  if (!b) return p;
  b.classList.add('busy');
  var done = function () { b.classList.remove('busy'); };
  return p.then(function (v) { done(); return v; },
                function (e) { done(); throw e; });
}

/* What a screen shows while its data is still coming. */
function skeleton(n) {
  var rows = '';
  for (var i = 0; i < (n || 3); i++) {
    rows += '<div class="card"><div class="sk" style="width:' + (40 + i * 14) + '%"></div>' +
            '<div class="sk"></div>' + (i === 0 ? '<div class="sk" style="width:70%"></div>' : '') +
            '</div>';
  }
  return rows;
}
function loading(n) { render(skeleton(n)); }

function render(html) { el('view').innerHTML = html +
  '<footer>Veterinary &amp; AH Dept, Jangaon · అత్యవసర హెల్ప్‌లైన్ <b>1962</b> · ' + BUILD + '</footer>'; }
function badge(st) {
  return '<span class="badge b-' + esc(st) + '">' + esc(T(STATUS_TE[st] || st, STATUS_EN[st] || st)) + '</span>';
}
function spLabel(v) { var s = SPECIES.find(function (x) { return x.v === v; }); return s ? s.pic + ' ' + T(s.te, s.en) : v; }
function syLabel(v) { var s = SYMPTOMS.find(function (x) { return x.v === v; }); return s ? T(s.te, s.en) : v; }
function mapsLink(lat, lng) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
}
function facilityCard(f, title) {
  if (!f) return '';
  var dir = (f.lat && f.lng)
    ? '<a class="btn small ghost" target="_blank" rel="noopener" href="' + mapsLink(f.lat, f.lng) + '">🗺️ ' + esc(T('దారి చూపించు', 'Directions')) + '</a>' : '';
  var call = f.mobile ? '<a class="btn small" href="tel:' + esc(f.mobile) + '">📞 ' + esc(T('డాక్టర్‌కు కాల్', 'Call doctor')) + '</a>' : '';
  return '<div class="fac"><div class="hint">' + esc(title || T('మీ కేంద్రం', 'Your centre')) + '</div>' +
    '<div class="nm">' + esc(f.name) + '</div>' +
    (f.incharge ? '<div>' + esc(T('డాక్టర్', 'Doctor')) + ': <b>' + esc(f.incharge) + '</b></div>' : '') +
    (f.address ? '<div class="hint">' + esc(f.address) + (f.village ? ', ' + esc(f.village) : '') + '</div>' : '') +
    (f.hours ? '<div class="hint">' + esc(f.hours) + (f.weekly_off ? ' · ' + esc(T('సెలవు', 'Off')) + ': ' + esc(f.weekly_off) : '') + '</div>' : '') +
    '<div class="rowline">' + call + dir + '</div></div>';
}
// ---------------------------------------------------------------- install prompt + camera
var installEvt = null;
function isInstalled() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
         window.navigator.standalone === true ||
         localStorage.getItem('jps_installed') === '1';
}
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  if (isInstalled()) return; // already installed — never offer again
  installEvt = e;
  var btn = document.getElementById('instTop');
  if (btn) btn.hidden = false;
});
window.addEventListener('appinstalled', function () {
  localStorage.setItem('jps_installed', '1');
  installEvt = null;
  var btn = document.getElementById('instTop');
  if (btn) btn.hidden = true;
});
(function wireInstallBar() {
  var btn = document.getElementById('instTop');
  if (btn) btn.onclick = function () {
    if (!installEvt) return;
    installEvt.prompt();
    installEvt.userChoice.then(function (c) {
      if (c && c.outcome === 'accepted') localStorage.setItem('jps_installed', '1');
      btn.hidden = true; installEvt = null;
    });
  };
  if (isInstalled()) { if (btn) btn.hidden = true; }
  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  // WhatsApp/other in-app browsers (Android WebView) cannot install — point to Chrome
  if (!standalone && / wv\)| WebView|; wv/.test(navigator.userAgent)) {
    var wb = document.getElementById('wvbar');
    if (wb) wb.hidden = false;
  }
})();
var camStream = null;
function stopCam() {
  if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
}

// ---------------------------------------------------------------- prescribing (v0.6)
// One row per medicine, the way Apollo/Practo collect them — plus the two withdrawal
// fields an Indian veterinary slip needs and a human one does not.
// Staff names often already read "Dr Srinivas", so don't print "Dr. Dr Srinivas".
function drName(n) {
  n = String(n || '').trim();
  if (!n) return '';
  return /^dr\.?\s/i.test(n) ? n : 'Dr. ' + n;
}
var medSeq = 0;
function medRowHtml() {
  var i = ++medSeq;
  var opts = function (list, sel) {
    return list.map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === sel ? ' selected' : '') + '>' +
        o.v + ' - ' + o.en + '</option>';
    }).join('');
  };
  return '<div class="medrow">' +
    '<div class="medtop"><span class="medno">' + i + '</span>' +
      '<input class="m-name" placeholder="Inj. Enrofloxacin 10%" maxlength="120">' +
      '<button type="button" class="medx" aria-label="Remove medicine">✕</button></div>' +
    '<div class="medgrid">' +
      '<input class="m-strength" placeholder="10 ml" maxlength="60">' +
      '<select class="m-route">' + RX_ROUTES.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select>' +
      '<select class="m-freq">' + opts(DOSE_FREQ, '1-0-1') + '</select>' +
      '<select class="m-timing">' + opts(DOSE_TIMING, 'after') + '</select>' +
      '<input class="m-days" type="number" min="0" max="90" placeholder="days">' +
    '</div>' +
    '<div class="medgrid wd">' +
      '<input class="m-milk" type="number" min="0" max="720" placeholder="Milk withhold (hrs)">' +
      '<input class="m-meat" type="number" min="0" max="120" placeholder="Meat withhold (days)">' +
    '</div>' +
    '<label class="wdnone"><input type="checkbox" class="m-wdnone">' +
      '<span>No withholding needed for this medicine</span></label>' +
    '<input class="m-note" placeholder="Deep IM, alternate sides" maxlength="160">' +
    '</div>';
}
function addMedRow() {
  var box = el('meds');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', medRowHtml());
  var row = box.lastElementChild;
  row.querySelector('.medx').onclick = function () { box.removeChild(row); };
  var none = row.querySelector('.m-wdnone');
  none.onchange = function () {
    ['.m-milk', '.m-meat'].forEach(function (sel) {
      var f = row.querySelector(sel);
      f.disabled = none.checked;
      if (none.checked) f.value = '';
    });
  };
  return row;
}
function collectMeds() {
  var box = el('meds');
  if (!box) return [];
  return Array.prototype.map.call(box.querySelectorAll('.medrow'), function (row) {
    var v = function (sel) { var n = row.querySelector(sel); return n ? n.value : ''; };
    var cb = row.querySelector('.m-wdnone');
    return { name: v('.m-name'), strength: v('.m-strength'), route: v('.m-route'),
             freq: v('.m-freq'), timing: v('.m-timing'), days: v('.m-days'),
             milk_h: v('.m-milk'), meat_d: v('.m-meat'), note: v('.m-note'),
             wd_none: cb && cb.checked ? 1 : 0 };
  }).filter(function (m) { return String(m.name).trim(); });
}

/* The offer rail advances itself and the dots follow. */
function autoCarousel() {
  clearInterval(window._car);
  var c = document.querySelector('.carou');
  if (!c || c.children.length < 2) return;
  window._car = setInterval(function () {
    if (!document.body.contains(c)) { clearInterval(window._car); return; }
    var w = c.firstElementChild.offsetWidth + 10;
    var next = c.scrollLeft + w >= c.scrollWidth - 20 ? 0 : c.scrollLeft + w;
    c.scrollTo({ left: next, behavior: 'smooth' });
    var dots = document.querySelectorAll('.dots i'), k = Math.round(next / w);
    for (var i = 0; i < dots.length; i++) dots[i].className = i === k ? 'on' : '';
  }, 3600);
}

function stopPoll() { if (S.poll) { clearInterval(S.poll); S.poll = null; } }
function startPoll(reloadFn) {
  stopPoll();
  var seen = S.lastRev;
  S.poll = setInterval(function () {
    api('meta.rev', {}).then(function () {
      if (S.lastRev !== seen) { seen = S.lastRev; reloadFn(); }
    }).catch(function () {});
  }, 25000);
}

// ---------------------------------------------------------------- native bridges (graceful on web)
function tryPhoneHint() { // resolves phone string or null
  try {
    var P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PhoneHint;
    if (!P) return Promise.resolve(null);
    return P.request().then(function (r) { return r && r.phoneNumber ? r.phoneNumber : null; })
      .catch(function () { return null; });
  } catch (e) { return Promise.resolve(null); }
}
function tryGoogleSignIn() { // resolves idToken or null
  try {
    var G = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth;
    if (!G) return Promise.resolve(null);
    return G.signIn().then(function (u) {
      return (u && u.authentication && u.authentication.idToken) ? u.authentication.idToken : null;
    }).catch(function () { return null; });
  } catch (e) { return Promise.resolve(null); }
}
function tryRegisterPush() {
  try {
    var P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    if (!P || !S.token) return;
    P.requestPermissions().then(function (res) {
      if (res.receive !== 'granted') return;
      P.addListener('registration', function (t) {
        api('device.register', { fcm_token: t.value, platform: 'android' }).catch(function () {});
      });
      P.register();
    }).catch(function () {});
  } catch (e) {}
}

// ---------------------------------------------------------------- photo compression (≤300 KB)
function compressPhoto(file) {
  return new Promise(function (resolve, reject) {
    if (!file) return resolve(null);
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var max = 1280, w = img.width, h = img.height;
      if (w > max || h > max) { var k = Math.min(max / w, max / h); w = Math.round(w * k); h = Math.round(h * k); }
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      var q = 0.75, data = cv.toDataURL('image/jpeg', q);
      while (data.length > 400000 && q > 0.35) { q -= 0.1; data = cv.toDataURL('image/jpeg', q); }
      resolve(data.split(',')[1]);
    };
    img.onerror = function () { reject(new Error(T('ఫోటో చదవలేకపోయాం', 'Could not read the photo'))); };
    img.src = url;
  });
}

// ================================================================ screens
function langChips() {
  return '<div class="chips" id="langchips">' +
    [['te', 'తెలుగు'], ['en', 'English'], ['both', 'తెలుగు + English']].map(function (o) {
      return '<button class="chip' + (S.lang === o[0] ? ' on' : '') + '" data-l="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
}
function wireLangChips(rerender) {
  var box = el('langchips'); if (!box) return;
  Array.prototype.forEach.call(box.querySelectorAll('[data-l]'), function (b) {
    b.onclick = function () { setLang(b.getAttribute('data-l')); rerender(); };
  });
}

function vIdentify(msg) {
  stopPoll();
  render(
    '<div class="signin">' +
      '<div class="si-mark"><img src="icon-192.png" alt=""></div>' +
      '<h1>' + esc(T('పశువుకు వైద్య సహాయం ఒక్క ట్యాప్ దూరం',
        'Veterinary help for your animal, one tap away')) + '</h1>' +
      '<p class="si-sub">' + esc(T('ప్రభుత్వ పశు వైద్యం · పూర్తిగా ఉచితం',
        'Government veterinary care · completely free')) + '</p>' +
    '</div>' +
    (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
    '<div class="card">' +
      '<button class="btn" id="hintbtn">📱 ' +
        esc(T('నా నంబర్‌తో కొనసాగండి', 'Continue with my number')) + '</button>' +
      '<div class="orline"><span>' + esc(T('లేదా', 'or')) + '</span></div>' +
      '<label style="margin-top:0">' + TL('మొబైల్ నంబర్', 'Mobile number') + '</label>' +
      '<input id="ph" type="tel" inputmode="numeric" placeholder="9XXXXXXXXX">' +
      '<label>' + TL('మీ పేరు', 'Your name') + '</label>' +
      '<input id="nm" type="text" maxlength="80">' +
      '<div style="height:14px"></div>' +
      '<button class="btn ghost" id="manbtn">' + esc(T('కొనసాగండి', 'Continue')) + '</button>' +
      '<p class="en" style="text-align:center;margin-top:10px">' +
        esc(T('OTP అవసరం లేదు · పాస్‌వర్డ్ లేదు', 'No OTP, no password')) + '</p>' +
    '</div>' +
    '<a class="sosbar" href="tel:1962">' +
      '<span class="sb-ic">🚑</span>' +
      '<span><b>' + esc(T('అత్యవసరమా? 1962', 'Emergency? Call 1962')) + '</b>' +
      '<span class="hint">' + esc(T('24 గంటలూ ఉచిత సహాయం', 'Free state helpline, 24 hours')) + '</span></span></a>' +
    '<div class="card"><label style="margin-top:0">' + TL('భాష', 'Language') + '</label>' + langChips() + '</div>' +
    '<p class="hint" style="text-align:center"><a href="#staff">' +
      esc(T('సిబ్బంది ప్రవేశం', 'Staff sign-in')) + ' →</a></p>'
  );
  wireLangChips(function () { vIdentify(msg); });
  el('hintbtn').onclick = function () {
    el('hintbtn').classList.add('busy');
    tryPhoneHint().then(function (phone) {
      if (!phone) {
        el('hintbtn').classList.remove('busy');
        el('ph').focus();
        return toast(T('నంబర్ కనబడలేదు — టైప్ చేయండి',
          'Number picker unavailable — please type it'));
      }
      identify(phone, '', 'hint');
    });
  };
  el('manbtn').onclick = function () {
    el('manbtn').classList.add('busy');
    identify(el('ph').value, el('nm').value, 'manual');
  };
}
function identify(phone, name, source) {
  var dev = localStorage.getItem('jps_dev') || (Math.random().toString(36).slice(2) + Date.now().toString(36));
  localStorage.setItem('jps_dev', dev);
  api('farmer.identify', { phone: phone, name: name, source: source, device_id: dev })
    .then(function (d) { saveAuth(d.token, d.user); tryRegisterPush(); location.hash = '#home'; })
    .catch(function (e) { vIdentify(e.message); });
}

function vHome() {
  loading(3);
  Promise.all([api('farmer.myRequests', {}), api('meta.broadcasts', {}).catch(function () { return { broadcasts: [] }; })])
  .then(function (both) {
    var d = both[0];
    var notices = (both[1].broadcasts || []).map(function (b) {
      return '<div class="tip"><b>' + esc(b.title) + '</b>' +
        (b.body ? '<div>' + esc(b.body) + '</div>' : '') +
        '<div class="hint">' + esc(String(b.at).slice(0, 10)) + '</div></div>';
    }).join('');
    var noticesCard = notices
      ? '<div class="card"><h2>📢 ' + TL('ప్రకటనలు', 'Notices') + '</h2>' + notices + '</div>' : '';
    var rows = d.requests.map(function (r) {
      return '<tr><td><a href="#t/' + esc(r.ticket) + '"><b>' + esc(r.ticket) + '</b></a><br>' +
        '<span class="hint">' + esc(spLabel(r.species)) + '</span></td>' +
        '<td>' + badge(r.status) + '<br><span class="hint">' + esc(r.created_at.slice(0, 16)) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="2" class="hint">' + esc(T('ఇంకా అభ్యర్థనలు లేవు', 'No requests yet')) + '</td></tr>';
    var open = d.requests.filter(function (r) {
      return r.status === 'NEW' || r.status === 'ASSIGNED' || r.status === 'VISIT_SCHEDULED';
    });
    var live = open.length ? open[0] : null;
    var S1 = function (te, en) { return esc(S.lang === 'en' ? en : te); };

    // where this user is, taken from their own last request
    var last = d.requests[0] || null;
    var place = last && last.village
      ? esc(last.village) + (last.mandal ? ', ' + esc(last.mandal) : '')
      : esc(T('మీ ప్రాంతం', 'Set your area'));
    var fac = last && last.facility ? last.facility : null;

    var header =
      '<div class="ahd">' +
        '<div class="lrow"><span class="pin">📍</span>' +
          '<a href="#loc" style="color:inherit"><div class="lb">' + S1('మీ గ్రామ పంచాయతీ', 'Your Gram Panchayat') + '</div>' +
            '<div class="lv">' + place + ' ▾</div></a>' +
          '<a class="av" href="#tips">📗</a></div>' +
        '<a class="sbar" href="#new">🔍 <span>' +
          S1('జ్వరం, ఈత, టీకా… వెతకండి', 'Fever, calving, vaccination…') +
          '</span></a>' +
      '</div>';

    var cats =
      '<div class="cats">' +
        '<a href="#new"><i>🩺</i>' + S1('సలహా', 'Ask a vet') + '</a>' +
        '<a href="#cases"><i>📋</i>' + S1('నా కేసులు', 'My cases') + '</a>' +
        '<a href="#animals"><i>🐄</i>' + S1('నా పశువులు', 'My animals') + '</a>' +
        '<a href="#centre"><i>🏥</i>' + S1('కేంద్రం', 'My centre') + '</a>' +
        '<a href="#vacc"><i>💉</i>' + S1('టీకాలు', 'Vaccination') + '</a>' +
        '<a href="#tips"><i>📗</i>' + S1('సూచనలు', 'Care tips') + '</a>' +
      '</div>';

    // the carousel carries whatever the district is actually broadcasting
    var bans = (both[1].broadcasts || []).map(function (b, k) {
      return '<div class="ban ' + (k % 2 ? 'b' : 'a') + '"><span class="ic">📢</span>' +
        '<div><b>' + esc(b.title) + '</b><span>' + esc((b.body || '').slice(0, 64)) + '</span></div></div>';
    });
    if (!bans.length) {
      bans.push('<div class="ban a"><span class="ic">🩺</span><div><b>' +
        esc(T('ఉచిత వైద్య సలహా', 'Free veterinary advice')) +
        '</b><span>' + esc(T('ప్రభుత్వ పశు వైద్యులు · 24×7', 'Government vets · 24×7')) + '</span></div></div>');
    }
    var carousel = '<div class="carou">' + bans.join('') + '</div>' +
      '<div class="dots">' + bans.map(function (x, k) {
        return '<i class="' + (k ? '' : 'on') + '"></i>'; }).join('') + '</div>';

    var liveCard = live
      ? '<a class="livecase" href="#t/' + esc(live.ticket) + '">' +
          '<div class="lc-top">' + badge(live.status) +
            '<span class="lc-tk">' + esc(live.ticket) + '</span></div>' +
          '<div class="lc-ttl">' + esc(spLabel(live.species)) + ' · ' + esc(syLabel(live.symptom)) + '</div>' +
          '<div class="lc-sub">' + (live.vet ? esc(live.vet.name) + ' · ' : '') +
            esc(T('వివరాలు చూడండి', 'See details')) + ' →</div></a>'
      : '';

    var split =
      '<div class="sh"><h2>' + S1('సలహా కావాలా?', 'Need advice?') + '</h2></div>' +
      '<div class="split">' +
        '<a href="#new"><span class="e">📹</span><div class="t">' +
          S1('ఆన్‌లైన్ సలహా', 'Online advice') + '</div>' +
          '<div class="s">' + S1('డాక్టర్ కాల్ చేస్తారు', 'A vet calls you back') + '</div></a>' +
        '<a href="#new"><span class="e">🏥</span><div class="t">' +
          S1('కేంద్రంలో', 'At the centre') + '</div>' +
          '<div class="s">' + S1('సందర్శన ఖరారు', 'The vet schedules a visit') + '</div></a>' +
      '</div>';

    var centreCard = fac
      ? '<div class="sh"><h2>' + S1('మీ పశు వైద్య కేంద్రం', 'Your veterinary centre') + '</h2>' +
          '<a href="#centre">' + S1('వివరాలు', 'Details') + '</a></div>' +
        '<a class="card" href="#centre" style="display:block">' +
          '<div class="rowline"><span style="font-size:23px">🏥</span>' +
          '<div style="flex:1;min-width:0"><b style="font-size:14px">' + esc(fac.name) + '</b>' +
          '<div class="en">' + esc(fac.code || '') + (fac.village ? ' · ' + esc(fac.village) : '') + '</div></div></div>' +
          '<div class="en" style="margin-top:9px;padding-top:9px;border-top:1px solid var(--line)">' +
          esc(T('మీ పంచాయతీకి కేటాయించిన కేంద్రం — మీరు ఎంచుకోవాలసిన అవసరం లేదు',
            'Assigned to your panchayat. You do not choose a centre or a doctor.')) + '</div></a>'
      : '';

    // the problem grid files a request pre-pointed at that symptom
    var probs = SYMPTOMS.slice(0, 8).map(function (y) {
      return '<a href="#new"><i>🩹</i>' + esc(T(y.te, y.en)) + '</a>';
    }).join('');

    render(
      header + cats + carousel +
      '<div class="pad">' +
      liveCard +
      '<a class="sosbar" href="tel:1962">' +
        '<span class="sb-ic">🚑</span>' +
        '<span><b>' + esc(T('అత్యవసరమా? 1962', 'Emergency? Call 1962')) + '</b>' +
        '<span class="hint">' + esc(T('24 గంటలూ ఉచిత సహాయం', 'Free state helpline, 24 hours')) + '</span></span></a>' +
      split +
      centreCard +
      '<div class="sh"><h2>' + S1('సమస్య ఎంచుకోండి', 'Pick the problem') + '</h2>' +
        '<a href="#new">' + S1('అన్నీ', 'All') + '</a></div>' +
      '<div class="specs">' + probs + '</div>' +
      noticesCard +
      '<div class="card"><div class="sh"><h2>' + TL('నా అభ్యర్థనలు', 'My requests') + '</h2>' +
        '<a href="#cases">' + S1('అన్నీ', 'All') + '</a></div>' +
        '<table>' + rows + '</table></div>' +
      '<p style="text-align:center;margin-top:13px"><a href="#" id="lo" class="hint">' +
        esc(T('లాగ్ అవుట్', 'Logout')) + '</a></p>' +
      '</div>');
    autoCarousel();
    el('lo').onclick = function (ev) { ev.preventDefault(); logout(); };
  }).catch(function (e) { if (e.code === 'auth') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vNew() {
  loading(3);
  loadMasters().then(function (M) {
    var tiles = SPECIES.map(function (s) {
      return '<label class="tile"><input type="radio" name="sp" value="' + s.v + '">' +
        '<img class="spimg" src="img/' + s.v + '.jpg" alt="" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
        '<span class="pic" style="display:none">' + s.pic + '</span>' +
        esc(S.lang === 'en' ? s.en : s.te) +
        (S.lang === 'both' ? '<span class="en">' + s.en + '</span>' : '') + '</label>';
    }).join('');
    var cats = [];
    M.services.forEach(function (s) { if (cats.indexOf(s.category) < 0) cats.push(s.category); });
    var svcOpts = cats.map(function (c) {
      var inner = M.services.filter(function (s) { return s.category === c; }).map(function (s) {
        return '<option value="' + esc(s.code) + '">' + (s.emergency ? '🔴 ' : '') + esc(T(s.te, s.en)) + '</option>';
      }).join('');
      return '<optgroup label="' + esc(c) + '">' + inner + '</optgroup>';
    }).join('');
    var md = (S.meta ? S.meta.mandals : []).map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('');
    render(
      '<div class="card"><h1>' + TL('కొత్త అభ్యర్థన', 'New request') + '</h1>' +
      '<div id="msg"></div>' +
      '<label>' + TL('ఏ జంతువు?', 'Which animal?') + '</label><div class="tiles" id="tiles">' + tiles + '</div>' +
      '<label>' + TL('సమస్య / సేవ', 'Problem / service') + '</label>' +
      '<select id="svc"><option value="">— ' + esc(T('ఎంచుకోండి', 'Select')) + ' —</option>' + svcOpts + '</select>' +
      '<div id="svcinfo"></div>' +
      '<label>' + TL('వివరాలు', 'Details (optional)') + '</label>' +
      '<textarea id="ds" maxlength="1000" placeholder="' + esc(T('ఎప్పటి నుంచి? ఏమి గమనించారు?', 'Since when? What did you notice?')) + '"></textarea>' +
      '<label>' + TL('ఫోటో', 'Photo (optional)') + '</label>' +
      '<input id="pf" type="file" accept="image/*" capture="environment">' +
      '<label>' + TL('చెవి ట్యాగ్ నంబర్', 'Ear-tag no. (optional)') + '</label>' +
      '<input id="tg" type="text" maxlength="20" inputmode="numeric">' +
      '<label>' + TL('మండలం', 'Mandal') + '</label>' +
      '<select id="md"><option value="">— ' + esc(T('ఎంచుకోండి', 'Select')) + ' —</option>' + md + '</select>' +
      '<label>' + TL('గ్రామ పంచాయతీ', 'Gram Panchayat') + '</label>' +
      '<select id="gp" disabled><option value="">— ' + esc(T('ముందు మండలం ఎంచుకోండి', 'Pick mandal first')) + ' —</option></select>' +
      '<label>' + TL('గ్రామం / నివాసం', 'Village / habitation') + '</label><input id="vg" type="text" maxlength="80" value="' + esc(S.user && S.user.village || '') + '">' +
      '<label>' + TL('మీ పేరు', 'Your name') + '</label><input id="nm" type="text" maxlength="80" value="' + esc(S.user && S.user.name || '') + '">' +
      '<div class="rowline"><button class="btn small ghost" id="loc">📍 ' + esc(T('నా లొకేషన్ జోడించు', 'Attach my location')) + '</button><span class="hint" id="locst"></span></div>' +
      '<div style="height:6px"></div>' +
      '<label class="emg"><input id="em" type="checkbox"><span><b>' + esc(T('అత్యవసరం', 'Emergency')) + '</b><br>' +
      '<span class="hint">' + esc(T('ఈత కష్టం / తీవ్ర గాయం / విషాహారం', 'Difficult delivery / severe injury / poisoning')) + '</span></span></label>' +
      '<div class="stickycta"><button class="btn" id="go">' + esc(T('అభ్యర్థన పంపండి', 'Submit request')) + '</button></div>' +
      '<div style="height:8px"></div><a class="btn ghost" href="#home">← ' + esc(T('వెనుకకు', 'Back')) + '</a></div>');
    var farmPos = { lat: '', lng: '' };
    el('tiles').addEventListener('change', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tile'), function (t) {
        t.classList.toggle('on', t.querySelector('input').checked);
      });
    });
    el('svc').onchange = function () {
      var svc = M.services.find(function (s) { return s.code === el('svc').value; });
      if (svc && svc.emergency) { el('em').checked = true; }
      el('svcinfo').innerHTML = svc
        ? '<p class="hint">' + (svc.emergency ? '🔴 ' : '') + esc(T('లక్ష్య స్పందన', 'Target response')) + ': ' + esc(svc.sla_raw || (svc.sla_min + ' min')) + '</p>' : '';
    };
    el('md').onchange = function () {
      var m = (S.meta.mandals || []).find(function (x) { return String(x.id) === el('md').value; });
      var list = (m && M.gpsByMandal[m.name]) || [];
      el('gp').disabled = !list.length;
      el('gp').innerHTML = '<option value="">— ' + esc(T('ఎంచుకోండి', 'Select')) + ' —</option>' +
        list.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('');
    };
    el('loc').onclick = function () {
      el('locst').textContent = '…';
      if (!navigator.geolocation) { el('locst').textContent = T('లొకేషన్ అందుబాటులో లేదు', 'Location unavailable'); return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        farmPos.lat = p.coords.latitude.toFixed(6); farmPos.lng = p.coords.longitude.toFixed(6);
        el('locst').textContent = '✓ ' + farmPos.lat + ', ' + farmPos.lng;
      }, function () { el('locst').textContent = T('లొకేషన్ దొరకలేదు', 'Could not get location'); },
      { enableHighAccuracy: true, timeout: 10000 });
    };
    el('go').onclick = function () {
      var spv = (document.querySelector('input[name=sp]:checked') || {}).value;
      var svcCode = el('svc').value;
      el('go').disabled = true;
      compressPhoto(el('pf').files[0]).then(function (b64) {
        return api('request.create', {
          species: spv, symptom: SERVICE2SYMPTOM[svcCode] || 'other',
          service_code: svcCode, gp: el('gp').value,
          description: el('ds').value, pashu_tag: el('tg').value,
          mandal_id: el('md').value, village: el('vg').value || el('gp').value,
          name: el('nm').value, emergency: el('em').checked ? 1 : 0,
          farm_lat: farmPos.lat, farm_lng: farmPos.lng,
          photo_b64: b64 || '', photo_mime: 'image/jpeg'
        });
      }).then(function (d) { location.hash = '#t/' + d.ticket; })
        .catch(function (e) {
          el('go').disabled = false;
          el('msg').innerHTML = '<div class="err">' + esc(e.message) + '</div>';
          window.scrollTo(0, 0);
        });
    };
  }).catch(function (e) { if (e.code === 'auth') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vTicket(ticket) {
  loading(3);
  var staff = S.user && S.user.role !== 'farmer';
  api('request.get', { ticket: ticket }).then(function (r) {
    var events = (r.events || []).map(function (e) {
      return '<li><b>' + esc(EVENT_TE[e.type] || e.type) + '</b>' +
        (e.actor ? ' — ' + esc(e.actor) : '') +
        (e.note ? '<div>' + esc(e.note) + '</div>' : '') +
        '<div class="when">' + esc(e.at) + '</div></li>';
    }).join('');
    var vet = r.vet ? '<p>' + esc(T('డాక్టర్', 'Doctor')) + ': <b>' + esc(r.vet.name) + '</b> — <a href="tel:' + esc(r.vet.phone) + '">' + esc(r.vet.phone) + '</a></p>' : '';
    var farmer = staff && r.farmer ? '<p>User: <b>' + esc(r.farmer.name) + '</b> · <a href="tel:' + esc(r.farmer.phone) + '">' + esc(r.farmer.phone) + '</a>' +
      (r.farmer.status === 'unconfirmed' ? ' <span class="badge b-NEW">number unconfirmed</span>' : '') + '</p>' : '';
    var farmLoc = staff && r.farm_lat && r.farm_lng
      ? '<p><a target="_blank" rel="noopener" href="' + mapsLink(r.farm_lat, r.farm_lng) + '">🗺️ User location on map</a></p>' : '';
    var visit = r.visit_date
      ? '<p>📅 ' + esc(T('సందర్శన', 'Visit')) + ': <b>' + esc(r.visit_date) + (r.visit_slot ? ' — ' + esc(r.visit_slot) : '') + '</b></p>' : '';
    var photo = r.photo ? '<p><img class="ph" src="data:' + esc(r.photo.mime) + ';base64,' + r.photo.b64 + '"></p>' : '';
    var report = r.diagnosis
      ? '<div class="card"><h2>🩺 ' + TL('డాక్టర్ నివేదిక', "Doctor's report") + '</h2>' +
        '<p>' + esc(r.diagnosis) + '</p>' +
        (r.vet ? '<p class="hint">— ' + esc(r.vet.name) + '</p>' : '') + '</div>' : '';
    var rx = (r.prescriptions || []).map(function (p) {
      // Laid out the way an Apollo/Practo e-prescription is: letterhead, prescriber with
      // council number, patient block, Rx table, advice, then the withdrawal notice -
      // the one block an Indian veterinary slip carries that a human one does not.
      var head =
        '<div class="rxhead">' +
          '<div class="rxdept">' + esc(T('పశుసంవర్ధక శాఖ', 'Veterinary & Animal Husbandry Dept')) +
            ' · ' + esc(T('జనగామ జిల్లా', 'Jangaon District')) + '</div>' +
          (p.facility_name ? '<div class="rxfac">' + esc(p.facility_name) + '</div>' : '') +
          '<div class="rxdoc"><span>' + esc(drName(p.doctor_name)) + '</span>' +
            (p.doctor_reg ? '<span class="rxreg">Reg. ' + esc(p.doctor_reg) + '</span>' : '') + '</div>' +
        '</div>';

      var pt = [];
      pt.push(['<b>' + esc(T('యజమాని', 'Owner')) + '</b>', esc((r.farmer && r.farmer.name) || (S.user && S.user.name) || '')]);
      pt.push(['<b>' + esc(T('జంతువు', 'Animal')) + '</b>', esc(spLabel(r.species)) + (r.pashu_tag ? ' · Tag ' + esc(r.pashu_tag) : '')]);
      if (p.weight_kg) pt.push(['<b>' + esc(T('బరువు', 'Weight')) + '</b>', esc(p.weight_kg) + ' kg']);
      if (p.temp_c) pt.push(['<b>' + esc(T('ఉష్ణోగ్రత', 'Temp')) + '</b>', esc(p.temp_c) + ' °C']);
      var ptBlock = '<div class="rxpt">' + pt.map(function (x) {
        return '<div><span>' + x[0] + '</span><span>' + x[1] + '</span></div>'; }).join('') + '</div>';

      var meds = (p.meds || []).length
        ? '<table class="rxtab"><thead><tr><th>#</th><th>' + esc(T('మందు', 'Medicine')) + '</th>' +
            '<th>' + esc(T('మోతాదు', 'Dosage')) + '</th></tr></thead><tbody>' +
          p.meds.map(function (m, i) {
            var fq = DOSE_FREQ.filter(function (f) { return f.v === m.freq; })[0];
            var tm = DOSE_TIMING.filter(function (t) { return t.v === m.timing; })[0];
            return '<tr><td class="rxn">' + (i + 1) + '</td>' +
              '<td><b>' + esc(m.name) + '</b>' +
                (m.strength ? '<div class="rxsub">' + esc(m.strength) +
                  (m.route && m.route !== 'Oral' ? ' · ' + esc(m.route) : '') + '</div>' : '') +
                (m.note ? '<div class="rxsub">' + esc(m.note) + '</div>' : '') + '</td>' +
              '<td><b class="rxfreq">' + esc(m.freq) + '</b>' +
                (fq ? '<div class="rxsub">' + esc(T(fq.te, fq.en)) + '</div>' : '') +
                (m.days ? '<div class="rxsub">' + m.days + ' ' + esc(T('రోజులు', 'days')) + '</div>' : '') +
                (tm && m.timing !== 'any' ? '<div class="rxsub">' + esc(T(tm.te, tm.en)) + '</div>' : '') +
              '</td></tr>';
          }).join('') + '</tbody></table>'
        : (p.rx_text ? '<p class="rxpre">' + esc(p.rx_text) + '</p>' : '');

      // Food-chain safety. Loud on purpose: milk sold inside this window is a residue violation.
      var wd = '';
      if (p.withdraw_milk_h || p.withdraw_meat_d) {
        var parts = [];
        if (p.withdraw_milk_h) parts.push('<div><span class="wdno">' + p.withdraw_milk_h + ' ' +
          esc(T('గంటలు', 'hours')) + '</span>' + esc(T('పాలు వాడవద్దు / అమ్మవద్దు', 'Do not use or sell milk')) + '</div>');
        if (p.withdraw_meat_d) parts.push('<div><span class="wdno">' + p.withdraw_meat_d + ' ' +
          esc(T('రోజులు', 'days')) + '</span>' + esc(T('మాంసానికి పంపవద్దు', 'Do not send for meat')) + '</div>');
        wd = '<div class="rxwd"><div class="wdttl">⚠️ ' +
          esc(T('ఔషధ విరమణ కాలం', 'Withdrawal period')) + '</div>' + parts.join('') +
          '<div class="wdfoot">' + esc(T('చివరి మోతాదు నుంచి లెక్కించండి',
            'Counted from the last dose given')) + '</div></div>';
      }

      var body = ptBlock +
        (p.observation ? '<div class="rxsec"><h3>' + esc(T('నిర్ధారణ', 'Diagnosis')) + '</h3><p>' + esc(p.observation) + '</p></div>' : '') +
        (meds ? '<div class="rxsec"><h3>Rx · ' + esc(T('మందులు', 'Medicines')) + '</h3>' + meds + '</div>' : '') +
        wd +
        (p.advice ? '<div class="rxsec"><h3>' + esc(T('సలహా', 'Advice')) + '</h3><p>' + esc(p.advice) + '</p></div>' : '') +
        (p.tests ? '<div class="rxsec"><h3>' + esc(T('పరీక్షలు', 'Tests')) + '</h3><p>' + esc(p.tests) + '</p></div>' : '') +
        (p.followup_date ? '<div class="rxsec"><h3>' + esc(T('మళ్లీ చూపించండి', 'Follow-up')) + '</h3><p>' + esc(p.followup_date) + '</p></div>' : '') +
        (p.photo ? '<img class="ph" src="data:' + esc(p.photo.mime) + ';base64,' + p.photo.b64 + '">' : '');

      var foot = '<div class="rxfoot">' +
        '<div>' + esc(T('డిజిటల్‌గా జారీ చేయబడింది — సంతకం అవసరం లేదు',
          'Issued electronically — valid without a physical signature')) + '</div>' +
        '<div class="rxmeta"><span>' + esc(p.rx_no || '') + '</span><span>' + esc(p.at) + '</span>' +
          '<span>' + esc(r.ticket) + '</span></div></div>';

      return '<div class="card rxcard">' + head + body + foot +
        '<div class="rowline"><button class="btn small ghost" onclick="window.print()">🖨️ ' +
        esc(T('ప్రింట్ / సేవ్', 'Print / save')) + '</button></div></div>';
    }).join('');
    var svcLine = r.service ? '<p>' + esc(T(r.service.te, r.service.en)) + ' <span class="hint">(' + esc(r.service.code) + ')</span></p>' : '';
    var caseOpen = r.status === 'ASSIGNED' || r.status === 'VISIT_SCHEDULED';
    var video = '';
    if (!staff && (r.status === 'NEW' || caseOpen || r.status === 'ESCALATED')) {
      // assigned doctor once claimed; until then the routed centre's in-charge doctor
      var docPhone = (r.vet && r.vet.phone) ? r.vet.phone : (r.facility && r.facility.mobile) || '';
      var docLabel = (r.vet && r.vet.phone)
        ? T('డాక్టర్‌కు కాల్', 'Call doctor')
        : T('కేంద్రం డాక్టర్‌కు కాల్', 'Call centre doctor');
      // An escalated case is exactly when 1962 matters most - don't send them back home for it.
      if (r.status === 'ESCALATED') {
        video += '<div class="tip warn"><b>' + esc(T('1962 / MVC బృందం సంప్రదిస్తారు',
          'The 1962 / MVC team will contact you')) + '</b></div>' +
          '<a class="btn red" href="tel:1962">🚑 ' + esc(T('1962కి కాల్ చేయండి', 'Call 1962 now')) + '</a>' +
          '<div style="height:8px"></div>';
      }
      if (docPhone) {
        video += '<div class="rowline">' +
          '<a class="btn small" href="tel:' + esc(docPhone) + '">📞 ' + esc(docLabel) + '</a>' +
          '<a class="btn small" style="background:#128C7E" target="_blank" rel="noopener" href="https://wa.me/' +
          esc(String(docPhone).replace(/\D/g, '')) + '">📹 ' + esc(T('WhatsApp వీడియో కాల్', 'WhatsApp video call')) + '</a></div>' +
          '<p class="hint">' + esc(T('WhatsApp తెరుచుకుంటుంది — పైన 📹 గుర్తు నొక్కితే డాక్టర్‌కు కాల్ వెళ్తుంది',
            'WhatsApp opens on the doctor chat — tap the 📹 icon at the top to ring them')) + '</p>' +
          '<div style="height:8px"></div>';
      }
    }
    var actions = '';
    if (staff && (r.status === 'NEW' || r.status === 'ASSIGNED' || r.status === 'VISIT_SCHEDULED')) {
      var slotOpts = SLOTS.map(function (s) { return '<option value="' + s.te + ' · ' + s.en + '">' + s.te + ' · ' + s.en + '</option>'; }).join('');
      actions = '<div class="card" id="acts">' +
        (r.status === 'NEW'
          ? '<button class="btn" id="claim">Claim this case</button>'
          : '<div class="rowline"><a class="btn small wa" id="vcall" target="_blank" rel="noopener" href="https://wa.me/' +
            esc(String(r.farmer.phone).replace(/\D/g, '')) + '">📹 WhatsApp video call</a>' +
            '<a class="btn small" href="tel:' + esc(r.farmer.phone) + '">📞 Call user</a></div>' +
            '<p class="hint">WhatsApp opens on their chat — tap the 📹 icon at the top to ring them. Their phone rings like any WhatsApp call, even locked.</p>' +
            '<label>Observation &amp; diagnosis <span class="en">(required to resolve)</span></label>' +
            '<textarea id="note" maxlength="1000" placeholder="Findings · diagnosis · advice to the user"></textarea>' +
            '<div class="rowline2"><div><label>Weight (kg)</label><input id="wkg" type="number" inputmode="decimal" min="0" max="2000" placeholder="410"></div>' +
            '<div><label>Temp (&deg;C)</label><input id="tpc" type="number" inputmode="decimal" min="30" max="45" step="0.1" placeholder="39.8"></div></div>' +
            '<label>Medicines &mdash; Rx</label>' +
            '<div id="meds"></div>' +
            '<div class="rowline"><button class="btn small ghost" id="addmed" type="button">+ Add medicine</button></div>' +
            '<label>Advice to the owner <span class="en">(printed on the slip)</span></label>' +
            '<textarea id="adv" maxlength="600" placeholder="Strip the quarter fully before each dose. Keep bedding dry."></textarea>' +
            '<label>Tests <span class="en">(optional)</span></label>' +
            '<textarea id="tst" maxlength="1000" placeholder="Blood smear · milk culture · revisit if ..."></textarea>' +
            '<label>Follow-up date <span class="en">(optional)</span></label><input id="fud" type="date">' +
            '<label>Prescription photo (optional)</label>' +
            '<input id="rxf" type="file" accept="image/*" capture="environment">' +
            '<p class="hint">Medicines, advice or tests are issued as a formal prescription with your name, registration number, centre and time.</p>' +
            '<div class="rowline"><button class="btn small ghost" data-a="log_call">Log call</button></div>' +
            '<h2>Disposition</h2><div class="rowline">' +
            '<button class="btn small green" data-a="green">GREEN close</button>' +
            '<button class="btn small amber" data-a="amber">AMBER visit</button>' +
            '<button class="btn small red" data-a="red">RED 1962</button></div>' +
            '<label>Visit date (AMBER)</label><input id="vd" type="date">' +
            '<label>Visit slot</label><select id="vs"><option value="">—</option>' + slotOpts + '</select>' +
            '<div class="rowline">' +
            '<button class="btn small ghost" data-a="visit_done"' + (r.status !== 'VISIT_SCHEDULED' ? ' disabled' : '') + '>Visit done → resolve</button>' +
            '<button class="btn small ghost" data-a="cancel">Cancel</button></div>') +
        '</div>';
    }
    render(
      '<div class="token"><div class="lbl">' + esc(T('అభ్యర్థన సంఖ్య', 'Request token')) + '</div>' +
      '<div class="no">' + esc(r.ticket) + '</div><div class="lbl">' + esc(r.created_at) + '</div></div>' +
      '<div class="card"><p>' + badge(r.status) +
      (r.emergency ? ' <span class="badge b-ESCALATED">' + esc(T('అత్యవసరం', 'EMERGENCY')) + '</span>' : '') + '</p>' +
      '<p><b>' + esc(spLabel(r.species)) + '</b> — ' + esc(syLabel(r.symptom)) + '</p>' + svcLine +
      '<p class="hint">' + esc(r.gp ? r.gp + ', ' : '') + esc(r.village) + ', ' + esc(r.mandal) + '</p>' +
      (r.description ? '<p>' + esc(r.description) + '</p>' : '') +
      (r.pashu_tag ? '<p class="hint">Ear tag: ' + esc(r.pashu_tag) + '</p>' : '') +
      visit + farmer + farmLoc + vet + photo + '</div>' + video +
      (!staff ? facilityCard(r.facility, T('మీ పశు వైద్య కేంద్రం', 'Your veterinary centre')) : '') +
      report + rx + actions +
      '<div class="card"><h2>' + TL('పురోగతి', 'Progress') + '</h2><ul class="rail">' + events + '</ul></div>' +
      (!staff && (r.status === 'NEW' || caseOpen)
        ? '<button class="btn ghost" style="color:var(--red);border-color:var(--red)" id="wd">✖ ' +
          esc(T('అభ్యర్థన రద్దు చేయండి', 'Withdraw this request')) + '</button><div style="height:8px"></div>'
        : '') +
      '<a class="btn ghost" href="' + (staff ? '#vet' : '#home') + '">← ' + (staff ? 'Queue' : esc(T('హోమ్', 'Home'))) + '</a>');
    if (el('wd')) el('wd').onclick = function () {
      if (!confirm(T('ఖచ్చితంగా రద్దు చేయాలా? ఇది వెనక్కి తీసుకోలేరు.', 'Withdraw this request? This cannot be undone.'))) return;
      busy(el('wd'), api('request.withdraw', { id: r.id })).then(function () {
        toast(T('అభ్యర్థన రద్దు అయ్యింది', 'Request withdrawn'));
        vTicket(ticket);
      })
        .catch(function (e) { el('wd').disabled = false; alert(e.message); });
    };
    if (staff && el('acts')) {
      var onThisTicket = function () { return location.hash === '#t/' + ticket; };
      if (el('addmed')) {
        el('addmed').onclick = function () { addMedRow(); };
        addMedRow(); // start with one row so the doctor can just type
      }
      // the link opens WhatsApp on its own; this only records the attempt for the district
      if (el('vcall')) el('vcall').onclick = function () {
        api('vet.callPlaced', { id: r.id }).catch(function () {});
      };
      if (el('claim')) el('claim').onclick = function () {
        api('vet.claim', { id: r.id }).then(function () { if (onThisTicket()) vTicket(ticket); })
          .catch(function (e) { alert(e.message); if (onThisTicket()) vTicket(ticket); });
      };
      Array.prototype.forEach.call(document.querySelectorAll('#acts [data-a]'), function (b) {
        b.onclick = function () {
          b.classList.add('busy');
          var unbusy = function () { b.classList.remove('busy'); };
          var rxFile = el('rxf') && el('rxf').files[0];
          compressPhoto(rxFile).then(function (rxb64) {
            return api('vet.act', { id: r.id, action: b.getAttribute('data-a'),
              note: (el('note') || {}).value || '', visit_date: (el('vd') || {}).value || '',
              visit_slot: (el('vs') || {}).value || '',
              meds: collectMeds(), advice: (el('adv') || {}).value || '',
              followup_date: (el('fud') || {}).value || '',
              weight_kg: (el('wkg') || {}).value || '', temp_c: (el('tpc') || {}).value || '',
              tests: (el('tst') || {}).value || '',
              rx_b64: rxb64 || '', rx_mime: 'image/jpeg' });
          }).then(function () {
            unbusy();
            toast('Saved');
            if (onThisTicket()) vTicket(ticket);
          }).catch(function (e) { unbusy(); alert(e.message); });
        };
      });
    }
    startPoll(function () { if (location.hash === '#t/' + ticket) vTicket(ticket); });
  }).catch(function (e) { if (e.code === 'auth') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

/* All of a user's requests, filterable. Everything here is already in farmer.myRequests. */
function vCases(filter) {
  filter = filter || 'all';
  loading(3);
  api('farmer.myRequests', {}).then(function (d) {
    var open = ['NEW', 'ASSIGNED', 'VISIT_SCHEDULED'];
    var list = d.requests.filter(function (r) {
      if (filter === 'open') return open.indexOf(r.status) >= 0;
      if (filter === 'done') return open.indexOf(r.status) < 0;
      return true;
    });
    var cards = list.map(function (r) {
      return '<a class="card" href="#t/' + esc(r.ticket) + '" style="display:block">' +
        '<div class="rowline">' + badge(r.status) +
          '<span style="flex:1"></span><span class="en">' + esc(r.ticket) + '</span></div>' +
        '<div style="font-size:14.5px;font-weight:800;margin-top:6px">' + esc(spLabel(r.species)) +
          ' · ' + esc(syLabel(r.symptom)) + '</div>' +
        '<div class="en">' + (r.vet ? esc(r.vet.name) + ' · ' : '') +
          esc(String(r.created_at).slice(0, 16)) + '</div></a>';
    }).join('') || '<div class="card hint">' +
      esc(T('ఇక్కడ ఏమీ లేదు', 'Nothing here yet')) + '</div>';
    render(
      '<h1>' + TL('నా కేసులు', 'My cases') + '</h1>' +
      '<div class="chips" style="margin:12px 0">' +
        '<button class="chip' + (filter === 'all' ? ' on' : '') + '" data-f="all">' +
          esc(T('అన్నీ', 'All')) + '</button>' +
        '<button class="chip' + (filter === 'open' ? ' on' : '') + '" data-f="open">' +
          esc(T('నడుస్తున్నవి', 'Active')) + '</button>' +
        '<button class="chip' + (filter === 'done' ? ' on' : '') + '" data-f="done">' +
          esc(T('ముగిసినవి', 'Closed')) + '</button></div>' +
      cards);
    Array.prototype.forEach.call(document.querySelectorAll('[data-f]'), function (b) {
      b.onclick = function () { vCases(b.getAttribute('data-f')); };
    });
  }).catch(function (e) { if (e.code === 'auth') return logout();
    render('<div class="err">' + esc(e.message) + '</div>'); });
}

/* One card per ear tag, built by grouping the user's own request history. The backend has
   no animal table - the tag on each request is the only identity an animal has. */
function vAnimals() {
  loading(2);
  api('farmer.myRequests', {}).then(function (d) {
    var by = {}, order = [];
    d.requests.forEach(function (r) {
      var k = r.pashu_tag ? 'tag:' + r.pashu_tag : 'sp:' + r.species;
      if (!by[k]) { by[k] = { tag: r.pashu_tag, species: r.species, rows: [] }; order.push(k); }
      by[k].rows.push(r);
    });
    var cards = order.map(function (k) {
      var a = by[k];
      return '<div class="card">' +
        '<div class="rowline"><span style="font-size:24px">' +
          esc((SPECIES.find(function (x) { return x.v === a.species; }) || { pic: '🐄' }).pic) + '</span>' +
        '<div style="flex:1;min-width:0"><b style="font-size:14.5px">' + esc(spLabel(a.species)) + '</b>' +
        '<div class="en">' + (a.tag ? 'Tag ' + esc(a.tag) :
          esc(T('ట్యాగ్ లేదు', 'No ear tag'))) + ' · ' +
          a.rows.length + ' ' + esc(T('సందర్శనలు', 'visits')) + '</div></div></div>' +
        '<table style="margin-top:9px">' + a.rows.slice(0, 5).map(function (r) {
          return '<tr><td><b>' + esc(String(r.created_at).slice(0, 10)) + '</b><br>' +
            '<span class="en">' + esc(syLabel(r.symptom)) + '</span></td>' +
            '<td style="text-align:right"><a class="btn small ghost" href="#t/' + esc(r.ticket) + '">' +
            esc(T('చూడండి', 'Open')) + '</a></td></tr>';
        }).join('') + '</table></div>';
    }).join('') || '<div class="card hint">' +
      esc(T('ఇంకా పశువులు లేవు — అభ్యర్థన పంపినప్పుడు ఇక్కడ కనబడతాయి',
        'No animals yet. They appear here once you file a request with an ear tag.')) + '</div>';
    render('<h1>' + TL('నా పశువులు', 'My animals') + '</h1>' +
      '<p class="hint" style="margin-bottom:12px">' +
      esc(T('చెవి ట్యాగ్ నంబర్ ప్రకారం గత చరిత్ర',
        'History grouped by ear tag')) + '</p>' + cards);
  }).catch(function (e) { if (e.code === 'auth') return logout();
    render('<div class="err">' + esc(e.message) + '</div>'); });
}

/* The centre this user's panchayat routes to, with its real service list and timings. */
function vCentre() {
  loading(3);
  api('farmer.myRequests', {}).then(function (d) {
    var withFac = d.requests.filter(function (r) { return r.facility; })[0];
    if (!withFac) {
      return render('<h1>' + TL('మీ కేంద్రం', 'Your centre') + '</h1>' +
        '<div class="card hint">' + esc(T('మొదటి అభ్యర్థన పంపిన తర్వాత మీ కేంద్రం ఇక్కడ కనబడుతుంది',
          'Your centre appears here once you file your first request.')) + '</div>' +
        '<a class="btn" href="#new">' + esc(T('కొత్త అభ్యర్థన', 'New request')) + '</a>');
    }
    var f = withFac.facility;
    render('<h1>' + TL('మీ కేంద్రం', 'Your centre') + '</h1>' +
      facilityCard(f, '') +
      '<div class="card" style="background:var(--cta-50);box-shadow:none">' +
        '<div class="rowline" style="align-items:flex-start"><span style="font-size:17px">ℹ️</span>' +
        '<div class="hint" style="flex:1"><b>' +
        esc(T('ఈ కేంద్రం మీకు ఎందుకు?', 'Why this centre?')) + '</b><br>' +
        esc(T('మీ గ్రామ పంచాయతీ ఈ కేంద్రానికి కేటాయించబడింది. డాక్టర్ను మీరు ఎంచుకోరు — ఆ రోజు డ్యూటీలో ఉన్నవారు మీ కేసు తీసుకుంటారు.',
          'Your Gram Panchayat is mapped to this centre. You never pick a doctor — whoever is on duty that day takes your case.')) +
        '</div></div></div>' +
      '<a class="btn" href="#new">' + esc(T('సలహా అడగండి', 'Ask a vet')) + '</a>');
  }).catch(function (e) { if (e.code === 'auth') return logout();
    render('<div class="err">' + esc(e.message) + '</div>'); });
}

/* Asked once at sign-in, reused on every request after that. Two equal routes in,
   because detection can only narrow it down - see the note on the screen. */
function vLoc(mode) {
  mode = mode || 'auto';
  loading(2);
  Promise.all([loadMasters(), api('meta.info', {})]).then(function (both) {
    var gps = both[0].gpsByMandal || {};
    var mandals = (S.meta && S.meta.mandals) || both[1].mandals || [];
    var cur = S.user || {};
    var mOpts = mandals.map(function (m) {
      return '<option value="' + esc(m.id) + '"' +
        (String(cur.mandal_id) === String(m.id) ? ' selected' : '') + '>' + esc(m.name) + '</option>';
    }).join('');

    var pane = mode === 'auto'
      ? '<div class="card" style="text-align:center;padding:20px 15px">' +
          '<div class="locpulse">\ud83d\udccd</div>' +
          '<div class="hint" style="margin-top:11px">' +
            esc(T('\u0c2e\u0c3f\u0c2e\u0c4d\u0c2e\u0c32\u0c4d\u0c28\u0c3f \u0c26\u0c17\u0c4d\u0c17\u0c30\u0c3f \u0c15\u0c47\u0c02\u0c26\u0c4d\u0c30\u0c3e\u0c28\u0c3f\u0c15\u0c3f \u0c38\u0c30\u0c3f\u0c2a\u0c4b\u0c32\u0c4d\u0c1a\u0c3f, \u0c2a\u0c02\u0c1a\u0c3e\u0c2f\u0c24\u0c40\u0c28\u0c3f \u0c2e\u0c3f\u0c2e\u0c4d\u0c2e\u0c32\u0c4d\u0c28\u0c3f \u0c27\u0c43\u0c35\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c2e\u0c28\u0c3f \u0c05\u0c21\u0c41\u0c17\u0c41\u0c24\u0c3e\u0c02',
              'We match you to the nearest centre, then ask you to confirm the panchayat.')) + '</div>' +
          '<button class="btn" style="margin-top:12px" id="locgo">' +
            esc(T('\u0c32\u0c4a\u0c15\u0c47\u0c37\u0c28\u0c4d \u0c05\u0c28\u0c41\u0c2e\u0c24\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f', 'Allow location')) + '</button>' +
          '<div id="locout" style="margin-top:11px"></div></div>'
      : '<div class="card">' +
          '<label style="margin-top:0">' + TL('\u0c2e\u0c02\u0c21\u0c32\u0c02', 'Mandal') + '</label>' +
          '<select id="lmd">' + mOpts + '</select>' +
          '<label>' + TL('\u0c17\u0c4d\u0c30\u0c3e\u0c2e \u0c2a\u0c02\u0c1a\u0c3e\u0c2f\u0c24\u0c40', 'Gram Panchayat') + '</label>' +
          '<select id="lgp"><option value="">\u2014</option></select>' +
          '<label>' + TL('\u0c17\u0c4d\u0c30\u0c3e\u0c2e\u0c02 / \u0c28\u0c3f\u0c35\u0c3e\u0c38\u0c02', 'Village / habitation') + '</label>' +
          '<input id="lvg" maxlength="80" value="' + esc(cur.village || '') + '">' +
          '<div style="height:13px"></div>' +
          '<button class="btn" id="lsave">' + esc(T('\u0c38\u0c47\u0c35\u0c4d \u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f', 'Save')) + '</button></div>';

    render(
      '<h1>' + TL('\u0c2e\u0c40 \u0c2a\u0c36\u0c41\u0c35\u0c41 \u0c0e\u0c15\u0c4d\u0c15\u0c21 \u0c09\u0c02\u0c26\u0c3f?', 'Where is your animal?') + '</h1>' +
      '<p class="hint" style="margin:6px 0 13px">' +
        esc(T('\u0c2e\u0c40 \u0c17\u0c4d\u0c30\u0c3e\u0c2e \u0c2a\u0c02\u0c1a\u0c3e\u0c2f\u0c24\u0c40 \u0c2c\u0c1f\u0c4d\u0c1f\u0c3f \u0c15\u0c47\u0c02\u0c26\u0c4d\u0c30\u0c02, \u0c21\u0c3e\u0c15\u0c4d\u0c1f\u0c30\u0c4d \u0c28\u0c3f\u0c30\u0c4d\u0c23\u0c2f\u0c3f\u0c02\u0c1a\u0c2c\u0c21\u0c24\u0c3e\u0c30\u0c41. \u0c12\u0c15\u0c4d\u0c15\u0c38\u0c3e\u0c30\u0c3f \u0c05\u0c21\u0c3f\u0c17\u0c3f\u0c24\u0c47 \u0c1a\u0c3e\u0c32\u0c41.',
          'Your Gram Panchayat decides the centre and the on-duty vet. Asked once, then remembered.')) + '</p>' +
      '<div class="split">' +
        '<a id="optAuto" class="' + (mode === 'auto' ? 'on' : '') + '"><span class="e">\ud83d\udccd</span>' +
          '<div class="t">' + esc(T('\u0c28\u0c3e \u0c32\u0c4a\u0c15\u0c47\u0c37\u0c28\u0c4d', 'Use my location')) + '</div>' +
          '<div class="s">' + esc(T('\u0c35\u0c47\u0c17\u0c02\u0c17\u0c3e', 'Fastest')) + '</div></a>' +
        '<a id="optMan" class="' + (mode === 'man' ? 'on' : '') + '"><span class="e">\u270d\ufe0f</span>' +
          '<div class="t">' + esc(T('\u0c28\u0c47\u0c28\u0c47 \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c41\u0c02\u0c1f\u0c3e', 'Enter it myself')) + '</div>' +
          '<div class="s">' + esc(T('\u0c1c\u0c3e\u0c2c\u0c3f\u0c24\u0c3e \u0c28\u0c41\u0c02\u0c1a\u0c3f', 'From a list')) + '</div></a>' +
      '</div>' + pane +
      '<div class="card" style="background:var(--cta-50);box-shadow:none">' +
        '<div class="rowline" style="align-items:flex-start"><span style="font-size:17px">\u2139\ufe0f</span>' +
        '<div class="hint" style="flex:1">' +
        esc(T('\u0c17\u0c4d\u0c30\u0c3e\u0c2e \u0c2a\u0c02\u0c1a\u0c3e\u0c2f\u0c24\u0c40 \u0c17\u0c21\u0c3f \u0c35\u0c3f\u0c35\u0c30\u0c3e\u0c32\u0c41 \u0c07\u0c02\u0c15\u0c3e \u0c2a\u0c42\u0c30\u0c4d\u0c24\u0c3f \u0c15\u0c3e\u0c32\u0c47\u0c26\u0c41, \u0c05\u0c02\u0c26\u0c41\u0c15\u0c47 \u0c32\u0c4a\u0c15\u0c47\u0c37\u0c28\u0c4d \u0c26\u0c17\u0c4d\u0c17\u0c30\u0c3f \u0c15\u0c47\u0c02\u0c26\u0c4d\u0c30\u0c3e\u0c28\u0c4d\u0c28\u0c3f \u0c2e\u0c3e\u0c24\u0c4d\u0c30\u0c2e\u0c47 \u0c1a\u0c42\u0c2a\u0c41\u0c24\u0c41\u0c02\u0c26\u0c3f \u2014 \u0c2e\u0c40\u0c30\u0c41 \u0c27\u0c43\u0c35\u0c40\u0c15\u0c30\u0c3f\u0c02\u0c1a\u0c3e\u0c32\u0c3f.',
          'GP boundary data is incomplete in the district master, so detection can only point at the nearest centre and ask you to confirm.')) +
        '</div></div></div>');

    el('optAuto').onclick = function () { vLoc('auto'); };
    el('optMan').onclick = function () { vLoc('man'); };

    if (mode === 'man') {
      var fillGps = function () {
        var name = (mandals.find(function (x) { return String(x.id) === el('lmd').value; }) || {}).name;
        var list = gps[name] || [];
        el('lgp').innerHTML = '<option value="">\u2014</option>' + list.map(function (g) {
          return '<option' + (g === cur.gp ? ' selected' : '') + '>' + esc(g) + '</option>';
        }).join('');
      };
      el('lmd').onchange = fillGps;
      fillGps();
      el('lsave').onclick = function () {
        busy(el('lsave'), api('farmer.setLocation', { mandal_id: el('lmd').value,
          gp: el('lgp').value, village: el('lvg').value }))
          .then(function (d) {
            S.user = d.user;
            localStorage.setItem('jps_user', JSON.stringify(S.user));
            toast(T('\u0c32\u0c4a\u0c15\u0c47\u0c37\u0c28\u0c4d \u0c38\u0c47\u0c35\u0c4d \u0c05\u0c2f\u0c3f\u0c02\u0c26\u0c3f', 'Location saved'));
            location.hash = '#home';
          })
          .catch(function (e) { toast(e.message); });
      };
    } else {
      el('locgo').onclick = function () {
        var b = el('locgo');
        b.classList.add('busy');
        el('locout').innerHTML = '<div class="sk" style="width:70%;margin:0 auto"></div>';
        var done = function (fac) {
          b.classList.remove('busy');
          b.hidden = true;
          el('locout').innerHTML =
            '<div class="locfound"><div class="rowline"><span style="font-size:17px">\u2705</span>' +
            '<div style="flex:1;min-width:0"><b>' + esc(fac ? fac.name : T('\u0c26\u0c17\u0c4d\u0c17\u0c30\u0c3f \u0c15\u0c47\u0c02\u0c26\u0c4d\u0c30\u0c02', 'Nearest centre')) + '</b>' +
            '<div class="en">' + esc(fac ? (fac.mandal || '') + (fac.village ? ' \u00b7 ' + fac.village : '') : '') + '</div></div></div>' +
            '<div class="en" style="margin-top:7px">' +
            esc(T('\u0c07\u0c26\u0c3f \u0c38\u0c30\u0c48\u0c28\u0c26\u0c47\u0c28\u0c3e? \u0c2a\u0c02\u0c1a\u0c3e\u0c2f\u0c24\u0c40\u0c28\u0c3f \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f.', 'Is that right? Pick your panchayat to confirm.')) + '</div>' +
            '<button class="btn" style="margin-top:10px" id="locconf">' +
            esc(T('\u0c2a\u0c02\u0c1a\u0c3e\u0c2f\u0c24\u0c40 \u0c0e\u0c02\u0c1a\u0c41\u0c15\u0c4b\u0c02\u0c21\u0c3f', 'Choose my panchayat')) + '</button></div>';
          el('locconf').onclick = function () { vLoc('man'); };
        };
        if (!navigator.geolocation) return done(null);
        navigator.geolocation.getCurrentPosition(function (pos) {
          var fs = (S.masters && S.masters.facilities) || [];
          var best = null, bestD = Infinity;
          fs.forEach(function (f) {
            if (!f.lat || !f.lng) return;
            var dx = (Number(f.lat) - pos.coords.latitude) * 111000;
            var dy = (Number(f.lng) - pos.coords.longitude) * 105000;
            var dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < bestD) { bestD = dd; best = f; }
          });
          done(best);
        }, function () { done(null); }, { timeout: 8000 });
      };
    }
  }).catch(function (e) { if (e.code === 'auth') return logout();
    render('<div class="err">' + esc(e.message) + '</div>'); });
}

/* Vaccination, derived from resolved PRV-01 visits. There is no vaccination register
   in the backend, so this reads the user's own history rather than inventing dates. */
function vVacc() {
  loading(2);
  api('farmer.myRequests', {}).then(function (d) {
    var today = new Date().toISOString().slice(0, 10);
    var addMonths = function (iso, n) {
      var q = String(iso).slice(0, 10).split('-');
      var y = Number(q[0]), mo = Number(q[1]) - 1 + n, dd = Number(q[2]);
      y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
      var last = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
                  31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo];
      if (dd > last) dd = last;
      var two = function (x) { return (x < 10 ? '0' : '') + x; };
      return y + '-' + two(mo + 1) + '-' + two(dd);
    };
    var by = {}, order = [];
    d.requests.forEach(function (r) {
      var k = r.pashu_tag ? 'tag:' + r.pashu_tag : 'sp:' + r.species;
      if (!by[k]) { by[k] = { tag: r.pashu_tag, species: r.species, last: null }; order.push(k); }
      var isVacc = r.service && r.service.code === 'PRV-01';
      if (isVacc && r.status === 'RESOLVED') {
        var when = String(r.closed_at || r.created_at).slice(0, 10);
        if (!by[k].last || when > by[k].last) by[k].last = when;
      }
    });
    var cards = order.map(function (k) {
      var a = by[k], due = a.last ? addMonths(a.last, 6) : null;
      var state = !a.last ? 'none' : (today > due ? 'overdue' : 'ok');
      var pill = state === 'none'
        ? '<span class="badge b-NEW">' + esc(T('\u0c30\u0c3f\u0c15\u0c3e\u0c30\u0c4d\u0c21\u0c41 \u0c32\u0c47\u0c26\u0c41', 'No record')) + '</span>'
        : state === 'overdue'
          ? '<span class="badge b-ESCALATED">' + esc(T('\u0c06\u0c32\u0c38\u0c4d\u0c2f\u0c02', 'Overdue')) + '</span>'
          : '<span class="badge b-RESOLVED">' + esc(due) + '</span>';
      return '<div class="card"><div class="rowline">' +
        '<span style="font-size:23px">' + esc((SPECIES.find(function (x) { return x.v === a.species; })
          || { pic: '\ud83d\udc04' }).pic) + '</span>' +
        '<div style="flex:1;min-width:0"><b style="font-size:14px">' + esc(spLabel(a.species)) + '</b>' +
        '<div class="en">' + (a.tag ? 'Tag ' + esc(a.tag) : esc(T('\u0c1f\u0c4d\u0c2f\u0c3e\u0c17\u0c4d \u0c32\u0c47\u0c26\u0c41', 'No ear tag'))) + '</div></div>' +
        pill + '</div>' +
        '<div class="en" style="margin-top:8px">' + (a.last
          ? esc(T('\u0c1a\u0c3f\u0c35\u0c30\u0c3f \u0c1f\u0c40\u0c15\u0c3e', 'Last vaccination')) + ': ' + esc(a.last) +
            ' \u00b7 ' + esc(T('\u0c24\u0c30\u0c41\u0c35\u0c3e\u0c24\u0c3f\u0c26\u0c3f', 'next')) + ' ' + esc(due)
          : esc(T('\u0c08 \u0c2f\u0c3e\u0c2a\u0c4d\u200c\u0c32\u0c4b \u0c1f\u0c40\u0c15\u0c3e \u0c30\u0c3f\u0c15\u0c3e\u0c30\u0c4d\u0c21\u0c41 \u0c32\u0c47\u0c26\u0c41', 'No vaccination recorded through this app')) ) +
        '</div></div>';
    }).join('') || '<div class="card hint">' +
      esc(T('\u0c07\u0c02\u0c15\u0c3e \u0c2a\u0c36\u0c41\u0c35\u0c41\u0c32\u0c41 \u0c32\u0c47\u0c35\u0c41', 'No animals yet')) + '</div>';

    render('<h1>' + TL('\u0c1f\u0c40\u0c15\u0c3e\u0c32\u0c41', 'Vaccination') + '</h1>' +
      '<p class="hint" style="margin:6px 0 13px">' +
        esc(T('FMD \u0c1f\u0c40\u0c15\u0c3e \u0c2a\u0c4d\u0c30\u0c24\u0c3f 6 \u0c28\u0c46\u0c32\u0c32\u0c15\u0c41. \u0c08 \u0c24\u0c47\u0c26\u0c40\u0c32\u0c41 \u0c2e\u0c40 \u0c38\u0c4a\u0c02\u0c24 \u0c2d\u0c47\u0c1f\u0c40 \u0c1a\u0c30\u0c3f\u0c24\u0c4d\u0c30 \u0c28\u0c41\u0c02\u0c1a\u0c3f \u0c32\u0c46\u0c15\u0c4d\u0c15\u0c3f\u0c02\u0c1a\u0c3f\u0c28\u0c35\u0c3f \u2014 \u0c05\u0c27\u0c3f\u0c15\u0c3e\u0c30\u0c3f\u0c15 \u0c30\u0c3f\u0c1c\u0c3f\u0c38\u0c4d\u0c1f\u0c30\u0c4d \u0c15\u0c3e\u0c26\u0c41.',
          'FMD is every 6 months. These dates are worked out from your own visit history, not an official register.')) + '</p>' +
      cards +
      '<a class="btn" href="#new">' + esc(T('\u0c1f\u0c40\u0c15\u0c3e \u0c15\u0c4b\u0c38\u0c02 \u0c05\u0c2d\u0c4d\u0c2f\u0c30\u0c4d\u0c25\u0c3f\u0c02\u0c1a\u0c02\u0c21\u0c3f', 'Request a vaccination')) + '</a>');
  }).catch(function (e) { if (e.code === 'auth') return logout();
    render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vTips() {
  var row = function (icon, te, en, bad) {
    return '<div class="tiprow' + (bad ? ' bad' : '') + '"><span class="ti">' + icon + '</span>' +
      '<div>' + TL(te, en) + '</div></div>';
  };
  render(
    '<h1>' + TL('పశు సంరక్షణ', 'Animal care') + '</h1>' +
    '<p class="hint" style="margin:6px 0 14px">' +
      esc(T('జనగామ పశు వైద్య శాఖ సాధారణ సూచనలు. తీవ్రంగా అనారోగ్యంగా ఉంటే 1962కి కాల్ చేయండి.',
        'General guidance from the Jangaon Veterinary Department. If the animal is seriously ill, call 1962.')) + '</p>' +

    '<div class="card"><h2>✅ ' + TL('చేయవలసినవి', 'Do') + '</h2>' +
      row('💧', 'పశువులకు ఎప్పుడూ శుభ్రమైన తాగునీరు అందుబాటులో ఉంచండి',
        'Keep clean drinking water available at all times') +
      row('💉', 'ప్రభుత్వ టీకాలు సకాలంలో వేయించండి',
        'Keep government vaccinations on schedule') +
      row('🪱', 'సంవత్సరానికి కనీసం రెండుసార్లు నాగలి నివారణ మందు',
        'Deworm at least twice a year') +
      row('🥛', 'పాలు పితికే ముందు, తర్వాత పొదుగును శుభ్రం చేయండి',
        'Clean the udder before and after milking') +
      row('🏷️', 'చెవి ట్యాగ్ నంబర్ భద్రంగా నోట్ చేసుకోండి',
        'Keep the ear tag number noted safely') +
    '</div>' +

    '<div class="card"><h2>⛔ ' + TL('చేయకూడనివి', "Don't") + '</h2>' +
      row('💊', 'డాక్టర్ సూచన లేకుండా సొంతంగా యాంటీబయాటిక్స్ ఇవ్వవద్దు',
        'Never give antibiotics without a vet’s advice', 1) +
      row('🌾', 'పురుగుమందు చల్లిన పొలాల్లో వెంటనే మేపవద్దు',
        'Do not graze on freshly sprayed fields', 1) +
      row('🐄', 'ఈత కష్టమైనప్పుడు బలవంతంగా లాగవద్దు — 1962కి కాల్ చేయండి',
        'Never pull during a difficult calving — call 1962', 1) +
      row('🚫', 'ప్లాస్టిక్ కవర్లు, పాడైన మేత పశువులకు అందకుండా చూడండి',
        'Keep plastic and spoiled feed away from animals', 1) +
      row('🐍', 'పాము కాటుకు నాటు వైద్యం మీద ఆధారపడవద్దు',
        'Do not rely on home remedies for snakebite', 1) +
    '</div>' +

    '<a class="sosbar" href="tel:1962"><span class="sb-ic">🚑</span>' +
      '<span><b>' + esc(T('అత్యవసరమా? 1962', 'Emergency? Call 1962')) + '</b>' +
      '<span class="hint">' + esc(T('24 గంటలూ ఉచిత', 'Free, 24 hours')) + '</span></span></a>');
}
function staffNav(cur) {
  var items = [['#vet', 'Queue'], ['#att', 'Attendance'], ['#leave', 'Leave'],
               ['#stock', 'Stock'], ['#issues', 'Issues']];
  if (S.user && S.user.role === 'admin') {
    items.unshift(['#admin', 'Dashboard']);
    items.push(['#bcast', 'Broadcasts']);
  }
  return '<div class="staffnav">' + items.map(function (i) {
    return '<button data-nav="' + i[0] + '" class="' + (cur === i[0] ? 'on' : '') + '">' + i[1] + '</button>';
  }).join('') + '</div>';
}
function wireStaffNav() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (b) {
    b.onclick = function () { location.hash = b.getAttribute('data-nav'); };
  });
}

function vAttend() {
  loading(2);
  api('staff.attendance', {}).then(function (d) {
    var last = d.records[0];
    var nextIn = !last || last.type === 'out';
    var rows = d.records.map(function (r) {
      var loc = (r.lat && r.lng)
        ? ' <a target="_blank" rel="noopener" href="' + mapsLink(r.lat, r.lng) + '">📍</a>' +
          (r.dist_m !== '' && r.dist_m != null ? '<span class="hint"> ' + esc(String(r.dist_m)) + 'm</span>' : '') : '';
      var ph = r.has_photo ? ' <a href="#" data-ph="' + esc(r.id) + '">📷</a>' : '';
      return '<tr><td>' + (r.type === 'in' ? '✅ In' : '🏁 Out') + loc + ph +
        '<div id="phbox-' + esc(r.id) + '"></div></td><td>' + esc(r.at) + '</td></tr>';
    }).join('') || '<tr><td colspan="2" class="hint">No records yet</td></tr>';
    render('<h1>Attendance</h1>' + staffNav('#att') +
      '<div class="card" style="text-align:center"><div id="msg"></div>' +
      '<label style="text-align:left">Live photo — camera only, no gallery</label>' +
      '<video id="cam" class="cam" autoplay playsinline muted></video>' +
      '<div id="campv"></div>' +
      '<div class="rowline" style="justify-content:center"><button class="btn small ghost" id="snap">📸 Capture</button></div>' +
      '<p class="hint">Your location is captured automatically. Staff mapped to a centre must be within 300 m of it to mark attendance.</p>' +
      '<button class="btn ' + (nextIn ? 'green' : 'amber') + '" id="att" disabled>' +
      (nextIn ? '✅ Check in' : '🏁 Check out') + '</button></div>' +
      '<div class="card"><h2>My recent records</h2><table>' + rows + '</table></div>');
    wireStaffNav();
    var camB64 = null;
    function startCam() {
      camB64 = null;
      el('att').disabled = true;
      el('campv').innerHTML = '';
      el('cam').style.display = '';
      el('snap').textContent = '📸 Capture';
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        el('msg').innerHTML = '<div class="err">This browser has no live camera support — use Chrome</div>';
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(function (st) { camStream = st; el('cam').srcObject = st; })
        .catch(function () { el('msg').innerHTML = '<div class="err">Allow camera access to mark attendance</div>'; });
    }
    startCam();
    el('snap').onclick = function () {
      if (camB64) { startCam(); return; } // retake
      var v = el('cam');
      if (!v.videoWidth) { el('msg').innerHTML = '<div class="err">Camera not ready yet</div>'; return; }
      var cv = document.createElement('canvas');
      var k = Math.min(1, 640 / v.videoWidth);
      cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
      cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      camB64 = cv.toDataURL('image/jpeg', 0.7).split(',')[1];
      stopCam();
      v.style.display = 'none';
      el('campv').innerHTML = '<img class="ph" style="max-width:200px" src="data:image/jpeg;base64,' + camB64 + '">';
      el('snap').textContent = '🔄 Retake';
      el('msg').innerHTML = '';
      el('att').disabled = false;
    };
    el('att').onclick = function () {
      if (!camB64) return;
      el('att').disabled = true;
      el('att').textContent = 'Getting location…';
      if (!navigator.geolocation) { el('msg').innerHTML = '<div class="err">GPS unavailable on this device</div>'; return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        api('staff.attend', { type: nextIn ? 'in' : 'out', photo_b64: camB64, photo_mime: 'image/jpeg',
          lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })
        .then(vAttend).catch(function (e) {
          el('msg').innerHTML = '<div class="err">' + esc(e.message) + '</div>';
          el('att').disabled = false; el('att').textContent = nextIn ? '✅ Check in' : '🏁 Check out';
        });
      }, function () {
        el('msg').innerHTML = '<div class="err">Could not get location — switch on GPS and try again</div>';
        el('att').disabled = false; el('att').textContent = nextIn ? '✅ Check in' : '🏁 Check out';
      }, { enableHighAccuracy: true, timeout: 15000 });
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-ph]'), function (a) {
      a.onclick = function (ev) {
        ev.preventDefault();
        api('staff.attendPhoto', { id: a.getAttribute('data-ph') }).then(function (d2) {
          el('phbox-' + a.getAttribute('data-ph')).innerHTML =
            '<img class="ph" style="max-width:140px" src="data:' + esc(d2.photo.mime) + ';base64,' + d2.photo.b64 + '">';
        }).catch(function (e) { alert(e.message); });
      };
    });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vLeave() {
  loading(2);
  var isAdmin = S.user.role === 'admin';
  Promise.all([api('staff.leaveList', {}), isAdmin ? api('staff.leaveList', { all: 1 }) : Promise.resolve(null)])
  .then(function (res) {
    var mine = res[0].leaves.map(function (l) {
      return '<tr><td>' + esc(l.from_date) + ' → ' + esc(l.to_date) + '<br><span class="hint">' + esc(l.reason) + '</span></td>' +
        '<td><span class="badge ' + (l.status === 'approved' ? 'b-RESOLVED' : l.status === 'rejected' ? 'b-ESCALATED' : 'b-NEW') + '">' + esc(l.status) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="2" class="hint">No leave requests</td></tr>';
    var pendingAll = '';
    if (isAdmin) {
      var pend = res[1].leaves.filter(function (l) { return l.status === 'pending'; });
      pendingAll = '<div class="card"><h2>Pending approvals (' + pend.length + ')</h2><table>' +
        (pend.map(function (l) {
          return '<tr><td><b>' + esc(l.name) + '</b><br>' + esc(l.from_date) + ' → ' + esc(l.to_date) +
            '<br><span class="hint">' + esc(l.reason) + '</span></td>' +
            '<td><div class="rowline"><button class="btn small green" data-lv="' + esc(l.id) + '" data-d="approved">Approve</button>' +
            '<button class="btn small red" data-lv="' + esc(l.id) + '" data-d="rejected">Reject</button></div></td></tr>';
        }).join('') || '<tr><td class="hint">Nothing pending</td></tr>') + '</table></div>';
    }
    render('<h1>Leave</h1>' + staffNav('#leave') +
      '<div class="card"><h2>Request leave</h2><div id="msg"></div>' +
      '<label>From</label><input id="lf" type="date">' +
      '<label>To</label><input id="lt" type="date">' +
      '<label>Reason</label><input id="lr" type="text" maxlength="300">' +
      '<div style="height:10px"></div><button class="btn small" id="lgo">Submit request</button></div>' +
      pendingAll +
      '<div class="card"><h2>My requests</h2><table>' + mine + '</table></div>');
    wireStaffNav();
    el('lgo').onclick = function () {
      api('staff.leaveRequest', { from_date: el('lf').value, to_date: el('lt').value, reason: el('lr').value })
        .then(vLeave).catch(function (e) { el('msg').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-lv]'), function (b) {
      b.onclick = function () {
        api('admin.leaveDecide', { id: b.getAttribute('data-lv'), decision: b.getAttribute('data-d') })
          .then(vLeave).catch(function (e) { alert(e.message); });
      };
    });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vStock() {
  loading(2);
  var fc = localStorage.getItem('jps_stock_fc') || 'AH-01';
  loadMasters().then(function (M) {
    return api('stock.list', { facility_code: fc }).then(function (d) {
      var facOpts = M.facilities.map(function (f) {
        return '<option value="' + esc(f.code) + '"' + (f.code === fc ? ' selected' : '') + '>' + esc(f.code) + ' — ' + esc(f.name) + '</option>';
      }).join('');
      var have = {};
      var rows = d.stock.map(function (s) {
        have[s.item_code] = 1;
        return '<tr class="' + (s.low ? 'breach' : '') + '"><td>' + esc(s.item_name) +
          (s.low ? ' <span class="badge b-ESCALATED">LOW</span>' : '') +
          '<br><span class="hint">' + esc(s.item_code) + '</span></td>' +
          '<td><input style="width:70px" type="number" min="0" id="q-' + esc(s.item_code) + '" value="' + s.qty + '"></td>' +
          '<td><input style="width:70px" type="number" min="0" id="r-' + esc(s.item_code) + '" value="' + s.reorder_level + '"></td>' +
          '<td><button class="btn small ghost" data-save="' + esc(s.item_code) + '">Save</button></td></tr>';
      }).join('') || '<tr><td colspan="4" class="hint">No items tracked here yet — add one below</td></tr>';
      var addOpts = M.stockItems.filter(function (i) { return !have[i.code]; }).map(function (i) {
        return '<option value="' + esc(i.code) + '">' + esc(i.name) + '</option>';
      }).join('');
      render('<h1>Medicine stock</h1>' + staffNav('#stock') +
        '<div class="card"><label>Facility</label><select id="fc">' + facOpts + '</select>' +
        '<table style="margin-top:10px"><tr><th>Item</th><th>Qty</th><th>Reorder at</th><th></th></tr>' + rows + '</table>' +
        '<h2>Track new item</h2><select id="ni">' + addOpts + '</select>' +
        '<div class="rowline"><input style="width:90px" type="number" min="0" id="nq" placeholder="Qty">' +
        '<input style="width:90px" type="number" min="0" id="nr" placeholder="Reorder">' +
        '<button class="btn small" id="nadd">Add</button></div>' +
        '<p class="hint">Red rows are at/under reorder level. Quantities live here, not in the workbook.</p></div>');
      wireStaffNav();
      el('fc').onchange = function () { localStorage.setItem('jps_stock_fc', el('fc').value); vStock(); };
      function save(code, qty, ro) {
        api('stock.upsert', { facility_code: el('fc').value, item_code: code, qty: qty, reorder_level: ro })
          .then(vStock).catch(function (e) { alert(e.message); });
      }
      Array.prototype.forEach.call(document.querySelectorAll('[data-save]'), function (b) {
        var c = b.getAttribute('data-save');
        b.onclick = function () { save(c, el('q-' + c).value, el('r-' + c).value); };
      });
      el('nadd').onclick = function () { save(el('ni').value, el('nq').value, el('nr').value); };
    });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vIssues() {
  loading(2);
  var isAdmin = S.user.role === 'admin';
  api('staff.issueList', {}).then(function (d) {
    var rows = d.issues.map(function (i) {
      var act = (isAdmin && i.status === 'open')
        ? '<div class="rowline"><input id="ir-' + esc(i.id) + '" type="text" placeholder="Response">' +
          '<button class="btn small ghost" data-close="' + esc(i.id) + '">Close</button></div>' : '';
      return '<div class="tip' + (i.status === 'open' ? '' : ' ') + '"><b>' + esc(i.by) + '</b> · ' + esc(i.category) +
        ' · <span class="badge ' + (i.status === 'open' ? 'b-NEW' : 'b-RESOLVED') + '">' + esc(i.status) + '</span>' +
        '<div>' + esc(i.text) + '</div>' +
        (i.response ? '<div class="hint">↳ ' + esc(i.response) + '</div>' : '') + act + '</div>';
    }).join('') || '<p class="hint">No issues raised</p>';
    render('<h1>Support issues</h1>' + staffNav('#issues') +
      '<div class="card"><h2>Raise an issue</h2><div id="msg"></div>' +
      '<label>Category</label><select id="ic"><option>supplies</option><option>equipment</option>' +
      '<option>app</option><option>other</option></select>' +
      '<label>Describe it</label><textarea id="it" maxlength="1000"></textarea>' +
      '<div style="height:10px"></div><button class="btn small" id="igo">Submit</button></div>' +
      '<div class="card"><h2>' + (isAdmin ? 'All issues' : 'My issues') + '</h2>' + rows + '</div>');
    wireStaffNav();
    el('igo').onclick = function () {
      api('staff.issueCreate', { category: el('ic').value, text: el('it').value })
        .then(vIssues).catch(function (e) { el('msg').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
      var id = b.getAttribute('data-close');
      b.onclick = function () {
        api('admin.issueClose', { id: id, response: (el('ir-' + id) || {}).value || '' })
          .then(vIssues).catch(function (e) { alert(e.message); });
      };
    });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vBcast() {
  loading(2);
  api('meta.broadcasts', {}).then(function (d) {
    var rows = d.broadcasts.map(function (b) {
      return '<div class="tip"><b>' + esc(b.title) + '</b><div>' + esc(b.body) + '</div>' +
        '<div class="hint">' + esc(b.at) + '</div>' +
        '<button class="btn small ghost" data-end="' + esc(b.id) + '">End broadcast</button></div>';
    }).join('') || '<p class="hint">No active broadcasts</p>';
    render('<h1>Broadcasts</h1>' + staffNav('#bcast') +
      '<div class="card"><h2>Publish a notice</h2><div id="msg"></div>' +
      '<p class="hint">Shows on every farmer\'s home screen until ended. Telugu first, English second.</p>' +
      '<label>Title</label><input id="bt" type="text" maxlength="120">' +
      '<label>Details</label><textarea id="bb" maxlength="1000"></textarea>' +
      '<div style="height:10px"></div><button class="btn small" id="bgo">Publish</button></div>' +
      '<div class="card"><h2>Active</h2>' + rows + '</div>');
    wireStaffNav();
    el('bgo').onclick = function () {
      api('admin.broadcast', { title: el('bt').value, body: el('bb').value })
        .then(vBcast).catch(function (e) { el('msg').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-end]'), function (b) {
      b.onclick = function () {
        api('admin.broadcastEnd', { id: b.getAttribute('data-end') }).then(vBcast)
          .catch(function (e) { alert(e.message); });
      };
    });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vStaff(msg) {
  stopPoll();
  var nb = S.meta && S.meta.needsBootstrap;
  render(
    '<div class="signin">' +
      '<div class="si-mark"><img src="icon-192.png" alt=""></div>' +
      '<h1>Staff sign-in</h1>' +
      '<p class="si-sub">Veterinary &amp; Animal Husbandry Dept, Jangaon</p>' +
    '</div>' +
    (msg ? '<div class="' + (msg.ok ? 'ok' : 'err') + '">' + esc(msg.text) + '</div>' : '') +
    '<div class="card">' +
      '<label style="margin-top:0">Email</label>' +
      '<input id="se" type="email" value="' + esc(localStorage.getItem('jps_staff_email') || '') + '">' +
      '<label>Access code</label>' +
      '<input id="sc" type="text" autocapitalize="characters" placeholder="10 characters">' +
      '<div style="height:14px"></div>' +
      '<button class="btn" id="cbtn">Sign in</button>' +
      '<div class="orline"><span>or</span></div>' +
      '<button class="btn ghost" id="gbtn">Sign in with Google</button>' +
      '<p class="en" style="text-align:center;margin-top:9px">Google works once the district OAuth ' +
        'client is configured. Until then use the access code.</p>' +
    '</div>' +
    (nb ? '<div class="card"><h2>First-time setup</h2>' +
      '<label>Your email</label><input id="be" type="email">' +
      '<label>Your name</label><input id="bn" type="text">' +
      '<label>Bootstrap code (from the setup() log)</label>' +
      '<input id="bc" type="text" autocapitalize="characters">' +
      '<div style="height:13px"></div><button class="btn" id="bbtn">Create admin</button></div>' : '') +
    '<p class="hint" style="text-align:center"><a href="#identify">← User app</a></p>');
  el('gbtn').onclick = function () {
    el('gbtn').classList.add('busy');
    tryGoogleSignIn().then(function (idt) {
      el('gbtn').classList.remove('busy');
      if (!idt) return vStaff({ ok: false, text: 'Google sign-in unavailable on this build — use the access code.' });
      api('staff.google', { id_token: idt })
        .then(function (d) { saveAuth(d.token, d.user); location.hash = d.user.role === 'admin' ? '#admin' : '#vet'; })
        .catch(function (e) { vStaff({ ok: false, text: e.message }); });
    });
  };
  el('cbtn').onclick = function () {
    busy(el('cbtn'), api('staff.code', { email: el('se').value, code: el('sc').value }))
      .then(function (d) {
        localStorage.setItem('jps_staff_email', el('se').value);
        saveAuth(d.token, d.user);
        location.hash = d.user.role === 'admin' ? '#admin' : '#vet';
      })
      .catch(function (e) { vStaff({ ok: false, text: e.message }); });
  };
  if (nb) el('bbtn').onclick = function () {
    busy(el('bbtn'), api('staff.bootstrap',
      { email: el('be').value, name: el('bn').value, code: el('bc').value }))
      .then(function (d) { saveAuth(d.token, d.user); location.hash = '#admin'; })
      .catch(function (e) { vStaff({ ok: false, text: e.message }); });
  };
}
function vVet(tab) {
  tab = tab || 'fresh';
  loading(3);
  Promise.all([api('vet.queue', {}), api('staff.alerts', {}).catch(function () { return { alerts: [] }; })])
  .then(function (both) {
    var q = both[0];
    var alerts = (both[1].alerts || []).map(function (n) {
      return '<div class="tip warn"><b>' + esc(n.title) + '</b>' +
        (n.ticket ? ' — <a href="#t/' + esc(n.ticket) + '">' + esc(n.ticket) + '</a>' : '') +
        '<div class="hint">' + esc(n.body) + ' · ' + esc(String(n.at).slice(5, 16)) + '</div></div>';
    }).join('');
    function rows(list, claimable) {
      return list.map(function (r) {
        return '<tr class="' + ((r.sla_breach || r.resolve_breach) ? 'breach' : '') + '">' +
          '<td><a href="#t/' + esc(r.ticket) + '"><b>' + esc(r.ticket) + '</b></a>' +
          (r.emergency ? ' <span class="badge b-ESCALATED">EMG</span>' : '') +
          '<br><span class="hint">' + r.minutes_open + ' min</span></td>' +
          '<td>' + esc(spLabel(r.species)) + '<br><span class="hint">' +
          esc(r.service ? r.service.en : syLabel(r.symptom)) + '</span></td>' +
          '<td>' + esc(r.village) + '<br><span class="hint">' + esc(r.mandal) + '</span></td>' +
          '<td>' + (claimable
            ? '<button class="btn small" data-claim="' + esc(r.id) + '">Claim</button>'
            : '<a class="btn small ghost" href="#t/' + esc(r.ticket) + '">Open</a>') + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="hint">Empty</td></tr>';
    }
    var lists = { fresh: rows(q.fresh, true), mine: rows(q.mine, false), closedToday: rows(q.closedToday, false) };
    render(
      '<h1>Vet duty console <span class="hint">' + esc(S.user.name) + '</span></h1>' +
      staffNav('#vet') + alerts +
      // The council number prints on every prescription, so nag until it is set - once.
      (S.user.reg_no ? '' :
        '<div class="tip warn"><b>Add your registration number</b>' +
        '<div class="hint">It is printed on every prescription you issue. State Veterinary Council number.</div>' +
        '<div class="rowline" style="margin-top:8px"><input id="regno" placeholder="TSVC/2019/4471" maxlength="40" style="margin:0">' +
        '<button class="btn small" id="regsave">Save</button></div></div>') +
      '<div class="rowline"><button class="btn small ' + (q.on_call ? 'green' : 'amber') + '" id="avbtn">' +
      (q.on_call ? '🟢 On call — tap to go off' : '🟠 Off call — tap to go on') + '</button></div>' +
      '<p class="hint">' + (q.jurisdiction && q.jurisdiction.length
        ? 'Your centres: <b>' + q.jurisdiction.join(', ') + '</b> — you see cases routed to them (and unrouted ones).'
        : (S.user.role === 'admin' ? 'District-wide view.' : 'District-wide view (this account is not mapped to a centre in the staff master).')) +
      ' Red rows breach response or resolution SLA.</p>' +
      '<div class="tabs">' +
      '<button data-t="fresh" class="' + (tab === 'fresh' ? 'on' : '') + '">Open (' + q.fresh.length + ')</button>' +
      '<button data-t="mine" class="' + (tab === 'mine' ? 'on' : '') + '">Mine (' + q.mine.length + ')</button>' +
      '<button data-t="closedToday" class="' + (tab === 'closedToday' ? 'on' : '') + '">Closed today (' + q.closedToday.length + ')</button></div>' +
      '<div class="card"><table><tr><th>Token</th><th>Case</th><th>Location</th><th></th></tr>' + lists[tab] + '</table></div>' +
      (S.user.role === 'admin' ? '<a class="btn ghost" href="#admin">Admin dashboard →</a>' : '') +
      '<p style="text-align:center"><a href="#" id="lo" class="hint">Logout</a></p>');
    wireStaffNav();
    if (el('regsave')) el('regsave').onclick = function () {
      var v = el('regno').value.trim();
      if (!v) return;
      el('regsave').disabled = true;
      api('staff.profile', { reg_no: v }).then(function (d) {
        S.user.reg_no = d.reg_no;
        localStorage.setItem('jps_user', JSON.stringify(S.user));
        vVet(tab);
      }).catch(function (e) { el('regsave').disabled = false; alert(e.message); });
    };
    el('avbtn').onclick = function () {
      api('staff.availability', { on: q.on_call ? 0 : 1 }).then(function () { vVet(tab); })
        .catch(function (e) { alert(e.message); });
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (b) {
      b.onclick = function () { vVet(b.getAttribute('data-t')); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-claim]'), function (b) {
      b.onclick = function () {
        api('vet.claim', { id: b.getAttribute('data-claim') })
          .then(function () {
            // don't repaint the console if the doctor already navigated elsewhere
            if (location.hash === '' || location.hash === '#vet') vVet('mine');
          })
          .catch(function (e) { alert(e.message); if (location.hash === '' || location.hash === '#vet') vVet(tab); });
      };
    });
    el('lo').onclick = function (ev) { ev.preventDefault(); logout(); };
    startPoll(function () { vVet(tab); });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vAdmin() {
  loading(4);
  Promise.all([api('admin.stats', {}), api('admin.links', {}).catch(function () { return {}; })])
  .then(function (both) {
    var st = both[0], lk = both[1];
    // authuser pins Google links to the account this admin logged in with, so they
    // open correctly even when other Gmail accounts are signed into the browser
    var au = '?authuser=' + encodeURIComponent(S.user.email || '');
    var quick = '<div class="card"><h2>Quick links</h2>' +
      '<p class="hint">Google links open as <b>' + esc(S.user.email) + '</b> even if other accounts are signed in.</p>' +
      '<div class="rowline">' +
      (lk.spreadsheet_id ? '<a class="btn small ghost" target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/' + esc(lk.spreadsheet_id) + '/edit' + au + '">📊 Database Sheet</a>' : '') +
      (lk.photos_folder_id ? '<a class="btn small ghost" target="_blank" rel="noopener" href="https://drive.google.com/drive/folders/' + esc(lk.photos_folder_id) + au + '">🖼️ Photos folder</a>' : '') +
      '<a class="btn small ghost" target="_blank" rel="noopener" href="poster.html">🪧 QR poster</a>' +
      '<a class="btn small ghost" target="_blank" rel="noopener" href="https://github.com/jangaoncdm/jps-app">🛠️ App repo</a>' +
      '</div></div>';
    var mrows = Object.keys(st.byMandal).sort(function (a, b) { return st.byMandal[b] - st.byMandal[a]; })
      .map(function (m) { return '<tr><td>' + esc(m) + '</td><td>' + st.byMandal[m] + '</td></tr>'; }).join('') ||
      '<tr><td colspan="2" class="hint">No data yet</td></tr>';
    var vrows = st.vets.map(function (v) {
      return '<tr><td>' + esc(v.name) + '</td><td>' + esc(v.email) + '<br><span class="hint">' + esc(v.phone) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="2" class="hint">No vets yet</td></tr>';
    var orows = st.openList.map(function (r) {
      return '<tr class="' + (r.sla_breach ? 'breach' : '') + '"><td><a href="#t/' + esc(r.ticket) + '"><b>' + esc(r.ticket) + '</b></a>' +
        (r.emergency ? ' <span class="badge b-ESCALATED">EMG</span>' : '') + '</td>' +
        '<td>' + badge(r.status) + '</td><td>' + esc(r.mandal) + '</td><td>' + r.minutes_open + ' min</td></tr>';
    }).join('') || '<tr><td colspan="4" class="hint">No open requests</td></tr>';
    render(
      '<h1>District dashboard</h1>' + staffNav('#admin') +
      '<div class="stats">' +
      '<div class="stat"><div class="n">' + st.open + '</div><div class="l">Open</div></div>' +
      '<div class="stat"><div class="n">' + st.emergenciesOpen + '</div><div class="l">Emergencies</div></div>' +
      '<div class="stat"><div class="n" style="color:var(--red)">' + st.slaBreaches + '</div><div class="l">SLA breaches</div></div>' +
      '<div class="stat"><div class="n">' + st.resolvedToday + '</div><div class="l">Resolved today</div></div></div>' +
      (function () {
        var L = st.last30; if (!L) return '';
        var mx = Math.max(L.byDisposition.GREEN, L.byDisposition.AMBER, L.byDisposition.RED, 1);
        function bar(lbl, n, color) {
          return '<div class="hint">' + lbl + ' — ' + n + '</div>' +
            '<div class="bar"><i style="width:' + Math.round(n / mx * 100) + '%;background:' + color + '"></i></div>';
        }
        return '<div class="card"><h2>Last 30 days</h2>' +
          '<p><b>' + L.total + '</b> requests · avg first response <b>' +
          (L.avgFirstResponseMin == null ? '—' : L.avgFirstResponseMin + ' min') + '</b> (' + L.responded + ' responded)</p>' +
          bar('GREEN — advice closed', L.byDisposition.GREEN, 'var(--ok)') +
          bar('AMBER — visits', L.byDisposition.AMBER, 'var(--accent)') +
          bar('RED — escalated 1962', L.byDisposition.RED, 'var(--red)') + '</div>';
      })() + quick +
      '<div class="card"><h2>Open requests</h2><table><tr><th>Token</th><th>Status</th><th>Mandal</th><th>Age</th></tr>' + orows + '</table>' +
      '<p class="hint">Full data lives in the Google Sheet — open it for filters, pivots and exports.</p></div>' +
      '<div class="card"><h2>Requests by mandal</h2><table><tr><th>Mandal</th><th>#</th></tr>' + mrows + '</table></div>' +
      '<div class="card"><h2>Duty vets</h2><table><tr><th>Name</th><th>Contact</th></tr>' + vrows + '</table>' +
      '<div id="codebox"></div>' +
      '<label>Add vet — name</label><input id="an" type="text">' +
      '<label>Email (used for sign-in)</label><input id="ae" type="email">' +
      '<label>Mobile</label><input id="ap" type="tel" placeholder="9XXXXXXXXX">' +
      '<div style="height:10px"></div><button class="btn small" id="ab">Add vet</button></div>' +
      '<p style="text-align:center"><a href="#" id="lo" class="hint">Logout</a></p>');
    wireStaffNav();
    el('ab').onclick = function () {
      api('admin.addVet', { name: el('an').value, email: el('ae').value, phone: el('ap').value })
        .then(function (d) {
          el('codebox').innerHTML = d.access_code
            ? '<div class="ok">Vet added. One-time access code (share securely): <b>' + esc(d.access_code) + '</b></div>'
            : '<div class="ok">Vet added.</div>';
        }).catch(function (e) { el('codebox').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
    };
    el('lo').onclick = function (ev) { ev.preventDefault(); logout(); };
    startPoll(function () { vAdmin(); });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

// ---------------------------------------------------------------- router
/** Bottom tab bar — farmers only. Staff screens have their own nav and a tab bar
 *  would just compete with it. Rendered from the shell so it survives every view. */
function paintTabs() {
  var bar = el('tabbar');
  if (!bar) return;
  var farmer = S.user && S.user.role === 'farmer' && S.token;
  bar.hidden = !farmer;
  document.body.className = farmer ? '' : 'staff';
  if (!farmer) return;
  var h = location.hash || '#home';
  var tab = function (href, icon, te, en, cls) {
    var on = (href === '#home' && (h === '#home' || h === ''))
      || (href !== '#home' && h.indexOf(href) === 0);
    return '<a href="' + href + '" class="' + (cls || '') + (on ? ' on' : '') + '">' +
      '<span class="ic">' + icon + '</span><span>' + esc(T(te, en)) + '</span></a>';
  };
  bar.innerHTML =
    tab('#home', '🏠', '\u0c39\u0c4b\u0c2e\u0c4d', 'Home') +
    tab('#cases', '📋', '\u0c15\u0c47\u0c38\u0c41\u0c32\u0c41', 'Cases') +
    tab('#new', '➕', '\u0c05\u0c21\u0c17\u0c02\u0c21\u0c3f', 'Ask') +
    tab('#animals', '🐄', '\u0c2a\u0c36\u0c41\u0c35\u0c41\u0c32\u0c41', 'Animals') +
    '<a href="tel:1962" class="sos"><span class="ic">🚑</span><span>1962</span></a>';
}

function route() {
  stopCam(); // release the camera whenever the screen changes
  paintTabs();
  var h = location.hash || '';
  if (h.indexOf('#t/') === 0) return vTicket(h.slice(3));
  if (h === '#staff') return vStaff();
  if (h === '#vet') return vVet();
  if (h === '#admin') return vAdmin();
  if (h === '#new') return vNew();
  if (h === '#home') return vHome();
  if (h === '#tips') return vTips();
  if (h === '#cases') return vCases();
  if (h === '#animals') return vAnimals();
  if (h === '#centre') return vCentre();
  if (h === '#loc') return vLoc();
  if (h === '#vacc') return vVacc();
  if (h === '#att') return vAttend();
  if (h === '#leave') return vLeave();
  if (h === '#stock') return vStock();
  if (h === '#issues') return vIssues();
  if (h === '#bcast') return vBcast();
  return vIdentify();
}
window.addEventListener('hashchange', route);
setLang(S.lang);
document.getElementById('langbtn').onclick = function () {
  setLang(S.lang === 'both' ? 'te' : (S.lang === 'te' ? 'en' : 'both'));
  route();
};

function dismissSplash() {
  var sp = el('splash');
  if (sp && sp.className !== 'gone') {
    // hold the welcome for its full beat even when the API answers instantly
    var wait = Math.max(0, 1900 - (Date.now() - BOOT));
    setTimeout(function () { sp.className = 'gone'; }, wait);
  }
}
var BOOT = Date.now();

api('meta.info', {}).then(function (m) {
  S.meta = m;
  if (S.token && S.user) {
    location.hash = S.user.role === 'farmer' ? (location.hash || '#home')
      : (S.user.role === 'admin' ? (location.hash || '#admin') : (location.hash || '#vet'));
    route();
    dismissSplash();
    tryRegisterPush();
  } else {
    location.hash = location.hash === '#staff' ? '#staff' : '#identify';
    route();
    dismissSplash();
  }
}).catch(function () {
  dismissSplash();
  render('<div class="err">సర్వర్‌కు కనెక్ట్ కాలేకపోయాం — API_URL సెట్ చేయాలి<br>' +
    'Cannot reach server. Set API_URL in app.js to the Apps Script /exec URL.</div>');
});
