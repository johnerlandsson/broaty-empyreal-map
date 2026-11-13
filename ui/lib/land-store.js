// The walked places of Tamsin's land, their notes, and routes between them.
// Pure (no DOM). Routes run on a copy of the Mallard automapper's graph and
// route finder (./automap), rebuilt from the places after any change.

import { createMap, addRoom, getRoomByKey, linkExit } from "./automap/graph.js";
import { findPath } from "./automap/pathfind.js";

export const DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const isStr = (v) => typeof v === "string" && v !== "";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** One exit as the store keeps it, { to, area?, back? }, or null for none. */
function cleanExit(e) {
  if (!e || !isStr(e.to)) return null;
  const exit = { to: e.to };
  if (isStr(e.area)) exit.area = e.area;
  if (DIRS.includes(e.back)) exit.back = e.back;
  return exit;
}

/** The compass exits of `raw` keyed by dir, each through cleanExit after `as` (which reads one as given). */
function cleanExits(raw, as = (e) => e) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(raw)) {
    const dir = String(k).toLowerCase();
    if (!DIRS.includes(dir)) continue;
    const exit = cleanExit(raw[k] && as(raw[k]));
    if (exit) out[dir] = exit;
  }
  return out;
}

/** A frame's exit (the game's `{ id, area, inverse }`, dirs in any case) as the store's. */
const frameExit = (e) => ({ to: e.id, area: e.area, back: typeof e.inverse === "string" ? e.inverse.toLowerCase() : undefined });

function cleanStored(p) {
  if (!p || !isStr(p.id) || !isNum(p.x) || !isNum(p.y)) return null;
  const exits = cleanExits(p.exits);
  const place = { id: p.id, name: typeof p.name === "string" ? p.name : "", x: p.x, y: p.y, z: isNum(p.z) ? p.z : 0, exits };
  if (isStr(p.note)) place.note = p.note;
  return place;
}

/** Two places alike in all a frame brings: name, spot and exits. */
function samePlace(a, b) {
  if (a.name !== b.name || a.x !== b.x || a.y !== b.y || a.z !== b.z) return false;
  for (const dir of DIRS) {
    const e = a.exits[dir], f = b.exits[dir];
    if (!e !== !f) return false;
    if (e && (e.to !== f.to || e.area !== f.area || e.back !== f.back)) return false;
  }
  return true;
}

export class LandStore {
  constructor() {
    this.who = null;
    this.here = null;
    this._places = new Map();
    this._listeners = [];
    this._map = null;
    /** Counts changes to the places, their exits and notes (not a step that only moves `here`). */
    this.version = 0;
  }

  _changed() {
    this.version++;
    this._map = null; // the routing graph is rebuilt from the places when next needed
    for (const fn of this._listeners) fn();
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  /** A room frame: the place, and you in it. True when the places changed; false for a bad frame,
   *  and for a step into a place walked before just as it is now, which only moves `here` (no
   *  onChange, so nothing is saved or rebuilt). */
  ingest(frame) {
    if (!frame || !isStr(frame.id) || !frame.coords || !isNum(frame.coords.x) || !isNum(frame.coords.y)) return false;
    const old = this._places.get(frame.id);
    const place = {
      id: frame.id,
      name: typeof frame.name === "string" ? frame.name : "",
      x: frame.coords.x,
      y: frame.coords.y,
      z: isNum(frame.coords.z) ? frame.coords.z : 0,
      exits: cleanExits(frame.exits, frameExit),
    };
    this.here = frame.id;
    if (old && samePlace(old, place)) return false;
    if (old && old.note !== undefined) place.note = old.note;
    this._places.set(frame.id, place); // Map keeps first-walked order on replace
    this._changed();
    return true;
  }

  places() {
    return [...this._places.values()];
  }

  place(id) {
    return this._places.get(id);
  }

  walked(id) {
    return this._places.has(id);
  }

  setNote(id, text) {
    const p = this._places.get(id);
    if (!p) return;
    if (isStr(text)) p.note = text;
    else delete p.note;
    this._changed();
  }

  route(fromId, toId) {
    if (!this.walked(fromId) || !this.walked(toId)) return null;
    if (!this._map) {
      const map = createMap();
      for (const p of this._places.values()) addRoom(map, { key: p.id, name: p.name, coords: { x: p.x, y: p.y, z: p.z } });
      for (const p of this._places.values()) {
        const from = getRoomByKey(map, p.id);
        for (const dir of DIRS) {
          const e = p.exits[dir];
          const to = e && getRoomByKey(map, e.to);
          if (to) linkExit(map, from.id, dir, to.id);
        }
      }
      this._map = map;
    }
    const map = this._map;
    const path = findPath(map, getRoomByKey(map, fromId).id, getRoomByKey(map, toId).id);
    if (!path) return null;
    return [fromId, ...path.map((step) => map.rooms[step.toId].key)];
  }

  record() {
    return { v: 1, places: JSON.parse(JSON.stringify(this.places())) };
  }

  load(who, record) {
    if (this.who !== null && this.who !== who) {
      this._places = new Map();
      this.here = null;
    }
    const pending = this._places;
    this.who = who;
    this._places = new Map();
    if (record && typeof record === "object" && record.v === 1 && Array.isArray(record.places)) {
      for (const raw of record.places) {
        const p = cleanStored(raw);
        if (p) this._places.set(p.id, p);
      }
    }
    for (const [id, p] of pending) {
      const old = this._places.get(id);
      if (old && old.note !== undefined && p.note === undefined) p.note = old.note;
      this._places.set(id, p);
    }
    this._changed();
  }

  /** No one's map: every place, its notes, where you are and whose it was. */
  clear() {
    this.who = null;
    this.here = null;
    this._places = new Map();
    this._changed();
  }

  /** Forget the walked places whose ids start with prefix (all of them by default), and their notes;
   *  the place you stand in stays, without its note. */
  forget(prefix = "") {
    const here = this.here && this._places.get(this.here);
    const kept = new Map();
    for (const [id, p] of this._places) {
      if (!id.startsWith(prefix)) kept.set(id, p);
      else if (p === here) {
        delete here.note; // you stay lit on the board, as a place you've walked
        kept.set(id, p);
      }
    }
    this._places = kept;
    if (!here) this.here = null;
    this._changed();
  }
}
