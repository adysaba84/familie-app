import { API_KEY, CLIENT_ID } from './config.js';
import { getToken } from './auth.js';

// The Cloud project number is the first part of the OAuth client ID. Picker needs it as appId
// so that picking a file grants this app (drive.file) access to exactly that file.
const APP_ID = CLIENT_ID.split('-')[0];

function loadPicker() {
  return new Promise((resolve, reject) => {
    if (typeof gapi === 'undefined') { reject(new Error('gapi_missing')); return; }
    gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('picker_load_failed')) });
  });
}

// Resolves to [{id, name}] of the spreadsheets the person picked (empty if cancelled).
export async function pickSpreadsheets() {
  await loadPicker();
  const token = await getToken();
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(google.picker.DocsViewMode.LIST);
    new google.picker.PickerBuilder()
      .addView(view)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setLocale('ro')
      .setCallback((d) => {
        if (d.action === google.picker.Action.PICKED) resolve(d.docs.map((x) => ({ id: x.id, name: x.name })));
        else if (d.action === google.picker.Action.CANCEL) resolve([]);
      })
      .build()
      .setVisible(true);
  });
}
