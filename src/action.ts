import { Telegraf } from "telegraf";
import { ActionContext, NextFunction } from "./queue.js";

export type BotContext = {
  bot: Telegraf,
  adminId: number,
  chatId: number,
}

export class Action {
  delay: number
  next: Action[]
  prev: Action[]
  hasPreSteps: boolean

  constructor({
    postDelay = 1000, // Delay after action successfully executed
  } = {}) {
    this.delay = postDelay;
    this.next = [];
    this.prev = [];
    this.hasPreSteps = false;
  }

  /**
   * @param {Object} context
   * @param {Object} context.chromium
   *
   * @param {Function} next - confirm action being successfully executed
   *
   * @returns Promise<null>
   */
  async execute(context: ActionContext, next: NextFunction): Promise<void> {
    throw new Error('Override required');
  }

  getDelay() {
    return this.delay;
  }

  setNextSteps(actions: Action[]) {
    this.next = actions;
  }

  setPreSteps(actions: Action[]) {
    this.prev = actions;
    this.hasPreSteps = true;
  }

  getPreSteps() {
    return this.prev;
  }

  getNextSteps() {
    return this.next;
  }
}

