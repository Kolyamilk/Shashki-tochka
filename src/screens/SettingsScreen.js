import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/globalStyles';
import { LinearGradient } from 'expo-linear-gradient';
import Piece from '../components/Piece'; // добавили для превью
import { ref, get } from 'firebase/database';
import { db } from '../firebase/config';
import { getLevelFromExp } from '../utils/levelSystem';


// Пресеты для доски (6 вариантов)
const boardPresets = [
  { name: 'Классика', light: '#f0d9b5', dark: '#b58863', requiredLevel: 1 },
  { name: 'Мрамор', light: '#e8e8e8', dark: '#a0a0a0', requiredLevel: 2 },
  { name: 'Дуб', light: '#e3c194', dark: '#8b5a2b', requiredLevel: 3 },
  { name: 'Лаванда', light: '#e6e6fa', dark: '#8a6e8b', requiredLevel: 4 },
  { name: 'Мятный', light: '#d4f0d0', dark: '#6b8e6b', requiredLevel: 5 },
  { name: 'Океан', light: '#c0e0ff', dark: '#2f6f8f', requiredLevel: 6 },
  { name: 'Закат', light: '#ffd4a3', dark: '#d9534f', requiredLevel: 7 },
  { name: 'Ночь', light: '#4a5568', dark: '#1a202c', requiredLevel: 8 },
  { name: 'Изумруд', light: '#a7f3d0', dark: '#047857', requiredLevel: 9 },
];

// Пресеты для шашек (добавлен коричневый)
const piecePresets = [
  { name: 'Белый', color: '#FFFFFF', requiredLevel: 1 },
  { name: 'Чёрный', color: '#333333', requiredLevel: 1 },
  { name: 'Серый', color: '#d6d6d6', requiredLevel: 2 },
  { name: 'Коричневый', color: '#8B4513', requiredLevel: 3 },
  { name: 'Красный', color: '#FF4444', requiredLevel: 4 },
  { name: 'Зелёный', color: '#44FF44', requiredLevel: 5 },
  { name: 'Жёлтый', color: '#FFFF44', requiredLevel: 6 },
  { name: 'Оранжевый', color: '#FF8800', requiredLevel: 7 },
  { name: 'Фиолетовый', color: '#AA44FF', requiredLevel: 8 },
];

// Пресеты для стиля дамки
const kingStylePresets = [
  { name: 'Корона', value: 'crown', preview: '♔', requiredLevel: 1 },
  { name: 'Королева', value: 'queen', preview: '♛', requiredLevel: 1 },
  { name: 'Звезда', value: 'star', preview: '★', requiredLevel: 2 },
  { name: 'Сердце', value: 'heart', preview: '♡', requiredLevel: 3 },
  { name: 'Череп', value: 'skull', preview: '☠', requiredLevel: 4 },
  { name: 'Щит', value: 'shield', preview: '⛨', requiredLevel: 5 },
  { name: 'Крест', value: 'cross', preview: '✚', requiredLevel: 6 },
  { name: 'Цветок', value: 'flower', preview: '✿', requiredLevel: 7 },
  { name: 'Пацифик', value: 'peace', preview: '☮', requiredLevel: 8 },
];

