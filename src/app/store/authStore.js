import { create } from 'zustand'

function sendMsg(message) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error('Chrome API unavailable'))
      return
    }
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(res)
      }
    })
  })
}

export const useAuthStore = create((set) => ({
  authenticated: false,
  loading:       true,
  orgUrl:        null,

  checkAuth: async () => {
    set({ loading: true })
    try {
      const res = await sendMsg({ type: 'GET_AUTH_STATUS' })
      if (res?.authenticated) {
        set({
          authenticated: true,
          orgUrl:        res.orgUrl,
          loading:       false,
        })
      } else {
        set({ authenticated: false, loading: false })
      }
    } catch {
      set({ authenticated: false, loading: false })
    }
  },

  clearSession: async () => {
    await sendMsg({ type: 'CLEAR_SESSION' })
    set({ authenticated: false, orgUrl: null })
  },
}))