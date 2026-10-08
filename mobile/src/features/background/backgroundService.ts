import BackgroundFetch, {type HeadlessEvent} from 'react-native-background-fetch';
import {
  getBackgroundMonitorState,
  recordBackgroundNotification,
  recordBackgroundRun,
  setBackgroundMonitorEnabled,
} from '../../storage/backgroundSettingsRepository';
import {runBackgroundMeasurement} from './backgroundMeasurement';
import {shouldNotifySevere} from './degradationRules';
import {notifySevereDegradation} from './notifications';

const activeTasks = new Map<string, AbortController>();
const finishedTaskIds = new Set<string>();
let configurePromise: Promise<void> | null = null;

export function finishBackgroundTask(taskId: string): void {
  // A timeout callback and the normal callback can race. The active entry owns finish().
  if (!activeTasks.has(taskId)) {
    return;
  }
  activeTasks.delete(taskId);
  finishedTaskIds.add(taskId);
  BackgroundFetch.finish(taskId);
}

export async function runBackgroundTask(taskId: string): Promise<void> {
  if (activeTasks.has(taskId)) {
    return;
  }
  finishedTaskIds.delete(taskId);
  const controller = new AbortController();
  activeTasks.set(taskId, controller);
  try {
    const state = await getBackgroundMonitorState();
    if (!state.enabled || controller.signal.aborted) {
      return;
    }
    const result = await runBackgroundMeasurement(controller.signal);
    if (result.kind !== 'completed' || controller.signal.aborted) {
      return;
    }
    await recordBackgroundRun(result.evaluation);
    if (
      shouldNotifySevere(result.evaluation, state.lastNotificationAt, Date.now()) &&
      !controller.signal.aborted &&
      await notifySevereDegradation(result.evaluation)
    ) {
      await recordBackgroundNotification();
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[qos] background check failed', error);
    }
  } finally {
    controller.abort();
    finishBackgroundTask(taskId);
  }
}

export function cancelBackgroundTask(taskId: string): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.abort();
    finishBackgroundTask(taskId);
  } else if (!finishedTaskIds.has(taskId)) {
    finishedTaskIds.add(taskId);
    BackgroundFetch.finish(taskId);
  }
}

export async function registerBackgroundTasks(): Promise<void> {
  if (configurePromise) {
    return configurePromise;
  }
  configurePromise = (async () => {
    const state = await getBackgroundMonitorState();
    if (!state.enabled) {
      configurePromise = null;
      return;
    }
    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
      },
      taskId => {runBackgroundTask(taskId).catch(() => undefined);},
      taskId => {cancelBackgroundTask(taskId);},
    );
    if (status !== BackgroundFetch.STATUS_AVAILABLE) {
      throw new Error('Background refresh unavailable');
    }
    if (!(await getBackgroundMonitorState()).enabled) {
      await BackgroundFetch.stop();
      configurePromise = null;
    }
  })().catch(async error => {
    configurePromise = null;
    await BackgroundFetch.stop().catch(() => undefined);
    throw error;
  });
  return configurePromise;
}

export async function enableBackgroundMonitoring(): Promise<void> {
  await setBackgroundMonitorEnabled(true);
  try {
    await registerBackgroundTasks();
  } catch (error) {
    await setBackgroundMonitorEnabled(false);
    throw error;
  }
}

export async function disableBackgroundMonitoring(): Promise<void> {
  await setBackgroundMonitorEnabled(false);
  for (const taskId of activeTasks.keys()) {
    cancelBackgroundTask(taskId);
  }
  await BackgroundFetch.stop();
  configurePromise = null;
}

export async function getBackgroundRefreshAvailable(): Promise<boolean> {
  return (await BackgroundFetch.status()) === BackgroundFetch.STATUS_AVAILABLE;
}

export async function backgroundFetchHeadlessTask(event: HeadlessEvent): Promise<void> {
  if (event.timeout) {
    // The native scheduler still requires finish for an already-expired headless event.
    cancelBackgroundTask(event.taskId);
    return;
  }
  await runBackgroundTask(event.taskId);
}
