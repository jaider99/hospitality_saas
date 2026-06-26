import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Home as HomeIcon, BarChart2, Plus, FileText, AlertCircle } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useLayoutStore } from '../store/layout';

interface Props {
  incidentsCount: number;
}

export default function BottomNavBar({ incidentsCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { setFabOpen } = useLayoutStore();

  const getActiveTab = () => {
    if (pathname.includes('/dashboard')) return 'dashboard';
    if (pathname.includes('/recipes')) return 'recipes';
    if (pathname.includes('/documents')) return 'documents';
    if (pathname.includes('/review')) return 'review';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  return (
    <View style={{ position: 'absolute', bottom: 20, left: 16, right: 16, zIndex: 10 }}>
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: '#e2e1dd',
        shadowColor: '#151515',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10
      }}>
        
        <TouchableOpacity onPress={() => router.push('/(tabs)/dashboard')} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
          <HomeIcon size={20} color={activeTab === 'dashboard' ? '#151515' : '#8c8c89'} />
          <Text style={{ fontSize: 9, marginTop: 4, fontWeight: '600', color: activeTab === 'dashboard' ? '#151515' : '#8c8c89', fontFamily: 'Sora' }}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(tabs)/recipes')} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
          <BarChart2 size={20} color={activeTab === 'recipes' ? '#151515' : '#8c8c89'} />
          <Text style={{ fontSize: 9, marginTop: 4, fontWeight: '600', color: activeTab === 'recipes' ? '#151515' : '#8c8c89', fontFamily: 'Sora' }}>Metrics</Text>
        </TouchableOpacity>

        {/* Central absolute positioned FAB */}
        <View style={{ marginHorizontal: 8, marginTop: -24 }}>
          <TouchableOpacity onPress={() => setFabOpen(true)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#151515',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 4,
              borderColor: '#fafaf8',
              shadowColor: '#151515',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 3
            }}>
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(tabs)/documents')} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
          <FileText size={20} color={activeTab === 'documents' ? '#151515' : '#8c8c89'} />
          <Text style={{ fontSize: 9, marginTop: 4, fontWeight: '600', color: activeTab === 'documents' ? '#151515' : '#8c8c89', fontFamily: 'Sora' }}>Uploads</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(tabs)/review')} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, position: 'relative' }}>
          <AlertCircle size={20} color={activeTab === 'review' ? '#151515' : '#8c8c89'} />
          <Text style={{ fontSize: 9, marginTop: 4, fontWeight: '600', color: activeTab === 'review' ? '#151515' : '#8c8c89', fontFamily: 'Sora' }}>Alerts</Text>
          {incidentsCount > 0 && (
            <View style={{ position: 'absolute', top: 2, right: 18, width: 6, height: 6, borderRadius: 3, backgroundColor: '#b23a3a', borderWidth: 1, borderColor: '#ffffff' }} />
          )}
        </TouchableOpacity>

      </View>
    </View>
  );
}
