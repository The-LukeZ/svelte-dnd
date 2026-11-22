import { render } from "vitest-browser-svelte";
import Smoke from "./fixtures/Smoke.svelte";

describe("svelte component tests", () => {
    it("renders a svelte component", async () => {
        const screen = await render(Smoke, { label: "hi" });
        await expect.element(screen.getByText("hi")).toBeInTheDocument();
    });
});
