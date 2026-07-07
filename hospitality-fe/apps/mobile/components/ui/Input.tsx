import React from 'react';
import { View, TextInput, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';

interface InputProps {
  value: string;
  onChangeText?: (text: string) => void;
  label?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'numeric' | 'email-address' | 'phone-pad';
  error?: string | null;
  style?: StyleProp<ViewStyle>;
  editable?: boolean;
}

export default function Input({
  value,
  onChangeText,
  label,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  style,
  editable = true,
}: InputProps) {
  return (
    <View style={[{ marginBottom: 12, width: '100%' }, style]}>
      {label ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#8c8c89', marginBottom: 4, fontFamily: 'Sora', textTransform: 'uppercase' }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8c8c89"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        style={{
          backgroundColor: editable ? '#ffffff' : '#f5f4f1',
          borderWidth: 1,
          borderColor: error ? '#b23a3a' : '#e2e1dd',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 13,
          color: editable ? '#151515' : '#8c8c89',
          fontFamily: 'Sora',
        }}
      />
      {error ? (
        <Text style={{ fontSize: 11, color: '#b23a3a', marginTop: 4, fontFamily: 'Sora' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
