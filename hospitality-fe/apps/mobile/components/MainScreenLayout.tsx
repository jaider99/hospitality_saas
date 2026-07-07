import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Menu, LogOut, Bot } from 'lucide-react-native';
import { useAuthStore } from '../store/auth';
import { useLayoutStore } from '../store/layout';
import BottomNavBar from './BottomNavBar';
import NavigationDrawer from './modals/NavigationDrawer';
import SiriChatModal from './modals/SiriChatModal';
import UploadSheetModal from './modals/UploadSheetModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  children: React.ReactNode;
  title: string;
}

export default function MainScreenLayout({ children, title }: Props) {
  const { logout } = useAuthStore();
  const {
    sidebarOpen, setSidebarOpen,
    chatOpen, setChatOpen,
    fabOpen, setFabOpen,
    incidents,
    chatHistory,
    chatInput, setChatInput,
    isListening,
    isPlayingIdx, setIsPlayingIdx,
    handleChatSend,
    handleMicPress
  } = useLayoutStore();

  const activeIncidentsCount = incidents.filter(i => i.status === 'open').length;

  return (
    <View style={{ flex: 1, backgroundColor: '#fafaf8', paddingTop: 48, position: 'relative' }}>
      
      {/* Top Bar Header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e1dd',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={{ padding: 6, marginRight: 8 }}>
            <Menu size={20} color="#151515" />
          </TouchableOpacity>
          <View style={{
            width: 26,
            height: 26,
            backgroundColor: '#151515',
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8
          }}>
            <Bot size={13} color="#1f8f5c" />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>{title}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setChatOpen(true)} style={{ padding: 8, backgroundColor: '#f1f0ec', borderRadius: 10, marginRight: 8 }}>
            <Bot size={16} color="#151515" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={{ padding: 8, backgroundColor: '#f1f0ec', borderRadius: 10 }}>
            <LogOut size={16} color="#b23a3a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Content */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}>
        {children}
      </View>

      {/* Slide-over left Navigation Drawer Modal */}
      <NavigationDrawer
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        logout={logout}
        incidentsCount={activeIncidentsCount}
        screenHeight={SCREEN_HEIGHT}
      />

      {/* Siri Voice Chat Overlay Modal */}
      <SiriChatModal
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        chatHistory={chatHistory}
        chatInput={chatInput}
        setChatInput={setChatInput}
        isListening={isListening}
        isPlayingIdx={isPlayingIdx}
        setIsPlayingIdx={setIsPlayingIdx}
        handleChatSend={handleChatSend}
        handleMicPress={handleMicPress}
        screenHeight={SCREEN_HEIGHT}
      />

      {/* Upload FAB SHEET Overlay Modal */}
      <UploadSheetModal
        visible={fabOpen}
        onClose={() => setFabOpen(false)}
        screenHeight={SCREEN_HEIGHT}
      />

      {/* Mobile Sticky Floating Navigation Bar */}
      {!(sidebarOpen || chatOpen || fabOpen) && (
        <BottomNavBar
          incidentsCount={activeIncidentsCount}
        />
      )}
    </View>
  );
}
