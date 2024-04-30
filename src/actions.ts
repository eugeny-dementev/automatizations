import * as fs from 'fs';
import { promisify } from 'util';
import * as path from "path";
import { Page } from 'playwright';
import { Action, QueueContext } from 'async-queue-runner';

import parseTorrent from "parse-torrent";
import { TFile, getDestination } from './torrent.js';
import animeDubRecognizer from './multi-track.js';
import { qBitTorrentHost } from './config.js';
import { BotContext, BrowserContext, PlaywrightContext, QBitTorrentContext } from './types.js';

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
// const picPath = (picName: string) => path.resolve(process.cwd(), 'pics', `${picName}.png`);

function getUserDataPath(): string {
  return path.resolve(process.cwd(), 'userData');
}
export class OpenBrowser extends Action<PlaywrightContext> {
  async execute(context: PlaywrightContext & QueueContext) {
    const { chromium } = context;
    const browser = await chromium.launchPersistentContext(getUserDataPath(), { headless: true });
    const pages = browser.pages()

    for (const page of pages) {
      page.close();
    }

    const page: Page = await browser.newPage();

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    await page.setExtraHTTPHeaders({
      'User-Agent': userAgent,
      'Accept-Language': 'en-US,en;q=0.9'
    });

    context.extend({
      browser, page,
    });
  }
}

export class CloseBrowser extends Action<BotContext & BrowserContext> {
  async execute(context: BotContext & BrowserContext & QueueContext): Promise<void> {
    const { browser } = context;

    const pages = browser.pages();

    for (const page of pages) {
      page.close();
    }

    await browser.close();
  }
}

export class OpenQBitTorrent extends Action<BotContext & BrowserContext> {
  async execute(context: BotContext & BrowserContext & QueueContext) {
    const { page } = context;

    await page.goto(qBitTorrentHost, {
      waitUntil: 'networkidle',
    });
  }
}

export class AddUploadToQBitTorrent extends Action<BotContext & BrowserContext & QBitTorrentContext & BotContext> {
  async execute(context: BotContext & BrowserContext & QBitTorrentContext & BotContext & QueueContext) {
    const { page, dir, torrentFilePath, logger } = context;

    try {
      const vs = page.viewportSize() || { width: 200, height: 200 };
      await page.mouse.move(vs.width, vs.height);
      await page.locator('#uploadButton').click(); // default scope
    } catch (e) {
      logger.error(e as Error);
    }

    logger.info('Clicked to add new download task');
    logger.info(`${torrentFilePath} => ${dir}`);

    // popup is opened, but it exist in iFrame so need to switch scopes to it
    const uploadPopupFrame = page.frameLocator('#uploadPage_iframe');

    // search input[type=file] inside iframe locator
    const chooseFileButton = uploadPopupFrame.locator('#uploadForm #fileselect');

    logger.info('chooseFileButton: ' + await chooseFileButton.innerHTML());

    // Start waiting for file chooser before clicking. Note no await.
    const fileChooserPromise = page.waitForEvent('filechooser');
    await chooseFileButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(torrentFilePath);

    logger.info('file choosing ' + torrentFilePath);
    // alternative way to set files to input[type=file]
    // await chooseFileButton.setInputFiles([torrentFilePath]);
    logger.info('torrent file set');

    // Set destination path
    await uploadPopupFrame.locator('#savepath').fill(dir);
    logger.info('destination set ' + dir);

    // submit downloading and wait for popup to close
    await Promise.all([
      uploadPopupFrame.locator('button[type="submit"]').click(),
      page.waitForSelector('#uploadPage_iframe', { state: "detached" }),
    ])

    logger.info('torrent submitted');
  }
}

export class ExtendContext extends Action<any> {
  contextExtension: object | undefined
  constructor(context: object) {
    super();

    this.contextExtension = context;
  }

  async execute(context: any) {
    context.extend(this.contextExtension);
  }
}

export class CheckTorrentFile extends Action<BotContext & QBitTorrentContext> {
  async execute(context: BotContext & QBitTorrentContext & QueueContext): Promise<void> {
    const { torrentFilePath, blogger, logger } = context;

    logger.info('cheking torrentFilePath: ' + torrentFilePath);

    const file = await readFile(path.resolve(torrentFilePath));
    const torrent = await parseTorrent(file) as { files: TFile[] };

    if (torrent?.['files']) {
      blogger.adminInfo(torrent.files);
    }

    let dir = '';
    try {
      dir = getDestination(torrent.files);
    } catch (e) {
      logger.error(e as Error);
      blogger.error(e as Error);
      const { message } = e as Error;
      blogger.info(message);
      return;
    }

    context.push([
      new ExtendContext({ dir }),
      new OpenBrowser(),
      new OpenQBitTorrent(),
      new AddUploadToQBitTorrent(),
      new CloseBrowser(),
    ]);
  }
}

export class TGPrintTorrentPattern extends Action<BotContext & QBitTorrentContext> {
  async execute(context: BotContext & QBitTorrentContext & QueueContext): Promise<void> {
    const { torrentFilePath, blogger } = context;
    const dirs = new Set();

    const file = await readFile(path.resolve(torrentFilePath));
    const torrent = await parseTorrent(file) as { files: TFile[] };

    for (const file of torrent.files) {
      const { path: filePath } = file;

      const parts = filePath.split('/');

      const fileName = parts.pop();
      const fileDir = parts.join('/');

      const fileExt = path.parse(fileName || '').ext;

      dirs.add(`${fileDir}/*${fileExt}`);
    }

    const patterns = Array.from(dirs.keys()) as string[];

    blogger.adminInfo(patterns);
    blogger.adminInfo(Array.from(animeDubRecognizer(patterns)));
  }
}

export class DeleteFile extends Action<BotContext> {
  async execute(context: BotContext): Promise<void> {
    await unlink(context.filePath);
  }
}
