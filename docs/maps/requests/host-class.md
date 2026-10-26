# Request: `class` on `Ship.Status.host`

*Draft, for John to send to Natalie. Not sent.*

Hi Natalie,

Could `Ship.Status.host` (gmcp.md §8.2) have `class` too, beside `name`? The
hull's id, as `ship` has it in `Empyreal.Room`: `"freighter"`, `"skiff"`.

Why: when a skiff is docked at a freighter's collar, the map would like to
draw the host ship with your ship at her collar. It knows the host's name
and where she is, but not what she is, so it can't pick her drawing.

It tells the map nothing hidden. Aboard a ship you already see her class
(gmcp.md §8.2: "her class plain from her cockpit"), and `Ship.Status` already
has `class` for your own ship. A hull's class is already shown in the game.

It's a small addition, and the map does nothing until it's there.

Thanks,
John
