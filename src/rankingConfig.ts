import type { RankingAlgorithmId, RankingAlgorithmSetting } from "./types";

export const DEFAULT_RANKING_ALGORITHMS: RankingAlgorithmSetting[] = [
	{ id: "fuzzy-match", enabled: true },
	{ id: "prefix-length", enabled: true },
	{ id: "alphabetical", enabled: true },
	{ id: "usage-frequency", enabled: true },
	{ id: "original-order", enabled: true },
];

export const normalizeRankingAlgorithms = (
	items: RankingAlgorithmSetting[]
): RankingAlgorithmSetting[] => {
	const enabled = items.filter((entry) => entry.enabled);
	const disabled = items.filter((entry) => !entry.enabled);
	return [...enabled, ...disabled];
};

export const toggleAlgorithmEnabled = (
	items: RankingAlgorithmSetting[],
	id: RankingAlgorithmId,
	enabled: boolean
): RankingAlgorithmSetting[] => {
	const normalized = normalizeRankingAlgorithms(items);
	const enabledCount = normalized.filter((entry) => entry.enabled).length;
	if (!enabled && enabledCount <= 1 && normalized.some((entry) => entry.id === id && entry.enabled)) {
		return normalized;
	}
	const updated = normalized.map((entry) =>
		entry.id === id ? { ...entry, enabled } : entry
	);
	return normalizeRankingAlgorithms(updated);
};

export const moveEnabledAlgorithm = (
	items: RankingAlgorithmSetting[],
	sourceId: RankingAlgorithmId,
	targetId: RankingAlgorithmId,
	insertAfter: boolean
): RankingAlgorithmSetting[] => {
	const normalized = normalizeRankingAlgorithms(items);
	const enabled = normalized.filter((entry) => entry.enabled);
	const disabled = normalized.filter((entry) => !entry.enabled);

	const sourceIndex = enabled.findIndex((entry) => entry.id === sourceId);
	if (sourceIndex < 0) {
		return normalized;
	}

	const [sourceEntry] = enabled.splice(sourceIndex, 1);
	const targetIndex = enabled.findIndex((entry) => entry.id === targetId);
	if (targetIndex < 0) {
		return normalized;
	}

	let insertIndex = targetIndex;
	if (insertAfter) {
		insertIndex = targetIndex + 1;
	}
	if (insertIndex > enabled.length) {
		insertIndex = enabled.length;
	}

	enabled.splice(insertIndex, 0, sourceEntry);

	return normalizeRankingAlgorithms([...enabled, ...disabled]);
};
