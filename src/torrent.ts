import { moviesDir, tvshowsDir } from "./config.js";

export type TFile = {
  name: string,
  path: string,
  length: number,
  offset: number,
}

/**
 * Check torrent files
 */
export function getDestination(files: TFile[]): string {
  for (const file of files) {
    const { path } = file;

    const parts = path.split('\\');

    if (parts.length > 2) {
      throw new Error('torrent should contain no more than one directory with *.mkv files in it');
    }

    const name = parts.pop() as string

    if (!/\.mkv$/.test(name)) {
      throw new Error('torrent should contain only *.mkv files');
    }
  }

  if (files.length > 1) {
    return tvshowsDir;
  }

  return moviesDir;
}
