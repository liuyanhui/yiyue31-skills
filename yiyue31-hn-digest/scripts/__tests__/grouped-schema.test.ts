import { test, expect, describe } from "bun:test";
import { loadFixture } from "./helpers";

/**
 * Validates that a data object conforms to the grouped-schema-v1 structure.
 * Returns an object with a `valid` boolean and an array of descriptive error strings.
 */
export function validateGroupedSchema(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Data must be a non-null object"] };
  }

  const d = data as Record<string, unknown>;

  // --- Top-level required fields ---
  if (typeof d.postId !== "string" || d.postId.length === 0) {
    errors.push("Missing or invalid required field 'postId' (must be a non-empty string)");
  }

  if (!Array.isArray(d.groups)) {
    errors.push("Missing or invalid required field 'groups' (must be an array)");
  } else {
    d.groups.forEach((group: unknown, index: number) => {
      const g = group as Record<string, unknown>;
      const prefix = `groups[${index}]`;

      if (typeof g.name !== "string" || g.name.length === 0) {
        errors.push(`${prefix}: missing or invalid 'name' (must be a non-empty string)`);
      }
      if (typeof g.dimension !== "string" || g.dimension.length === 0) {
        errors.push(`${prefix}: missing or invalid 'dimension' (must be a non-empty string)`);
      }
      if (typeof g.summary !== "string" || g.summary.length === 0) {
        errors.push(`${prefix}: missing or invalid 'summary' (must be a non-empty string)`);
      }
      if (!Array.isArray(g.commentIds)) {
        errors.push(`${prefix}: missing or invalid 'commentIds' (must be an array)`);
      } else {
        (g.commentIds as unknown[]).forEach((id, ci) => {
          if (typeof id !== "string") {
            errors.push(`${prefix}.commentIds[${ci}]: must be a string, got ${typeof id}`);
          }
        });
      }

      // Optional subGroups
      if (g.subGroups !== undefined) {
        if (!Array.isArray(g.subGroups)) {
          errors.push(`${prefix}: 'subGroups' must be an array if present`);
        } else {
          (g.subGroups as unknown[]).forEach((sub: unknown, si: number) => {
            const s = sub as Record<string, unknown>;
            const subPrefix = `${prefix}.subGroups[${si}]`;

            if (typeof s.name !== "string" || s.name.length === 0) {
              errors.push(`${subPrefix}: missing or invalid 'name' (must be a non-empty string)`);
            }
            if (typeof s.dimension !== "string" || s.dimension.length === 0) {
              errors.push(`${subPrefix}: missing or invalid 'dimension' (must be a non-empty string)`);
            }
            if (typeof s.summary !== "string" || s.summary.length === 0) {
              errors.push(`${subPrefix}: missing or invalid 'summary' (must be a non-empty string)`);
            }
            if (!Array.isArray(s.commentIds)) {
              errors.push(`${subPrefix}: missing or invalid 'commentIds' (must be an array)`);
            } else {
              (s.commentIds as unknown[]).forEach((id, ci) => {
                if (typeof id !== "string") {
                  errors.push(`${subPrefix}.commentIds[${ci}]: must be a string, got ${typeof id}`);
                }
              });
            }
          });
        }
      }
    });
  }

  if (!Array.isArray(d.controversies)) {
    errors.push("Missing or invalid required field 'controversies' (must be an array)");
  } else {
    d.controversies.forEach((controversy: unknown, index: number) => {
      const c = controversy as Record<string, unknown>;
      const prefix = `controversies[${index}]`;

      if (typeof c.topic !== "string" || c.topic.length === 0) {
        errors.push(`${prefix}: missing or invalid 'topic' (must be a non-empty string)`);
      }
      if (!Array.isArray(c.sides)) {
        errors.push(`${prefix}: missing or invalid 'sides' (must be an array)`);
      } else {
        (c.sides as unknown[]).forEach((side: unknown, si: number) => {
          const s = side as Record<string, unknown>;
          const sidePrefix = `${prefix}.sides[${si}]`;

          if (typeof s.stance !== "string" || s.stance.length === 0) {
            errors.push(`${sidePrefix}: missing or invalid 'stance' (must be a non-empty string)`);
          }
          if (typeof s.summary !== "string" || s.summary.length === 0) {
            errors.push(`${sidePrefix}: missing or invalid 'summary' (must be a non-empty string)`);
          }
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Helper: build a valid grouped payload (mirrors grouped-schema-v1.json)
// ---------------------------------------------------------------------------
function makeValidGroupedData() {
  return {
    postId: "12345678",
    groups: [
      {
        name: "Performance optimization approaches",
        dimension: "topic",
        summary: "Discussion of various methods to improve build performance.",
        commentIds: ["100001", "100002"],
        subGroups: [
          {
            name: "In favor",
            dimension: "stance",
            summary: "Supporters argue the new approach significantly reduces compile times.",
            commentIds: ["100001"],
          },
        ],
      },
    ],
    controversies: [
      {
        topic: "Whether TypeScript is inherently slow",
        sides: [
          { stance: "Agree", summary: "The type system adds overhead that slows compilation." },
          { stance: "Disagree", summary: "The bottleneck is the build pipeline, not TypeScript itself." },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("validateGroupedSchema", () => {
  test("accepts a valid grouped payload", () => {
    const data = makeValidGroupedData();
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts valid data with no subGroups", () => {
    const data = makeValidGroupedData();
    // Remove optional subGroups
    delete (data.groups[0] as Record<string, unknown>).subGroups;
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // --- Negative tests ---

  test("rejects payload missing postId", () => {
    const data = makeValidGroupedData() as Record<string, unknown>;
    delete data.postId;
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("postId"))).toBe(true);
  });

  test("rejects payload where postId is not a string", () => {
    const data = { ...makeValidGroupedData(), postId: 12345 };
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("postId"))).toBe(true);
  });

  test("rejects payload where groups is not an array", () => {
    const data = { ...makeValidGroupedData(), groups: "not-an-array" };
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("groups") && e.includes("array"))).toBe(true);
  });

  test("rejects group missing name", () => {
    const data = makeValidGroupedData();
    delete (data.groups[0] as Record<string, unknown>).name;
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("groups[0]") && e.includes("name"))).toBe(true);
  });

  test("rejects group with commentIds that is not an array", () => {
    const data = makeValidGroupedData();
    (data.groups[0] as Record<string, unknown>).commentIds = "bad";
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("commentIds") && e.includes("array"))).toBe(true);
  });

  test("rejects group with non-string entries in commentIds", () => {
    const data = makeValidGroupedData();
    (data.groups[0] as Record<string, unknown>).commentIds = ["valid", 42, true];
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("commentIds") && e.includes("string"))).toBe(true);
  });

  test("rejects controversy missing sides", () => {
    const data = makeValidGroupedData();
    delete (data.controversies[0] as Record<string, unknown>).sides;
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("controversies[0]") && e.includes("sides"))).toBe(true);
  });

  test("rejects controversy with sides missing stance", () => {
    const data = makeValidGroupedData();
    delete ((data.controversies[0] as Record<string, unknown>).sides as Record<string, unknown>[])[0].stance;
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("sides[0]") && e.includes("stance"))).toBe(true);
  });

  test("rejects payload missing controversies field entirely", () => {
    const data = makeValidGroupedData() as Record<string, unknown>;
    delete data.controversies;
    const result = validateGroupedSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("controversies"))).toBe(true);
  });

  test("rejects non-object input", () => {
    const result = validateGroupedSchema("just a string");
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  test("rejects null input", () => {
    const result = validateGroupedSchema(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  test("rejects array input", () => {
    const result = validateGroupedSchema([1, 2, 3]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});
