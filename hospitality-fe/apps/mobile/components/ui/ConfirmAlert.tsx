import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import Button from './Button';

interface ConfirmAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'success';
}

export default function ConfirmAlert({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  variant = 'danger',
}: ConfirmAlertProps) {
  // Auto-detect success title
  const isSuccess = variant === 'success' || /success|saved|uploaded/i.test(title);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.alertBox}>
          <View style={styles.iconContainer}>
            {isSuccess ? (
              <View style={[styles.iconCircle, { backgroundColor: '#e6f4ec', borderColor: '#a7f3d0' }]}>
                <CheckCircle2 size={24} color="#1f8f5c" />
              </View>
            ) : (
              <View style={[styles.iconCircle, { backgroundColor: '#fceaea', borderColor: '#fecaca' }]}>
                <AlertTriangle size={24} color="#b23a3a" />
              </View>
            )}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {onCancel ? (
              <Button
                title={cancelText}
                onPress={onCancel}
                variant="secondary"
                style={styles.button}
              />
            ) : null}
            <Button
              title={confirmText}
              onPress={onConfirm}
              variant={isSuccess ? 'primary' : 'danger'}
              style={[styles.button, !onCancel && { flex: 1 }]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 21, 21, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e1dd',
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#151515',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#151515',
    marginBottom: 8,
    fontFamily: 'Sora',
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    color: '#8c8c89',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Sora',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
  },
});
