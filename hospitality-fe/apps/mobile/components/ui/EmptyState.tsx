import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionTitle?: string;
  onActionPress?: () => void;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  actionTitle,
  onActionPress,
  icon,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onActionPress ? (
        <Button title={actionTitle} onPress={onActionPress} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e1dd',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginVertical: 16,
  },
  iconContainer: {
    marginBottom: 12,
    opacity: 0.6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#151515',
    marginBottom: 4,
    fontFamily: 'Sora',
    textAlign: 'center',
  },
  description: {
    fontSize: 11,
    color: '#8c8c89',
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: 'Sora',
    marginBottom: 16,
  },
  button: {
    minWidth: 120,
  },
});
