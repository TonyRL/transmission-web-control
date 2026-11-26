import { type Browser, chromium, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

const torrent = (
  id: number,
  uploadRatio: number,
  uploadedEver: number,
  downloadedEver: number,
): Record<string, unknown> => ({
  id,
  name: `torrent-${id}`,
  hashString: `hash${id}`,
  status: 0,
  totalSize: 1000,
  percentDone: 1,
  leftUntilDone: 0,
  addedDate: 0,
  doneDate: 0,
  activityDate: 0,
  queuePosition: id,
  rateDownload: 0,
  rateUpload: 0,
  recheckProgress: 0,
  peersGettingFromUs: 0,
  peersSendingToUs: 0,
  trackerStats: [],
  // Fields that the details panel reads
  pieces: 'gA==',
  pieceCount: 1,
  pieceSize: 1000,
  files: [],
  fileStats: [],
  trackers: [],
  peers: [],
  downloadDir: '/downloads',
  error: 0,
  errorString: '',
  uploadRatio,
  uploadedEver,
  downloadedEver,
});

const torrents = [
  torrent(1, 1.23456, 123456, 100000),
  torrent(2, 0.5, 50, 100),
  // TR_RATIO_INF
  torrent(3, -2, 100, 0),
  // TR_RATIO_NA
  torrent(4, -1, 0, 0),
];

const stats = {
  uploadedBytes: 0,
  downloadedBytes: 0,
  filesAdded: 0,
  sessionCount: 1,
  secondsActive: 0,
};

const rpcResults: Record<string, unknown> = {
  'session-get': {
    version: '4.0.6',
    'rpc-version': 17,
    'download-dir': '/downloads',
    'alt-speed-enabled': false,
  },
  'session-stats': {
    torrentCount: torrents.length,
    activeTorrentCount: 0,
    pausedTorrentCount: torrents.length,
    downloadSpeed: 0,
    uploadSpeed: 0,
    'cumulative-stats': stats,
    'current-stats': stats,
  },
  'free-space': { path: '/downloads', 'size-bytes': 1000 },
  'torrent-get': { torrents, removed: [] },
};

let server: ViteDevServer;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await createServer({ server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage();

  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
    await route.abort();
  });
  await page.route('**/rpc', async (route) => {
    const request = route.request();
    if (!request.headers()['x-transmission-session-id']) {
      await route.fulfill({ status: 409, headers: { 'X-Transmission-Session-Id': 'e2e' } });
      return;
    }

    const { method, arguments: args } = JSON.parse(request.postData() ?? '{}');
    const result =
      method === 'torrent-get' && typeof args.ids === 'number'
        ? { torrents: torrents.filter(({ id }) => id === args.ids) }
        : rpcResults[method];
    await route.fulfill({ json: { result: 'success', arguments: result ?? {} } });
  });

  await page.goto(server.resolvedUrls?.local[0] ?? '');
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

test('torrent list shows the upload ratio with two decimals', async () => {
  // Click All torrents
  await page.locator('.tree-node.tree-root-first').click();

  const cells = page.locator('.datagrid-body td[field="uploadRatio"] span');
  await expect.poll(async () => await cells.count()).toBe(torrents.length);

  const rendered = await cells.evaluateAll((spans) =>
    spans.map((span) => [span.textContent, span.className]),
  );

  expect(rendered).toEqual(
    expect.arrayContaining([
      ['1.23', ''],
      ['0.50', 'text-status-warning'],
      ['∞', ''],
      ['0.00', ''],
    ]),
  );
});

test('torrent details show the upload ratio with two decimals', async () => {
  await page.locator('.datagrid-body td[field="name"]', { hasText: 'torrent-1' }).click();
  // Expand details panel
  await page.locator('#layout_body > .layout-expand-south .layout-button-up').click();

  await expect
    .poll(async () => await page.locator('#torrent-attribute-value-uploadRatio').textContent())
    .toBe('1.23');
});
