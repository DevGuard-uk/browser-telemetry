# @devguard-uk/browser-telemetry

Lightweight client-side browser exception reporting, breadcrumbs, and user journey tracking for applications protected by DevGuard.

## Features

- **Uncaught Exception & Promise Rejection Capture**: Automatic capture of `window.onerror` and `unhandledrejection`.
- **Breadcrumb Timeline**: Tracks SPA route transitions (`pushState`, `popstate`), interactive clicks, and console warnings/errors.
- **Strict Client-Side PII Scrubbing**: Redacts tokens, Authorization headers, credit card patterns, and sensitive query parameters before network dispatch.
- **Reliable Non-Blocking Delivery**: Uses `navigator.sendBeacon` with `fetch(keepalive: true)` fallback.
- **Fail-Safe**: Never crashes the host application.

## Quick Start

```html
<script src="/path/to/devguard-web-telemetry.min.js"></script>
<script>
  DevGuardWebTelemetry.init({
    projectId: 'YOUR_PROJECT_ID',
    // Publishable project SDK key only — never the account Master Secret in the browser.
    sdkKey: 'YOUR_PROJECT_SDK_KEY',
    endpoint: 'https://api.devguard.uk/api/v1/telemetry'
  });
</script>
```

Or via ES module / Bundlers:

```javascript
import { initDevGuardWebTelemetry, recordUserLog, captureException } from '@devguard-uk/browser-telemetry';

initDevGuardWebTelemetry({
  projectId: 'YOUR_PROJECT_ID',
  sdkKey: 'YOUR_PROJECT_SDK_KEY',
  endpoint: 'https://api.devguard.uk/api/v1/telemetry',
  sampleRate: 1.0,
  enableBreadcrumbs: true
});

// Record custom user journey step
recordUserLog({
  screen: '/checkout',
  widget: 'PayButton',
  action: 'tap'
});
```
