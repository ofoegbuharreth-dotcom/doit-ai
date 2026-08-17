import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type NextActionWidgetData = {
  taskId?: string;
  title: string;
  goal?: string;
  minutes?: number;
};

export const NEXT_ACTION_WIDGET_NAME = 'DoitNextAction';
export const NEXT_ACTION_STORAGE_KEY = '@doit/next-action-widget';

export function NextActionWidget({ data }: { data?: NextActionWidgetData }) {
  const hasAction = Boolean(data?.title);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: data?.taskId ? `doit://focus/${data.taskId}` : 'doit://home' }}
      style={{
        backgroundGradient: { from: '#151821', to: '#090A0C', orientation: 'TL_BR' },
        borderColor: '#292E38', borderRadius: 24, borderWidth: 1,
        flexDirection: 'column', height: 'match_parent', justifyContent: 'space-between',
        padding: 18, width: 'match_parent',
      }}
    >
      <FlexWidget style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget text="DOIT AI · TODAY" style={{ color: '#C8FF3D', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }} />
        <TextWidget text={hasAction && data?.minutes ? `${data.minutes} MIN` : 'OPEN'} style={{ color: '#8D95A3', fontSize: 11, fontWeight: '700' }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', flexGap: 4, width: 'match_parent' }}>
        <TextWidget text={hasAction ? data!.title : 'Your next move starts here'} maxLines={2} truncate="END" style={{ color: '#F5F7F8', fontSize: 19, fontWeight: '700' }} />
        <TextWidget text={data?.goal ?? 'Open DOIT AI to build today’s plan'} maxLines={1} truncate="END" style={{ color: '#A7ADB7', fontSize: 12 }} />
      </FlexWidget>
      <TextWidget text={hasAction ? 'START FOCUS  →' : 'TAP TO OPEN  →'} style={{ color: '#C8FF3D', fontSize: 11, fontWeight: '700' }} />
    </FlexWidget>
  );
}