// Модальное окно выбора цвета с блокировкой и значком замка
const ColorPickerModal = ({ visible, onClose, onSelect, currentColor, title, disabledColors = [], userLevel = 1 }) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>Выберите цвет для ваших шашек</Text>
          <View style={styles.colorGrid}>
            {piecePresets.map((item) => {
              const isDisabled = disabledColors.includes(item.color);
              const isLocked = userLevel < item.requiredLevel;
              const cannotSelect = isDisabled || isLocked;
              const isSelected = currentColor === item.color;
              return (
                <TouchableOpacity
                  key={item.color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: item.color },
                    isSelected && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    if (!cannotSelect) {
                      onSelect(item.color);
                      onClose();
                    }
                  }}
                  disabled={cannotSelect}
                  activeOpacity={0.7}
                >
                  {isSelected && !cannotSelect && (
                    <View style={styles.selectedCheckmark}>
                      <Text style={styles.selectedCheckmarkText}>✓</Text>
                    </View>
                  )}
                  {cannotSelect && (
                    <View style={styles.disabledOverlay}>
                      <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔒'}</Text>
                      {isLocked && (
                        <Text style={styles.levelRequirement}>Ур. {item.requiredLevel}</Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.colorName}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const KingStyleModal = ({ visible, onClose, onSelect, currentStyle, title, disabledStyles = [], userLevel = 1, pieceColor }) => {
  const tempPiece = { player: 1, king: true };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.styleGrid}>
            {kingStylePresets.map((item) => {
              const isDisabled = disabledStyles.includes(item.value);
              const isLocked = userLevel < item.requiredLevel;
              const cannotSelect = isDisabled || isLocked;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.styleOption,
                    currentStyle === item.value && styles.styleOptionSelected,
                  ]}
                  onPress={() => {
                    if (!cannotSelect) {
                      onSelect(item.value);
                      onClose();
                    }
                  }}
                  disabled={cannotSelect}
                  activeOpacity={0.7}
                >
                  <View style={styles.previewKingWrapper}>
                    <Text style={[styles.previewKingSymbol, { color: pieceColor }]}>
                      {item.preview}
                    </Text>
                  </View>
                  <Text style={styles.styleName}>{item.name}</Text>
                  {cannotSelect && (
                    <View style={styles.disabledStyleOverlay}>
                      <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔒'}</Text>
                      {isLocked && (
                        <Text style={styles.levelRequirement}>Ур. {item.requiredLevel}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Компонент интерактивного превью доски
const InteractivePreviewBoard = () => {
  const {
    boardLightColor,
    boardDarkColor,
    myPieceColor,
    setMyPieceColor,
    opponentPieceColor,
    setOpponentPieceColor,
    myKingStyle,
    setMyKingStyle,
    opponentKingStyle,
    setOpponentKingStyle,
    kingCrownColor,
  } = useSettings();

  const { userId } = useAuth();
  const [userLevel, setUserLevel] = useState(1);
  const [myColorModalVisible, setMyColorModalVisible] = useState(false);
  const [opponentColorModalVisible, setOpponentColorModalVisible] = useState(false);
  const [myKingStyleModalVisible, setMyKingStyleModalVisible] = useState(false);
  const [opponentKingStyleModalVisible, setOpponentKingStyleModalVisible] = useState(false);

  useEffect(() => {
    const loadUserLevel = async () => {
      if (!userId) return;
      try {
        const userStatsRef = ref(db, `users/${userId}/stats`);
        const snapshot = await get(userStatsRef);
        if (snapshot.exists()) {
          const stats = snapshot.val();
          const levelInfo = getLevelFromExp(stats.exp || 0);
          setUserLevel(levelInfo.level);
        }
      } catch (error) {
        console.error('Ошибка загрузки уровня:', error);
      }
    };
    loadUserLevel();
  }, [userId]);

  const darkenColor = (color) => {
    if (color?.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const darker = (c) => Math.max(0, c - 40);
      return `#${darker(r).toString(16).padStart(2, '0')}${darker(g).toString(16).padStart(2, '0')}${darker(b).toString(16).padStart(2, '0')}`;
    }
    return color;
  };

  const renderCell = (row, col, pieceType) => {
    const isDark = (row + col) % 2 === 1;
    const bgColor = isDark ? boardDarkColor : boardLightColor;

    let pieceColor = null;
    let isKing = false;
    let onPress = null;
    let piece = null;
    let overrideStyle = null;

    if (pieceType === 'myNormal') {
      pieceColor = myPieceColor;
      onPress = () => setMyColorModalVisible(true);
    } else if (pieceType === 'myKing') {
      piece = { player: 1, king: true };
      overrideStyle = myKingStyle;
      onPress = () => setMyKingStyleModalVisible(true);
    } else if (pieceType === 'opponentNormal') {
      pieceColor = opponentPieceColor;
      onPress = () => setOpponentColorModalVisible(true);
    } else if (pieceType === 'opponentKing') {
      piece = { player: 2, king: true };
      overrideStyle = opponentKingStyle;
      onPress = () => setOpponentKingStyleModalVisible(true);
    }

    return (
      <TouchableOpacity
        key={`cell-${row}-${col}`}
        style={[styles.previewCell, { backgroundColor: bgColor }]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        {pieceType === 'myNormal' || pieceType === 'opponentNormal' ? (
          <LinearGradient
            colors={[pieceColor, darkenColor(pieceColor)]}
            style={styles.previewPiece}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ) : piece && (
          <Piece
            piece={piece}
            canCapture={false}
            overrideKingStyle={overrideStyle}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderBoard = () => {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      const cells = [];
      for (let c = 0; c < 8; c++) {
        let pieceType = null;
        if (r < 3 && (r + c) % 2 === 1) pieceType = 'opponentNormal';
        if (r > 4 && (r + c) % 2 === 1) pieceType = 'myNormal';
        if (r === 0 && c === 1) pieceType = 'myKing';
        if (r === 7 && c === 2) pieceType = 'opponentKing';
        cells.push(renderCell(r, c, pieceType));
      }
      rows.push(
        <View key={`row-${r}`} style={styles.previewRow}>
          {cells}
        </View>
      );
    }
    return rows;
  };

  return (
    <>
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Предпросмотр</Text>
        <Text style={styles.previewHint}>
          Нажмите на шашку, чтобы изменить цвет. Нажмите на дамку, чтобы выбрать стиль.
        </Text>
        <View style={styles.previewBoard}>{renderBoard()}</View>
      </View>

      <ColorPickerModal
        visible={myColorModalVisible}
        onClose={() => setMyColorModalVisible(false)}
        onSelect={setMyPieceColor}
        currentColor={myPieceColor}
        title="Цвет ваших шашек"
        disabledColors={[opponentPieceColor]}
        userLevel={userLevel}
      />
      <ColorPickerModal
        visible={opponentColorModalVisible}
        onClose={() => setOpponentColorModalVisible(false)}
        onSelect={setOpponentPieceColor}
        currentColor={opponentPieceColor}
        title="Цвет шашек противника"
        disabledColors={[myPieceColor]}
        userLevel={userLevel}
      />
      <KingStyleModal
        visible={myKingStyleModalVisible}
        onClose={() => setMyKingStyleModalVisible(false)}
        onSelect={setMyKingStyle}
        currentStyle={myKingStyle}
        title="Стиль дамки (ваши фигуры)"
        disabledStyles={[opponentKingStyle]}
        userLevel={userLevel}
        pieceColor={myPieceColor}
      />
      <KingStyleModal
        visible={opponentKingStyleModalVisible}
        onClose={() => setOpponentKingStyleModalVisible(false)}
        onSelect={setOpponentKingStyle}
        currentStyle={opponentKingStyle}
        title="Стиль дамки (противник)"
        disabledStyles={[myKingStyle]}
        userLevel={userLevel}
        pieceColor={opponentPieceColor}
      />
    </>
  );
};

const SettingsScreen = ({ navigation }) => {
  const {
    boardLightColor,
    boardDarkColor,
    setBoardLightColor,
    setBoardDarkColor,
  } = useSettings();

  const { userId } = useAuth();
  const [userLevel, setUserLevel] = useState(1);

  useEffect(() => {
    const loadUserLevel = async () => {
      if (!userId) return;
      try {
        const userStatsRef = ref(db, `users/${userId}/stats`);
        const snapshot = await get(userStatsRef);
        if (snapshot.exists()) {
          const stats = snapshot.val();
          const levelInfo = getLevelFromExp(stats.exp || 0);
          setUserLevel(levelInfo.level);
        }
      } catch (error) {
        console.error('Ошибка загрузки уровня:', error);
      }
    };
    loadUserLevel();
  }, [userId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>⚙️ Настройки</Text>

      {/* Интерактивное превью */}
      <InteractivePreviewBoard />

      {/* Секция: Цвета доски */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🎨</Text>
          <Text style={styles.categoryTitle}>Цвета доски</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Выберите цветовую схему для игровой доски
        </Text>
        <View style={styles.presetsGrid}>
          {boardPresets.map((preset, index) => {
            const isLocked = userLevel < preset.requiredLevel;
            const isSelected = boardLightColor === preset.light && boardDarkColor === preset.dark;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.presetItem,
                  isSelected && styles.presetSelected,
                  isLocked && styles.presetLocked,
                ]}
                onPress={() => {
                  if (!isLocked) {
                    setBoardLightColor(preset.light);
                    setBoardDarkColor(preset.dark);
                  }
                }}
                disabled={isLocked}
                activeOpacity={0.7}
              >
                <View style={styles.boardPreview}>
                  <View style={styles.boardPreviewRow}>
                    <View style={[styles.boardPreviewCell, { backgroundColor: preset.light }]} />
                    <View style={[styles.boardPreviewCell, { backgroundColor: preset.dark }]} />
                  </View>
                  <View style={styles.boardPreviewRow}>
                    <View style={[styles.boardPreviewCell, { backgroundColor: preset.dark }]} />
                    <View style={[styles.boardPreviewCell, { backgroundColor: preset.light }]} />
                  </View>
                </View>
                <Text style={[styles.presetName, isLocked && styles.presetNameLocked]}>
                  {preset.name}
                </Text>
                {isSelected && !isLocked && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
                {isLocked && (
                  <View style={styles.boardLockBadge}>
                    <Text style={styles.boardLockIcon}>🔒</Text>
                    <Text style={styles.boardLockText}>Ур. {preset.requiredLevel}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={() => navigation.goBack()}>
        <Text style={styles.saveButtonText}>← Назад</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
const styles = StyleSheet.create({
  container: {
    marginTop:20,
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  previewKingEmoji: {
    fontSize: 24,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 16, // уменьшили
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  previewContainer: {
    backgroundColor: '#2c3e50',
    borderRadius: 16,
    padding: 12, // уменьшили
    marginBottom: 16, // уменьшили
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  previewHint: {
    fontSize: 12, // уменьшили шрифт
    color: colors.textLight,
    marginBottom: 10,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  previewBoard: {
    borderWidth: 2,
    borderColor: '#4a2c2c',
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewRow: {
    flexDirection: 'row',
  },
  previewCell: {
    width: 36, // уменьшили размер клеток
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPiece: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#888',
  },
  previewNormal: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  previewKing: {
    fontSize: 14,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 12, // уменьшили
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingBottom: 4,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  presetItem: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    borderRadius: 12,
    padding: 8, // уменьшили
    marginBottom: 8, // уменьшили
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  presetSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#3a4a5a',
  },
  presetLocked: {
    opacity: 0.6,
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#1a2a3a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  presetName: {
    color: colors.textLight,
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  presetNameLocked: {
    color: '#888',
  },
  boardLockBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
  },
  boardLockIcon: {
    fontSize: 14,
  },
  boardLockText: {
    fontSize: 8,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  boardPreview: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#888',
  },
  boardPreviewRow: {
    flexDirection: 'row',
  },
  boardPreviewCell: {
    width: 24,
    height: 24,
  },
  saveButton: {
    backgroundColor: colors.secondary,
    padding: 12, // уменьшили
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20, // уменьшили
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a2a3a',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  colorOption: {
    width: 70,
    height: 70,
    borderRadius: 35,
    margin: 8,
    borderWidth: 3,
    borderColor: '#444',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
    position: 'relative',
  },
  colorOptionSelected: {
    borderColor: '#FFD700',
    borderWidth: 4,
    transform: [{ scale: 1.05 }],
  },
  selectedCheckmark: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFD700',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 6,
  },
  selectedCheckmarkText: {
    color: '#1a2a3a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  colorName: {
    position: 'absolute',
    bottom: -20,
    fontSize: 10,
    color: '#aaa',
    fontWeight: '600',
  },
  colorOptionDisabled: {
    opacity: 0.3,
  },
  disabledOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 20,
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  levelRequirement: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: 'bold',
    marginTop: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 15,
  },
  styleOption: {
    width: 70,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  styleOptionSelected: {
    borderColor: '#FFD700',
  },
  disabledStyleOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  lockIcon: {
    fontSize: 12,
    color: '#fff',
  },
  levelRequirement: {
    fontSize: 8,
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  previewKingWrapper: {
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
  },
  previewKingSymbol: {
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 50,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  stylePreview: {
    fontSize: 30,
    marginBottom: 4,
  },
  styleName: {
    color: colors.textLight,
    fontSize: 12,
  },
  modalCloseButton: {
    backgroundColor: '#FF6B6B',
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;