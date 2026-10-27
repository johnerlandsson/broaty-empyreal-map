// A stand-in for the edit server's API, for the page's tests: the state as read from `disk`, trial
// builds and saves. Each trial is recorded in `tries` as {url, body: {json}, files}: the file the
// change touched (the one unlike the last trial that passed, or what's on disk) as a one-file save
// would have sent it, and every file tried. Each save is recorded in `saves` as its files, and
// written to `disk`. `replies` queues answers to trials and saves in turn ({status, body}, or a
// promise of one); a trial passes, and a save is written with version 99, where none is queued.

export function fakeServer(disk) {
  const tries = [];
  const saves = [];
  const replies = [];
  let trials = 0;
  let last = null; // each file's JSON as the last trial that passed had it

  const reply = async (fallback) => (await replies.shift()) ?? fallback;
  const answer = (status, body) => ({ ok: status === 200, status, json: async () => body });

  const fetch = async (url, init = {}) => {
    if (init.method === "POST" && url === "/api/trial") {
      const { files } = JSON.parse(init.body);
      const before = (name) => JSON.stringify(last?.[name] ?? disk.tweaks[name]?.json ?? {});
      const name = Object.keys(files).find((n) => JSON.stringify(files[n]) !== before(n)) ?? Object.keys(files)[0];
      tries.push({ url: `/api/tweaks/${name}`, body: { json: files[name] }, files });
      const { status, body } = await reply({ status: 200, body: { ok: true, trial: ++trials, changed: [] } });
      if (status === 200) last = files;
      return answer(status, body);
    }
    if (init.method === "PUT" && url === "/api/tweaks") {
      const { files } = JSON.parse(init.body);
      saves.push(files);
      const versions = Object.fromEntries(Object.keys(files).map((n) => [n, 99]));
      const { status, body } = await reply({ status: 200, body: { ok: true, versions, changed: [] } });
      if (status === 200 || (status !== 409 && body?.versions)) {
        for (const [n, { json }] of Object.entries(files)) disk.tweaks[n] = { json, version: body.versions[n] };
        if (files.palette) disk.palette = files.palette.json;
        last = null;
      }
      return answer(status, body);
    }
    return answer(200, structuredClone(disk));
  };
  return { fetch, tries, saves, replies };
}
