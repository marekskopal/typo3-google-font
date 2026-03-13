import { test, expect, Route } from '@playwright/test';

const FONT_URL_1 = 'https://fonts.test/css2?family=Roboto:wght@400;700&display=swap';
const FONT_URL_2 = 'https://fonts.test/css2?family=Open+Sans:wght@400;600&display=swap';

const FONT_CSS_ROBOTO = `@font-face { font-family: 'Roboto'; src: url(https://fonts.gstatic.test/roboto.woff2) format('woff2'); }`;
const FONT_CSS_OPEN_SANS = `@font-face { font-family: 'Open Sans'; src: url(https://fonts.gstatic.test/open-sans.woff2) format('woff2'); }`;

/**
 * Returns the HTML fragment that GoogleFontEventListener generates for the given font URLs.
 * Mirrors getLinkStylesheet() output exactly so tests stay in sync with the PHP implementation.
 */
function buildFontHtml(fonts: Array<{ id: string; url: string }>): string {
  const fontTags = fonts
    .map(({ id, url }) => [
      `<link id="${id}" rel="preload" href="${url}" as="style">`,
      `<script>var ${id}=document.getElementById('${id}');${id}.onload=function(){${id}.onload=null;${id}.rel='stylesheet'};window.addEventListener('load',function(){if(${id}.rel!=='stylesheet'){${id}.rel='stylesheet';}});</script>`,
    ].join(''))
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fontTags}
</head>
<body><p>Font loading test</p></body>
</html>`;
}

test.describe('Google Font async loading', () => {
  /**
   * Normal first-visit scenario: font CSS arrives after a network delay.
   * The onload handler is already registered by the time the response arrives,
   * so it should fire and switch rel to "stylesheet".
   */
  test('loads font on first visit (slow network fetch)', async ({ page }) => {
    await page.route('https://fonts.test/**', async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS_ROBOTO });
    });

    await page.setContent(buildFontHtml([{ id: 'googleFonts1', url: FONT_URL_1 }]));

    await expect(page.locator('#googleFonts1')).toHaveAttribute('rel', 'stylesheet', { timeout: 5_000 });
  });

  /**
   * Cache race condition scenario: font CSS is fulfilled instantly (zero delay).
   * This simulates a disk-cache hit where the browser resolves the preload
   * synchronously before the inline <script> has a chance to register onload.
   * Without the window.load fallback, rel would stay as "preload" forever.
   * With the fallback, window "load" fires and forces rel to "stylesheet".
   */
  test('loads font when cached (instant response — cache race condition)', async ({ page }) => {
    await page.route('https://fonts.test/**', async (route: Route) => {
      // Zero delay: fulfilled before the inline script can set onload.
      await route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS_ROBOTO });
    });

    await page.setContent(buildFontHtml([{ id: 'googleFonts1', url: FONT_URL_1 }]));

    await expect(page.locator('#googleFonts1')).toHaveAttribute('rel', 'stylesheet', { timeout: 5_000 });
  });

  /**
   * Multiple fonts scenario: each font loads at a different time.
   * Ensures each independent window.load listener fires correctly for all fonts.
   */
  test('loads multiple fonts correctly', async ({ page }) => {
    let callCount = 0;
    await page.route('https://fonts.test/**', async (route: Route) => {
      callCount++;
      const url = route.request().url();
      const delay = callCount === 1 ? 0 : 400; // first instant (cache), second slow (network)
      await new Promise((resolve) => setTimeout(resolve, delay));
      const body = url.includes('Open+Sans') ? FONT_CSS_OPEN_SANS : FONT_CSS_ROBOTO;
      await route.fulfill({ status: 200, contentType: 'text/css', body });
    });

    await page.setContent(buildFontHtml([
      { id: 'googleFonts1', url: FONT_URL_1 },
      { id: 'googleFonts2', url: FONT_URL_2 },
    ]));

    await expect(page.locator('#googleFonts1')).toHaveAttribute('rel', 'stylesheet', { timeout: 5_000 });
    await expect(page.locator('#googleFonts2')).toHaveAttribute('rel', 'stylesheet', { timeout: 6_000 });
  });

  /**
   * Back/forward navigation scenario (bfcache):
   * Navigate to the fixture page, confirm fonts load, navigate away, then go back.
   * If the browser restores from bfcache (page snapshot), the rel attributes should
   * already be "stylesheet" since they were set before the page was frozen.
   * If the browser does a full reload, the font must load again correctly.
   */
  test('loads font correctly after navigating back', async ({ page }) => {
    await page.route('https://fonts.test/**', async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS_ROBOTO });
    });

    // Navigate to the fixture via webServer (required for real navigation history).
    await page.goto('/font-loading.html');
    await expect(page.locator('#googleFonts1')).toHaveAttribute('rel', 'stylesheet', { timeout: 5_000 });

    // Navigate away, then back.
    await page.goto('about:blank');
    await page.goBack();

    // Whether restored from bfcache (rel was already "stylesheet") or fully reloaded
    // (window.load fallback kicks in), the font must still be in stylesheet state.
    await expect(page.locator('#googleFonts1')).toHaveAttribute('rel', 'stylesheet', { timeout: 5_000 });
  });

  /**
   * Regression test: demonstrate the bug that existed WITHOUT the window.load fallback.
   * This test uses the buggy JS variant and verifies it FAILS on instant (cached) responses.
   * It is expected to FAIL — it is skipped by default to avoid polluting CI results.
   * Unskip manually to confirm the bug exists without the fix.
   */
  test.skip('REGRESSION: buggy implementation fails on cached response (expected failure)', async ({ page }) => {
    await page.route('https://fonts.test/**', async (route: Route) => {
      // Zero delay = cache hit scenario
      await route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS_ROBOTO });
    });

    // Buggy JS: no window.load fallback — if onload fires before the script runs, font never loads.
    const buggyHtml = `<!DOCTYPE html>
<html><head>
  <link id="googleFonts1" rel="preload" href="${FONT_URL_1}" as="style">
  <script>var googleFonts1=document.getElementById('googleFonts1');googleFonts1.onload=function(){googleFonts1.onload=null;googleFonts1.rel='stylesheet'};</script>
</head><body><p>test</p></body></html>`;

    await page.setContent(buggyHtml);

    // This assertion is expected to time out when the cache race condition triggers.
    await expect(page.locator('#googleFonts1')).toHaveAttribute('rel', 'stylesheet', { timeout: 3_000 });
  });
});
