/* JPS app.js — BUILD JPS v0.5.0-M4 b012
 * Set API_URL to the Apps Script /exec deployment URL. POSTs go as text/plain
 * (GAS cannot answer CORS preflights; text/plain avoids one; body still arrives in postData).
 */
'use strict';
var API_URL = 'https://script.google.com/macros/s/AKfycbzoft5NDa9cSsR7QexjilMA_Uv2FWujkJqaWnYTLn8yY32pSit1EuQ5iBxS1nRJHR4b2g/exec';
var BUILD = 'JPS v0.5.0-M4 b012';

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
var JITSI = 'https://meet.jit.si/';
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

function api(action, payload) {
  payload = payload || {};
  if (S.token) payload.token = S.token;
  return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, payload: payload }) })
    .then(function (r) { return r.json(); })
    .then(function (j) {
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
    (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
    '<div class="card"><label style="margin-top:0">' + TL('భాష', 'Language') + '</label>' + langChips() + '</div>' +
    '<div class="card" style="text-align:center">' +
    '<h1>' + esc(T('పశువుకు వైద్య సహాయం', 'Animal health help')) + '</h1>' +
    '<p class="hint">' + esc(T('డాక్టర్ మీకు తిరిగి కాల్ చేస్తారు', 'Doctor-on-call — a vet calls you back.')) + '</p>' +
    '<div style="height:10px"></div>' +
    '<button class="btn" id="hintbtn">📱 ' + esc(T('నా నంబర్‌తో కొనసాగండి', 'Continue with my number')) + '</button>' +
    '<div style="height:8px"></div>' +
    '<a class="btn red" href="tel:1962">🚑 ' + esc(T('అత్యవసరం? 1962', 'Emergency? 1962')) + '</a></div>' +
    '<div class="card"><h2>' + TL('నంబర్ టైప్ చేయండి', 'Or type your number') + '</h2>' +
    '<label>' + TL('మొబైల్ నంబర్', 'Mobile') + '</label>' +
    '<input id="ph" type="tel" inputmode="numeric" placeholder="9XXXXXXXXX">' +
    '<label>' + TL('మీ పేరు', 'Name') + '</label>' +
    '<input id="nm" type="text" maxlength="80">' +
    '<div style="height:10px"></div><button class="btn ghost" id="manbtn">' + esc(T('కొనసాగండి', 'Continue')) + '</button>' +
    '<p class="hint" style="margin-top:10px"><a href="#staff">Staff sign-in →</a></p></div>'
  );
  wireLangChips(function () { vIdentify(msg); });
  el('hintbtn').onclick = function () {
    el('hintbtn').disabled = true;
    tryPhoneHint().then(function (phone) {
      if (!phone) { el('hintbtn').disabled = false;
        el('ph').focus();
        return alert(T('ఈ ఫోన్‌లో నంబర్ కనబడలేదు — దయచేసి టైప్ చేయండి', 'Number picker unavailable — please type it'));
      }
      identify(phone, '', 'hint');
    });
  };
  el('manbtn').onclick = function () { identify(el('ph').value, el('nm').value, 'manual'); };
}
function identify(phone, name, source) {
  var dev = localStorage.getItem('jps_dev') || (Math.random().toString(36).slice(2) + Date.now().toString(36));
  localStorage.setItem('jps_dev', dev);
  api('farmer.identify', { phone: phone, name: name, source: source, device_id: dev })
    .then(function (d) { saveAuth(d.token, d.user); tryRegisterPush(); location.hash = '#home'; })
    .catch(function (e) { vIdentify(e.message); });
}

function vHome() {
  render('<div class="spin">' + esc(T('లోడ్ అవుతోంది…', 'Loading…')) + '</div>');
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
    render(
      '<div class="card" style="text-align:center;padding:22px">' +
      '<h1>' + esc(T('పశువుకు వైద్య సహాయం కావాలా?', 'Need help for your animal?')) + '</h1>' +
      '<p class="hint">' + esc(T('అభ్యర్థన పంపండి — డాక్టర్ కాల్ చేస్తారు', 'File a request — a vet will call you back.')) + '</p><div style="height:10px"></div>' +
      '<a class="btn" href="#new">🩺 ' + esc(T('కొత్త అభ్యర్థన', 'New request')) + '</a><div style="height:8px"></div>' +
      '<a class="btn red" href="tel:1962">🚑 ' + esc(T('అత్యవసరం? 1962', 'Emergency? 1962')) + '</a></div>' +
      noticesCard +
      '<div class="card"><h2>' + TL('నా అభ్యర్థనలు', 'My requests') + '</h2><table>' + rows + '</table></div>' +
      '<a class="btn ghost" href="#tips">📗 ' + esc(T('పశు సంరక్షణ సూచనలు', "Do's & don'ts for your animals")) + '</a>' +
      '<p style="text-align:center;margin-top:10px"><a href="#" id="lo" class="hint">' + esc(T('లాగ్ అవుట్', 'Logout')) + '</a></p>');
    el('lo').onclick = function (ev) { ev.preventDefault(); logout(); };
  }).catch(function (e) { if (e.code === 'auth') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vNew() {
  render('<div class="spin">' + esc(T('లోడ్ అవుతోంది…', 'Loading…')) + '</div>');
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
      '<div style="height:12px"></div><button class="btn" id="go">' + esc(T('అభ్యర్థన పంపండి', 'Submit request')) + '</button>' +
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
  render('<div class="spin">' + esc(T('లోడ్ అవుతోంది…', 'Loading…')) + '</div>');
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
      var head = '<div style="border-bottom:2px solid var(--brand);padding-bottom:8px;margin-bottom:10px">' +
        '<div class="hint">పశుసంవర్ధక శాఖ · Veterinary &amp; AH Department, Jangaon</div>' +
        (p.facility_name ? '<div><b>' + esc(p.facility_name) + '</b></div>' : '') +
        (p.doctor_name ? '<div>Dr. ' + esc(p.doctor_name) + '</div>' : '') +
        '<div class="hint">' + esc(p.at) + ' · ' + esc(r.ticket) + ' · ' + esc(spLabel(r.species)) +
        (r.pashu_tag ? ' · Tag ' + esc(r.pashu_tag) : '') + '</div></div>';
      var body =
        (p.observation ? '<p><b>' + esc(T('పరిశీలన', 'Observation')) + ':</b> ' + esc(p.observation) + '</p>' : '') +
        (p.rx_text ? '<p><b>℞</b></p><p style="white-space:pre-line;border-left:3px solid var(--line);padding-left:10px">' + esc(p.rx_text) + '</p>' : '') +
        (p.tests ? '<p><b>' + esc(T('పరీక్షలు / సూచనలు', 'Tests / advice')) + ':</b> ' + esc(p.tests) + '</p>' : '') +
        (p.photo ? '<img class="ph" src="data:' + esc(p.photo.mime) + ';base64,' + p.photo.b64 + '">' : '');
      return '<div class="card"><h2>💊 ' + TL('మందుల చీటీ', 'Prescription') + '</h2>' + head + body +
        '<div class="rowline"><button class="btn small ghost" onclick="window.print()">🖨️ ' +
        esc(T('ప్రింట్ / సేవ్', 'Print / save')) + '</button></div></div>';
    }).join('');
    var svcLine = r.service ? '<p>' + esc(T(r.service.te, r.service.en)) + ' <span class="hint">(' + esc(r.service.code) + ')</span></p>' : '';
    var caseOpen = r.status === 'ASSIGNED' || r.status === 'VISIT_SCHEDULED';
    var video = '';
    if (caseOpen && !staff && r.vet && r.vet.phone) {
      // symmetrical with the doctor's side: user can ring or WhatsApp-video-call the doctor directly
      video = '<div class="rowline">' +
        '<a class="btn small" href="tel:' + esc(r.vet.phone) + '">📞 ' + esc(T('డాక్టర్‌కు కాల్', 'Call doctor')) + '</a>' +
        '<a class="btn small" style="background:#128C7E" target="_blank" rel="noopener" href="https://wa.me/' +
        esc(String(r.vet.phone).replace(/\D/g, '')) + '">📹 ' + esc(T('WhatsApp వీడియో కాల్', 'WhatsApp video call')) + '</a></div>' +
        '<p class="hint">' + esc(T('WhatsApp తెరుచుకుంటుంది — పైన 📹 గుర్తు నొక్కితే డాక్టర్‌కు కాల్ వెళ్తుంది',
          'WhatsApp opens on the doctor chat — tap the 📹 icon at the top to ring them')) + '</p>' +
        '<div style="height:8px"></div>';
    }
    var actions = '';
    if (staff && (r.status === 'NEW' || r.status === 'ASSIGNED' || r.status === 'VISIT_SCHEDULED')) {
      var slotOpts = SLOTS.map(function (s) { return '<option value="' + s.te + ' · ' + s.en + '">' + s.te + ' · ' + s.en + '</option>'; }).join('');
      actions = '<div class="card" id="acts">' +
        (r.status === 'NEW'
          ? '<button class="btn" id="claim">Claim this case</button>'
          : '<div class="rowline"><a class="btn small" href="tel:' + esc(r.farmer.phone) + '">📞 Call user</a>' +
            '<a class="btn small" style="background:#128C7E" target="_blank" rel="noopener" href="https://wa.me/' +
            esc(String(r.farmer.phone).replace(/\D/g, '')) + '">📹 WhatsApp video call</a></div>' +
            '<p class="hint">WhatsApp opens on their chat — tap the 📹 icon at the top there. Their phone rings like a normal WhatsApp call.</p>' +
            '<p class="hint">First video call on this phone: Jitsi asks the host to sign in — use your own Gmail, one time only. Users never need an account.</p>' +
            '<label>Observation &amp; diagnosis <span class="en">(required to resolve)</span></label>' +
            '<textarea id="note" maxlength="1000" placeholder="Findings · diagnosis · advice to the user"></textarea>' +
            '<label>Medicines — Rx <span class="en">(one per line; auto-becomes a prescription)</span></label>' +
            '<textarea id="rxt" maxlength="1000" placeholder="Inj. ... dose · route · days&#10;Bolus ... "></textarea>' +
            '<label>Tests / further advice <span class="en">(optional)</span></label>' +
            '<textarea id="tst" maxlength="1000" placeholder="Blood smear · milk culture · revisit if ..."></textarea>' +
            '<label>Prescription photo (optional)</label>' +
            '<input id="rxf" type="file" accept="image/*" capture="environment">' +
            '<p class="hint">Anything written in Rx or Tests is issued as a formal prescription with your name, centre and time.</p>' +
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
      el('wd').disabled = true;
      api('request.withdraw', { id: r.id }).then(function () { vTicket(ticket); })
        .catch(function (e) { el('wd').disabled = false; alert(e.message); });
    };
    if (staff && el('acts')) {
      if (el('claim')) el('claim').onclick = function () {
        api('vet.claim', { id: r.id }).then(function () { vTicket(ticket); })
          .catch(function (e) { alert(e.message); vTicket(ticket); });
      };
      Array.prototype.forEach.call(document.querySelectorAll('#acts [data-a]'), function (b) {
        b.onclick = function () {
          b.disabled = true;
          var rxFile = el('rxf') && el('rxf').files[0];
          compressPhoto(rxFile).then(function (rxb64) {
            return api('vet.act', { id: r.id, action: b.getAttribute('data-a'),
              note: (el('note') || {}).value || '', visit_date: (el('vd') || {}).value || '',
              visit_slot: (el('vs') || {}).value || '',
              rx_text: (el('rxt') || {}).value || '', tests: (el('tst') || {}).value || '',
              rx_b64: rxb64 || '', rx_mime: 'image/jpeg' });
          }).then(function () { vTicket(ticket); })
            .catch(function (e) { b.disabled = false; alert(e.message); });
        };
      });
    }
    startPoll(function () { vTicket(ticket); });
  }).catch(function (e) { if (e.code === 'auth') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vTips() {
  function tip(cls, te, en) {
    return '<div class="tip' + (cls ? ' ' + cls : '') + '">' + TL(te, en) + '</div>';
  }
  render(
    '<div class="card"><h1>📗 ' + TL('పశు సంరక్షణ — సూచనలు', "Animal care — do's & don'ts") + '</h1>' +
    '<p class="hint">' + esc(T('జనగామ పశు వైద్య శాఖ సాధారణ సూచనలు. అనారోగ్యం తీవ్రంగా ఉంటే వెంటనే 1962కి కాల్ చేయండి.',
      'General guidance from the Jangaon Veterinary Department. If the animal is seriously ill, call 1962 immediately.')) + '</p></div>' +
    '<div class="card"><h2>✅ ' + TL('చేయవలసినవి', 'Do') + '</h2>' +
    tip('', 'పశువులకు ఎప్పుడూ శుభ్రమైన తాగునీరు అందుబాటులో ఉంచండి', 'Keep clean drinking water available at all times') +
    tip('', 'ప్రభుత్వ టీకాలు (గాలికుంటు, గొంతువాపు) సకాలంలో వేయించండి — ఉచితం', 'Get government vaccinations (FMD, HS/BQ) on schedule — they are free') +
    tip('', 'సంవత్సరానికి కనీసం రెండుసార్లు నట్టల మందు వేయించండి', 'Deworm at least twice a year') +
    tip('', 'పాలు పితికే ముందు, తర్వాత పొదుగును శుభ్రంగా కడగండి', 'Wash the udder before and after milking') +
    tip('', 'చెవి ట్యాగ్ నంబర్ భద్రంగా నోట్ చేసుకోండి — వైద్యానికి, బీమాకు అవసరం', 'Note the ear-tag number safely — needed for treatment and insurance') +
    tip('', 'కొత్త పశువును మందలో కలిపే ముందు వారం రోజులు విడిగా ఉంచండి', 'Keep newly bought animals separate for a week before mixing with the herd') +
    '</div>' +
    '<div class="card"><h2>❌ ' + TL('చేయకూడనివి', "Don't") + '</h2>' +
    tip('warn', 'డాక్టర్ సూచన లేకుండా సొంతంగా యాంటీబయాటిక్ ఇంజెక్షన్లు ఇవ్వకండి', 'Do not give antibiotic injections on your own without a doctor\'s advice') +
    tip('warn', 'పురుగుమందు చల్లిన పొలాల్లో వెంటనే మేపకండి', 'Do not graze animals in freshly pesticide-sprayed fields') +
    tip('warn', 'ఈత కష్టమైనప్పుడు బలవంతంగా లాగవద్దు — వెంటనే డాక్టర్‌ను పిలవండి', 'Do not pull the calf by force in difficult delivery — call the doctor at once') +
    tip('warn', 'ప్లాస్టిక్ కవర్లు, పాడైన మేత పశువులకు పెట్టవద్దు', 'Do not let animals eat plastic covers or spoiled feed') +
    tip('warn', 'పాము కాటుకు నాటు వైద్యం మీద ఆధారపడవద్దు — 1962కి కాల్ చేయండి', 'Do not rely on folk remedies for snake bite — call 1962') +
    '</div>' +
    '<a class="btn ghost" href="#home">← ' + esc(T('హోమ్', 'Home')) + '</a>');
}

// ---------------------------------------------------------------- staff modules (v0.4, English-only)
function staffNav(cur) {
  var items = [['#vet', 'Queue'], ['#att', 'Attendance'], ['#leave', 'Leave'],
               ['#stock', 'Stock'], ['#issues', 'Issues']];
  if (S.user && S.user.role === 'admin') items.push(['#bcast', 'Broadcasts']);
  return '<div class="tabs" style="flex-wrap:wrap">' + items.map(function (i) {
    return '<button data-nav="' + i[0] + '" class="' + (cur === i[0] ? 'on' : '') + '">' + i[1] + '</button>';
  }).join('') + '</div>';
}
function wireStaffNav() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (b) {
    b.onclick = function () { location.hash = b.getAttribute('data-nav'); };
  });
}

