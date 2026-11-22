import { useEffect, useState } from 'react';

// Task 2 spike. Replaced by the real readiness screen in Task 3.
type Row = [label: string, value: string];

const OPTIONS: LanguageModelCreateCoreOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

function envRows(): Row[] {
  return [
    ['URL protocol', location.protocol],
    ['isSecureContext', String(window.isSecureContext)],
    ['crypto.subtle available', String(!!globalThis.crypto?.subtle)],
    ['indexedDB available', String(!!globalThis.indexedDB)],
    ['LanguageModel in window', String('LanguageModel' in globalThis)],
  ];
}

export function Spike() {
  const [rows] = useState<Row[]>(envRows);
  const [availability, setAvailability] = useState('(checking)');
  const [progress, setProgress] = useState<string>('');
  const [reply, setReply] = useState('');
  const [destroyCheck, setDestroyCheck] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (!('LanguageModel' in globalThis)) return setAvailability('API missing');
        setAvailability(await LanguageModel.availability(OPTIONS));
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  async function start() {
    setError('');
    try {
      const session = await LanguageModel.create({
        ...OPTIONS,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) =>
            setProgress(`${Math.round(e.loaded * 100)}%`),
          );
        },
      });
      setProgress('created');
      setReply(await session.prompt('Reply with the single word: ready'));
      session.destroy();
      try {
        await session.prompt('hello');
        setDestroyCheck('FAIL: prompt after destroy did not reject');
      } catch (e) {
        setDestroyCheck(`OK: rejected (${String(e)})`);
      }
      setAvailability(await LanguageModel.availability(OPTIONS));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 720 }}>
      <h1>Scary Money Manager: Task 2 spike</h1>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ paddingRight: 16 }}>{k}</td>
              <td>
                <b>{v}</b>
              </td>
            </tr>
          ))}
          <tr>
            <td>LanguageModel.availability()</td>
            <td>
              <b>{availability}</b>
            </td>
          </tr>
          <tr>
            <td>Download progress</td>
            <td>
              <b>{progress || '-'}</b>
            </td>
          </tr>
          <tr>
            <td>Test reply</td>
            <td>
              <b>{reply || '-'}</b>
            </td>
          </tr>
          <tr>
            <td>After destroy()</td>
            <td>
              <b>{destroyCheck || '-'}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <button onClick={start}>Start (create session and test)</button>
      </p>
      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}
    </main>
  );
}
