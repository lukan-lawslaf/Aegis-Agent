import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { gatewayModelStore } from '@extension/storage';

/** Agent roles that can run on different models (SIH split-brain mode). */
export type GatewayRole = 'planner' | 'navigator';

/**
 * SIH model boundary. The extension calls FastAPI only; FastAPI owns the
 * choice between local Ollama and an OpenAI-compatible cloud provider.
 *
 * Roles are split for speed:
 * - planner (and extractor/validator, same structured-output shape) runs the
 *   fast local instruct model — env VITE_SIH_PLANNER_MODEL.
 * - navigator/executor (DOM actions, tool calls) runs the model picked at
 *   runtime in the settings modal (gatewayModelStore), falling back to
 *   VITE_SIH_QWEN_MODEL.
 */
export async function createSihGatewayModel(role: GatewayRole = 'navigator'): Promise<BaseChatModel> {
  const baseURL = (import.meta.env.VITE_SIH_FASTAPI_URL as string | undefined) ?? 'http://127.0.0.1:8000/v1';
  const defaultPlannerModel = (import.meta.env.VITE_SIH_PLANNER_MODEL as string | undefined) ?? 'qwen3-vl:4b-instruct';
  const defaultNavigatorModel = (import.meta.env.VITE_SIH_QWEN_MODEL as string | undefined) ?? 'gemma4:31b-cloud';

  let model = defaultNavigatorModel;
  if (role === 'planner') {
    model = defaultPlannerModel;
  } else {
    try {
      const selected = await gatewayModelStore.getModel();
      if (selected) model = selected;
    } catch {
      // storage unavailable — keep the build default
    }
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
