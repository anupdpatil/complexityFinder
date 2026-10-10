import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, analyzeCode } from "./main";

describe("analyzeCode", () => {
  it("reports constant time and space when no complexity signals exist", () => {
    expect(analyzeCode("return 42;")).toMatchObject({
      timeComplexity: "O(1)",
      spaceComplexity: "O(1)",
      confidence: "Low",
      signals: ["no loops, recursion, or growing collections found"],
    });
  });

  it("ignores loops in line and block comments", () => {
    const result = analyzeCode("// for (;;) {}\n/* while (true) {} */\nreturn value;");
    expect(result.timeComplexity).toBe("O(1)");
    expect(result.signals).toEqual(["no loops, recursion, or growing collections found"]);
  });

  it("detects linear iteration", () => {
    const result = analyzeCode("for (let i = 0; i < n; i++) total += i;");
    expect(result).toMatchObject({ timeComplexity: "O(n)", spaceComplexity: "O(1)", confidence: "Medium" });
    expect(result.signals).toEqual(["1 loop found"]);
  });

  it("detects logarithmic loops", () => {
    const result = analyzeCode("while (n > 1) { n /= 2; }");
    expect(result.timeComplexity).toBe("O(log n)");
    expect(result.signals).toContain("multiplicative loop update found");
  });

  it("prioritizes nested-loop detection", () => {
    const result = analyzeCode("for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) {} }");
    expect(result.timeComplexity).toBe("O(n\u00B2)");
    expect(result.signals).toEqual(expect.arrayContaining(["2 loops found", "nested iteration found"]));
  });

  it("detects named recursion and extra allocation", () => {
    const result = analyzeCode("function visit(n) { const values = []; values.push(n); return n ? visit(n - 1) : 0; }", "visit");
    expect(result).toMatchObject({ timeComplexity: "O(2^n)", spaceComplexity: "O(n)", confidence: "Medium" });
    expect(result.signals).toEqual(expect.arrayContaining(["recursive call found", "growing collection/allocation found"]));
  });

  it.each(["new Array(n)", "Array(n)", "items.push(value)", "list.append(value)", "malloc(size)"])(
    "marks %s as allocating auxiliary space",
    (source) => expect(analyzeCode(source).spaceComplexity).toBe("O(n)"),
  );
});

describe("App", () => {
  it("renders the initial sample and empty analysis state", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Ready to analyze" })).toBeInTheDocument();
    expect(screen.getByLabelText("Source code")).toHaveValue(expect.stringContaining("binarySearch"));
    expect(screen.getByDisplayValue("binarySearch")).toBeInTheDocument();
  });

  it("shows validation feedback for blank source without producing a result", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(screen.getByLabelText("Source code"));
    await user.click(screen.getByRole("button", { name: "Analyze complexity" }));
    expect(await screen.findByText("Paste code or choose a source file first.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ready to analyze" })).toBeInTheDocument();
  });

  it("analyzes pasted code and presents time, space, and source metadata", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(screen.getByLabelText("Source code"));
    await user.type(screen.getByLabelText("Source code"), "for (let i = 0; i < n; i++) {{}} ");
    await user.clear(screen.getByPlaceholderText("Function name (optional)"));
    await user.click(screen.getByRole("button", { name: "Analyze complexity" }));
    expect(screen.getByRole("button")).toBeDisabled();
    await waitFor(() => expect(screen.getByText("Entire source")).toBeInTheDocument());
    expect(screen.getByText("Pasted code")).toBeInTheDocument();
    expect(screen.getByText("O(n)")).toBeInTheDocument();
    expect(screen.getByText("O(1)")).toBeInTheDocument();
  });

  it("loads an uploaded file and identifies it as the analysis source", async () => {
    render(<App />);
    const file = new File(["while (n > 1) { n /= 2; }"], "halve.js", { type: "text/javascript" });
    const input = screen.getByLabelText(/Upload file/i);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText("Source code")).toHaveValue("while (n > 1) { n /= 2; }"));
    fireEvent.click(screen.getByRole("button", { name: "Analyze complexity" }));
    expect(await screen.findByText("halve.js")).toBeInTheDocument();
    expect(screen.getByText("O(log n)")).toBeInTheDocument();
  });
});
