import {
	moveEnabledAlgorithm,
	normalizeRankingAlgorithms,
	toggleAlgorithmEnabled,
	DEFAULT_RANKING_ALGORITHMS,
} from "../src/rankingConfig";
import type { RankingAlgorithmSetting } from "../src/types";

describe("rankingConfig helpers", () => {
	const cloneBase = () =>
		DEFAULT_RANKING_ALGORITHMS.map((entry) => ({ ...entry }));

	it("normalizes the list so disabled algorithms sit at the end", () => {
		const mixed = [
			{ id: "alphabetical", enabled: false },
			{ id: "fuzzy-match", enabled: true },
			{ id: "usage-frequency", enabled: true },
			{ id: "original-order", enabled: false },
		];
		const normalized = normalizeRankingAlgorithms(mixed);
		expect(normalized.slice(0, 2).every((entry) => entry.enabled)).toBe(
			true
		);
		expect(
			normalized.slice(2).every((entry) => !entry.enabled)
		).toBe(true);
	});

	it("moves an enabled algorithm before the drop target when insertAfter=false", () => {
		const base = cloneBase();
		const reordered = moveEnabledAlgorithm(
			base,
			"usage-frequency",
			"fuzzy-match",
			false
		);
		expect(reordered.map((entry) => entry.id)).toEqual([
			"usage-frequency",
			"fuzzy-match",
			"prefix-length",
			"alphabetical",
			"original-order",
		]);
	});

	it("moves an enabled algorithm after the drop target when insertAfter=true", () => {
		const base = cloneBase();
		const reordered = moveEnabledAlgorithm(
			base,
			"prefix-length",
			"alphabetical",
			true
		);
		expect(reordered.map((entry) => entry.id)).toEqual([
			"fuzzy-match",
			"alphabetical",
			"prefix-length",
			"usage-frequency",
			"original-order",
		]);
	});

	it("pushes disabled algorithms to the bottom while preserving others", () => {
		const base = cloneBase();
		const toggled = toggleAlgorithmEnabled(
			base,
			"alphabetical",
			false
		);
		expect(toggled.map((entry) => entry.id)).toEqual([
			"fuzzy-match",
			"prefix-length",
			"usage-frequency",
			"original-order",
			"alphabetical",
		]);
		expect(toggled.find((entry) => entry.id === "alphabetical")?.enabled).toBe(
			false
		);
	});

	it("re-enabling an algorithm keeps it among the enabled ordering", () => {
		const base = cloneBase();
		const disabled = toggleAlgorithmEnabled(
			base,
			"alphabetical",
			false
		);
		const reenabled = toggleAlgorithmEnabled(
			disabled,
			"alphabetical",
			true
		);
		expect(reenabled.map((entry) => entry.id)).toEqual([
			"fuzzy-match",
			"prefix-length",
			"usage-frequency",
			"original-order",
			"alphabetical",
		]);
		expect(reenabled.find((entry) => entry.id === "alphabetical")?.enabled).toBe(
			true
		);
	});

	it("prevents the last enabled algorithm from being disabled", () => {
		let state = cloneBase();
		const disableTargets: RankingAlgorithmSetting["id"][] = [
			"prefix-length",
			"alphabetical",
			"usage-frequency",
			"original-order",
		];
		for (const target of disableTargets) {
			state = toggleAlgorithmEnabled(state, target, false);
		}
		expect(state.filter((entry) => entry.enabled).length).toBe(1);
		const result = toggleAlgorithmEnabled(state, "fuzzy-match", false);
		expect(result.filter((entry) => entry.enabled).length).toBe(1);
		expect(result.find((entry) => entry.id === "fuzzy-match")?.enabled).toBe(
			true
		);
	});
});
