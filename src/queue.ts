import { BrowserType, chromium } from 'playwright';
import { CleanUpContext, ErrorNotification } from './actions.js';
import { Logger } from './logger.js';
import { Action } from './action.js';

// randomize for couldflare to notice less bot like activity
export function rnd(min = 100, max = 1000) {
  return min + Math.floor(Math.random() * (max - min));
}

export function delay(timeout = 1000) {
  console.log('delay:', timeout);
  return new Promise((res) => {
    // only add random delay if delay require in the first place
    setTimeout(res, timeout + timeout ? rnd() : 0);
  });
}

export type ActionContext = {
  chromium: BrowserType,
  queue: ActionsQueueHandler,
  logger: Logger,
}

export type NextFunction = (confirmation?: boolean, contextExtention?: object) => void

export class ActionsQueueHandler {
  queue: Action[] = [];
  delay = delay;
  loopAction = false;


  async prepareContext(): Promise<ActionContext> {
    return {
      chromium,
      queue: this,
      logger: new Logger(),
    };
  }

  async loop() {
    console.log('starting loop');
    const context = await this.prepareContext();
    while (this.loopAction) {
      context.logger.info('queue loop iteration, elements in the queue:' + this.queue.length);
      if (this.queue.length === 0) {
        this.loopAction = false;
        console.log('no actions, pausing loop');
        return;
      }
      await this.iterate(context);
    }
  }

  async iterate(context: ActionContext) {
    if (this.queue.length === 0) {
      await delay(1000);
      return;
    }

    let processed = true;

    const action = this.queue[0];
    console.log(`running ${action.constructor.name || 'some undefined'} action`)
    const next: NextFunction = (confirmation = true, contextExtension) => {
      processed = confirmation;

      if (contextExtension) {
        if (!isObject(contextExtension)) throw new Error('contextExtension is not an object');

        Object.assign(context, contextExtension);
      }
    }

    try {
      await action.execute(context, next);

      if (processed === true) {
        this.ack();
      }

      this.queue.push(...action.getNextSteps());

      if (action.hasPreSteps) {
        this.queue.unshift(...action.getPreSteps());
      }
    } catch (e) {
      this.ack();
      this.queue.unshift(new ErrorNotification(e as Error));
    }

    await this.delay(action.getDelay());
  }

  addTask(performance: Action[]) {
    // @TODO: Add performance to separate queue.
    // Need to have ability to cancel current performance if input is invalid.
    this.queue.push(...performance, new CleanUpContext());

    if (this.loopAction === false) {
      this.loopAction = true;
      this.loop().catch(console.error);
    }
  }

  ack() { // Acknowledge processing action
    this.queue.shift();
  }
}

function isObject(obj) {
  return typeof obj === 'object' && obj !== null;
}
