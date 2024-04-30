import { BrowserContext as Browser, BrowserType, Page } from "playwright";
import { Telegraf } from "telegraf";
import { Logger } from "./logger.js";

export type PlaywrightContext = {
  chromium: BrowserType,
}

type BLogger = {
    info: (msg: string) => void,
    error: (err: Error) => void,
    adminInfo: (json: object) => void,
}

export type BotContext = {
  bot: Telegraf,
  filePath: string,
  logger: Logger,
  blogger: BLogger,
  adminId: number,
  chatId: number,
}

export type BrowserContext = {
  browser: Browser,
  page: Page,
};

export type QBitTorrentContext = {
  dir: string,
  torrentFilePath: string,
};

