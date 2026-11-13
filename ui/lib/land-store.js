// The walked places of Tamsin's land, their notes, and routes between them.
// Pure (no DOM). Routes run on a copy of the Mallard automapper's graph and
// route finder (./automap), rebuilt from the places after any change.

import { createMap, addRoom, getRoomByKey, linkExit } from "./automap/graph.js";
import { findPath } from "./automap/pathfind.js";

export const DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const isStr = (v) => typeof v === "string" && v !== "";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function cleanExits(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(raw)) {
    const dir = String(k).toLowerCase();
    if (!DIRS.includes(dir)) continue;
    const e = raw[k];
    if (!e || !isStr(e.id)) continue;
    const exit = { to: e.id };
    if (isStr(e.area)) exit.area = e.area;
    const back = typeof e.inverse === "string" ? e.inverse.toLowerCase() : "";
    if (DIRS.includes(back)) exit.back = back;
    out[dir] = exit;
  }
  return out;
}

function cleanStored(p) {
  if (!p || !isStr(p.id) || !isNum(p.x) || !isNum(p.y)) return null;
  const exits = {};
  if (p.exits && typeof p.exits === "object") {
    for (const dir of DIRS) {
      const e = p.exits[dir];
      if (!e || !isStr(e.to)) continue;
      const exit = { to: e.to };
      if (isStr(e.area)) exit.area = e.area;
      if (DIRS.includes(e.back)) exit.back = e.back;
      exits[dir] = exit;
    }
  }
  const place = { id: p.id, name: typeof p.name === "string" ? p.name : "", x: p.x, y: p.y, z: isNum(p.z) ? p.z : 0, exits };
  if (isStr(p.note)) place.note = p.note;
  return place;
}

export class LandStore {
  constructor() {
    this.who = null;
    this.here = null;
    this._places = new Map();
    this._listeners = [];
    this._map = null;
  }

  _changed() {
    this._map = null;
    for (const fn of this._listeners) fn();
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  ingest(frame) {
    if (!frame || !isStr(frame.id) || !frame.coords || !isNum(frame.coords.x) || !isNum(frame.coords.y)) return false;
    const old = this._places.get(frame.id);
    const place = {
      id: frame.id,
      name: typeof frame.name === "string" ? frame.name : "",
      x: frame.coords.x,
      y: frame.coords.y,
      z: isNum(frame.coords.z) ? frame.coords.z : 0,
      exits: cleanExits(frame.exits),
    };
    if (old && old.note !== undefined) place.note = old.note;
    this._places.set(frame.id, place); // Map keeps first-walked order on replace
    this.here = frame.id;
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

  forget() {
    const here = this.here && this._places.get(this.here);
    this._places = new Map();
    this._map = null;
    if (here) {
      delete here.note; // you stay lit on the board, as a place you've walked
      this._places.set(here.id, here);
    } else this.here = null;
    this._changed();
  }
}
