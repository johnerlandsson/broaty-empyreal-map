// The game's port words, cut down for the build's tests: its defaults and its merge.
export const PORT_WORDS = {
  start: { self: 'You land.' },
  sky: {
    high: '{star} stands high.',
    up: '{star} is up in the {dir}.',
    low: '{star} is low in the {dir}, shadows to the {away}.',
    rises: '{star} rises in the {dir}.',
    sets: '{star} sets in the {dir}.',
    paling: 'Paling in the {dir}.',
    dusk: 'Dusk in the {dir}.',
    night: 'Night.',
  },
};

type Words = { words?: { start?: object; sky?: Record<string, string> } };

export function portWords(st: Words) {
  return {
    ...PORT_WORDS,
    ...st.words,
    start: { ...PORT_WORDS.start, ...st.words?.start },
    sky: { ...PORT_WORDS.sky, ...st.words?.sky },
  };
}
