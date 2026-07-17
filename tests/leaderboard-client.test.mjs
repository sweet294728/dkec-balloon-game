import assert from 'node:assert/strict';
import test from 'node:test';

import { LEADERBOARD_ENDPOINT } from '../src/leaderboard/config.js';
import {
  buildLeaderboardListUrl,
  loadLeaderboard,
  submitLeaderboard,
} from '../src/leaderboard/client.js';

const ENDPOINT = 'https://script.google.com/macros/s/example/exec';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.removed = false;
    this.submitted = false;

    if (tagName === 'iframe') {
      this.contentWindow = {};
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentNode) {
      const index = this.parentNode.children.indexOf(this);
      if (index >= 0) {
        this.parentNode.children.splice(index, 1);
      }
      this.parentNode = null;
    }
    this.removed = true;
  }

  submit() {
    this.submitted = true;
  }
}

class FakeDocument {
  constructor() {
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.created = [];
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    this.created.push(element);
    return element;
  }
}

class FakeWindow {
  constructor() {
    this.listeners = new Map();
    this.timers = [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchMessage(source, data, origin = '') {
    for (const listener of this.listeners.get('message') ?? []) {
      listener({ source, data, origin });
    }
  }

  setTimeout(handler, timeoutMs) {
    const timer = { handler, timeoutMs, cleared: false };
    this.timers.push(timer);
    return timer;
  }

  clearTimeout(timer) {
    timer.cleared = true;
  }

  runLatestTimer() {
    this.timers.at(-1).handler();
  }
}

function installBrowser(t) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const browserWindow = new FakeWindow();
  const document = new FakeDocument();

  globalThis.window = browserWindow;
  globalThis.document = document;

  t.after(() => {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }

    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  });

  return { browserWindow, document };
}

function assertTimerCleared(browserWindow) {
  assert.equal(browserWindow.timers.length, 1);
  assert.equal(browserWindow.timers[0].cleared, true);
}

function assertListCleanup(browserWindow, document, callbackName) {
  assert.equal(Object.hasOwn(browserWindow, callbackName), false);
  assert.equal(document.head.children.length, 0);
  assertTimerCleared(browserWindow);
}

function getSubmission(document) {
  const iframe = document.created.find((element) => element.tagName === 'IFRAME');
  const form = document.created.find((element) => element.tagName === 'FORM');
  return { iframe, form };
}

function assertSubmitCleanup(browserWindow, document) {
  const { iframe, form } = getSubmission(document);
  assert.equal(browserWindow.listeners.get('message')?.size ?? 0, 0);
  assert.equal(document.body.children.length, 0);
  assert.equal(form.removed, true);
  assert.equal(iframe.removed, true);
  assertTimerCleared(browserWindow);
}

test('config uses the deployed production leaderboard endpoint', () => {
  assert.equal(
    LEADERBOARD_ENDPOINT,
    'https://script.google.com/macros/s/AKfycbzT41cnNdBb5eBi7S7TSmCKQ7epkI5MWGX3Sx2f8aJpys8WiZj-wbGT6Iwn61Tdor_B/exec',
  );
});

test('buildLeaderboardListUrl creates the exact HTTPS JSONP list URL', () => {
  assert.equal(
    buildLeaderboardListUrl(ENDPOINT, '__dkecCallback1'),
    'https://script.google.com/macros/s/example/exec?action=list&callback=__dkecCallback1',
  );
});

test('buildLeaderboardListUrl rejects an empty endpoint with a Chinese configuration error', () => {
  assert.throws(
    () => buildLeaderboardListUrl('', '__dkecCallback1'),
    {
      name: 'TypeError',
      message: '排行榜尚未設定，請管理者設定排行榜網址。',
    },
  );
});

test('buildLeaderboardListUrl rejects non-HTTPS endpoints and unsafe callbacks', () => {
  assert.throws(
    () => buildLeaderboardListUrl('http://example.com/exec', '__dkecCallback1'),
    /HTTPS/,
  );
  assert.throws(
    () => buildLeaderboardListUrl(ENDPOINT, 'alert(1)'),
    /callback/i,
  );
  assert.throws(
    () => buildLeaderboardListUrl(ENDPOINT, '__bad.name'),
    /callback/i,
  );
});

test('loadLeaderboard validates an empty endpoint before requiring a browser DOM', () => {
  assert.throws(
    () => loadLeaderboard(''),
    {
      name: 'TypeError',
      message: '排行榜尚未設定，請管理者設定排行榜網址。',
    },
  );
});

test('loadLeaderboard resolves valid records and cleans every JSONP resource', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = loadLeaderboard(ENDPOINT);
  const script = document.created.find((element) => element.tagName === 'SCRIPT');
  const scriptUrl = new URL(script.src);
  const callbackName = scriptUrl.searchParams.get('callback');

  assert.match(callbackName, /^__[A-Za-z0-9_]+$/);
  assert.equal(scriptUrl.searchParams.get('action'), 'list');
  assert.equal(document.head.children[0], script);

  const records = [{ nickname: 'DKEC', score: 42 }];
  browserWindow[callbackName]({ ok: true, records });

  assert.equal(await promise, records);
  assertListCleanup(browserWindow, document, callbackName);
});

