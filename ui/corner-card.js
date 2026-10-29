// A card in the deck band's top-left corner, across from the zoom buttons: the ship's move in a belt
// (moveCard) or her waiting on Control's clearance (clearanceCard), each its own card stacked in the
// corner. A label, a detail, the seconds left and a bar that drains to its end, as its message gives. It sits in the panel's frame rather than on the plan, so it reads the same over a
// ship's drawing as over a ring's corridor, at any zoom. The bar drains by a Web Animation and the
// seconds tick on a timer only while something's under way; doing nothing hides it. (Not a CSS
// transition: that starts from the width last drawn, and a card just shown may have none drawn yet,
// so its bar sat empty until the next stage.)
// Screen readers aren't given it: the game tells them in text, without countdowns.

export class CornerCard {
  /**
   * @param {HTMLElement} containerEl the deck band
   * @param {(msg: any, now: number) => ({ label: string, detail: string, seconds: number | null, fraction: number | null, ms: number | null, recheck?: number | null } | null)} cardOf
   *   what the card shows of its message at `now` (ms); `recheck` is ms until it may change untold
   */
  constructor(containerEl, cardOf) {
    let stack = containerEl.querySelector(":scope > .corner-cards");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "corner-cards";
      containerEl.appendChild(stack);
    }
    const div = document.createElement("div");
    div.className = "corner-card";
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

  /** The message from the Lua side: the work message for the ship's move, the clearance message for the wait. */
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
      // from where it is now, drain to empty by its end, starting now rather than at the next frame.
      // The fill slides out of the track's left rather than narrowing: a transform runs on the
      // compositor, where a width is laid out and painted every frame, and it keeps the rounded end
      // a scaleX would squash
      const from = `translateX(${((card.fraction * 100).toFixed(2) - 100).toFixed(2)}%)`;
      this.drain = this.fillEl.animate([{ transform: from }, { transform: "translateX(-100%)" }], {
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
