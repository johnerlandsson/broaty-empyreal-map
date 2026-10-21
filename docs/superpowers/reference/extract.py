import sys, json, glob
rooms = {}
for f in sorted(glob.glob('/home/john/.local/share/net.mallard.app/logs/empyreal-7/*.mallardlog')):
    for line in open(f):
        if '"kind":"gmcp"' not in line: continue
        try: ev = json.loads(line)["event"]
        except Exception: continue
        p, d = ev.get("package"), ev.get("data")
        if p not in ("mudstd.room.info", "Empyreal.Room", "Room.Info") or not isinstance(d, dict): continue
        rid = d.get("id") or d.get("num")
        if not rid: continue
        r = rooms.setdefault(rid, {"pk": set()})
        r["pk"].add(p)
        for k, v in d.items():
            if v is not None: r.setdefault(p, {})[k] = v
json.dump({k: {kk: (sorted(vv) if isinstance(vv, set) else vv) for kk, vv in v.items()} for k, v in rooms.items()},
          open('/tmp/empx/rooms.json', 'w'), indent=1, sort_keys=True)
tiss = sorted(k for k in rooms if k.startswith("tiss."))
print(len(rooms), "rooms,", len(tiss), "tiss")
for k in tiss:
    r = rooms[k]; m = r.get("mudstd.room.info", {}); e = r.get("Empyreal.Room", {}); o = r.get("Room.Info", {})
    print(f'{k:28} {str(m.get("name") or o.get("name")):24} {str(e.get("address") or o.get("address")):24} {str(m.get("coords")):30} exits={ {d:x.get("id") for d,x in (m.get("exits") or {}).items()} }')
