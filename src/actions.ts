import * as fs from 'fs';
import { promisify } from 'util';
import * as path from "path";
import { BrowserContext as Browser, Page } from 'playwright';
import { Action } from "./action.js";
import { ActionContext, NextFunction } from "./queue.js";

import parseTorrent from "parse-torrent";
import { TFile, getDestination } from './torrent.js';
import animeDubRecognizer from './multi-track.js';
import { qBitTorrentHost } from './config.js';

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
// const picPath = (picName: string) => path.resolve(process.cwd(), 'pics', `${picName}.png`);


function getUserDataPath(): string {
  return path.resolve(process.cwd(), 'userData');
}

export type BrowserContext = {
  browser: Browser,
  page: Page,
};

export type RutrackerContext = {
  url: string,
}

export type QBitTorrentContext = {
  dir: string,
  torrentFilePath: string,
};

export type BotContext = {
  blogger: {
    info: (msg: string) => void,
    error: (err: Error) => void,
    adminInfo: (json: object) => void,
  }
}

export class OpenBrowser extends Action {
  async execute(context: ActionContext, next: NextFunction) {
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

    next(true, {
      browser, page,
    });
  }
}

export class CloseBrowser extends Action {
  async execute(context: ActionContext & BrowserContext, _next: NextFunction): Promise<void> {
    const { browser } = context;

    const pages = browser.pages();

    for (const page of pages) {
      page.close();
    }

    await browser.close();
  }
}

export class OpenRtrcr extends Action {
  async execute(context: ActionContext & BrowserContext) {
    const { page, logger } = context;

    await page.goto('https://rutracker.org/forum/tracker.php', {
      waitUntil: 'commit',
    });

    logger.info('rtrcr opened')
  }
}

export class IsCloudFlareOpened extends Action {
  async execute(_context: ActionContext, _next: NextFunction) {
    // const { page } = context;

    // is page conteins cloudFlare by css selectors
    // if contains, add preSteps for human interaction
    // if not, do nothing

    this.setPreSteps([
      new LogInfo('CloudFlare opened, human interaction require'),
      new WaitForCloudFlareToPass(),
    ]);
  }
}

export class OpenRtrcrTopic extends Action {
  async execute(context: ActionContext & BrowserContext & RutrackerContext, _next: NextFunction) {
    const { page, url, logger } = context;

    await page.goto(url, {
      waitUntil: 'commit',
    });

    logger.info('rtrcr topis opened');
  }
}

export class DownloadRtrcrFile extends Action {
  async execute(context: ActionContext & BrowserContext, next: NextFunction) {
    const { page, logger } = context;

    // extract link to file by css selector
    // download file to directory or click to the link
    // need to check how it's done in playwright
    // add downloaded file path to the context

    // Start waiting for download before clicking. Note no await.
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.dl-link').click();
    const download = await downloadPromise;

    logger.info('torrent file downloaded');

    const filePath = path.resolve('.', 'files', download.suggestedFilename());

    // Wait for the download process to complete and save the downloaded file somewhere.
    await download.saveAs(filePath);

    logger.info('torrent file saved to ' + filePath);

    next(true, {
      torrentFilePath: filePath,
    });
  }
}

export class OpenQBitTorrent extends Action {
  async execute(context: ActionContext & BrowserContext) {
    const { page } = context;

    await page.goto(qBitTorrentHost, {
      waitUntil: 'networkidle',
    });
  }
}

export class AddUploadToQBitTorrent extends Action {
  async execute(context: ActionContext & BrowserContext & QBitTorrentContext & BotContext, _next: NextFunction) {
    const { page, dir, torrentFilePath, logger, blogger } = context;

    try {
      const vs = page.viewportSize() || { width: 200, height: 200 };
      await page.mouse.move(vs.width, vs.height);
      await page.locator('#uploadButton').click(); // default scope
    } catch (e) {
      blogger.error(e as Error);
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

export class ExtendContext extends Action {
  contextExtension: object | undefined
  constructor(context: object) {
    super({ postDelay: 0 });
    this.contextExtension = context;
  }

  async execute(_context: ActionContext, next: NextFunction) {
    next(true, this.contextExtension);
  }
}

export class TGLogInfo extends Action {
  message: string;

  constructor(message: string) {
    super({ postDelay: 0 });
    this.message = message;
  }
  async execute(context: ActionContext & BotContext) {
    const { blogger } = context;

    blogger.info(this.message);
  }
}

export class LogInfo extends Action {
  message: string;

  constructor(message: string) {
    super({ postDelay: 0 });
    this.message = message;
  }
  async execute(context: ActionContext) {
    const { logger } = context;

    logger.info(this.message);
  }
}

export class WaitForCloudFlareToPass extends Action {
  async execute(_context: ActionContext, next: NextFunction) {
    // const { page } = context;


    // is page still contains cloudflare
    // if contains
    next(false);
    // if not
    //   call next(true);
  }
}

export class ErrorNotification extends Action {
  error: Error

  constructor(error: Error) {
    super({ postDelay: 0 });
    this.error = error;
  }

  async execute(context: ActionContext & BotContext) {
    const { logger } = context;
    logger.error(this.error);

    if (context.blogger) {
      context.blogger.error(this.error);
    }
  }
}

export class CheckTorrentFile extends Action {
  constructor() {
    super({ postDelay: 0 });
  }

  async execute(context: ActionContext & QBitTorrentContext & BotContext): Promise<void> {
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

    this.setPreSteps([
      new ExtendContext({ dir }),
      new OpenBrowser(),
      new OpenQBitTorrent(),
      new AddUploadToQBitTorrent(),
      new LogInfo('File added to qBitTorrent'),
      new TGLogInfo('File processed successfully'),
      new CloseBrowser(),
    ]);
  }
}

export class TGPrintTorrentPatter extends Action {
  constructor() {
    super({ postDelay: 0 });
  }

  async execute(context: ActionContext & QBitTorrentContext & BotContext, _next: NextFunction): Promise<void> {
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


const pureContextKeys: Array<keyof ActionContext> = ['chromium', 'queue', 'logger'];
export class CleanUpContext extends Action {
  constructor() {
    super({ postDelay: 0 });
  }

  /*
   * Remove from context all that is not: chromium, queue, logger
   */
  async execute(context: ActionContext, _next: NextFunction): Promise<void> {

    const keys = Object.keys(context) as Array<keyof ActionContext>;

    for (const key of keys) {
      if (pureContextKeys.includes(key)) continue

      delete context[key];
    }

  }
}

export class DeleteFile extends Action {
  constructor(private readonly filePath: string) {
    super({ postDelay: 0 });
  }

  async execute(): Promise<void> {
    await unlink(this.filePath);
  }
}
