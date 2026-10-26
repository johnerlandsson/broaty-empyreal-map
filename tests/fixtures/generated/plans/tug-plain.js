// The generated tug plan (empyreal 266aa9b) frozen with the look an untweaked plan
// resolves to (resolveLook with no tweak file), for tests of a plan with no tweaks. Not generated.
export default {
  "source": {
    "commit": "266aa9b",
    "file": "content/plans/tug.yaml"
  },
  "id": "tug",
  "name": "tug",
  "kind": "plan",
  "gravity": 0,
  "hulls": [
    "tug"
  ],
  "layout": {
    "kind": "decks"
  },
  "levels": [
    1
  ],
  "rooms": [
    {
      "id": "tug.cockpit",
      "name": "Cockpit of the {name}",
      "address": "Deck 1, frame 2",
      "at": {
        "deck": 1,
        "frame": 2,
        "side": 0
      },
      "exits": {
        "south": "tug.collar"
      },
      "gravity": 0,
      "flags": [
        "airlock"
      ],
      "canopy": true
    },
    {
      "id": "tug.collar",
      "name": "Towing Collar",
      "address": "Deck 1, frame 1",
      "at": {
        "deck": 1,
        "frame": 1,
        "side": 0
      },
      "exits": {
        "north": "tug.cockpit"
      },
      "gravity": 0,
      "flags": [
        "berth"
      ]
    }
  ],
  "look": {
    "paint": {
      "cockpit": "industrial",
      "collar": "docks"
    },
    "fixtures": [],
    "footprints": {},
    "hull": {},
    "profile": {
      "bevel": 0.12,
      "noseDrop": 0.35,
      "noseLength": 0.8,
      "spine": null
    },
    "surface": {
      "seams": true,
      "windows": [
        "cockpit"
      ],
      "stripe": {
        "paint": "residential",
        "at": 0.3,
        "width": 0.14
      },
      "navLights": true
    },
    "greebles": [],
    "view": {
      "cutaway": "hide-above"
    },
    "palette": {
      "concourse": "#d9a441",
      "residential": "#5b8def",
      "hydroponics": "#4caf7a",
      "commons": "#a57be0",
      "offices": "#3fb6b2",
      "midring": "#8796a8",
      "industrial": "#d0703c",
      "docks": "#cfe3ff",
      "hub": "#cfe3ff"
    }
  }
};
