// Reads the Empyreal game source (read-only) into plain objects.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

function readYaml(path) {
  return parse(readFileSync(path, "utf8"));
}

function readDir(dir, key) {
  if (!existsSync(dir)) throw new Error(`Empyreal source not found: no ${dir}`);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((file) => {
      const doc = readYaml(join(dir, file));
      return { file, area: doc[key], rooms: doc.rooms ?? [] };
    });
}

function commitOf(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], {
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
 * @returns {{commit: string|null, areas: object[], plans: object[], hulls: object[], world: object[]}}
 */
export function loadSource(dir) {
  const content = join(dir, "content");
  const areas = readDir(join(content, "areas"), "area");
  const plans = readDir(join(content, "plans"), "plan");
  const hulls = readYaml(join(content, "game/hulls.yaml")).hulls.map((h) => pick(h, ["id", "name", "class", "plan"]));
  const world = readYaml(join(content, "game/world.yaml")).world.stations.map((s) => pick(s, ["id", "name", "berth"]));
  return { commit: commitOf(dir), areas, plans, hulls, world };
}
