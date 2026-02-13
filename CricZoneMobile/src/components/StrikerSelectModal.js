import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { colors, spacing, borderRadius, fontWeights } from '../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const StrikerSelectModal = ({
  visible,
  onSelect,
  batsmanOptions, // Array of { id, name, runs, balls, isNew, isSuggested }
  title = 'Select Next Striker',
}) => {
  if (!batsmanOptions || batsmanOptions.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🏏</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Who will face the next ball?</Text>
          </View>

          {/* Batsman Options */}
          <View style={styles.optionsContainer}>
            {batsmanOptions.map((batsman, index) => (
              <TouchableOpacity
                key={batsman.id || index}
                style={[
                  styles.optionCard,
                  batsman.isSuggested && styles.optionCardSuggested,
                ]}
                onPress={() => onSelect(batsman)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  {/* Avatar */}
                  <View style={[
                    styles.avatar,
                    batsman.isSuggested && styles.avatarSuggested,
                  ]}>
                    <Text style={[
                      styles.avatarText,
                      batsman.isSuggested && styles.avatarTextSuggested,
                    ]}>
                      {batsman.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.optionInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[
                        styles.optionName,
                        batsman.isSuggested && styles.optionNameSuggested,
                      ]} numberOfLines={1}>
                        {batsman.name}
                      </Text>
                      {batsman.isNew && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.optionStats}>
                      {batsman.isNew ? 'Coming in to bat' : `${batsman.runs} (${batsman.balls})`}
                    </Text>
                  </View>

                  {/* Suggested indicator */}
                  {batsman.isSuggested && (
                    <View style={styles.suggestedBadge}>
                      <Text style={styles.suggestedText}>Suggested</Text>
                    </View>
                  )}
                </View>

                {/* Tap indicator */}
                <View style={[
                  styles.selectIndicator,
                  batsman.isSuggested && styles.selectIndicatorSuggested,
                ]}>
                  <Text style={[
                    styles.selectText,
                    batsman.isSuggested && styles.selectTextSuggested,
                  ]}>
                    Tap to select
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info text */}
          <Text style={styles.infoText}>
            Select the batsman who should face the next delivery
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 25,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  optionCardSuggested: {
    backgroundColor: '#f0f9ff',
    borderColor: colors.primary,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSuggested: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748b',
  },
  avatarTextSuggested: {
    color: '#ffffff',
  },
  optionInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  optionNameSuggested: {
    color: '#1e293b',
  },
  newBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  optionStats: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  suggestedBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  suggestedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  selectIndicator: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  selectIndicatorSuggested: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
  },
  selectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  selectTextSuggested: {
    color: colors.primary,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default StrikerSelectModal;
