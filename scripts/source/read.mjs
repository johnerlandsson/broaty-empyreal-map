// Reads the Empyreal game source (read-only) into plain objects.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/** A YAML file's doc; a bad one throws naming the file. */
function readYaml(path) {
  try {
    return parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${path}: ${err.message}`);
  }
}

/** The doc's value at a dotted key; a doc without it (an empty file too) throws naming the file. */
function need(path, doc, key) {
  const value = key.split(".").reduce((v, k) => v?.[k], doc);
  if (value === undefined || value === null) throw new Error(`${path}: no ${key}`);
  return value;
}

function readDir(dir, key) {
  if (!existsSync(dir)) throw new Error(`Empyreal source not found: no ${dir}`);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((file) => {
      const path = join(dir, file);
      const doc = readYaml(path);
      return { file, area: need(path, doc, key), rooms: doc.rooms ?? [] };
    });
}

function commitOf(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/**
 * @param {string} dir  the Empyreal checkout
 * @returns {{commit: string|null, areas: object[], plans: object[], hulls: object[], world: object[], shipGravity: number, heavyWidth: number}}
 */
export function loadSource(dir) {
  const content = join(dir, "content");
  const areas = readDir(join(content, "areas"), "area");
  const plans = readDir(join(content, "plans"), "plan");
  const hullsPath = join(content, "game/hulls.yaml");
  const worldPath = join(content, "game/world.yaml");
  const hulls = need(hullsPath, readYaml(hullsPath), "hulls");
  const worldDoc = readYaml(worldPath);
  const world = need(worldPath, worldDoc, "world.stations").map((s) => pick(s, ["id", "name", "berth"]));
  // A ship's gravity where her plan gives none; none at all without it, as the game's loader has it.
  const shipGravity = worldDoc.world.shipGravity ?? 0;
  const framesPath = join(content, "game/frames.yaml");
  const frames = need(framesPath, readYaml(framesPath), "frames");
  // A body's size is length, width and height (hauling.md §3); its width is what must clear an opening.
  const heavyWidth = need(framesPath, { heavy: frames.find((f) => f.id === "heavy_frame") }, "heavy.body.size.1");
  return { commit: commitOf(dir), areas, plans, hulls, world, shipGravity, heavyWidth };
}
