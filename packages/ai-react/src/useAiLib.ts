import { useEffect, useState } from 'react';
import { AiLib, AiLibOptions } from '@connexup/ai-api';

export type UseEditorOptions = AiLibOptions;
export function useAiLib(options: UseEditorOptions) {
  const [aiLib] = useState(() => new AiLib(options));

  useEffect(() => {
    return () => {
      aiLib.destroy();
    };
  }, []);

  return aiLib;
}
