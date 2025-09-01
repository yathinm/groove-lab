import { createContext, useContext } from 'react'
import { defaultConfig, type Config } from './constants'

const ConfigContext = createContext<Config>(defaultConfig)

export function useAppConfig(): Config {
  return useContext(ConfigContext)
}

export function ConfigProvider({ children, value }: { children: React.ReactNode, value?: Partial<Config> }) {
  const merged: Config = {
    ...defaultConfig,
    ui: { ...defaultConfig.ui, ...(value?.ui ?? {}) },
    audio: { ...defaultConfig.audio, ...(value?.audio ?? {}) },
    upload: { ...defaultConfig.upload, ...(value?.upload ?? {}) },
    storage: { ...defaultConfig.storage, ...(value?.storage ?? {}) },
    polling: { ...defaultConfig.polling, ...(value?.polling ?? {}) },
    labels: { ...defaultConfig.labels, ...(value?.labels ?? {}) },
  }
  return (
    <ConfigContext.Provider value={merged}>{children}</ConfigContext.Provider>
  )
}


