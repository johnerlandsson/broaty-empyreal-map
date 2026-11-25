// The walked places of each world's land, their notes, the sites' rooms walked behind their fronts,
// and routes between them. Pure (no DOM). Routes run on a copy of the Mallard automapper's graph and
// route finder (./automap), rebuilt from the places after any change.

import { createMap, addRoom, getRoomByKey, linkExit } from "./automap/graph.js";
import { findPath } from "./automap/pathfind.js";
import { frontSite } from "./land-choose.js";

export const DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
/** A site's room keeps these too: up, down, in and out are how a site goes deeper (set-pieces.md). */
export const ROOM_DIRS = [...DIRS, "u", "d", "in", "out"];

const isStr = (v) => typeof v === "string" && v !== "";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** Km round the world at which a place's x comes round (gmcp.md §9.5), if it's sent; else undefined. */
const keptWrap = (v) => (isNum(v) && v > 0 ? v : undefined);
/** Whether a place id is the front of site `site`: `surface.<world>.site.<site>`. */
const frontId = (id, site) => frontSite(id) === site;

/** One exit as the store keeps it, { to, area?, back?, style? }, or null for none. `style` is how
 *  the way goes as the game sends it (gmcp.md §9.5.3: climb, road, trail), kept as sent so a style
 *  the board can't draw yet is there once it can (land-layout.js decides what's drawn). */
function cleanExit(e) {
  if (!e || !isStr(e.to)) return null;
  const exit = { to: e.to };
  if (isStr(e.area)) exit.area = e.area;
  if (ROOM_DIRS.includes(e.back)) exit.back = e.back;
  if (isStr(e.style)) exit.style = e.style;
  return exit;
}

/** The exits of `raw` keyed by dir (compass points, else `dirs`), each through cleanExit after `as`
 *  (which reads one as given). */
function cleanExits(raw, as = (e) => e, dirs = DIRS) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(raw)) {
    const dir = String(k).toLowerCase();
    if (!dirs.includes(dir)) continue;
    const exit = cleanExit(raw[k] && as(raw[k]));
    if (exit) out[dir] = exit;
  }
  return out;
}

/** A terrain worth keeping: any the game sends but `room` (no ground yet), kept as sent so a terrain
 *  the board can't draw yet is there once it can (land-kinds.js styleOf decides what's drawn). */
const keptTerrain = (v) => (isStr(v) && v !== "room" ? v : undefined);

/** A frame's exit (the game's `{ id, area, inverse, style }`, dirs in any case) as the store's. */
const frameExit = (e) => ({ to: e.id, area: e.area, back: typeof e.inverse === "string" ? e.inverse.toLowerCase() : undefined, style: e.style });

function cleanStored(p) {
  if (!p || !isStr(p.id) || !isNum(p.x) || !isNum(p.y)) return null;
  const exits = cleanExits(p.exits);
  const place = { id: p.id, name: typeof p.name === "string" ? p.name : "", x: p.x, y: p.y, z: isNum(p.z) ? p.z : 0, exits };
  const terrain = keptTerrain(p.terrain);
  if (terrain) place.terrain = terrain;
  const wrap = keptWrap(p.wrap);
  if (wrap) place.wrap = wrap;
  if (isStr(p.note)) place.note = p.note;
  return place;
}

/** A site's room as saved: its id, name, site and front, and its compass exits. */
function cleanRoom(r) {
  if (!r || !isStr(r.id) || !isStr(r.site) || !isStr(r.front)) return null;
  return { id: r.id, name: typeof r.name === "string" ? r.name : "", site: r.site, front: r.front, exits: cleanExits(r.exits, undefined, ROOM_DIRS) };
}

/** Two rooms alike in all a frame brings: name and exits. */
function sameRoom(a, b) {
  return a.name === b.name && JSON.stringify(a.exits) === JSON.stringify(b.exits);
}

/** Two places alike in all a frame brings: name, terrain, spot and exits. */
function samePlace(a, b) {
  if (a.name !== b.name || a.terrain !== b.terrain || a.x !== b.x || a.y !== b.y || a.z !== b.z || a.wrap !== b.wrap) return false;
  for (const dir of DIRS) {
    const e = a.exits[dir], f = b.exits[dir];
    if (!e !== !f) return false;
    if (e && (e.to !== f.to || e.area !== f.area || e.back !== f.back || e.style !== f.style)) return false;
  }
  return true;
}

export class LandStore {
  constructor() {
    this.who = null;
    this.here = null;
    this._places = new Map();
    /** A site's rooms walked (set-pieces.md §3), by id: they come with no coords, so each is kept by
     *  its front, the walked place `surface.<world>.site.<site>`, and is never a place of the land. */
    this._rooms = new Map();
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
    if (frame && isStr(frame.site)) return this._ingestRoom(frame);
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
    // what's underfoot, as the game sends it; `room` or none (as for a tile not built yet) keeps
    // what an earlier step brought
    const terrain = keptTerrain(frame.terrain) ?? old?.terrain;
    if (terrain) place.terrain = terrain;
    // where x comes round; a frame without it keeps what an earlier one brought, as terrain does
    const wrap = keptWrap(frame.wrap) ?? old?.wrap;
    if (wrap) place.wrap = wrap;
    this.here = frame.id;
    if (old && samePlace(old, place)) return false;
    if (old && old.note !== undefined) place.note = old.note;
    this._places.set(frame.id, place); // Map keeps first-walked order on replace
    this._changed();
    return true;
  }

