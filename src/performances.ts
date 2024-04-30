// set of actions to performe for particular context

import { Action, BotContext } from './action.js';
import {
  AddUploadToQBitTorrent, CheckTorrentFile,
  DeleteFile, DownloadRtrcrFile,
  ExtendContext, LogInfo,
  OpenBrowser, OpenQBitTorrent,
  OpenRtrcr, OpenRtrcrTopic,
  TGPrintTorrentPatter
} from './actions.js';

export function downloadRtrcrMovie(url: string, dir = 'D:\\Movies'): Action[] {
  return [
    new ExtendContext({ url, dir }),
    new OpenBrowser(),
    new OpenRtrcr(),
    new OpenRtrcrTopic(),
    new DownloadRtrcrFile(),
    new OpenQBitTorrent(),
    new AddUploadToQBitTorrent(),
    new LogInfo('File added to QBT'),
  ];
}

function botLoggerFactory(context: BotContext) {
  const { bot, chatId, adminId } = context;

  return {
    info(msg: string) {
      bot.telegram.sendMessage(chatId, msg);
    },
    error(err: Error) {
      bot.telegram.sendMessage(adminId, '```\n' + escapeRegExp(prettyError(err)) + '\n```', { parse_mode: 'MarkdownV2' });
    },
    adminInfo(json: object) {
      bot.telegram
        .sendMessage(adminId, '```\n' + escapeRegExp(JSON.stringify(json, null, 2)) + '\n```', { parse_mode: 'MarkdownV2' })
        .catch((err) => {
          this.error(err);
        });
    },
  }
}

export function handleQBTFile(botContextbot: BotContext, torrentFilePath: string, dir = 'D:\\Movies'): Action[] {
  const blogger = botLoggerFactory(botContextbot);

  return [
    new ExtendContext({ blogger, dir, torrentFilePath }),
    new TGPrintTorrentPatter(),
    new CheckTorrentFile(),
    new DeleteFile(torrentFilePath),
  ];
}

function prettyError(error: Error) {
  if (!(error instanceof Error)) {
    throw new TypeError('Input must be an instance of Error');
  }

  const message = `${error.name}: ${error.message}`;
  const stack = error.stack!
    .split('\n')
    .slice(1)
    .map((line) => `  ${line}`)
    .join('\n');

  return `${message}\n${stack}`;
}

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
