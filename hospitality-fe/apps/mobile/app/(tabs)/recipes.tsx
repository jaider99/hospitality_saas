import React from 'react';
import { View } from 'react-native';
import RecipesBoardScreen from '../../components/screens/RecipesBoardScreen';

export default function RecipesTab() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, marginTop: 12, marginBottom: 84 }}>
      <RecipesBoardScreen />
    </View>
  );
}
