import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const SAMPLE = `function binarySearch(items, target) {
  let low = 0, high = items.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (items[mid] === target) return mid;
    if (items[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}`;

export function analyzeCode(source, functionName = "") {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$|#.*$/gm, "");
  const loops = [...code.matchAll(/\b(for|while|do)\b\s*(?:\([^)]*\)|[^\n{]*)/g)];
  const hasLogLoop = loops.some(({ index }) => /(?:\/=\s*2|\*=\s*2|>>=|<<=)/.test(code.slice(index, index + 180)));
  const hasNestedLoops = /\b(for|while)\b[\s\S]{0,400}\b(for|while)\b/.test(code);
  const safeName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const functionBody = functionName ? code.slice(code.search(new RegExp(`(?:function|def)\\s+${safeName}|${safeName}\\s*=`))) : code;
  const recursive = Boolean(functionName) && new RegExp(`\\b${safeName}\\s*\\(`).test(functionBody.replace(new RegExp(`(?:function|def)\\s+${safeName}[^\n{]*`, "")));
  const allocates = /\b(new\s+(?:Array|Map|Set|List|Vector)|Array\s*\(|\.push\s*\(|\.append\s*\(|malloc\s*\()/i.test(code);
  const time = recursive ? "O(2^n)" : !loops.length ? "O(1)" : hasNestedLoops ? "O(n²)" : hasLogLoop ? "O(log n)" : "O(n)";
  const space = recursive || allocates ? "O(n)" : "O(1)";
  const signals = [];
  if (loops.length) signals.push(`${loops.length} loop${loops.length === 1 ? "" : "s"} found`);
  if (hasNestedLoops) signals.push("nested iteration found");
  if (hasLogLoop) signals.push("multiplicative loop update found");
  if (recursive) signals.push("recursive call found");
  if (allocates) signals.push("growing collection/allocation found");
  if (!signals.length) signals.push("no loops, recursion, or growing collections found");
  return { timeComplexity: time, spaceComplexity: space, confidence: loops.length || recursive ? "Medium" : "Low", signals, explanation: `Estimate based on ${signals.join(", ")}. It is a helpful heuristic, not a formal proof of worst-case complexity.` };
}

export function App() {
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState("JavaScript");
  const [functionName, setFunctionName] = useState("binarySearch");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  async function analyze() {
    setLoading(true); setError("");
    try {
      if (!code.trim()) throw new Error("Paste code or choose a source file first.");
      await new Promise(resolve => setTimeout(resolve, 250));
      setResult({ ...analyzeCode(code, functionName), functionName: functionName || "Entire source", source: fileRef.current.files[0]?.name || "Pasted code" });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  function chooseFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => setCode(String(reader.result)); reader.readAsText(file);
  }
  return <main>
    <section className="hero"><span className="eyebrow">STATIC CODE ANALYSIS</span><h1>See the cost behind<br />your code.</h1></section>
    <section className="workspace">
      <div className="editor-card">
        <div className="toolbar"><strong>Source code</strong><label className="upload">Upload file <input ref={fileRef} onChange={chooseFile} type="file" accept=".js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.txt" /></label></div>
        <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" aria-label="Source code" />
        <div className="controls"><select value={language} onChange={e => setLanguage(e.target.value)}><option>JavaScript</option><option>TypeScript</option><option>Python</option><option>Java</option><option>C / C++</option><option>Other</option></select><input value={functionName} onChange={e => setFunctionName(e.target.value)} placeholder="Function name (optional)" /><button disabled={loading} onClick={analyze}>{loading ? "Analyzing…" : "Analyze complexity"}</button></div>
        {error && <p className="error">{error}</p>}
      </div>
      <aside className="results" aria-live="polite">
        {!result ? <div className="empty"><span>◎</span><h2>Ready to analyze</h2><p>Paste code, optionally upload a file, then run the estimate.</p></div> : <><div className="result-head"><span>ANALYSIS COMPLETE</span><small>{result.confidence} confidence</small></div><h2>{result.functionName}</h2><p className="source">{result.source}</p><div className="metrics"><div><span>TIME</span><strong>{result.timeComplexity}</strong></div><div><span>AUXILIARY SPACE</span><strong>{result.spaceComplexity}</strong></div></div><p className="explanation">{result.explanation}</p><div className="signals">{result.signals.map(signal => <span key={signal}>✓ {signal}</span>)}</div></>}
      </aside>
    </section>
    <footer>Complexity Finder uses explainable heuristics. Treat results as a review aid, not a formal proof.</footer>
  </main>;
}
createRoot(document.getElementById("root")).render(<App />);
