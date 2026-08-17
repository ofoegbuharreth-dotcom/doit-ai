import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import type { Goal, Task } from '@/types';
import { NEXT_ACTION_STORAGE_KEY, NEXT_ACTION_WIDGET_NAME, NextActionWidget, type NextActionWidgetData } from '@/widgets/NextActionWidget';

export async function syncNextActionWidget(task?: Task, goal?: Goal) {
  if (Platform.OS !== 'android') return;
  const data: NextActionWidgetData | undefined = task ? { taskId: task.id, title: task.title, goal: goal?.title, minutes: task.estimatedMinutes } : undefined;
  if (data) await AsyncStorage.setItem(NEXT_ACTION_STORAGE_KEY, JSON.stringify(data));
  else await AsyncStorage.removeItem(NEXT_ACTION_STORAGE_KEY);
  await requestWidgetUpdate({ widgetName: NEXT_ACTION_WIDGET_NAME, renderWidget: () => <NextActionWidget data={data} /> });
}
