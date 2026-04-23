// src/utils/soundManager.js
// Простая заглушка для звуков (можно расширить позже)

class SoundManager {
  constructor() {
    this.enabled = true;
  }

  // Простой звук хода (пока заглушка)
  async playMoveSound() {
    if (!this.enabled) return;
    // В будущем здесь можно добавить реальные звуки
    // Пока просто логируем
    console.log('🔊 Звук хода');
  }

  // Звук взятия (пока заглушка)
  async playCaptureSound() {
    if (!this.enabled) return;
    console.log('🔊 Звук взятия');
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

export const soundManager = new SoundManager();

// Инициализация (пока ничего не делает)
export const initSounds = async () => {
  console.log('🔊 Звуковая система инициализирована (заглушка)');
};
