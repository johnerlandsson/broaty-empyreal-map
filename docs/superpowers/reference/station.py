import json
R = json.load(open('/tmp/empx/rooms.json'))
DIR = {"N": (0, 1), "S": (0, -1), "E": (1, 0), "W": (-1, 0)}
out = {}
def ring_of(z): return ["rim", "mid", "inner", "core"][z]
for rid, r in R.items():
    if not rid.startswith("tiss."): continue
    m, e = r.get("mudstd.room.info", {}), r.get("Empyreal.Room", {})
    c = m.get("coords")
    if not c: continue
    out[rid] = dict(id=rid, name=m.get("name"), x=c["x"], y=c["y"], z=c["z"], address=e.get("address"),
                    district=e.get("district"), part=e.get("part"), visited=True,
                    exits={d: x["id"] for d, x in (m.get("exits") or {}).items()})
# infer unvisited rooms from exits of visited ones
for rid, r in list(out.items()):
    for d, t in r["exits"].items():
        if t in out or d not in DIR or "ladder" in t or t == "tiss.ladder-12-rim": continue
        dx, dy = DIR[d]
        out[t] = dict(id=t, name=None, x=r["x"] + dx, y=r["y"] + dy, z=r["z"], address=None, district=None,
                      part=None, visited=False, exits={})
# rooms only known from `directory`
for rid, name, x, y, z in [("tiss.schoolroom", "Schoolroom", 20, 1, 0), ("tiss.blister", "Observation Blister", 0, 6, 3)]:
    out.setdefault(rid, dict(id=rid, name=name, x=x, y=y, z=z, address=None, district=None, part=None, visited=False, exits={}))
NAMES = {"tiss.clinic": "Clinic", "tiss.flats": "Mid-Ring Flats", "tiss.machineshop": "Machine Shop", "tiss.rim-1000": "Rim 10:00",
         "tiss.spine-4": "Spine 4", "tiss.bunkers": "?", "tiss.heavystores": "?", "tiss.substation": "?", "tiss.seedvault": "?",
         "tiss.freightdock": "?", "tiss.fueldepot": "?"}
CLOSED = {"tiss.clinic", "tiss.flats", "tiss.machineshop", "tiss.schoolroom"}
for k, v in out.items():
    if not v["name"]: v["name"] = NAMES.get(k, "?")
    v["closed"] = k in CLOSED
# ladderways: every spoke has one per ring, half an hour spinward of its lift (seen on spoke 9)
for h in (12, 3, 6, 9):
    for z, ring in enumerate(("rim", "mid", "inner")):
        rid = f"tiss.ladderway-{h}-{ring}"
        if rid not in out:
            out[rid] = dict(id=rid, name=f"Ladderway {h}, {ring.capitalize()}", x=(h % 12)*2 + 1, y=0, z=z, address=None,
                            district="the Ladderways", part="ladderway", visited=False, exits={})
        out[rid]["part"] = "ladderway"
# freight transfer: 'up' from the hub, no coords from the game
t = R.get("tiss.transfer", {}).get("mudstd.room.info", {})
out["tiss.transfer"] = dict(id="tiss.transfer", name=t.get("name", "Freight Transfer"), x=0, y=-1, z=3, address="Hub, freight",
                            district="the Hub", part="hub", visited="tiss.transfer" in R, exits={"D": "tiss.hub"})
if "tiss.control" in out: out["tiss.control"]["name"] = "Docking Control Room"
json.dump(sorted(out.values(), key=lambda v: v["id"]), open('/tmp/empx/station.json', 'w'))
print(len(out), "placed;", sum(1 for v in out.values() if not v["visited"]), "unvisited:",
      sorted(k for k, v in out.items() if not v["visited"]))
