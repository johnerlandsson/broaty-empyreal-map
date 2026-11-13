# Automap engine (copied)

Source: `~/dev/mallardx-automapper`, commit `5134d5f`, files under `ui/`.

## What is here

- `graph.js`: the map (rooms by internal id with a key index, areas, terrains, JSON round trip). Used: `createMap`, `addRoom`, `getRoomByKey`, `linkExit`, `toJSON`, `fromJSON`.
- `links.js`: named links between rooms (one-way or both ways) and link offers. Used: `addLink`, `deleteLink`, `setLinkOneWay`, `setLinkField`, `linkLabel`, `hasWay`, `linksOf`, `applyServerLinks`, `offersLinks`.
- `pathfind.js`: the route finder. Used: `findPath`, `distances`, `LINK_COST`. Imports `links.js`.
- `graph.test.js`, `links.test.js`, `pathfind.test.js`: the automapper's tests for these three modules.

Only these three modules are copied, because they are the whole engine we need and they have no other dependencies (`graph.js` and `links.js` import nothing; `pathfind.js` imports only `links.js`). Room ids are the game's, so `identity.js` (placing rooms that have no ids) is not needed. `floors.js` and `render.js` are not copied. This is the spec's "Left to the builder" choice.

## Our changes

- No engine code is changed. The copied `.js` files are byte-identical to `5134d5f`.
- `links.test.js`: the import of `./edits.js` (not copied) is removed, along with the `describe("links through deletes and merges")` block that used it. Those two cases were "deleting a room drops the links into it" and "merging folds the source's links into the target and repoints links in". Both test `deleteRoom` and `mergeRooms`, which we do not have. The other 10 cases in the file are unchanged.

## Updating

Copy the three modules and their tests again from the automapper at the new commit, then re-run `npx vitest run ui/lib/automap`. Re-apply the changes listed above. The `links.test.js` edit must be redone by hand if the file is copied over, so check for the `edits.js` import first.
