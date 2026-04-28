import { defineStore } from 'pinia';

import { ref, computed } from 'vue';

export const usePasswordVaultStore = defineStore('password-vault', () => {
  const isUnlocked = ref(false);
  const masterKey = ref<string | null>(null);
  const lastActivityTime = ref<number>(Date.now());
  const lockTimeout = 30 * 60 * 1000; // 30 minutes

  const isLocked = computed(() => !isUnlocked.value);

  function unlock(key: string) {
    masterKey.value = key;
    isUnlocked.value = true;
    updateActivity();
  }

  function lock() {
    masterKey.value = null;
    isUnlocked.value = false;
  }

  function updateActivity() {
    lastActivityTime.value = Date.now();
  }

  function checkTimeout() {
    if (isUnlocked.value && Date.now() - lastActivityTime.value > lockTimeout) {
      lock();
      return true;
    }
    return false;
  }

  return {
    isUnlocked,
    isLocked,
    masterKey,
    unlock,
    lock,
    updateActivity,
    checkTimeout,
  };
});