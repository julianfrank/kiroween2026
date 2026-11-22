import { describe, expect, it, vi } from 'vitest';
import {
  createReadiness,
  type LanguageModelLike,
  type ReadinessState,
  type SessionLike,
} from './readiness';

function fakeSession(reply = 'ready'): SessionLike & { destroyed: boolean } {
  return {
    destroyed: false,
    prompt: async () => reply,
    destroy() {
      this.destroyed = true;
    },
  };
}

function fakeLm(
  availability: string,
  session: SessionLike,
  progress: number[] = [],
): LanguageModelLike {
  return {
    availability: async () => availability,
    create: async (opts) => {
      const listeners: Array<(e: { loaded: number }) => void> = [];
      opts.monitor?.({ addEventListener: (_t, cb) => listeners.push(cb) });
      progress.forEach((p) => listeners.forEach((cb) => cb({ loaded: p })));
      return session;
    },
  };
}

function setup(lm: LanguageModelLike | undefined) {
  const steps: ReadinessState[] = [];
  const onReady = vi.fn();
  const r = createReadiness(lm, (s) => steps.push(s), onReady);
  return { r, steps, onReady, names: () => steps.map((s) => s.step) };
}

describe('readiness state machine', () => {
  it('is unsupported when the API is missing (Edge)', async () => {
    const { r, steps } = setup(undefined);
    await r.check();
    expect(steps.at(-1)).toMatchObject({ step: 'unsupported' });
  });

  it('is unsupported when availability is unavailable', async () => {
    const { r, steps } = setup(fakeLm('unavailable', fakeSession()));
    await r.check();
    expect(steps.at(-1)).toMatchObject({ step: 'unsupported' });
  });

  it('waits for a Start click when the model must be downloaded', async () => {
    const { r, steps } = setup(fakeLm('downloadable', fakeSession()));
    await r.check();
    expect(steps.at(-1)).toEqual({ step: 'needs-download' });
  });

  it('shows download percent, then initializing, testing, ready', async () => {
    const session = fakeSession();
    const { r, steps, names, onReady } = setup(fakeLm('downloadable', session, [0.25, 0.5, 1]));
    await r.check();
    await r.start();
    const percents = steps.flatMap((s) => (s.step === 'downloading' ? [s.percent] : []));
    expect(percents).toEqual([0, 25, 50, 100]);
    expect(names().slice(-3)).toEqual(['initializing', 'testing', 'ready']);
    expect(onReady).toHaveBeenCalledWith(session);
  });

  it('starts by itself when the model is already available', async () => {
    const { r, names, onReady } = setup(fakeLm('available', fakeSession()));
    await r.check();
    expect(names().at(-1)).toBe('ready');
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('fails and destroys the session when the test reply is wrong', async () => {
    const session = fakeSession('banana');
    const { r, steps, onReady } = setup(fakeLm('available', session));
    await r.check();
    expect(steps.at(-1)).toMatchObject({ step: 'error' });
    expect(session.destroyed).toBe(true);
    expect(onReady).not.toHaveBeenCalled();
  });

  it('reports an error when create() throws', async () => {
    const lm: LanguageModelLike = {
      availability: async () => 'downloadable',
      create: async () => {
        throw new Error('boom');
      },
    };
    const { r, steps } = setup(lm);
    await r.check();
    await r.start();
    expect(steps.at(-1)).toEqual({ step: 'error', message: 'boom' });
  });
});
