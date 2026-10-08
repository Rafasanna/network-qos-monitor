/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import BackgroundFetch from 'react-native-background-fetch';
import {backgroundFetchHeadlessTask} from './src/features/background/backgroundService';

AppRegistry.registerComponent(appName, () => App);
BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);
