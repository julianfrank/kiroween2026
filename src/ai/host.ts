import type { PromptOptions, SessionLike } from './readiness';

/** The one global AI session. Rebuilds it when the context nears the limit (design: 80%). */
export class AiHost {
  private session: SessionLike | null = null;

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

  async prompt(input: string, options?: PromptOptions): Promise<string> {
    if (!this.session) throw new Error('The AI is not ready.');
    const { contextUsage, contextWindow } = this.session;
    if (contextUsage !== undefined && contextWindow && contextUsage / contextWindow >= this.threshold) {
      await this.rebuild();
    }
    try {
      return await this.session!.prompt(input, options);
    } catch (e) {
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
