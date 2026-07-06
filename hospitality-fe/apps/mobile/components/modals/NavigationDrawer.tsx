import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import {
  Home as HomeIcon,
  FileText,
  CheckCircle,
  AlertCircle,
  Package,
  BarChart2,
  Users,
  AlertTriangle,
  Settings,
  Bot,
  LogOut
} from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';

interface Props {
  visible: boolean;
  onClose: () => void;
  logout: () => void;
  incidentsCount: number;
  screenHeight: number;
}

export default function NavigationDrawer({
  visible,
  onClose,
  logout,
  incidentsCount,
  screenHeight
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const getActiveId = () => {
    if (pathname.includes('/dashboard')) return 'dashboard';
    if (pathname.includes('/documents')) return 'documents';
    if (pathname.includes('/invoice-matching')) return 'invoice-matching';
    // if (pathname.includes('/review')) return 'review';
    if (pathname.includes('/products')) return 'products';
    // if (pathname.includes('/recipes')) return 'recipes';
    // if (pathname.includes('/labor')) return 'labor';
    // if (pathname.includes('/incidents')) return 'incidents';
    if (pathname.includes('/settings')) return 'settings';
    return 'dashboard';
  };

  const activeId = getActiveId();

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, route: '/(tabs)/dashboard' },
    { id: 'documents', label: 'Documents', icon: FileText, badge: 1, route: '/(tabs)/documents' },
    // { id: 'invoice-matching', label: 'OCR Matching', icon: CheckCircle, route: '/invoice-matching' },
    // { id: 'review', label: 'Review Center', icon: AlertCircle, badge: incidentsCount, route: '/(tabs)/review' },
    { id: 'products', label: 'Extracted Items', icon: Package, route: '/products' },
    // { id: 'recipes', label: 'Recipes Board', icon: BarChart2, route: '/(tabs)/recipes' },
    // { id: 'labor', label: 'Staff & Labor', icon: Users, route: '/labor' },
    // { id: 'incidents', label: 'Incidents Board', icon: AlertTriangle, route: '/incidents' },
    { id: 'settings', label: 'Settings', icon: Settings, route: '/settings' }
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          height: screenHeight,
          width: '100%',
          backgroundColor: 'rgba(21,21,21,0.5)',
          flexDirection: 'row'
        }}
      >
        <View
          style={{
            width: '75%',
            backgroundColor: '#151515',
            height: '100%',
            padding: 20,
            paddingTop: 48,
            justifyContent: 'space-between'
          }}
        >
          <View>
            {/* Header inside drawer */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.1)',
                paddingBottom: 16,
                marginBottom: 16
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: '#1f8f5c',
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bot size={18} color="#ffffff" />
              </View>
              <View>
                <Text
                  style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', fontFamily: 'Sora' }}
                >
                  Hospitality Elite
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: 2,
                    fontFamily: 'Sora'
                  }}
                >
                  Decision Intelligence
                </Text>
              </View>
            </View>

            {/* Navigation lists */}
            <ScrollView style={{ gap: 4 }} showsVerticalScrollIndicator={false}>
              {navigationItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    router.push(item.route as any);
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: activeId === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    marginBottom: 4
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <item.icon
                      size={16}
                      color={activeId === item.id ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: activeId === item.id ? '#ffffff' : 'rgba(255,255,255,0.6)',
                        fontFamily: 'Sora'
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {item.badge != null && item.badge > 0 && (
                    <View
                      style={{
                        backgroundColor: '#1f8f5c',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 10
                      }}
                    >
                      <Text
                        style={{
                          color: '#ffffff',
                          fontSize: 9,
                          fontWeight: '700',
                          fontFamily: 'Sora'
                        }}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Logout button at the bottom of the drawer */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              logout();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.1)',
              paddingTop: 16
            }}
          >
            <LogOut size={16} color="#b23a3a" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#b23a3a', fontFamily: 'Sora' }}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dismiss space on the right of the drawer */}
        <TouchableOpacity onPress={onClose} style={{ width: '25%', height: '100%' }} />
      </View>
    </Modal>
  );
}
