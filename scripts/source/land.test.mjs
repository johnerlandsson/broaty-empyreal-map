import { describe, expect, it } from "vitest";
import { landData } from "./land.mjs";

const YAML = `
lands:
  - world: tamsin
    from: zennor
    strokes:
      - kind: upland
        name: the Downs
        outline:
          - { e: 2, n: 70 }
          - { e: 90, n: 70 }
      - kind: town
        name: Zennor
        outline:
          - { e: -4, n: 6 }
          - { e: 4, n: 6 }
          - { e: 4, n: -7 }
    joins:
      - id: downs
        room: zennor.port-road
        dir: east
        at: { e: 4.8, n: 1.0 }
        name: The Open Downs
        km: 2.6
  - world: orrin
    from: dolcoath
    strokes:
      - kind: upland
        name: the Benches
        outline:
          - { e: 0, n: 0 }
`;

describe("landData", () => {
  it("gives each world its port, the town's outline and its joins' spots and rooms", () => {
    expect(landData(YAML).tamsin).toEqual({
      from: "zennor",
      town: [{ e: -4, n: 6 }, { e: 4, n: 6 }, { e: 4, n: -7 }],
      joins: { downs: { at: { e: 4.8, n: 1 }, room: "zennor.port-road" } },
    });
  });

  it("gives a land with no town an empty outline, and no joins none", () => {
    expect(landData(YAML).orrin).toEqual({ from: "dolcoath", town: [], joins: {} });
  });
});
