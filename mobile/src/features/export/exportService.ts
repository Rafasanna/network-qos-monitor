import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';

import {getMeasurementsForExport} from '../../storage/measurementRepository';
import {exportFileName, serializeMeasurementsCsv, serializeMeasurementsJson} from './serialization';
import type {ExportFormat} from './serialization';

/** The caller supplies exactly the IDs visible after applying History filters. */
export async function shareMeasurements(format: ExportFormat, visibleIds: string[]): Promise<void> {
  if (visibleIds.length === 0) {
    throw new Error('NO_MEASUREMENTS');
  }
  const items = await getMeasurementsForExport(visibleIds);
  if (items.length === 0) {
    throw new Error('NO_MEASUREMENTS');
  }
  const now = new Date();
  const fileName = exportFileName(format, now);
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  const content = format === 'csv'
    ? '\uFEFF' + serializeMeasurementsCsv(items)
    : serializeMeasurementsJson(items, now.toISOString());
  await ReactNativeBlobUtil.fs.writeFile(path, content, 'utf8');
  await Share.open({
    title: 'Exportar mediciones de red',
    url: `file://${path}`,
    type: format === 'csv' ? 'text/csv' : 'application/json',
    filename: fileName,
    failOnCancel: false,
  });
}
