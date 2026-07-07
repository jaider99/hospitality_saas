import React from 'react';
import { TouchableOpacity, Text, ViewStyle, TextStyle, ActivityIndicator, StyleProp } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const getStyles = () => {
    let backgroundColor = '#151515';
    let textColor = '#ffffff';
    let borderWidth = 0;
    let borderColor = 'transparent';

    if (variant === 'secondary') {
      backgroundColor = '#ffffff';
      textColor = '#151515';
      borderWidth = 1;
      borderColor = '#e2e1dd';
    } else if (variant === 'danger') {
      backgroundColor = '#b23a3a';
      textColor = '#ffffff';
    }

    if (disabled) {
      backgroundColor = variant === 'secondary' ? '#ffffff' : '#e2e1dd';
      textColor = '#8c8c89';
      if (variant === 'secondary') {
        borderColor = '#f1f0ec';
      }
    }

    return { backgroundColor, textColor, borderWidth, borderColor };
  };

  const { backgroundColor, textColor, borderWidth, borderColor } = getStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          backgroundColor,
          borderWidth,
          borderColor,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} style={{ marginRight: 8 }} />
      ) : null}
      <Text style={{ color: textColor, fontWeight: '600', fontSize: 13, fontFamily: 'Sora' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}
