import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../utils/theme';
import uploadService from '../utils/uploadService';

// A small, deterministic colour for a team's initials badge so the same team
// always gets the same tint (used as the fallback when no logo is uploaded).
const BADGE_COLORS = ['#4f46e5', '#0891b2', '#db2777', '#ea580c', '#16a34a', '#7c3aed', '#dc2626', '#0d9488'];
export const colorForName = (name) => {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return BADGE_COLORS[h % BADGE_COLORS.length];
};
export const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Reusable crest display: shows the uploaded logo, or a coloured initials badge
// when there's none. Used both inside LogoPicker and standalone across screens
// (cards, points table, scorecards) so a missing logo never looks broken.
export const TeamCrest = ({ uri, name, size = 40, square = false }) => {
  const radius = square ? size * 0.18 : size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#fff' }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colorForName(name), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{initialsOf(name)}</Text>
    </View>
  );
};

// Tappable logo picker. Pick from the library → upload → report the hosted URL
// back via onChange. Shows a spinner while uploading and a remove (×) button
// once a logo exists.
const LogoPicker = ({ value, onChange, token, folder = 'tournament', name = '', size = 56, label, square = false }) => {
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    if (uploading) return;
    try {
      // Use the OS system photo picker directly — it needs no runtime permission
      // on iOS (PHPicker) or Android (Photo Picker). We intentionally do NOT call
      // requestMediaLibraryPermissionsAsync: the READ_MEDIA_* permissions are
      // blocked in app.json (to stay clear of Google Play's photo-access policy),
      // so requesting them would be auto-denied and the picker would never open.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      const url = await uploadService.uploadImage(result.assets[0].uri, folder, token);
      if (!url) throw new Error('No URL returned');
      onChange && onChange(url);
    } catch (e) {
      Alert.alert('Upload failed', e?.error || e?.message || 'Could not upload the image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const radius = square ? size * 0.18 : size / 2;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity activeOpacity={0.8} onPress={pick} disabled={uploading} style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
        {uploading ? (
          <ActivityIndicator color={colors.primary} />
        ) : value ? (
          <Image source={{ uri: value }} style={{ width: size, height: size, borderRadius: radius }} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[styles.plus, { fontSize: size * 0.42 }]}>＋</Text>
          </View>
        )}
      </TouchableOpacity>

      {value && !uploading ? (
        <TouchableOpacity style={styles.remove} onPress={() => onChange && onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      ) : null}

      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  frame: {
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: colors.primaryLight, borderWidth: 2, borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  plus: { color: colors.primary, fontWeight: '700', lineHeight: undefined },
  remove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  removeText: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 18 },
  label: { marginTop: 6, fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});

export default LogoPicker;
