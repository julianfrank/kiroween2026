import type { PromptOptions, SessionLike } from './readiness';

/** How full the session's context is, 0 to 1, or null if Chrome does not say. Older Chrome builds used
 *  `inputUsage` / `inputQuota` for the same numbers. */
export function contextFill(session: SessionLike): number | null {
  const s = session as SessionLike & { inputUsage?: number; inputQuota?: number };
  const used = s.contextUsage ?? s.inputUsage;
  const limit = s.contextWindow ?? s.inputQuota;
  if (typeof used !== 'number' || typeof limit !== 'number' || !(limit > 0)) return null;
  return used / limit;
}

/** The one global AI session. Rebuilds it when the context nears the limit (design: 80%). */
export class AiHost {
  private session: SessionLike | null = null;
  /** How many times the session was rebuilt because its context filled up. */
  rebuilds = 0;

  constructor(
    private readonly create: () => Promise<SessionLike>,
    private readonly threshold = 0.8,
  ) {}

  adopt(session: SessionLike) {
    this.session = session;
  }

  get isReady() {
    return this.session !== null;
  }

  /** Current context fill (0 to 1), for display. Null when unknown or not ready. */
  get fill(): number | null {
    return this.session ? contextFill(this.session) : null;
  }

  async prompt(input: string, options?: PromptOptions): Promise<string> {
    if (!this.session) throw new Error('The AI is not ready.');
    const fill = contextFill(this.session);
    if (fill !== null && fill >= this.threshold) await this.rebuild();
    try {
      return await this.session!.prompt(input, options);
    } catch (e) {
      // The context overflowed anyway (or Chrome gives no usage numbers): start fresh and try once more.
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        await this.rebuild();
        return this.session!.prompt(input, options);
      }
      throw e;
    }
  }

  async rebuild() {
    const old = this.session;
    this.session = await this.create();
    this.rebuilds++;
    old?.destroy();
  }

  /** Start over with a brand-new session (after an import), so nothing from before can be recalled. */
  async renew() {
    this.destroy();
    this.session = await this.create();
  }

  /** Lock, tab close and import all end here. After this, prompt() throws. */
  destroy() {
    this.session?.destroy();
    this.session = null;
  }
}
