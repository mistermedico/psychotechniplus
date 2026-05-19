import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Modal,
  TextInput, Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

export interface AdminImagePickerProps {
  imageUri: string;
  onImageChange: (uri: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function AdminImagePicker({
  imageUri,
  onImageChange,
  placeholder = 'תמונה לשאלה',
  compact = false,
}: AdminImagePickerProps) {
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const boxHeight = compact ? 100 : 180;
  const imageHeight = compact ? 90 : 160;

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('הרשאה נדרשת', 'נא לאפשר גישה לגלריה בהגדרות האפליקציה');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onImageChange(result.assets[0].uri);
    }
  };

  const handlePasteUrl = () => {
    setUrlInput('');
    setUrlModalVisible(true);
  };

  const handleConfirmUrl = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onImageChange(trimmed);
    }
    setUrlModalVisible(false);
    setUrlInput('');
  };

  const handleRemove = () => {
    onImageChange('');
  };

  return (
    <View>
      {/* Image box */}
      <View style={[styles.imageBox, { height: boxHeight }, !imageUri && styles.imageBoxEmpty]}>
        {imageUri ? (
          <>
            <Image
              source={{ uri: imageUri }}
              style={[styles.image, { height: imageHeight }]}
              resizeMode="contain"
            />
            {/* Remove button */}
            <Pressable onPress={handleRemove} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContent}>
            <Text style={styles.emptyIcon}>📷</Text>
            {!compact && (
              <Text style={styles.emptyPlaceholder}>{placeholder}</Text>
            )}
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={[styles.btnRow, compact && styles.btnRowCompact]}>
        <Pressable onPress={handlePickFromLibrary} style={[styles.actionBtn, styles.galleryBtn]}>
          <Text style={styles.galleryBtnText}>
            {compact ? '📷' : '📷 בחר מגלריה'}
          </Text>
        </Pressable>
        <Pressable onPress={handlePasteUrl} style={[styles.actionBtn, styles.urlBtn]}>
          <Text style={styles.urlBtnText}>
            {compact ? '🔗' : '🔗 הדבק קישור'}
          </Text>
        </Pressable>
        {imageUri ? (
          <Pressable onPress={handlePickFromLibrary} style={[styles.actionBtn, styles.replaceBtn]}>
            <Text style={styles.replaceBtnText}>
              {compact ? '✏️' : '✏️ החלף'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* URL input modal */}
      <Modal
        visible={urlModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUrlModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setUrlModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => { /* stop propagation */ }}>
            <Text style={styles.modalTitle}>הדבק קישור לתמונה</Text>
            <TextInput
              style={styles.modalInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textAlign="left"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => { setUrlModalVisible(false); setUrlInput(''); }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>ביטול</Text>
              </Pressable>
              <Pressable onPress={handleConfirmUrl} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>אישור</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  imageBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    marginBottom: 8,
  },
  imageBoxEmpty: {
    borderColor: Colors.border,
  },
  image: {
    width: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  removeBtnText: {
    color: '#fff',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
  },
  emptyContent: {
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyPlaceholder: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  btnRowCompact: {
    gap: 4,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  galleryBtn: {
    backgroundColor: Colors.primaryLighter,
    borderColor: Colors.primary,
  },
  galleryBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  urlBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.border,
  },
  urlBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  replaceBtn: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
  },
  replaceBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    ...Shadow.lg,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#fff',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
