# Cars

*Status: built for T.I.S.S.'s spoke lifts, Zennor's tram and Dolcoath's cage. Last updated 2026-11-07.*

## What it is and when it shows

A car is a room that moves: a T.I.S.S. spoke lift, Zennor's cable tram
(empyreal `docs/planetside.md` §5.2, `docs/gmcp.md` §8.1), or Dolcoath's
cage in its shaft (`docs/orrin.md` §4.3). While you ride
one, the bottom band shows the car itself in place of the station's or the
city's plan, as a one-room ship's plan shows its hull (ship-plans.md), and
comes back to the plan as you step out. The top band stays as it was: the
station model with your spoke lit, or Zennor's sky.

Before, a lift lit its shaft on the ring plan, and the tram, which the Lua
side didn't take for a car, dimmed the city plan as if you'd left it.

## Where its data comes from

Only what the game sends a rider. Aboard a car there's no
mudstd.room.info; Empyreal.Room has `vehicle`: its `kind` (`lift`, `tram`
or `cage`), `floors` (its stops bottom to top, each `{ id, name? }`), the stop
it's `at` or the two it's `between` in the order it's going, its `doors` and
its `heading` (`hubward` or `rimward`, `uphill` or `downhill`, `up` or
`down`). The cage's stops are the place's data's, each with the name the
cage gives it ("the Town").
Empyreal.Vehicle keeps the last four up to date. `src/station_map/location.lua`
folds them into the location message's `lift`, with `kind` and `floors`;
a car without a kind is a lift, as the game sent them before the tram.

The game never says how far along between two stops the car is, so the
map doesn't guess: between two stops it's drawn midway.

## The drawing

- **The car,** fore up, a hull line round it as a ship's, its one room lit:
  - **a lift** is a square car with its doors on the south side and its
    panel beside them;
  - **the tram** is the long wooden car of its description: its floor
    stepped in three to sit level on the slope (dashed lines), slatted
    benches down both sides, a brake wheel at each end, the brass panel by
    the doors with a button a stop, and two doors on the platform side;
  - **the cage** is the open box of iron bars of its description, 600 by
    300 cm: bars all round, its checker-plate floor worn bright down the
    middle, a rail round it, the brass panel on its post with a button a
    station, and gates on the shaft side, a lattice across the gap while
    they're shut.
- **Its name** in the car: the game's for a lift (`Lift 3`, its address),
  the city's data for the tram and the cage (`The Tram`, `The Cage`, which
  have no address).
- **The doors** are a gap in the hull, their two leaves meeting across it
  while they're shut, open while the car's doors are.
- **What it's doing,** in Dim under the car, in its own words: `at Market,
  doors open`, `uphill, Market → Uptown`, `climbing hubward, Rim → Mid`;
  the cage's gates for doors: `at the Town, gates open`, `down, the Town →
  the Smelts`.
- **The line of its stops** under that: a dot a stop, bottom to top left to
  right, each with its short name (a T.I.S.S. floor by its ring, `Mid`; a
  tram stop without " Station", `Market`; a cage's station by the name the
  cage gives it, `the Town`), and the car on it, lit, on its stop or midway
  between two with an arrow its way. The cage's line stands upright beside
  it, as its shaft does, the Pithead at the top.

## Info line

The car and what it's doing: `THE TRAM · uphill, Market → Uptown`,
`LIFT 3 · climbing hubward, Rim → Mid`. At a stop it names the stop in full,
as the plan does: `THE TRAM · at Downs Station`, `LIFT 3 · at The Hub`,
`THE CAGE · at Town Station`.

## Code

- `ui/lib/cars.js`: `CARS` (each kind's size, name and words), `stopNames()`,
  `stopLine()`, `carDoing()`, `carInfo()`.
- `ui/car-deck.js`: the drawing, `carPlans(kind)` for a `DeckView`, and
  `updateCar()` each time the car moves.
- `ui/main.js`: `carView(kind)`, one view a kind built on first use, shown
  while the location message has a `lift`.
- `dev/preview.js`: `ride()` for a lift and `tramRide()` for the tram, with
  the messages the Lua side posts.
