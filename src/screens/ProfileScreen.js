// src/screens/ProfileScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebase/config';
import { colors } from '../styles/globalStyles';
import { useAuth } from '../context/AuthContext';
import { getLevelFromExp, getRankName, getLevelColor } from '../utils/levelSystem';
import { AVATAR_CONFIG, isAvatarUnlocked, getRequirementText } from '../utils/avatarSystem';

const ProfileScreen = ({ navigation }) => {
  const { userId, logout } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editAvatar, setEditAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [levelInfoModalVisible, setLevelInfoModalVisible] = useState(false);
  const [expHistoryModalVisible, setExpHistoryModalVisible] = useState(false);
  const [expHistory, setExpHistory] = useState([]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          setUserData(snapshot.val());
          setExpHistory(snapshot.val().expHistory || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [userId]);

  const handleLogout = () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: () => {
            logout();
            // После выхода контекст обновится, и навигация автоматически переключится на Login (см. App.js)
            // navigation.replace('Login'); // не нужно, так как logout обновляет userId и AppNavigator перестроится
          },
        },
      ]
    );
  };

  const goBack = () => {
    navigation.navigate('Menu');
  };

  const giftScreen = () => {
    navigation.navigate('GiftScreen');
  };

  const openEditModal = () => {
    setEditAvatar(userData.avatar);
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const userRef = ref(db, `users/${userId}`);
      await update(userRef, {
        avatar: editAvatar,
      });
      setUserData({ ...userData, avatar: editAvatar });
      setEditModalVisible(false);
      Alert.alert('Успешно', 'Аватар обновлен');
    } catch (error) {
      console.error(error);
      Alert.alert('Ошибка', 'Не удалось обновить аватар');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Не удалось загрузить профиль</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.buttonText}>Выйти</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.buttonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { totalGames, wins, exp = 0 } = userData.stats;
  const winRate = totalGames === 0 ? 0 : ((wins / totalGames) * 100).toFixed(1);

  const levelInfo = getLevelFromExp(exp);
  const rankName = getRankName(levelInfo.level);
  const levelColor = getLevelColor(levelInfo.level);
  const progress = levelInfo.currentLevelExp / levelInfo.expForNextLevel;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={openEditModal} style={styles.avatarContainer}>
          <Text style={styles.avatar}>{userData.avatar}</Text>
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>✏️</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.nameContainer}>
          <Text style={styles.name}>{userData.name}</Text>
          <TouchableOpacity style={styles.logoutIconButton} onPress={handleLogout}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.giftButton} onPress={giftScreen}>
          <Text style={styles.giftEmoji}>🎁</Text>
          <Text style={styles.giftButtonText}>Мои подарки</Text>
        </TouchableOpacity>

        {/* Уровень и опыт */}
        <TouchableOpacity
          style={styles.levelContainer}
          onPress={() => setExpHistoryModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.levelHeader}>
            <Text style={styles.levelText}>Уровень {levelInfo.level}</Text>
            <View style={styles.levelHeaderRight}>
              <Text style={styles.rankText}>{rankName}</Text>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setLevelInfoModalVisible(true);
                }}
              >
                <Text style={styles.infoButtonText}>ℹ️</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: levelColor }]} />
          </View>

          <Text style={styles.expText}>
            {levelInfo.currentLevelExp} / {levelInfo.expForNextLevel} опыта
          </Text>

          <Text style={styles.historyHint}>👆 Нажмите для просмотра истории</Text>
        </TouchableOpacity>

        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>📊 Статистика онлайн игр</Text>
          <Text style={styles.statsText}>Сыграно игр: {totalGames}</Text>
          <Text style={styles.statsText}>Побед: {wins}</Text>
          <Text style={styles.statsText}>Процент побед: {winRate}%</Text>
        </View>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.buttonText}>Назад</Text>
        </TouchableOpacity>
      </View>

      {/* Модальное окно редактирования */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Выбрать аватар</Text>

            <ScrollView
              style={styles.avatarGridScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.avatarGrid}>
                {AVATAR_CONFIG
                  .map((avatarConfig) => ({
                    ...avatarConfig,
                    unlocked: isAvatarUnlocked(
                      avatarConfig,
                      userData?.stats,
                      getLevelFromExp(userData?.stats?.exp || 0).level
                    )
                  }))
                  .sort((a, b) => {
                    // Сортировка: разблокированные сначала, заблокированные внизу
                    if (a.unlocked && !b.unlocked) return -1;
                    if (!a.unlocked && b.unlocked) return 1;
                    return 0;
                  })
                  .map((avatarConfig) => {
                    const { unlocked } = avatarConfig;
                    const requirementText = getRequirementText(avatarConfig.requirement);
                    const isSelected = editAvatar === avatarConfig.emoji;

                    // Короткий текст требования для отображения
                    let shortRequirement = '';
                    if (avatarConfig.requirement.type !== 'none') {
                      const { type, value } = avatarConfig.requirement;
                      if (type === 'level') shortRequirement = `${value} ур.`;
                      else if (type === 'games') shortRequirement = `${value} игр`;
                      else if (type === 'wins') shortRequirement = `${value} побед`;
                    }

                    return (
                      <TouchableOpacity
                        key={avatarConfig.emoji}
                        style={[
                          styles.avatarOption,
                          isSelected && styles.avatarOptionSelected,
                          !unlocked && styles.avatarOptionLocked
                        ]}
                        onPress={() => {
                          if (unlocked) {
                            setEditAvatar(avatarConfig.emoji);
                          } else {
                            Alert.alert('Заблокировано', requirementText);
                          }
                        }}
                      >
                        <Text style={[
                          styles.avatarOptionText,
                          !unlocked && styles.avatarOptionTextLocked
                        ]}>
                          {avatarConfig.emoji}
                        </Text>
                        {shortRequirement && (
                          <View style={[
                            styles.requirementBadge,
                            unlocked && styles.requirementBadgeUnlocked
                          ]}>
                            <Text style={[
                              styles.requirementText,
                              unlocked && styles.requirementTextUnlocked
                            ]}>
                              {shortRequirement}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Сохранить</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно информации об уровнях */}
      <Modal
        visible={levelInfoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLevelInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>📊 Система уровней</Text>

            <ScrollView style={styles.infoScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>💰 Начисление опыта</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🏆</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Победа онлайн</Text>
                    <Text style={styles.infoValue}>+300 опыта</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>💪</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Поражение онлайн</Text>
                    <Text style={styles.infoValue}>+50 опыта</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🤖</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Победа над гроссмейстером</Text>
                    <Text style={styles.infoValue}>+100 опыта</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🤖</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Победа над сложным ботом</Text>
                    <Text style={styles.infoValue}>+80 опыта</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🤖</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Победа над средним ботом</Text>
                    <Text style={styles.infoValue}>+50 опыта</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🤖</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Победа над легким ботом</Text>
                    <Text style={styles.infoValue}>+30 опыта</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>😔</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Поражение от бота</Text>
                    <Text style={styles.infoValue}>+20 опыта</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>👥</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Локальная игра</Text>
                    <Text style={styles.infoValue}>0 опыта</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>⭐ Ранги игроков</Text>

                <View style={styles.rankRow}>
                  <Text style={styles.rankLevel}>1-4</Text>
                  <Text style={styles.rankName}>🌱 Новичок</Text>
                </View>
                <View style={styles.rankRow}>
                  <Text style={styles.rankLevel}>5-9</Text>
                  <Text style={styles.rankName}>🥉 Любитель</Text>
                </View>
                <View style={styles.rankRow}>
                  <Text style={styles.rankLevel}>10-19</Text>
                  <Text style={styles.rankName}>🥈 Опытный</Text>
                </View>
                <View style={styles.rankRow}>
                  <Text style={styles.rankLevel}>20-29</Text>
                  <Text style={styles.rankName}>🥇 Профи</Text>
                </View>
                <View style={styles.rankRow}>
                  <Text style={styles.rankLevel}>30-39</Text>
                  <Text style={styles.rankName}>⭐ Эксперт</Text>
                </View>
                <View style={styles.rankRow}>
                  <Text style={styles.rankLevel}>40-49</Text>
                  <Text style={styles.rankName}>💎 Мастер</Text>
                </View>
                <View style={styles.rankRow}>
                  <Text style={styles.rankLevel}>50+</Text>
                  <Text style={styles.rankName}>🏆 Легенда</Text>
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>📈 Прогрессия</Text>
                <Text style={styles.infoDescription}>
                  Для каждого следующего уровня требуется на 100 опыта больше:{'\n\n'}
                  • Уровень 1→2: 100 опыта{'\n'}
                  • Уровень 2→3: 200 опыта{'\n'}
                  • Уровень 3→4: 300 опыта{'\n'}
                  и так далее...
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.infoCloseButton}
              onPress={() => setLevelInfoModalVisible(false)}
            >
              <Text style={styles.infoCloseButtonText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно истории опыта */}
      <Modal
        visible={expHistoryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>📜 История начислений опыта</Text>

            <ScrollView style={styles.infoScrollView} showsVerticalScrollIndicator={false}>
              {expHistory.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <Text style={styles.emptyHistoryText}>История пуста</Text>
                  <Text style={styles.emptyHistorySubtext}>Сыграйте игру, чтобы получить опыт</Text>
                </View>
              ) : (
                expHistory.map((entry, index) => {
                  const date = new Date(entry.timestamp);
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);

                  // Сравниваем даты (без учета времени)
                  const isSameDay = (d1, d2) => {
                    return d1.getDate() === d2.getDate() &&
                           d1.getMonth() === d2.getMonth() &&
                           d1.getFullYear() === d2.getFullYear();
                  };

                  let dateStr;
                  if (isSameDay(date, today)) {
                    dateStr = 'Сегодня';
                  } else if (isSameDay(date, yesterday)) {
                    dateStr = 'Вчера';
                  } else {
                    dateStr = date.toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });
                  }

                  const isWin = entry.result === 'win';
                  const isOpponentLeft = entry.result === 'opponent_left';
                  const resultEmoji = isWin ? '🏆' : (isOpponentLeft ? '🚪' : '💪');
                  const resultText = isWin ? 'Победа' : (isOpponentLeft ? 'Противник покинул игру' : 'Поражение');
                  const expColor = (isWin || isOpponentLeft) ? '#4ECDC4' : '#FF9800';

                  return (
                    <View key={index} style={styles.historyEntry}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyGameType}>{entry.gameType}</Text>
                        <Text style={styles.historyDate}>{dateStr}</Text>
                      </View>
                      <Text style={styles.historyOpponent}>Противник: {entry.opponent}</Text>
                      <View style={styles.historyFooter}>
                        <Text style={styles.historyResult}>{resultEmoji} {resultText}</Text>
                        <Text style={[styles.historyExp, { color: expColor }]}>
                          +{entry.expGained} опыта
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.infoCloseButton}
              onPress={() => setExpHistoryModalVisible(false)}
            >
              <Text style={styles.infoCloseButtonText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between', // чтобы кнопки были внизу
    padding: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    fontSize: 80,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4ECDC4',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  editBadgeText: {
    fontSize: 14,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginRight: 12,
  },
  logoutIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    backgroundColor: '#2c3e50',
    padding: 20,
    borderRadius: 20,
    width: '100%',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 12,
    textAlign: 'center',
  },
  statsText: {
    fontSize: 18,
    color: colors.textLight,
    marginBottom: 10,
  },
  buttonsContainer: {
    marginBottom: 30,
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 15,
  },
  backButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: 'center',
  },
  closeBtn: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  giftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  giftEmoji: {
    fontSize: 28,
    marginRight: 10,
  },
  giftButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textLight,
  },
  levelContainer: {
    backgroundColor: '#2c3e50',
    padding: 20,
    borderRadius: 20,
    width: '100%',
    marginBottom: 15,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  rankText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonText: {
    fontSize: 16,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#1a2a3a',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  expText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2c3e50',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: 10,
    marginTop: 10,
  },
  avatarGridScroll: {
    maxHeight: 280,
    marginBottom: 10,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  avatarOption: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  avatarOptionSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78, 205, 196, 0.3)',
    transform: [{ scale: 1.05 }],
  },
  avatarOptionLocked: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    opacity: 0.5,
  },
  avatarOptionText: {
    fontSize: 28,
  },
  avatarOptionTextLocked: {
    opacity: 0.4,
  },
  requirementBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  requirementBadgeUnlocked: {
    backgroundColor: 'rgba(78, 205, 196, 0.8)',
  },
  requirementText: {
    fontSize: 8,
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  requirementTextUnlocked: {
    color: '#1a2a3a',
  },
  input: {
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textLight,
    borderWidth: 1,
    borderColor: '#4a5a6a',
  },
  charCount: {
    fontSize: 12,
    color: '#8e8e93',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#4ECDC4',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  errorText: {
    color: colors.textLight,
    fontSize: 18,
    marginBottom: 20,
  },
  infoModalContent: {
    backgroundColor: '#2c3e50',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  infoModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 16,
    textAlign: 'center',
  },
  infoScrollView: {
    flexGrow: 0,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  infoEmoji: {
    fontSize: 20,
    marginRight: 10,
    width: 24,
  },
  infoTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textLight,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginLeft: 8,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  rankLevel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8e8e93',
    width: 50,
  },
  rankName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
  },
  infoDescription: {
    fontSize: 13,
    color: '#8e8e93',
    lineHeight: 18,
  },
  infoCloseButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  infoCloseButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a2a3a',
  },
  historyHint: {
    fontSize: 12,
    color: '#4ECDC4',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHistorySubtext: {
    fontSize: 13,
    color: '#8e8e93',
  },
  historyEntry: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyGameType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  historyDate: {
    fontSize: 11,
    color: '#8e8e93',
  },
  historyOpponent: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyResult: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
  },
  historyExp: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;