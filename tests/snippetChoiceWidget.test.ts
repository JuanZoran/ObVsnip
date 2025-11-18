import { ChoiceHintWidget } from "../src/snippetSession";

describe("ChoiceHintWidget", () => {
	it("renders active choice with highlight class", () => {
		const choices = ["李洪昆", "刘栋", "王思凡"];
		const widget = new ChoiceHintWidget("⚙️", choices, "王思凡", "#fff");
		const dom = widget.toDOM();
		const entries = dom.querySelectorAll(".snippet-choice-entry");
		expect(entries.length).toBe(choices.length);
		const active = dom.querySelector(".snippet-choice-entry-active");
		expect(active?.textContent).toBe("王思凡");
		expect(dom.style.getPropertyValue("--snippet-choice-active-color")).toBe(
			"#fff"
		);
	});

	it("handles no active match gracefully", () => {
		const choices = ["a", "b"];
		const widget = new ChoiceHintWidget("⚙️", choices, "c", "#fff");
		const dom = widget.toDOM();
		const active = dom.querySelector(".snippet-choice-entry-active");
		expect(active).toBeNull();
	});
});
