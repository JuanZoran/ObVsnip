import { rankSnippets } from "../src/snippetRankingPipeline";
import type { ParsedSnippet, RankingAlgorithmSetting } from "../src/types";

const makeSnippet = (
	prefix: string,
	priority: number
): ParsedSnippet => ({
	prefix,
	body: prefix,
	processedText: prefix,
	tabStops: [],
	description: "",
	priority,
});

const makeAlgorithm = (id: RankingAlgorithmSetting["id"], enabled = true) => ({
	id,
	enabled,
}) as RankingAlgorithmSetting;

describe("snippet ranking pipeline", () => {
	const baseSnippets = [
		makeSnippet("for loop", 0),
		makeSnippet("function", 1),
		makeSnippet("flp helper", 2),
	];

	const usageContext = new Map<string, number>([
		["function", 5],
		["for loop", 1],
	]);

	const fuzzyAlgorithm: RankingAlgorithmSetting = {
		id: "fuzzy-match",
		enabled: true,
	};

	const alphabeticalAlgorithm: RankingAlgorithmSetting = {
		id: "alphabetical",
		enabled: true,
	};

	const usageAlgorithm: RankingAlgorithmSetting = {
		id: "usage-frequency",
		enabled: true,
	};

	const originalOrderAlgorithm: RankingAlgorithmSetting = {
		id: "original-order",
		enabled: true,
	};

	it("gives priority to the fuzzy-matched snippet when that algorithm is first", () => {
		const sorted = rankSnippets(baseSnippets, [fuzzyAlgorithm], {
			query: "flp",
		});
		expect(sorted[0].prefix).toBe("flp helper");
	});

	it("falls back to alphabetical sorting when smarter strategies are disabled", () => {
		const sorted = rankSnippets(baseSnippets, [alphabeticalAlgorithm], {
			query: "",
		});
		expect(sorted.map((snippet) => snippet.prefix)).toEqual([
			"flp helper",
			"for loop",
			"function",
		]);
	});

	it("promotes snippets with higher usage counts when that strategy is prioritized", () => {
		const sorted = rankSnippets(
			baseSnippets,
			[usageAlgorithm, originalOrderAlgorithm],
			{ usage: usageContext }
		);
		expect(sorted[0].prefix).toBe("function");
	});

	it("respects original order when that is the only enabled strategy", () => {
		const sorted = rankSnippets(baseSnippets, [originalOrderAlgorithm], {});
		expect(sorted.map((snippet) => snippet.prefix)).toEqual([
			"for loop",
			"function",
			"flp helper",
		]);
	});

	it("uses priority then prefix length when a single algorithm yields ties", () => {
		const ranking: RankingAlgorithmSetting[] = [
			{ id: "fuzzy-match", enabled: true },
		];
		const tiedSnippets = [
			makeSnippet("alpha", 0),
			makeSnippet("beta", 1),
			makeSnippet("alp", 0),
		];
		const sorted = rankSnippets(tiedSnippets, ranking, { query: "" });
		expect(sorted[0].prefix).toBe("beta"); // priority 1 highest
		expect(sorted[1].prefix).toBe("alp"); // shorter prefix
		expect(sorted[2].prefix).toBe("alpha");
	});

	it("honors the full default ranking pipeline with fuzzy-priority ties", () => {
		const snippets = [
			makeSnippet("alpha", 0),
			makeSnippet("apples", 1),
			makeSnippet("apricot", 2),
			makeSnippet("app", 3),
			makeSnippet("banana", 4),
		];
		const algorithms = [
			makeAlgorithm("fuzzy-match"),
			makeAlgorithm("prefix-length"),
			makeAlgorithm("alphabetical"),
			makeAlgorithm("usage-frequency"),
			makeAlgorithm("original-order"),
		];
		const usage = new Map([
			["apples", 2],
			["apricot", 1],
			["app", 3],
		]);

		const sorted = rankSnippets(snippets, algorithms, {
			query: "ap",
			usage,
		});

		// fuzzy-match should group the "ap" prefixes first, but they tie; prefix-length orders app shortest first
		expect(sorted[0].prefix).toBe("app");
		expect(sorted[1].prefix).toBe("apples");
		expect(sorted[2].prefix).toBe("apricot");
		// banana falls back to alphabetical -> original order
		expect(sorted[3].prefix).toBe("alpha");
		expect(sorted[4].prefix).toBe("banana");
	});

	it("falls back to usage when fuzzy and prefix tie for empty query", () => {
		const snippets = [
			makeSnippet("app", 0),
			makeSnippet("ant", 1),
			makeSnippet("act", 2),
		];
		const algorithms = [
			makeAlgorithm("fuzzy-match"),
			makeAlgorithm("prefix-length"),
			makeAlgorithm("usage-frequency"),
			makeAlgorithm("original-order"),
		];
		const usage = new Map([
			["ant", 5],
			["app", 2],
		]);

		const sorted = rankSnippets(snippets, algorithms, { usage });
		expect(sorted[0].prefix).toBe("ant");
		expect(sorted[1].prefix).toBe("app");
		expect(sorted[2].prefix).toBe("act");
	});
});
