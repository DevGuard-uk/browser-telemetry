/**
 * @devguard-uk/browser-telemetry
 * Lightweight browser exception reporting & breadcrumbs (<4KB minified).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.DevGuardWebTelemetry = factory();
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var SENSITIVE_QUERY_RE = /(?<=[?&])(?:token|access_token|key|api_key|apiKey|secret|password|auth|authorization|card|cvv)=[^&\s]+/gi;
  var BEARER_RE = /Bearer\s+[A-Za-z0-9\-_.+=/]+/gi;
  var CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
  var SENSITIVE_KEY_RE = /pass|token|secret|auth|cookie|card|cvv|key|private/i;

  var S = {
    init: false,
    pid: null,
    key: null,
    ep: '/api/v1/telemetry',
    rate: 1,
    crumbs: true,
    maxCrumbs: 30,
    devId: null,
    ver: '1.0.0',
    hook: null,
    q: [],
    on: false,
  };

  function tryCatch(fn, d) {
    try { return fn(); } catch (_) { return d; }
  }

  function scrubString(s) {
    if (typeof s !== 'string') return s;
    return s.replace(SENSITIVE_QUERY_RE, '[redacted]').replace(BEARER_RE, 'Bearer [redacted]').replace(CARD_RE, '[card-redacted]');
  }

  function scrubObject(o, depth) {
    if (!o || typeof o !== 'object' || (depth || 0) > 3) return o;
    var out = Array.isArray(o) ? [] : {};
    for (var k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k)) {
        out[k] = SENSITIVE_KEY_RE.test(k) ? '[redacted]' : typeof o[k] === 'string' ? scrubString(o[k]) : typeof o[k] === 'object' ? scrubObject(o[k], (depth || 0) + 1) : o[k];
      }
    }
    return out;
  }

  function getDeviceId() {
    return tryCatch(function () {
      if (typeof window === 'undefined' || !window.localStorage) return 'web-anon-' + Math.random().toString(36).slice(2, 10);
      var id = window.localStorage.getItem('devguard_web_device_id');
      if (!id) {
        id = 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        window.localStorage.setItem('devguard_web_device_id', id);
      }
      return id;
    }, 'web-fallback');
  }

  function getBrowser() {
    return tryCatch(function () {
      if (typeof navigator === 'undefined') return 'Unknown Browser';
      var u = navigator.userAgent || '';
      if (/edg/i.test(u)) return 'Edge';
      if (/chrome|crios/i.test(u) && !/opr/i.test(u)) return 'Chrome';
      if (/firefox/i.test(u)) return 'Firefox';
      if (/safari/i.test(u) && !/chrome/i.test(u)) return 'Safari';
      return 'Browser';
    }, 'Browser');
  }

  function addBreadcrumb(b) {
    if (!S.crumbs || !b) return;
    tryCatch(function () {
      S.q.push({
        timestamp: b.timestamp || new Date().toISOString(),
        category: b.category || 'custom',
        message: scrubString(String(b.message || '').slice(0, 300)),
        data: b.data ? scrubObject(b.data, 0) : undefined,
      });
      if (S.q.length > S.maxCrumbs) S.q.shift();
    });
  }

  function postData(path, data) {
    return tryCatch(function () {
      var base = S.ep.replace(/\/+$/, '');
      var url = base + '/' + path.replace(/^\/+/, '');
      if (S.key && url.indexOf('apiKey=') === -1) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + 'apiKey=' + encodeURIComponent(S.key);
      }
      var body = JSON.stringify(data);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
          if (navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return true;
        } catch (_) {}
      }
      if (typeof fetch === 'function') {
        var h = { 'Content-Type': 'application/json' };
        if (S.key) h['x-devguard-api-key'] = S.key;
        fetch(url, { method: 'POST', headers: h, body: body, keepalive: true }).catch(function () {});
        return true;
      }
      return false;
    }, false);
  }

  function captureException(err, opt) {
    if (!S.init && !opt?.force) return;
    return tryCatch(function () {
      var e = err instanceof Error ? err : new Error(String(err || 'Error'));
      var fatal = Boolean(opt && opt.isFatal);
      if (!fatal && S.rate < 1 && Math.random() > S.rate) return;
      var loc = typeof window !== 'undefined' && window.location ? window.location.href : '';

      var rep = {
        projectId: S.pid,
        apiKey: S.key,
        deviceId: S.devId,
        errorName: scrubString(e.name || 'Error'),
        errorMessage: scrubString(e.message || 'Unknown error'),
        stackTrace: scrubString(e.stack || ''),
        crashType: opt && opt.crashType ? opt.crashType : 'js_error',
        isFatal: fatal,
        platform: 'web',
        sdkRuntime: 'web',
        hostPlatform: 'web',
        appVersion: S.ver,
        browser: getBrowser(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        url: scrubString(loc),
        breadcrumbs: S.q.slice(-S.maxCrumbs),
        clientMeta: opt && opt.clientMeta ? scrubObject(opt.clientMeta, 0) : {},
        occurredAt: new Date().toISOString(),
      };

      if (typeof S.hook === 'function') {
        rep = S.hook(rep);
        if (!rep) return;
      }
      postData('crash', rep);
      return rep;
    });
  }

  function recordUserLog(l) {
    if (!S.init || !l) return;
    return tryCatch(function () {
      var scr = scrubString(String(l.screen || '').trim());
      if (!scr) return;
      var item = {
        screen: scr,
        widget: l.widget ? scrubString(String(l.widget).slice(0, 80)) : undefined,
        className: l.className ? scrubString(String(l.className).slice(0, 80)) : undefined,
        action: l.action || 'view',
        extras: l.extras ? scrubObject(l.extras, 0) : undefined,
        timestamp: l.timestamp || new Date().toISOString(),
      };
      addBreadcrumb({ category: 'navigation', message: scr + (item.action ? ' (' + item.action + ')' : ''), data: item.extras });
      postData('journey', { projectId: S.pid, apiKey: S.key, deviceId: S.devId, platform: 'web', userLogs: [item] });
      return item;
    });
  }

  function setupHooks() {
    if (S.on || typeof window === 'undefined') return;
    S.on = true;

    window.addEventListener('error', function (e) {
      captureException(e.error || new Error(e.message || 'Uncaught error'), {
        isFatal: true,
        crashType: 'js_error',
        clientMeta: { filename: scrubString(e.filename || ''), lineno: e.lineno, colno: e.colno },
      });
    });

    window.addEventListener('unhandledrejection', function (e) {
      captureException(e.reason instanceof Error ? e.reason : new Error(String(e.reason || 'Unhandled Rejection')), {
        isFatal: true,
        crashType: 'unhandled_rejection',
      });
    });

    function onRoute() {
      tryCatch(function () {
        recordUserLog({ screen: window.location.pathname + window.location.search, action: 'view' });
      });
    }

    var p = window.history && window.history.pushState;
    if (typeof p === 'function') {
      window.history.pushState = function () {
        var r = p.apply(this, arguments);
        onRoute();
        return r;
      };
    }
    var rep = window.history && window.history.replaceState;
    if (typeof rep === 'function') {
      window.history.replaceState = function () {
        var r = rep.apply(this, arguments);
        onRoute();
        return r;
      };
    }
    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('click', function (e) {
        tryCatch(function () {
          var t = e.target;
          if (!t || !t.tagName) return;
          var tag = t.tagName.toLowerCase();
          if (tag === 'button' || tag === 'a' || t.getAttribute('role') === 'button' || (tag === 'input' && (t.type === 'button' || t.type === 'submit'))) {
            var label = t.getAttribute('aria-label') || (t.innerText || t.textContent || '').trim().slice(0, 30);
            addBreadcrumb({ category: 'ui.click', message: tag + (t.id ? '#' + t.id : '') + (label ? ' "' + scrubString(label) + '"' : '') });
          }
        });
      }, true);
    }

    if (typeof console !== 'undefined') {
      ['warn', 'error'].forEach(function (level) {
        var orig = console[level];
        if (typeof orig === 'function') {
          console[level] = function () {
            var a = Array.prototype.slice.call(arguments);
            addBreadcrumb({ category: 'console.' + level, message: a.map(String).join(' ').slice(0, 200) });
            return orig.apply(console, a);
          };
        }
      });
    }
  }

  function init(opt) {
    return tryCatch(function () {
      if (!opt || !opt.projectId) {
        console.warn('[DevGuardWebTelemetry] projectId required');
        return false;
      }
      S.pid = opt.projectId;
      S.key = opt.apiKey || null;
      S.ep = opt.endpoint || '/api/v1/telemetry';
      S.rate = typeof opt.sampleRate === 'number' ? Math.max(0, Math.min(1, opt.sampleRate)) : 1;
      S.crumbs = opt.enableBreadcrumbs !== false;
      S.maxCrumbs = typeof opt.maxBreadcrumbs === 'number' ? opt.maxBreadcrumbs : 30;
      S.devId = opt.deviceId || getDeviceId();
      S.ver = opt.appVersion || '1.0.0';
      S.hook = typeof opt.beforeSend === 'function' ? opt.beforeSend : null;
      S.init = true;
      setupHooks();
      addBreadcrumb({ category: 'lifecycle', message: 'DevGuard Web Telemetry initialized' });
      return true;
    }, false);
  }

  return {
    init: init,
    initDevGuardWebTelemetry: init,
    captureException: captureException,
    recordUserLog: recordUserLog,
    addBreadcrumb: addBreadcrumb,
    scrubString: scrubString,
    scrubObject: scrubObject,
    getState: function () {
      return {
        initialized: S.init,
        projectId: S.pid,
        apiKey: S.key,
        endpoint: S.ep,
        deviceId: S.devId,
        sampleRate: S.rate,
        enableBreadcrumbs: S.crumbs,
        breadcrumbs: S.q.slice(),
      };
    },
    resetForTesting: function () {
      S.init = false;
      S.pid = null;
      S.key = null;
      S.q = [];
      S.on = false;
    },
  };
});
