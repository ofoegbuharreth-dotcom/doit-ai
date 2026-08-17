import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { NEXT_ACTION_STORAGE_KEY, NEXT_ACTION_WIDGET_NAME, NextActionWidget, type NextActionWidgetData } from './NextActionWidget';

registerWidgetTaskHandler(async ({ widgetInfo, renderWidget }) => {
  if (widgetInfo.widgetName !== NEXT_ACTION_WIDGET_NAME) return;
  const stored = await AsyncStorage.getItem(NEXT_ACTION_STORAGE_KEY);
  const data = stored ? JSON.parse(stored) as NextActionWidgetData : undefined;
  renderWidget(<NextActionWidget data={data} />);
});
