# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TYPO3 CMS extension (`ms_google_font`) that includes Google Fonts in TYPO3 websites asynchronously and non-blocking, with preconnect support for loading efficiency.

- Extension key: `ms_google_font`
- PHP namespace: `MarekSkopal\GoogleFont\`
- Composer package: `marekskopal/typo3-google-font`
- Requires TYPO3 ^13.4 || ^14.0, PHP >=8.2

## Commands

### Static Analysis
```sh
vendor/bin/phpstan analyse
```

### Code Style Check
```sh
vendor/bin/phpcs
```

### Code Style Fix
```sh
vendor/bin/phpcbf
```

## Architecture

The extension has a single entry point: `Classes/EventListener/GoogleFontEventListener.php`.

**Flow:**
1. `GoogleFontEventListener` listens to `BeforeStylesheetsRenderingEvent` via the `#[AsEventListener]` attribute.
2. On invocation, it reads TypoScript settings from `plugin.tx_msgooglefont.settings.fontSrc.` (an indexed array of Google Font CSS URLs).
3. For each font URL, it injects a `<link rel="preload" as="style">` plus an inline `<script>` that sets `onload` to switch `rel` to `"stylesheet"` (with `onload=null` guard to prevent re-triggering). A `<noscript>` fallback is included for JS-disabled environments. This is the async/non-blocking loading technique — more reliable than the `media="print"` hack, which fails on cached resources.
4. It also injects a `<link rel="preconnect" href="https://fonts.gstatic.com">` for preconnect.
5. CSP nonces are applied to inline scripts via `ConsumableNonce` from the request attribute `nonce`.

**Configuration:**
- TypoScript template registered via `Configuration/TCA/Overrides/sys_template.php`
- Default TypoScript in `Configuration/Sets/GoogleFont/setup.typoscript`
- Site Set defined in `Configuration/Sets/GoogleFont/config.yaml`
- Services autowired/autoconfigured via `Configuration/Services.yaml`

**TypoScript settings format** (set by integrators):
```
plugin.tx_msgooglefont {
    settings {
        fontSrc {
            1 = https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap
        }
    }
}
```

Note: TypoScript arrays use dot-suffixed keys internally (e.g., `fontSrc.` not `fontSrc`).
