import { ChoiceHintWidget } from "../src/snippetSession";

describe("ChoiceHintWidget", () => {
	it("applies active class when flagged", () => {
		const widget = new ChoiceHintWidget("⚙️", "a/b", "#fff", true);
		const dom = widget.toDOM();
		expect(dom.classList.contains("snippet-choice-hint")).toBe(true);
		expect(dom.classList.contains("snippet-choice-hint-active")).toBe(true);
	});

	it("does not add active class for inactive widget", () => {
		const widget = new ChoiceHintWidget("⚙️", "a/b", "#fff", false);
		const dom = widget.toDOM();
		expect(dom.classList.contains("snippet-choice-hint")).toBe(true);
		expect(dom.classList.contains("snippet-choice-hint-active")).toBe(false);
	});
});
