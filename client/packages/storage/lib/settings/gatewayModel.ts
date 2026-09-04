import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

/**
 * Runtime-selectable gateway model (SIH single-brain). The stored value is the
 * exact model tag sent to the FastAPI gateway; an empty value means "use the
 * build-time VITE_SIH_QWEN_MODEL default". Changing it takes effect on the
 * next task — no extension rebuild required.
 */
export interface GatewayModelConfig {
  model: string;
}

export type GatewayModelStorage = BaseStorage<GatewayModelConfig> & {
  getModel: () => Promise<string>;
  setModel: (model: string) => Promise<void>;
};

const storage = createStorage<GatewayModelConfig>('sih-gateway-model', { model: '' }, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const gatewayModelStore: GatewayModelStorage = {
  ...storage,
  async getModel() {
    return (await storage.get())?.model ?? '';
  },
  async setModel(model: string) {
    await storage.set({ model });
  },
};
