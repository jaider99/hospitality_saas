import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Bot, X, Volume2, Send, Mic } from 'lucide-react-native';
import { ChatMsg } from '../../constants/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  chatHistory: ChatMsg[];
  chatInput: string;
  setChatInput: (text: string) => void;
  isListening: boolean;
  isPlayingIdx: number | null;
  setIsPlayingIdx: (idx: number | null) => void;
  handleChatSend: (text?: string) => void;
  handleMicPress: () => void;
  screenHeight: number;
}

export default function SiriChatModal({
  visible,
  onClose,
  chatHistory,
  chatInput,
  setChatInput,
  isListening,
  isPlayingIdx,
  setIsPlayingIdx,
  handleChatSend,
  handleMicPress,
  screenHeight,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{
        height: screenHeight,
        width: '100%',
        backgroundColor: 'rgba(21,21,21,0.4)',
        justifyContent: 'flex-end',
      }}>
        {/* Backdrop Touch Handler */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <View style={{
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: '80%',
          borderWidth: 1,
          borderColor: '#e2e1dd',
          padding: 20,
          paddingBottom: 34,
          justifyContent: 'space-between',
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e1dd', paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#1f8f5c', justifyContent: 'center', alignItems: 'center' }}>
                <Bot size={16} color="#ffffff" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>AI Assistant</Text>
                <Text style={{ fontSize: 10, color: '#1f8f5c', fontWeight: '500' }}>
                  {isListening ? '● Listening...' : 'Online · RAG-powered'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, backgroundColor: '#f1f0ec', borderRadius: 8 }}>
              <X size={14} color="#151515" />
            </TouchableOpacity>
          </View>

          {/* Chat History Messages */}
          <ScrollView style={{ flex: 1, marginVertical: 12 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 12 }}>
              {chatHistory.map((m, idx) => (
                <View key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <View style={{
                    backgroundColor: m.role === 'user' ? '#f5f4f1' : '#151515',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 16,
                    borderBottomRightRadius: m.role === 'user' ? 2 : 16,
                    borderBottomLeftRadius: m.role === 'ai' ? 2 : 16
                  }}>
                    <Text style={{ color: m.role === 'user' ? '#151515' : '#ffffff', fontSize: 13, lineHeight: 18, fontFamily: 'Sora' }}>
                      {m.text}
                    </Text>
                  </View>
                  {m.role === 'ai' && m.hasPlayback && (
                    <TouchableOpacity
                      onPress={() => setIsPlayingIdx(isPlayingIdx === idx ? null : idx)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginLeft: 2 }}
                    >
                      {isPlayingIdx === idx ? (
                        <>
                          <ActivityIndicator size="small" color="#1f8f5c" />
                          <Text style={{ fontSize: 10, color: '#1f8f5c', fontWeight: '600' }}>Playing...</Text>
                        </>
                      ) : (
                        <>
                          <Volume2 size={12} color="#8c8c89" />
                          <Text style={{ fontSize: 10, color: '#8c8c89' }}>Play response</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Siri Waveform Visual Simulation */}
          {isListening && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, height: 24, alignItems: 'center', marginBottom: 8 }}>
              {[8, 20, 14, 24, 16, 22, 10, 18].map((h, i) => (
                <View key={i} style={{ width: 3, height: h, backgroundColor: '#1f8f5c', borderRadius: 2 }} />
              ))}
            </View>
          )}

          {/* Quick Suggestion Pills */}
          {!isListening && (
            <View style={{ height: 38, marginBottom: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['Spends last week?', 'Exceptions?', 'Labor ratio?', 'Carbonara costing?'].map((sug) => (
                    <TouchableOpacity key={sug} onPress={() => handleChatSend(sug)} style={{ backgroundColor: '#f1f0ec', borderWidth: 1, borderColor: '#e2e1dd', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                      <Text style={{ fontSize: 11, color: '#151515', fontFamily: 'Sora' }}>{sug}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Inputs controls */}
          <View style={{ borderTopWidth: 1, borderTopColor: '#e2e1dd', paddingTop: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#fafaf8', borderWidth: 1, borderColor: '#e2e1dd', borderRadius: 12, padding: 8, alignItems: 'center' }}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask anything about your venue..."
                placeholderTextColor="#a8a8a4"
                style={{ flex: 1, fontSize: 13, color: '#151515', paddingVertical: 4, paddingHorizontal: 4 }}
              />
              <TouchableOpacity onPress={() => handleChatSend()} style={{ backgroundColor: '#151515', padding: 8, borderRadius: 8 }}>
                <Send size={12} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleMicPress} style={{
              backgroundColor: isListening ? '#b23a3a' : '#1f8f5c',
              paddingVertical: 12,
              borderRadius: 12,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8
            }}>
              <Mic size={14} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13, fontFamily: 'Sora' }}>
                {isListening ? 'Listening...' : 'Hold to Speak (Siri)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