  /** A site's room (a frame with `site`, no coords): kept by its walked front, which is the room's
   *  own exit's target, else the walked front of its site; false for one with no front walked. */
  _ingestRoom(frame) {
    if (!isStr(frame.id)) return false;
    const exits = cleanExits(frame.exits, frameExit, ROOM_DIRS);
    const old = this._rooms.get(frame.id);
    const front =
      Object.values(exits).find((e) => frontId(e.to, frame.site) && this._places.has(e.to))?.to ??
      old?.front ??
      [...this._places.keys()].find((id) => frontId(id, frame.site));
    if (!front) return false;
    const room = { id: frame.id, name: typeof frame.name === "string" ? frame.name : "", site: frame.site, front, exits };
    this.here = frame.id;
    if (old && old.front === front && sameRoom(old, room)) return false;
    this._rooms.set(frame.id, room);
    this._changed();
    return true;
  }

  places() {
    return [...this._places.values()];
  }

  place(id) {
    return this._places.get(id);
  }

  /** The site's rooms walked, in first-walked order. */
  rooms() {
    return [...this._rooms.values()];
  }

  room(id) {
    return this._rooms.get(id);
  }

  walked(id) {
    return this._places.has(id) || this._rooms.has(id);
  }

  /** The walked place of the land where id stands: a place itself, a site's room at its front; null
   *  for anything not walked. */
  standing(id) {
    if (this._places.has(id)) return id;
    return this._rooms.get(id)?.front ?? null;
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
      // a site's rooms stand at their front (set-pieces.md decision 48)
      for (const r of this._rooms.values()) {
        const f = this._places.get(r.front);
        if (f) addRoom(map, { key: r.id, name: r.name, coords: { x: f.x, y: f.y, z: f.z } });
      }
      for (const p of [...this._places.values(), ...this._rooms.values()]) {
        const from = getRoomByKey(map, p.id);
        if (!from) continue; // a room whose front was forgotten
        for (const dir of Object.keys(p.exits)) {
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
    const record = { v: 1, places: JSON.parse(JSON.stringify(this.places())) };
    if (this._rooms.size) record.rooms = JSON.parse(JSON.stringify(this.rooms()));
    return record;
  }

  load(who, record) {
    if (this.who !== null && this.who !== who) {
      this._places = new Map();
      this._rooms = new Map();
      this.here = null;
    }
    const pending = this._places, pendingRooms = this._rooms;
    this.who = who;
    this._places = new Map();
    this._rooms = new Map();
    if (record && typeof record === "object" && record.v === 1 && Array.isArray(record.places)) {
      for (const raw of record.places) {
        const p = cleanStored(raw);
        if (p) this._places.set(p.id, p);
      }
      for (const raw of Array.isArray(record.rooms) ? record.rooms : []) {
        const r = cleanRoom(raw);
        if (r) this._rooms.set(r.id, r);
      }
    }
    for (const [id, r] of pendingRooms) this._rooms.set(id, r);
    for (const [id, p] of pending) {
      const old = this._places.get(id);
      if (old && old.note !== undefined && p.note === undefined) p.note = old.note;
      if (old && old.terrain !== undefined && p.terrain === undefined) p.terrain = old.terrain; // a pending `room` frame
      this._places.set(id, p);
    }
    this._changed();
  }

  /** No one's map: every place, its notes, where you are and whose it was. */
  clear() {
    this.who = null;
    this.here = null;
    this._places = new Map();
    this._rooms = new Map();
    this._changed();
  }

  /** Forget the walked places whose ids start with prefix (all of them by default), and their notes;
   *  the place you stand in stays, without its note. */
  forget(prefix = "") {
    const here = this.here && this._places.get(this.here);
    const inRoom = this.here && this._rooms.get(this.here);
    const kept = new Map();
    for (const [id, p] of this._places) {
      if (!id.startsWith(prefix)) kept.set(id, p);
      else if (p === here || id === inRoom?.front) {
        delete p.note; // you stay lit on the board, as a place you've walked (or your room's front)
        kept.set(id, p);
      }
    }
    this._places = kept;
    // a site's rooms go with their front's land; the one you stand in stays, its front too
    const rooms = new Map();
    for (const [id, r] of this._rooms) {
      if (!r.front.startsWith(prefix) || r === inRoom) rooms.set(id, r);
    }
    this._rooms = rooms;
    if (!here && !inRoom) this.here = null;
    this._changed();
  }
}