function vAttend() {
  render('<div class="spin">Loading…</div>');
  api('staff.attendance', {}).then(function (d) {
    var last = d.records[0];
    var nextIn = !last || last.type === 'out';
    var rows = d.records.map(function (r) {
      var loc = (r.lat && r.lng)
        ? ' <a target="_blank" rel="noopener" href="' + mapsLink(r.lat, r.lng) + '">📍</a>' : '';
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
      '<p class="hint">Your location is captured automatically when you tap the button.</p>' +
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
  render('<div class="spin">Loading…</div>');
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
  render('<div class="spin">Loading…</div>');
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
  render('<div class="spin">Loading…</div>');
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
  render('<div class="spin">Loading…</div>');
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
    (msg ? '<div class="' + (msg.ok ? 'ok' : 'err') + '">' + esc(msg.text) + '</div>' : '') +
    '<div class="card"><h1>Staff sign-in</h1>' +
    '<button class="btn" id="gbtn">Sign in with Google</button>' +
    '<p class="hint" style="margin-top:8px">Works after the district OAuth client is configured; until then use the access code.</p></div>' +
    '<div class="card"><h2>Access code</h2>' +
    '<label>Email</label><input id="se" type="email" value="' + esc(localStorage.getItem('jps_staff_email') || '') + '">' +
    '<label>Access code</label><input id="sc" type="text" autocapitalize="characters">' +
    '<div style="height:10px"></div><button class="btn ghost" id="cbtn">Sign in</button></div>' +
    (nb ? '<div class="card"><h2>First-time setup (bootstrap admin)</h2>' +
      '<label>Your email</label><input id="be" type="email">' +
      '<label>Your name</label><input id="bn" type="text">' +
      '<label>Bootstrap code (from setup() log)</label><input id="bc" type="text" autocapitalize="characters">' +
      '<div style="height:10px"></div><button class="btn" id="bbtn">Create admin</button></div>' : '') +
    '<p class="hint"><a href="#identify">← User app</a></p>');
  el('gbtn').onclick = function () {
    tryGoogleSignIn().then(function (idt) {
      if (!idt) return vStaff({ ok: false, text: 'Google sign-in unavailable on this build — use access code.' });
      api('staff.google', { id_token: idt })
        .then(function (d) { saveAuth(d.token, d.user); location.hash = d.user.role === 'admin' ? '#admin' : '#vet'; })
        .catch(function (e) { vStaff({ ok: false, text: e.message }); });
    });
  };
  el('cbtn').onclick = function () {
    api('staff.code', { email: el('se').value, code: el('sc').value })
      .then(function (d) {
        localStorage.setItem('jps_staff_email', el('se').value);
        saveAuth(d.token, d.user); location.hash = d.user.role === 'admin' ? '#admin' : '#vet';
      })
      .catch(function (e) { vStaff({ ok: false, text: e.message }); });
  };
  if (nb) el('bbtn').onclick = function () {
    api('staff.bootstrap', { email: el('be').value, name: el('bn').value, code: el('bc').value })
      .then(function (d) { saveAuth(d.token, d.user); location.hash = '#admin'; })
      .catch(function (e) { vStaff({ ok: false, text: e.message }); });
  };
}

function vVet(tab) {
  tab = tab || 'fresh';
  render('<div class="spin">Loading queue…</div>');
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
          .then(function () { vVet('mine'); }).catch(function (e) { alert(e.message); vVet(tab); });
      };
    });
    el('lo').onclick = function (ev) { ev.preventDefault(); logout(); };
    startPoll(function () { vVet(tab); });
  }).catch(function (e) { if (e.code === 'auth' || e.code === 'forbidden') return logout(); render('<div class="err">' + esc(e.message) + '</div>'); });
}