test('loadLeaderboard rejects backend failures and cleans every JSONP resource', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = loadLeaderboard(ENDPOINT);
  const script = document.created.find((element) => element.tagName === 'SCRIPT');
  const callbackName = new URL(script.src).searchParams.get('callback');

  browserWindow[callbackName]({ ok: false, error: 'backend unavailable' });

  await assert.rejects(promise, /backend unavailable/);
  assertListCleanup(browserWindow, document, callbackName);
});

test('loadLeaderboard rejects malformed success payloads and cleans resources', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = loadLeaderboard(ENDPOINT);
  const script = document.created.find((element) => element.tagName === 'SCRIPT');
  const callbackName = new URL(script.src).searchParams.get('callback');

  browserWindow[callbackName]({ ok: true, records: null });

  await assert.rejects(promise, /records/i);
  assertListCleanup(browserWindow, document, callbackName);
});

test('loadLeaderboard rejects script errors and cleans every JSONP resource', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = loadLeaderboard(ENDPOINT);
  const script = document.created.find((element) => element.tagName === 'SCRIPT');
  const callbackName = new URL(script.src).searchParams.get('callback');

  script.onerror();

  await assert.rejects(promise, /script/i);
  assertListCleanup(browserWindow, document, callbackName);
});

test('loadLeaderboard rejects timeout and cleans every JSONP resource', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = loadLeaderboard(ENDPOINT, { timeoutMs: 25 });
  const script = document.created.find((element) => element.tagName === 'SCRIPT');
  const callbackName = new URL(script.src).searchParams.get('callback');

  assert.equal(browserWindow.timers[0].timeoutMs, 25);
  browserWindow.runLatestTimer();

  await assert.rejects(promise, /timeout/i);
  assertListCleanup(browserWindow, document, callbackName);
});

test('loadLeaderboard cleans resources when timer registration throws', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  browserWindow.setTimeout = () => {
    throw new Error('timer registration failed');
  };

  const promise = loadLeaderboard(ENDPOINT);
  const script = document.created.find((element) => element.tagName === 'SCRIPT');
  const callbackName = new URL(script.src).searchParams.get('callback');

  await assert.rejects(promise, /timer registration failed/);
  assert.equal(Object.hasOwn(browserWindow, callbackName), false);
  assert.equal(document.head.children.length, 0);
  assert.equal(script.removed, true);
});

test('loadLeaderboard cleans resources when appending the JSONP script throws', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  document.head.appendChild = () => {
    throw new Error('script append failed');
  };

  const promise = loadLeaderboard(ENDPOINT);
  const script = document.created.find((element) => element.tagName === 'SCRIPT');
  const callbackName = new URL(script.src).searchParams.get('callback');

  await assert.rejects(promise, /script append failed/);
  assertListCleanup(browserWindow, document, callbackName);
  assert.equal(script.removed, true);
});

test('submitLeaderboard posts own payload fields and accepts only its iframe response', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const payload = Object.assign(Object.create({ inherited: 'not-sent' }), {
    action: 'submit',
    requestId: 'request-123',
    nickname: 'DKEC',
    score: 42,
  });
  const promise = submitLeaderboard(ENDPOINT, payload);
  const { iframe, form } = getSubmission(document);

  assert.match(iframe.name, /^__[A-Za-z0-9_]+$/);
  assert.equal(iframe.hidden, true);
  assert.equal(form.hidden, true);
  assert.equal(form.method, 'POST');
  assert.equal(form.action, ENDPOINT);
  assert.equal(form.target, iframe.name);
  assert.equal(form.submitted, true);
  assert.deepEqual(
    form.children.map(({ type, name, value }) => ({ type, name, value })),
    [
      { type: 'hidden', name: 'action', value: 'submit' },
      { type: 'hidden', name: 'requestId', value: 'request-123' },
      { type: 'hidden', name: 'nickname', value: 'DKEC' },
      { type: 'hidden', name: 'score', value: '42' },
    ],
  );

  browserWindow.dispatchMessage({}, {
    source: 'dkec-leaderboard',
    requestId: 'request-123',
    ok: true,
  });
  browserWindow.dispatchMessage(iframe.contentWindow, {
    source: 'some-other-channel',
    requestId: 'request-123',
    ok: true,
  });
  browserWindow.dispatchMessage(iframe.contentWindow, {
    source: 'dkec-leaderboard',
    requestId: 'wrong-request',
    ok: true,
  });
  assert.equal(browserWindow.listeners.get('message').size, 1);

  const response = {
    source: 'dkec-leaderboard',
    requestId: 'request-123',
    ok: true,
    record: { nickname: 'DKEC', score: 42 },
  };
  browserWindow.dispatchMessage(iframe.contentWindow, response);

  assert.equal(await promise, response);
  assertSubmitCleanup(browserWindow, document);
});

