import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Single SIH model boundary. The extension calls FastAPI only; FastAPI owns
 * the choice between local Ollama and an OpenAI-compatible cloud provider.
 */
export function createSihGatewayModel(): BaseChatModel {
  const baseURL = (import.meta.env.VITE_SIH_FASTAPI_URL as string | undefined) ?? 'http://127.0.0.1:8000/v1';
  const model = (import.meta.env.VITE_SIH_QWEN_MODEL as string | undefined) ?? 'qwen3-vl:4b';

  return new ChatOpenAI({
    model,
    apiKey: 'sih-gateway',
    temperature: 0.1,
    maxTokens: 4096,
    configuration: {
      baseURL,
      defaultHeaders: { 'X-SIH-Protocol-Version': '1.0' },
    },
  });
}

