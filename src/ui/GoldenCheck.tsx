import { useState } from 'react';
import type { PromptHost } from '../chat/proposal';
import { GOLDEN, formatReport, runGolden } from '../golden/golden';

function chromeVersion(): string {
  const m = /Chrome\/(\d+)/.exec(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return m ? `Chrome ${m[1]}` : '';
}

/** Runs the golden sentences against the live model and shows a report to paste back. Saves nothing. */
export function GoldenCheck({ host }: { host: PromptHost }) {
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [report, setReport] = useState('');
  const [copied, setCopied] = useState(false);

  async function run() {
    setReport('');
    setCopied(false);
    setProgress([0, GOLDEN.length]);
    const r = await runGolden(host, (done, total) => setProgress([done, total]));
    setReport(formatReport(r, chromeVersion()));
    setProgress(null);
  }

  return (
    <div>
      <p>
        Sends {GOLDEN.length} sample sentences about made-up accounts to the on-device AI and checks what it proposes.
        Your own data is not used and nothing is saved. It takes a few minutes.
      </p>
      <button onClick={() => void run()} disabled={progress !== null}>
        {progress ? `Checking ${progress[0]} of ${progress[1]}…` : 'Run the AI check'}
      </button>
      {progress && <progress value={progress[0]} max={progress[1]} aria-label="AI check progress" style={{ marginLeft: 8 }} />}
      {report && (
        <>
          <pre aria-label="AI check report" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{report}</pre>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(report).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied' : 'Copy the report'}
          </button>
        </>
      )}
    </div>
  );
}
