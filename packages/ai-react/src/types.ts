import { AiLib, AiLibState } from '@chancetop/ai-api';

export type AiLibStateSnapshot = AiLibState;

export type UseAiLibStateOptions<
  TSelectorResult,
  TAiLib extends AiLib | null = AiLib | null,
> = {
  /**
   * The editor instance.
   */
  aiLib: TAiLib;
  /**
   * A selector function to determine the value to compare for re-rendering.
   */
  selector: (context: AiLibStateSnapshot) => TSelectorResult;
  /**
   * A custom equality function to determine if the editor should re-render.
   * @default `deepEqual` from `fast-deep-equal`
   */
  equalityFn?: (a: TSelectorResult, b: TSelectorResult | null) => boolean;
};
