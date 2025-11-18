import {
	incrementUsageCount,
	usageRecordToMap,
} from "../src/usageTracker";

describe("usageTracker helpers", () => {
	it("increments counts without mutating the original object", () => {
		const original = { foo: 2 };
		const updated = incrementUsageCount(original, "foo");
		expect(updated).not.toBe(original);
		expect(updated.foo).toBe(3);
		expect(original.foo).toBe(2);
	});

	it("handles missing prefix gracefully", () => {
		const updated = incrementUsageCount({ foo: 1 }, "");
		expect(updated.foo).toBe(1);
	});

	it("converts record to map with defaults", () => {
		const map = usageRecordToMap({ foo: 2, bar: undefined });
		expect(map.get("foo")).toBe(2);
		expect(map.get("bar")).toBe(0);
	});

	it("returns empty map for undefined usage", () => {
		const map = usageRecordToMap(undefined);
		expect(map.size).toBe(0);
	});
});
