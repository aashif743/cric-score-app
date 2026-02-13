import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { colors } from '../utils/theme';

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

                {/* Name and Stats */}
                <View style={styles.optionInfo}>
                  <Text style={[
                    styles.optionName,
                    batsman.isSuggested && styles.optionNameSuggested,
                  ]} numberOfLines={2}>
                    {batsman.name}
                  </Text>
                  <Text style={styles.optionStats}>
                    {batsman.isNew ? 'Coming in to bat' : `${batsman.runs} runs (${batsman.balls} balls)`}
                  </Text>
                </View>

                {/* Checkmark for suggested */}
                {batsman.isSuggested && (
                  <View style={styles.checkContainer}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Info text */}
          <Text style={styles.infoText}>
            Tap to select the next striker
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
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  optionCardSuggested: {
    backgroundColor: '#f0f9ff',
    borderColor: colors.primary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSuggested: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  avatarTextSuggested: {
    color: '#ffffff',
  },
  optionInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
  },
  optionNameSuggested: {
    color: '#1e293b',
  },
  optionStats: {
    fontSize: 13,
    color: '#64748b',
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default StrikerSelectModal;