test('submitLeaderboard accepts the Apps Script sandbox grandchild only from its trusted origin', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = submitLeaderboard(ENDPOINT, { requestId: 'request-google-1' });
  const sandboxWindow = {};
  const response = {
    source: 'dkec-leaderboard',
    requestId: 'request-google-1',
    ok: true,
    updated: true,
    rank: 1,
  };

  browserWindow.dispatchMessage(
    sandboxWindow,
    response,
    'https://attacker.example',
  );
  assert.equal(browserWindow.listeners.get('message').size, 1);

  browserWindow.dispatchMessage(
    sandboxWindow,
    response,
    'https://n-example-0lu-script.googleusercontent.com',
  );
  browserWindow.runLatestTimer();

  assert.equal(await promise, response);
  assertSubmitCleanup(browserWindow, document);
});

test('submitLeaderboard treats a completed cross-origin form response as delivered for legacy Apps Script deployments', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = submitLeaderboard(ENDPOINT, { requestId: 'request-legacy-1' });
  const { iframe } = getSubmission(document);

  Object.defineProperty(iframe.contentWindow, 'location', {
    get() {
      throw new DOMException('Blocked a frame with origin', 'SecurityError');
    },
  });
  iframe.onload();

  assert.deepEqual(await promise, {
    source: 'dkec-leaderboard',
    requestId: 'request-legacy-1',
    ok: true,
    updated: true,
    rank: null,
    transport: 'iframe-load',
  });
  assertSubmitCleanup(browserWindow, document);
});

test('submitLeaderboard rejects a matching backend error and cleans all resources', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = submitLeaderboard(ENDPOINT, { requestId: 'request-456' });
  const { iframe } = getSubmission(document);

  browserWindow.dispatchMessage(iframe.contentWindow, {
    source: 'dkec-leaderboard',
    requestId: 'request-456',
    ok: false,
    error: 'submission rejected',
  });

  await assert.rejects(promise, /submission rejected/);
  assertSubmitCleanup(browserWindow, document);
});

test('submitLeaderboard rejects timeout and cleans all resources', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const promise = submitLeaderboard(
    ENDPOINT,
    { requestId: 'request-789' },
    { timeoutMs: 30 },
  );

  assert.equal(browserWindow.timers[0].timeoutMs, 30);
  browserWindow.runLatestTimer();

  await assert.rejects(promise, /timeout/i);
  assertSubmitCleanup(browserWindow, document);
});

test('submitLeaderboard cleans resources when native form submission throws', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tagName) => {
    const element = originalCreateElement(tagName);
    if (tagName === 'form') {
      element.submit = () => {
        throw new Error('native submit failed');
      };
    }
    return element;
  };

  await assert.rejects(
    submitLeaderboard(ENDPOINT, { requestId: 'request-error' }),
    /native submit failed/,
  );
  assertSubmitCleanup(browserWindow, document);
});

test('submitLeaderboard cleans resources when message listener registration throws', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  browserWindow.addEventListener = () => {
    throw new Error('listener registration failed');
  };

  await assert.rejects(
    submitLeaderboard(ENDPOINT, { requestId: 'request-listener-error' }),
    /listener registration failed/,
  );

  const { iframe, form } = getSubmission(document);
  assert.equal(document.body.children.length, 0);
  assert.equal(form.removed, true);
  assert.equal(iframe.removed, true);
});

test('submitLeaderboard cleans an installed listener when timer registration throws', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  browserWindow.setTimeout = () => {
    throw new Error('timer registration failed');
  };

  await assert.rejects(
    submitLeaderboard(ENDPOINT, { requestId: 'request-timer-error' }),
    /timer registration failed/,
  );

  const { iframe, form } = getSubmission(document);
  assert.equal(browserWindow.listeners.get('message')?.size ?? 0, 0);
  assert.equal(document.body.children.length, 0);
  assert.equal(form.removed, true);
  assert.equal(iframe.removed, true);
});

test('submitLeaderboard cleans resources when appending the iframe throws', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  document.body.appendChild = () => {
    throw new Error('iframe append failed');
  };

  await assert.rejects(
    submitLeaderboard(ENDPOINT, { requestId: 'request-iframe-error' }),
    /iframe append failed/,
  );
  assertSubmitCleanup(browserWindow, document);
});

test('submitLeaderboard cleans resources when appending the form throws', async (t) => {
  const { browserWindow, document } = installBrowser(t);
  const appendChild = document.body.appendChild.bind(document.body);
  let appendCount = 0;
  document.body.appendChild = (element) => {
    appendCount += 1;
    if (appendCount === 2) {
      throw new Error('form append failed');
    }
    return appendChild(element);
  };

  await assert.rejects(
    submitLeaderboard(ENDPOINT, { requestId: 'request-form-error' }),
    /form append failed/,
  );
  assertSubmitCleanup(browserWindow, document);
});