function vAdmin() {
  render('<div class="spin">Loading dashboard…</div>');
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
      '<h1>District dashboard</h1>' +
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
      '<a class="btn ghost" href="#vet">← Vet console</a>' +
      '<p style="text-align:center"><a href="#" id="lo" class="hint">Logout</a></p>');
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
function route() {
  stopCam(); // release the camera whenever the screen changes
  var h = location.hash || '';
  if (h.indexOf('#t/') === 0) return vTicket(h.slice(3));
  if (h === '#staff') return vStaff();
  if (h === '#vet') return vVet();
  if (h === '#admin') return vAdmin();
  if (h === '#new') return vNew();
  if (h === '#home') return vHome();
  if (h === '#tips') return vTips();
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

api('meta.info', {}).then(function (m) {
  S.meta = m;
  if (S.token && S.user) {
    location.hash = S.user.role === 'farmer' ? (location.hash || '#home')
      : (S.user.role === 'admin' ? (location.hash || '#admin') : (location.hash || '#vet'));
    route();
    tryRegisterPush();
  } else {
    location.hash = location.hash === '#staff' ? '#staff' : '#identify';
    route();
  }
}).catch(function () {
  render('<div class="err">సర్వర్‌కు కనెక్ట్ కాలేకపోయాం — API_URL సెట్ చేయాలి<br>' +
    'Cannot reach server. Set API_URL in app.js to the Apps Script /exec URL.</div>');
});
