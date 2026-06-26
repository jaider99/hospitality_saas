import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth';
import { LoginSchema } from '@hospitality-saas/validation';
import { Mail, Lock, Eye, EyeOff, AlertTriangle, Zap } from 'lucide-react-native';
import '../globals.css';

export default function LoginPage() {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);

    // 1. Client-Side Validation using Shared Zod Schema
    const result = LoginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0]?.message || 'Validation failed');
      return;
    }

    setLoading(true);
    try {
      // Set Zustand State with mock data to bypass active API check
      login({
        user: {
          id: 'demo-user-id',
          name: 'Demo Manager',
          role: 'gm',
          email: email || 'manager@venue.com',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        accessToken: 'test-token-123',
        refreshToken: 'test-refresh-123'
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#fafaf8',
        justifyContent: 'center',
        paddingHorizontal: 24
      }}
    >
      <StatusBar style="dark" />

      <View style={{ marginVertical: 20 }}>
        {/* Mobile brand header (Logo box + Title + Subtitle) */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#151515',
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}
          >
            <Zap size={22} color="#1f8f5c" />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '600',
              color: '#151515',
              fontFamily: 'Sora',
              letterSpacing: -0.5
            }}
          >
            Hospitality Elite
          </Text>
          <Text style={{ fontSize: 14, color: '#8c8c89', marginTop: 6, fontFamily: 'Sora' }}>
            Sign in to your dashboard
          </Text>
        </View>

        {/* Login form card */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#e2e1dd',
            padding: 24,
            borderRadius: 16,
            shadowColor: '#151515',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1
          }}
        >
          {/* Error Banner */}
          {error && (
            <View
              style={{
                backgroundColor: '#fceaea',
                borderColor: '#ffb4ab',
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16
              }}
            >
              <AlertTriangle size={16} color="#b23a3a" style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={{ color: '#7a2828', fontSize: 13, fontFamily: 'Sora', flex: 1 }}>
                {error}
              </Text>
            </View>
          )}

          {/* Email Address */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#151515',
                marginBottom: 8,
                fontFamily: 'Sora'
              }}
            >
              Email address
            </Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: 14, zIndex: 10 }}>
                <Mail size={16} color="#8c8c89" />
              </View>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="manager@venue.com"
                placeholderTextColor="#a8a8a4"
                autoCapitalize="none"
                keyboardType="email-address"
                style={{
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#e2e1dd',
                  borderRadius: 12,
                  paddingLeft: 44,
                  paddingRight: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: '#151515',
                  fontFamily: 'Sora'
                }}
              />
            </View>
          </View>

          {/* Password */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#151515',
                marginBottom: 8,
                fontFamily: 'Sora'
              }}
            >
              Password
            </Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: 14, zIndex: 10 }}>
                <Lock size={16} color="#8c8c89" />
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="••••••••"
                placeholderTextColor="#a8a8a4"
                autoCapitalize="none"
                style={{
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#e2e1dd',
                  borderRadius: 12,
                  paddingLeft: 44,
                  paddingRight: 44,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: '#151515',
                  fontFamily: 'Sora'
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: 14, zIndex: 10, padding: 4 }}
              >
                {showPw ? <EyeOff size={16} color="#8c8c89" /> : <Eye size={16} color="#8c8c89" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Demo & Forgot Password links */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
              marginBottom: 8
            }}
          >
            <Text style={{ fontSize: 11, color: '#8c8c89', fontFamily: 'Sora' }}>
              Demo:{' '}
              <Text style={{ fontWeight: '600', color: '#151515' }}>
                manager@venue.com / 123456
              </Text>
            </Text>
            <TouchableOpacity>
              <Text
                style={{ fontSize: 11, color: '#1f8f5c', fontFamily: 'Sora', fontWeight: '500' }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: '#151515',
              paddingVertical: 14,
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 12,
              shadowColor: '#151515',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 1,
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, fontFamily: 'Sora' }}
              >
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Enterprise footer signature */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ fontSize: 11, color: '#8c8c89', fontFamily: 'Sora' }}>
            Hospitality Elite · Enterprise Operations Platform
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
