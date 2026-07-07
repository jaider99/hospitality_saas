import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  style?: StyleProp<ViewStyle>;
}

export default function Badge({ label, variant = 'default', style }: BadgeProps) {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: '#e6f4ec', text: '#1f8f5c' };
      case 'warning':
        return { bg: '#fbf1dd', text: '#b07a1a' };
      case 'danger':
        return { bg: '#fceaea', text: '#b23a3a' };
      case 'info':
        return { bg: '#eef2ff', text: '#4f46e5' };
      default:
        return { bg: '#f1f0ec', text: '#8c8c89' };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        {
          backgroundColor: colors.bg,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: colors.text,
          textTransform: 'uppercase',
          fontFamily: 'Sora',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
