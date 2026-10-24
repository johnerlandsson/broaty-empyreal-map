// What you're doing, as a card in the deck band's top-left corner, across from the zoom buttons:
// the action's label, its stage of how many and what waits, the seconds left and a bar that drains
// to its end. It sits in the panel's frame rather than on the plan, so it reads the same over a
// ship's drawing as over a ring's corridor, at any zoom. The bar drains by a Web Animation and the
// seconds tick on a timer only while something's under way; doing nothing hides it. (Not a CSS
// transition: that starts from the width last drawn, and a card just shown may have none drawn yet,
// so its bar sat empty until the next stage.)
// Screen readers aren't given it: the game tells them in text, without countdowns (actions.md §9).
// The ship's move in a belt (moveCard) is a second card under yours, stacked in the same corner.

import { actionCard } from "./lib/action.js";

export class ActionCard {
  /**
   * @param {HTMLElement} containerEl the deck band
   * @param {(msg: any, now: number) => ({ label: string, detail: string, seconds: number | null, fraction: number | null, ms: number | null, recheck?: number | null } | null)} cardOf
   *   what the card shows of its message at `now` (ms); `recheck` is ms until it may change untold
   */
  constructor(containerEl, cardOf = actionCard) {
    let stack = containerEl.querySelector(":scope > .action-cards");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "action-cards";
      containerEl.appendChild(stack);
    }
    const div = document.createElement("div");
    div.className = "action-card";
    div.setAttribute("aria-hidden", "true");
    div.hidden = true;
    div.innerHTML = '<div class="row"><span class="label"></span><span class="secs"></span></div><div class="detail"></div><div class="bar"><i></i></div>';
    stack.appendChild(div);
    this.cardOf = cardOf;
    this.div = div;
    this.labelEl = div.querySelector(".label");
    this.secsEl = div.querySelector(".secs");
    this.detailEl = div.querySelector(".detail");
    this.barEl = div.querySelector(".bar");
    this.fillEl = div.querySelector(".bar i");
    this.msg = null;
    this.timer = 0;
    this.drain = null;
  }

  /** The message from the Lua side: the action message, or for the ship's move the work message. */
  set(msg, now = Date.now()) {
    this.msg = msg;
    clearTimeout(this.timer);
    this.timer = 0;
    this.drain?.cancel();
    this.drain = null;
    const card = this.cardOf(msg, now);
    this.div.hidden = !card;
    if (!card) return;
    this.labelEl.textContent = card.label;
    this.detailEl.textContent = card.detail;
    this.detailEl.hidden = !card.detail;
    this.barEl.hidden = card.fraction === null;
    if (card.fraction !== null) {
      // from where it is now, drain to empty by its end, starting now rather than at the next frame
      this.drain = this.fillEl.animate([{ width: `${(card.fraction * 100).toFixed(2)}%` }, { width: "0%" }], {
        duration: card.ms,
        easing: "linear",
        fill: "forwards",
      });
      this.drain.startTime = document.timeline.currentTime;
    }
    this.tick(now);
  }

  /** Show the seconds left, and come back as the next whole second goes, or when it may have ended. */
  tick(now = Date.now()) {
    const card = this.cardOf(this.msg, now);
    if (!card) {
      this.div.hidden = true;
      return;
    }
    this.secsEl.textContent = card.seconds == null ? "" : `${card.seconds} s`;
    const waits = [card.ms ? card.ms % 1000 || 1000 : null, card.recheck ?? null].filter((n) => n !== null);
    if (!waits.length) return;
    this.timer = setTimeout(() => this.tick(), Math.max(16, Math.min(...waits)));
  }
}
