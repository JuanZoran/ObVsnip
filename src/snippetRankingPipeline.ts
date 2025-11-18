import type { ParsedSnippet, RankingAlgorithmSetting } from "./types";

export interface SnippetRankingContext {
	query?: string;
	usage?: Map<string, number>;
}

type RankedSnippet = {
	snippet: ParsedSnippet;
	originalIndex: number;
};

export const rankSnippets = (
	snippets: ParsedSnippet[],
	algorithms: RankingAlgorithmSetting[],
	context: SnippetRankingContext = {}
): ParsedSnippet[] => {
	const enabledAlgorithms = (algorithms ?? []).filter((entry) => entry.enabled);
	if (enabledAlgorithms.length === 0) {
		return [...snippets];
	}

	const normalizedQuery = (context.query ?? "").trim().toLowerCase();
	const usageMap = context.usage;

	const rankedSnippets: RankedSnippet[] = snippets.map((snippet, index) => ({
		snippet,
		originalIndex: index,
	}));

	const comparator = (left: RankedSnippet, right: RankedSnippet): number => {
		for (const algorithm of enabledAlgorithms) {
			const comparison = compareByAlgorithm(
				algorithm.id,
				left,
				right,
				normalizedQuery,
				usageMap
			);
			if (comparison !== 0) {
				return comparison;
			}
		}
		return compareStableFallback(left, right);
	};

	return [...rankedSnippets].sort(comparator).map((entry) => entry.snippet);
};

const compareByAlgorithm = (
	algorithmId: RankingAlgorithmSetting["id"],
	left: RankedSnippet,
	right: RankedSnippet,
	query: string,
	usageMap?: Map<string, number>
): number => {
	switch (algorithmId) {
		case "fuzzy-match":
			return compareFuzzy(left, right, query);
		case "prefix-length":
			return comparePrefixLength(left, right);
		case "alphabetical":
			return compareAlphabetical(left, right);
		case "usage-frequency":
			return compareUsageFrequency(left, right, usageMap);
		case "original-order":
			return compareOriginalOrder(left, right);
		default:
			return 0;
	}
};

const compareFuzzy = (
	left: RankedSnippet,
	right: RankedSnippet,
	query: string
): number => {
	const leftScore = getFuzzyScore(left.snippet.prefix, query);
	const rightScore = getFuzzyScore(right.snippet.prefix, query);
	return leftScore - rightScore;
};

const getFuzzyScore = (prefix: string, query: string): number => {
	if (!query) {
		return 0;
	}
	const normalizedPrefix = prefix.toLowerCase();
	if (normalizedPrefix === query) {
		return 0;
	}
	if (normalizedPrefix.startsWith(query)) {
		return 1;
	}
	const index = normalizedPrefix.indexOf(query);
	if (index >= 0) {
		return 10 + index;
	}
	return 1000 + normalizedPrefix.length;
};

const comparePrefixLength = (left: RankedSnippet, right: RankedSnippet): number => {
	return left.snippet.prefix.length - right.snippet.prefix.length;
};

const compareAlphabetical = (left: RankedSnippet, right: RankedSnippet): number => {
	return left.snippet.prefix.localeCompare(right.snippet.prefix);
};

const compareUsageFrequency = (
	left: RankedSnippet,
	right: RankedSnippet,
	usageMap?: Map<string, number>
): number => {
	const leftCount = usageMap?.get(left.snippet.prefix) ?? 0;
	const rightCount = usageMap?.get(right.snippet.prefix) ?? 0;
	return rightCount - leftCount;
};

const compareOriginalOrder = (
	left: RankedSnippet,
	right: RankedSnippet
): number => {
	return left.originalIndex - right.originalIndex;
};

const compareStableFallback = (
	left: RankedSnippet,
	right: RankedSnippet
): number => {
	const priorityLeft = left.snippet.priority ?? 0;
	const priorityRight = right.snippet.priority ?? 0;
	if (priorityLeft !== priorityRight) {
		return priorityRight - priorityLeft;
	}

	const leftLength = left.snippet.prefix.length;
	const rightLength = right.snippet.prefix.length;
	if (leftLength !== rightLength) {
		return leftLength - rightLength;
	}

	const alpha = left.snippet.prefix.localeCompare(right.snippet.prefix);
	if (alpha !== 0) {
		return alpha;
	}

	return left.originalIndex - right.originalIndex;
};
