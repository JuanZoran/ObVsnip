export const incrementUsageCount = (
	usage: Record<string, number>,
	prefix: string
): Record<string, number> => {
	if (!prefix) return { ...usage };
	const current = usage[prefix] ?? 0;
	return {
		...usage,
		[prefix]: current + 1,
	};
};

export const usageRecordToMap = (
	usage: Record<string, number> | undefined
): Map<string, number> => {
	const entries: [string, number][] = usage
		? Object.entries(usage).map(([key, value]) => [
				key,
				value ?? 0,
		  ])
		: [];
	return new Map(entries);
};
