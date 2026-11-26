import { setTimeout as sleep } from 'node:timers/promises';

import { expect, test } from 'vitest';

import type { System as AppSystem } from '../src/type';
import { page, rpc, torrents } from './setup.test';

type TestSystem = Omit<AppSystem, 'autoReloadTimer'> & {
  autoReloadTimer: number;
  reloadData(): void;
  resetTorrentInfos(...args: unknown[]): void;
};

const reloadStep = 500;
const answerTime = 300;
const methods = () => rpc.requests.map(({ method }) => method);
const reloading = async () => await page.evaluate(() => globalThis.system.reloading);

const prepare = async (autoReload: boolean) => {
  await page.evaluate(() => {
    const system = globalThis.system as unknown as TestSystem;
    system.config.autoReload = false;
    clearTimeout(system.autoReloadTimer);
  });
  await expect.poll(reloading).toBe(false);
  await page.evaluate(
    (config) => {
      Object.assign(globalThis.system.config, config);
    },
    { autoReload, reloadStep },
  );
  rpc.requests.length = 0;
};

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
  // Click All torrents
  await page.locator('.tree-node.tree-root-first').click();
  await page.locator('.datagrid-body td[field="name"]', { hasText: 'torrent-1' }).click();
  // Expand details panel
  await page.locator('#layout_body > .layout-expand-south .layout-button-up').click();

  await expect
    .poll(async () => await page.locator('#torrent-attribute-value-uploadRatio').textContent())
    .toBe('1.23');
});

test('refreshes torrents once per cycle and waits the configured delay after completion', async () => {
  await prepare(true);
  rpc.hold['torrent-get'] = sleep(answerTime);
  await page.evaluate(() => {
    (globalThis.system as unknown as TestSystem).reloadData();
  });

  await expect.poll(() => rpc.requests.length).toBeGreaterThanOrEqual(3);
  expect(methods().slice(0, 3)).toEqual(['session-stats', 'torrent-get', 'session-stats']);
  expect(rpc.requests[2]?.idle).toBeGreaterThanOrEqual(reloadStep);
});

test('does not overlap a slow request and refreshes once more for the requests made during it', async () => {
  await prepare(false);
  let release = () => {};
  rpc.hold['session-stats'] = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.evaluate(() => {
    (globalThis.system as unknown as TestSystem).reloadData();
  });
  await expect.poll(methods).toEqual(['session-stats']);
  await page.evaluate(() => {
    const system = globalThis.system as unknown as TestSystem;
    system.reloadData();
    system.reloadData();
  });
  expect(methods()).toEqual(['session-stats']);

  release();
  const cycles = ['session-stats', 'torrent-get', 'session-stats', 'torrent-get'];
  await expect.poll(methods).toEqual(cycles);
  await expect.poll(reloading).toBe(false);
  expect(methods()).toEqual(cycles);
});

test('starts the next cycle after the configured delay when a request fails', async () => {
  await prepare(true);
  rpc.hold['session-stats'] = sleep(answerTime);
  rpc.failStatus = true;
  await page.evaluate(() => {
    (globalThis.system as unknown as TestSystem).reloadData();
  });

  await expect.poll(() => rpc.requests.length).toBeGreaterThanOrEqual(3);
  expect(methods().slice(0, 3)).toEqual(['session-stats', 'session-stats', 'torrent-get']);
  expect(rpc.requests[1]?.idle).toBeGreaterThanOrEqual(reloadStep);
});

test('continues to refresh after the render throws', async () => {
  await prepare(true);
  rpc.hold['torrent-get'] = sleep(answerTime);
  const thrown = page.waitForEvent('console', {
    predicate: (message) => message.text().includes('render failed'),
    timeout: 10_000,
  });
  await page.evaluate(() => {
    const system = globalThis.system as unknown as TestSystem;
    const render = system.resetTorrentInfos;
    system.resetTorrentInfos = () => {
      system.resetTorrentInfos = render;
      throw new Error('render failed');
    };
    system.reloadData();
  });
  await thrown;

  await expect.poll(() => rpc.requests.length).toBeGreaterThanOrEqual(3);
  expect(methods().slice(0, 3)).toEqual(['session-stats', 'torrent-get', 'session-stats']);
  expect(rpc.requests[2]?.idle).toBeGreaterThanOrEqual(reloadStep);
});
