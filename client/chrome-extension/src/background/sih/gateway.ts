import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { gatewayModelStore } from '@extension/storage';

/**
 * Single SIH model boundary. The extension calls FastAPI only; FastAPI owns
 * the choice between local Ollama and an OpenAI-compatible cloud provider.
 *
 * The model tag is resolved at task time: the runtime selection from the
 * settings modal (gatewayModelStore) wins, falling back to the build-time
 * VITE_SIH_QWEN_MODEL default.
 */
export async function createSihGatewayModel(): Promise<BaseChatModel> {
  const baseURL = (import.meta.env.VITE_SIH_FASTAPI_URL as string | undefined) ?? 'http://127.0.0.1:8000/v1';
  const defaultModel = (import.meta.env.VITE_SIH_QWEN_MODEL as string | undefined) ?? 'qwen3-vl:4b';

  let model = defaultModel;
  try {
    const selected = await gatewayModelStore.getModel();
    if (selected) model = selected;
  } catch {
    // storage unavailable — keep the build default
  }

  return new ChatOpenAI({
    model,
    apiKey: 'sih-gateway',
    temperature: 0.1,
    // Generous cap: thinking-mode models can burn thousands of tokens before
    // the JSON answer; truncation here breaks structured-output parsing.
    maxTokens: 8192,
    configuration: {
      baseURL,
      defaultHeaders: { 'X-SIH-Protocol-Version': '1.0' },
    },
  });
}
