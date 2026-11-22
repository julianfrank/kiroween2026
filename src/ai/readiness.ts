// Task 3: AI readiness state machine. Pure logic with an injected LanguageModel so it can be tested.

export type ReadinessState =
  | { step: 'checking' }
  | { step: 'unsupported'; reason: string }
  | { step: 'needs-download' }
  | { step: 'downloading'; percent: number }
  | { step: 'initializing' }
  | { step: 'testing' }
  | { step: 'ready' }
  | { step: 'error'; message: string };

export interface PromptOptions {
  /** JSON Schema that forces the shape of the reply. */
  responseConstraint?: object;
  signal?: AbortSignal;
}

export interface SessionLike {
  prompt(input: string, options?: PromptOptions): Promise<string>;
  destroy(): void;
  /** Tokens used so far and the limit (present in Chrome). */
  readonly contextUsage?: number;
  readonly contextWindow?: number;
}

export interface MonitorLike {
  addEventListener(type: 'downloadprogress', cb: (e: { loaded: number }) => void): void;
}

export interface LanguageModelLike {
  availability(options: object): Promise<string>;
  create(options: { monitor?: (m: MonitorLike) => void } & object): Promise<SessionLike>;
}

export const MODEL_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

export const TEST_PROMPT = 'Reply with the single word: ready';
export const TEST_EXPECTED = 'ready';

export const NO_API_REASON =
  'This browser does not provide the built-in AI (Prompt API). Open this file in Google Chrome on Windows, macOS, Linux or a Chromebook Plus.';
export const UNAVAILABLE_REASON =
  'Chrome reports the on-device model cannot run on this device. It needs about 22 GB of free disk space, and either a GPU with more than 4 GB of VRAM or 16 GB of RAM with 4 CPU cores.';

/** Create a plain session (no download monitoring) for rebuilding after the context fills up. */
export function createPlainSession(lm: LanguageModelLike): Promise<SessionLike> {
  return lm.create({ ...MODEL_OPTIONS });
}

export interface Readiness {
  /** Look at availability and move to needs-download, or run the whole startup if the model is already available. */
  check(): Promise<void>;
  /** Called from a click (user activation). Creates the session, downloading the model if needed. */
  start(): Promise<void>;
}

export function createReadiness(
  lm: LanguageModelLike | undefined,
  onState: (s: ReadinessState) => void,
  onReady: (session: SessionLike) => void,
): Readiness {
  async function run(): Promise<void> {
    let session: SessionLike | undefined;
    try {
      onState({ step: 'downloading', percent: 0 });
      session = await lm!.create({
        ...MODEL_OPTIONS,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            const percent = Math.max(0, Math.min(100, Math.round(e.loaded * 100)));
            onState({ step: 'downloading', percent });
          });
        },
      });
      onState({ step: 'initializing' });
      onState({ step: 'testing' });
      const reply = await session.prompt(TEST_PROMPT);
      if (!reply.toLowerCase().includes(TEST_EXPECTED)) {
        session.destroy();
        onState({ step: 'error', message: 'The model answered the test prompt incorrectly.' });
        return;
      }
      onState({ step: 'ready' });
      onReady(session);
    } catch (e) {
      session?.destroy();
      onState({ step: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    async check() {
      onState({ step: 'checking' });
      if (!lm) return onState({ step: 'unsupported', reason: NO_API_REASON });
      try {
        const availability = await lm.availability(MODEL_OPTIONS);
        if (availability === 'unavailable') {
          return onState({ step: 'unsupported', reason: UNAVAILABLE_REASON });
        }
        if (availability === 'available') return run();
        onState({ step: 'needs-download' });
      } catch (e) {
        onState({ step: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    },
    async start() {
      if (!lm) return onState({ step: 'unsupported', reason: NO_API_REASON });
      return run();
    },
  };
}
