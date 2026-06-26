import React from 'react';
import { ScrollView } from 'react-native';
import RecipesBoardScreen from '../../components/screens/RecipesBoardScreen';

export default function RecipesTab() {
  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, marginTop: 12, marginBottom: 84 }} showsVerticalScrollIndicator={false}>
      <RecipesBoardScreen />
    </ScrollView>
  );
}
