import React from 'react';
import SettingsView from './SettingsView';
import { getRestaurantAction, getUsersAction } from './actions';

export default async function SettingsPage() {
  // Pre-fetch the initial restaurant and team members details on the server
  let initialRestaurant = null;
  let initialUsers = { items: [], total: 0, page: 1, limit: 5, pages: 0 };

  try {
    initialRestaurant = await getRestaurantAction();
  } catch (e) {
    console.warn('Could not pre-fetch restaurant details on server. Initializing with fallback.', e);
  }

  try {
    initialUsers = await getUsersAction({ page: 1, limit: 5 });
  } catch (e) {
    console.warn('Could not pre-fetch team members on server. Initializing with empty list.', e);
  }

  return (
    <SettingsView
      initialRestaurant={initialRestaurant}
      initialUsers={initialUsers}
    />
  );
}
