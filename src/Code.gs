/** CONFIG **/
const CONFIG = {
  SPREADSHEET_ID: 'PUT-SPREADSHEET-ID-HERE',
  PARTICIPANTS_SHEET: 'Participants',
  AUDIT_SHEET: 'AuditLog',
  CODE_COL: 1,   // A
  URL_COL: 2,    // B
  ACTIVE_COL: 3, // C
  RATE: { WINDOW_MS: 5 * 60 * 1000, MAX_ATTEMPTS: 5, BLOCK_MS: 15 * 60 * 1000 },
  RECAPTCHA_SECRET_PROPERTY: 'RECAPTCHA_SECRET', // set in Script Properties
  SALT_PROPERTY: 'HASH_SALT' // set in Script Properties
};

/** Entry points **/
function doGet(e) {
  const t = HtmlService.createTemplateFromFile('index');
  t.appTitle = 'Get Your Program Link';
  return t.evaluate()
      .setTitle('Get Your Program Link')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
}

function doPost(e) {
  const started = Date.now();
  const params = e.parameter || {};
  const codeRaw = (params.code || '');
  const ua = (params.ua || '');
  const recaptchaToken = (params['g-recaptcha-response'] || '');

  const code = normalizeCode(codeRaw);
  const codeHash = hashCode(code);
  const requestId = Utilities.getUuid();

  // Verify reCAPTCHA (if configured)
  const rc = verifyRecaptcha(recaptchaToken);
  if (!rc.ok) {
    logEvent({action:'recaptcha_fail', codeHash, success:false, message: String(rc.errorCodes), userAgent: ua, recaptchaScore: rc.score, requestId, latencyMs: Date.now()-started});
    return renderResult(false, 'Verification failed. Please try again.', null);
  }

  // Rate limit by code hash
  const rl = checkAndUpdateRateLimit(codeHash);
  if (!rl.allowed) {
    const waitMin = Math.ceil((rl.blockedUntil - Date.now())/60000);
    logEvent({action:'blocked', codeHash, success:false, message:`Rate limit. Wait ~${waitMin}m`, userAgent: ua, recaptchaScore: rc.score, requestId, latencyMs: Date.now()-started});
    return renderResult(false, 'Too many attempts. Please wait a bit and try again.', null);
  }

  // Lookup
  const url = findUrlByCode(code);
  if (url) {
    resetRateLimit(codeHash);
    logEvent({action:'success', codeHash, success:true, message:'URL returned', userAgent: ua, recaptchaScore: rc.score, requestId, latencyMs: Date.now()-started});
    return renderResult(true, null, url);
  } else {
    logEvent({action:'failure', codeHash, success:false, message:'Invalid or inactive code', userAgent: ua, recaptchaScore: rc.score, requestId, latencyMs: Date.now()-started});
    return renderResult(false, 'Invalid or inactive code.', null);
  }
}

/** Rendering **/
function renderResult(success, errorMessage, url) {
  const t = HtmlService.createTemplateFromFile('result');
  t.success = success;
  t.errorMessage = errorMessage;
  t.url = url;
  return t.evaluate()
      .setTitle('Get Your Program Link')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
}

/** Helpers **/
function getSheet_(name) {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-]/g, ''); // collapse spaces/dashes
}

function hashCode(code) {
  const salt = PropertiesService.getScriptProperties().getProperty(CONFIG.SALT_PROPERTY) || 'changeme';
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, code + ':' + salt);
  return raw.map(b => ((b + 256) & 255).toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function findUrlByCode(codeNorm) {
  if (!codeNorm) return null;
  const sh = getSheet_(CONFIG.PARTICIPANTS_SHEET);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const values = sh.getRange(2, 1, last - 1, 3).getValues(); // Code, URL, Active
  for (let i = 0; i < values.length; i++) {
    const [storedCode, url, active] = values[i];
    if (normalizeCode(storedCode) === codeNorm && (active === true || String(active).toUpperCase() === 'TRUE')) {
      return url;
    }
  }
  return null;
}

function logEvent(ev) {
  const sh = getSheet_(CONFIG.AUDIT_SHEET);
  sh.appendRow([
    new Date(),
    ev.action || '',
    ev.codeHash || '',
    ev.success === true,
    ev.message || '',
    ev.userAgent || '',
    ev.recaptchaScore != null ? ev.recaptchaScore : '',
    ev.blockedUntil ? new Date(ev.blockedUntil) : '',
    ev.latencyMs || '',
    ev.requestId || ''
  ]);
}

function rateLimiterKey_(codeHash) {
  return 'RL_' + codeHash;
}

function checkAndUpdateRateLimit(codeHash) {
  const props = PropertiesService.getScriptProperties();
  const key = rateLimiterKey_(codeHash);
  const now = Date.now();
  const lock = LockService.getScriptLock();
  lock.tryLock(500);
  try {
    const raw = props.getProperty(key);
    let data = raw ? JSON.parse(raw) : { count: 0, first: now, blockedUntil: 0 };
    if (data.blockedUntil && now < data.blockedUntil) {
      return { allowed: false, blockedUntil: data.blockedUntil, reason: 'blocked' };
    }
    if (now - data.first > CONFIG.RATE.WINDOW_MS) {
      data = { count: 0, first: now, blockedUntil: 0 };
    }
    data.count++;
    if (data.count > CONFIG.RATE.MAX_ATTEMPTS) {
      data.blockedUntil = now + CONFIG.RATE.BLOCK_MS;
      props.setProperty(key, JSON.stringify(data));
      return { allowed: false, blockedUntil: data.blockedUntil, reason: 'rate_exceeded' };
    } else {
      props.setProperty(key, JSON.stringify(data));
      return { allowed: true };
    }
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function resetRateLimit(codeHash) {
  PropertiesService.getScriptProperties().deleteProperty(rateLimiterKey_(codeHash));
}

function verifyRecaptcha(token) {
  const secret = PropertiesService.getScriptProperties().getProperty(CONFIG.RECAPTCHA_SECRET_PROPERTY);
  if (!secret) return { ok: true, score: null }; // reCAPTCHA disabled => allow
  if (!token) return { ok: false, score: null, errorCodes: ['missing-input-response'] };
  const resp = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  const data = JSON.parse(resp.getContentText() || '{}');
  return { ok: data.success === true, score: data.score || null, errorCodes: data['error-codes'] || [] };
}