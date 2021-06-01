import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import {
	browserAPI,
	promiseAllSkippingErrors,
	isOlderThan,
	itemBestPrice,
	didFailToFetchAllStorePrices,
} from 'copdeck-scraper';
import { assert, string, is, boolean } from 'superstruct';
import { ALLSTORES, APIConfig, Item, Proxy, Store } from 'copdeck-scraper/dist/types';
import { databaseCoordinator } from './databaseCoordinator';
import { Settings } from '../src/utils/types';
import { parse, pacFormat } from '../src/utils/proxyparser';
import { log } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
const { ipcMain, Notification } = require('electron');

const minUpdateInterval = 5;
const maxUpdateInterval = 1440;
const cacheAlarm = 'copdeckCacheAlarm';
const refreshPricesAlarm = 'copdeckRefreshPricesAlarm';
const refreshExchangeRatesAlarm = 'copdeckrefreshExchangeRatesAlarm';
const proxyRotationAlarm = 'copdeckProxyRotationAlarm';
const requestDelayMax = 1000;

const clearCache = async () => {
	// const { clearItemCache } = databaseCoordinator();
	try {
		// await clearItemCache();
	} catch (err) {
		log(err, true);
	}
};

// function showNotification(body: any) {
// new Notification({ title: NOTIFICATION_TITLE, body: body }).show();
// }

let mainWindow = null;

function initialize() {
	function createWindow() {
		mainWindow = new BrowserWindow({
			width: 380,
			height: 580,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				preload: path.join(__dirname, 'preload.js'),
			},
		});

		if (isDev) {
			mainWindow.loadURL('http://localhost:3000/index.html');
		} else {
			// 'build/index.html'
			mainWindow.loadURL(`file://${__dirname}/../index.html`);
		}

		// Hot Reloading
		if (isDev) {
			// 'node_modules/.bin/electronPath'
			require('electron-reload')(__dirname, {
				electron: path.join(
					__dirname,
					'..',
					'..',
					'node_modules',
					'.bin',
					'electron' + (process.platform === 'win32' ? '.cmd' : '')
				),
				forceHardReset: true,
				hardResetMethod: 'exit',
			});
		}

		if (isDev) {
			mainWindow.webContents.openDevTools();
		}
	}

	makeSingleInstance();

	app.whenReady().then(() => {
		createWindow();
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});
}

function makeSingleInstance() {
	if (process.mas) return;

	app.requestSingleInstanceLock();

	app.on('second-instance', () => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}
			mainWindow.focus();
		}
	});
}

initialize();

// ipcMain.on('search', (event, searchTerm) => {
// 	(async () => {
// 		try {
// 			assert(searchTerm, string());
// 			const { getSettings, getIsDevelopment } = databaseCoordinator();
// 			const [settings, dev] = await Promise.all([getSettings(), getIsDevelopment()]);
// 			log('searching', dev);
// 			const items = await browserAPI.searchItems(searchTerm, apiConfig(settings, dev));
// 			log('search results', dev);
// 			log(items, dev);
// 			sendResponse(items);
// 		} catch (err) {
// 			sendResponse([]);
// 			console.log(err);
// 		}
// 	})();

// 	event.sender.send('search', { a: 1 });
// });
