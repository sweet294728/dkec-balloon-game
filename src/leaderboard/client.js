const CALLBACK_PATTERN = /^__[A-Za-z0-9_]+$/;
const ENDPOINT_CONFIGURATION_ERROR = '撠閮剖???璁雯?';
let uniqueId = 0;

function parseEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.trim() === '') {
    throw new TypeError(ENDPOINT_CONFIGURATION_ERROR);
  }

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new TypeError(`${ENDPOINT_CONFIGURATION_ERROR} URL`);
  }

  if (url.protocol !== 'https:') {
    throw new TypeError('Leaderboard endpoint must use HTTPS');
  }

  return url;
}

function createUniqueName(label) {
  uniqueId += 1;
  return `__dkec_${label}_${Date.now()}_${uniqueId}`;
}

function getBrowserEnvironment() {
  const browserWindow = globalThis.window;
  const browserDocument = globalThis.document;

  if (!browserWindow || !browserDocument) {
    throw new TypeError('Leaderboard transport requires a browser DOM');
  }

  return { browserWindow, browserDocument };
}

function errorFromPayload(payload, fallbackMessage) {
  const message = typeof payload?.error === 'string' && payload.error.trim()
    ? payload.error
    : fallbackMessage;
  return new Error(message);
}

function safely(cleanupAction) {
  try {
    cleanupAction();
  } catch {
    // Cleanup is best-effort per resource so one browser API cannot block others.
  }
}

export function buildLeaderboardListUrl(endpoint, callbackName) {
  const url = parseEndpoint(endpoint);

  if (!CALLBACK_PATTERN.test(callbackName)) {
    throw new TypeError('Invalid JSONP callback name');
  }

  url.searchParams.set('action', 'list');
  url.searchParams.set('callback', callbackName);
  return url.toString();
}

export function loadLeaderboard(endpoint, { timeoutMs = 8000 } = {}) {
  const callbackName = createUniqueName('leaderboard');
  const scriptUrl = buildLeaderboardListUrl(endpoint, callbackName);
  const { browserWindow, browserDocument } = getBrowserEnvironment();
  const script = browserDocument.createElement('script');
  script.src = scriptUrl;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timerId;

    const cleanup = () => {
      if (timerId !== undefined) {
        safely(() => browserWindow.clearTimeout(timerId));
      }
      safely(() => {
        script.onerror = null;
      });
      safely(() => {
        delete browserWindow[callbackName];
      });
      safely(() => script.remove());
    };

    const settle = (handler, value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      handler(value);
    };

    try {
      browserWindow[callbackName] = (payload) => {
        if (payload?.ok === true && Array.isArray(payload.records)) {
          settle(resolve, payload.records);
          return;
        }

        const fallback = payload?.ok === true
          ? 'Leaderboard response records must be an array'
          : 'Leaderboard backend returned an error';
        settle(reject, errorFromPayload(payload, fallback));
      };

      script.onerror = () => {
        settle(reject, new Error('Leaderboard JSONP script failed to load'));
      };

      timerId = browserWindow.setTimeout(() => {
        settle(reject, new Error('Leaderboard list request timeout'));
      }, timeoutMs);

      browserDocument.head.appendChild(script);
    } catch (error) {
      settle(reject, error);
    }
  });
}

export function submitLeaderboard(
  endpoint,
  payload,
  { timeoutMs = 10000 } = {},
) {
  const endpointUrl = parseEndpoint(endpoint).toString();
  const { browserWindow, browserDocument } = getBrowserEnvironment();

  if (!payload || typeof payload !== 'object') {
    throw new TypeError('Leaderboard payload must be an object');
  }

  if (!Object.hasOwn(payload, 'requestId') || String(payload.requestId) === '') {
    throw new TypeError('Leaderboard payload requires a requestId');
  }

  const requestId = String(payload.requestId);
  const frameName = createUniqueName('leaderboard_frame');

  return new Promise((resolve, reject) => {
    let iframe;
    let form;
    let settled = false;
    let timerId;

    const cleanup = () => {
      safely(() => browserWindow.removeEventListener('message', handleMessage));
      if (timerId !== undefined) {
        safely(() => browserWindow.clearTimeout(timerId));
      }
      if (form) {
        safely(() => form.remove());
      }
      if (iframe) {
        safely(() => iframe.remove());
      }
    };

    const settle = (handler, value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      handler(value);
    };

    function handleMessage(event) {
      if (event.source !== iframe.contentWindow) {
        return;
      }

      const data = event.data;
      if (
        !data
        || data.source !== 'dkec-leaderboard'
        || data.requestId !== requestId
      ) {
        return;
      }

      if (data.ok === true) {
        settle(resolve, data);
      } else {
        settle(
          reject,
          errorFromPayload(data, 'Leaderboard backend rejected the submission'),
        );
      }
    }

    try {
      iframe = browserDocument.createElement('iframe');
      form = browserDocument.createElement('form');

      iframe.name = frameName;
      iframe.hidden = true;
      iframe.style.display = 'none';

      form.hidden = true;
      form.style.display = 'none';
      form.method = 'POST';
      form.action = endpointUrl;
      form.target = frameName;

      for (const fieldName of Object.keys(payload)) {
        const input = browserDocument.createElement('input');
        input.type = 'hidden';
        input.name = fieldName;
        input.value = String(payload[fieldName]);
        form.appendChild(input);
      }

      browserWindow.addEventListener('message', handleMessage);
      timerId = browserWindow.setTimeout(() => {
        settle(reject, new Error('Leaderboard submission timeout'));
      }, timeoutMs);

      browserDocument.body.appendChild(iframe);
      browserDocument.body.appendChild(form);
      form.submit();
    } catch (error) {
      settle(reject, error);
    }
  });
}
