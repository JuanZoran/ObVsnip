import { resolveVariableValue } from '../src/variableResolver';

const createApp = (file: any = null) => ({
	workspace: {
		getActiveFile: () => file,
	},
	vault: {
		getName: () => 'Vault',
	},
});

const createEditor = (selection: string | null = null) => ({
	getSelection: () => selection,
});

describe('variableResolver built-ins', () => {
	beforeAll(() => {
		jest.useFakeTimers().setSystemTime(new Date('2024-05-06T07:08:09'));
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it('resolves file-based variables', () => {
		const file = { name: 'note.md', path: 'folder/note.md', parent: { name: 'folder' } };
		const app = createApp(file as any);
		const editor = createEditor();
		expect(resolveVariableValue('TM_FILENAME', { app: app as any, editor: editor as any }).value).toBe('note.md');
		expect(resolveVariableValue('TM_FILEPATH', { app: app as any, editor: editor as any }).value).toBe('folder/note.md');
		expect(resolveVariableValue('TM_FOLDER', { app: app as any, editor: editor as any }).value).toBe('folder');
	});

	it('handles missing file gracefully', () => {
		const app = createApp(null);
		const editor = createEditor();
		expect(resolveVariableValue('TM_FILENAME', { app: app as any, editor: editor as any }).value).toBeNull();
	});

	it('reads selection-dependent variable', () => {
		const app = createApp(null);
		const editor = createEditor('text');
		expect(resolveVariableValue('TM_SELECTED_TEXT', { app: app as any, editor: editor as any }).value).toBe('text');
	});

	it('resolves vault name and clipboard', () => {
		const app = createApp(null);
		const editor = createEditor();
		const clipboard = { readText: jest.fn().mockReturnValue('clip') };
		const originalRequire = (window as any).require;
		(window as any).require = () => ({ clipboard });
		expect(resolveVariableValue('VAULT_NAME', { app: app as any, editor: editor as any }).value).toBe('Vault');
		expect(resolveVariableValue('TM_CLIPBOARD', { app: app as any, editor: editor as any }).value).toBe('clip');
		(window as any).require = originalRequire;
	});

	it('generates date/time variables', () => {
		const app = createApp(null);
		const editor = createEditor();
		expect(resolveVariableValue('CURRENT_YEAR', { app: app as any, editor: editor as any }).value).toBe('2024');
		expect(resolveVariableValue('CURRENT_MONTH', { app: app as any, editor: editor as any }).value).toBe('05');
		expect(resolveVariableValue('CURRENT_DATE', { app: app as any, editor: editor as any }).value).toBe('2024-05-06');
		expect(resolveVariableValue('CURRENT_HOUR', { app: app as any, editor: editor as any }).value).toBe('07');
		expect(resolveVariableValue('CURRENT_MINUTE', { app: app as any, editor: editor as any }).value).toBe('08');
		expect(resolveVariableValue('CURRENT_SECOND', { app: app as any, editor: editor as any }).value).toBe('09');
		expect(resolveVariableValue('TIME_FORMATTED', { app: app as any, editor: editor as any }).value).toBe('07:08:09');
	});

	it('returns unknown variable reason', () => {
		const app = createApp(null);
		const editor = createEditor();
		const result = resolveVariableValue('UNKNOWN', { app: app as any, editor: editor as any });
		expect(result.value).toBeNull();
		expect(result.reason).toBe('Unknown variable');
	});
});
