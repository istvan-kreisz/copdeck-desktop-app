import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import {
	nodeAPI,
	promiseAllSkippingErrors,
	isOlderThan,
	itemBestPrice,
	didFailToFetchAllStorePrices,
} from '@istvankreisz/copdeck-scraper';
import { assert, string, is, boolean } from 'superstruct';
import { APIConfig, Item, PriceAlert } from '@istvankreisz/copdeck-scraper/dist/types';
import { databaseCoordinator } from './databaseCoordinator';
import { Settings, SettingsSchema } from '../src/utils/types';
import { parse } from '../src/utils/proxyparser';
import { log } from '../src/utils/logger';
const { ipcMain, Notification, shell } = require('electron');
const cron = require('node-cron');
const { autoUpdater } = require('electron-updater');

let cacheTask: any;
let refreshPricesTask: any;
let refreshExchangeRatesTask: any;

const minUpdateInterval = 5;
const maxUpdateInterval = 1440;
const requestDelayMax = 1000;

const {
	getAlertsWithItems,
	getItems,
	getItemWithId,
	getAlerts,
	getSettings,
	getExchangeRates,
	listenToSettingsChanges,
	updateItem,
	saveItems,
	updateItems,
	saveAlert,
	saveSettings,
	saveExchangeRates,
	deleteAlert,
	clearItemCache,
	updateLastNotificationDateForAlerts,
} = databaseCoordinator();

let mainWindow: BrowserWindow | null | undefined;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 380,
		height: 608,
		show: false,
		resizable: !app.isPackaged,
		title: 'CopDeck',
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			preload: path.join(__dirname, 'preload.js'),
			nativeWindowOpen: true,
		},
	});

	mainWindow.setSize(380, mainWindow.getSize()[1] - mainWindow.getContentSize()[1] + 580);

	if (!app.isPackaged) {
		mainWindow.loadURL('http://localhost:3000/index.html');
	} else {
		mainWindow.loadURL(`file://${__dirname}/../index.html`);
	}

	if (!process.mas) {
		app.requestSingleInstanceLock();
	}

	// Hot Reloading
	if (!app.isPackaged) {
		require('electron-reload')(__dirname, {
			electron: path.join(
				__dirname,
				'..',
				'..',
				'node_modules',
				'.bin',
				'electron' + (process.platform === 'win32' ? '.cmd' : '')
			),
			forceHardReset: false,
			hardResetMethod: 'exit',
		});
	}

	if (!app.isPackaged) {
		mainWindow.webContents.openDevTools({ activate: false, mode: 'bottom' });
	}
	mainWindow.removeMenu();
}

app.whenReady().then(() => {

	// if (BrowserWindow.getAllWindows().length === 0) {
	createWindow();
	// }

	app.on('second-instance', () => {
		if (mainWindow && !!app.isPackaged) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}
			mainWindow.focus();
		}
	});

	app.on('before-quit', () => {
		cacheTask?.stop();
		refreshPricesTask?.stop();
		refreshExchangeRatesTask?.stop();
	});

	app.on('activate', () => {
		logDev('activated');
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
		mainWindow?.show();
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	mainWindow?.on('ready-to-show', () => {
        	autoUpdater.checkForUpdatesAndNotify();
			autoUpdater.logger = require('electron-log');
			autoUpdater.logger.transports.file.level = 'info';

		// mainWindow?.focus();
		if (app.isPackaged) {
			mainWindow?.show();
		}
	});

	mainWindow?.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	setupServices();
});

/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////

const logDev = (val) => {
	log(val, !app.isPackaged);
};

const clearCache = async () => {
	try {
		clearItemCache();
	} catch (err) {
		log(err, true);
	}
};

const refreshExchangeRates = async () => {
	const settings = getSettings();

	try {
		const rates = await nodeAPI.getExchangeRates(apiConfig(settings, !app.isPackaged));
		saveExchangeRates(rates);
		logDev('refreshed exchange rates');
		logDev(rates);
	} catch (err) {
		logDev(err);
	}
};

const apiConfig = (settings: Settings, dev: boolean): APIConfig => {
	return {
		currency: settings.currency,
		isLoggingEnabled: !app.isPackaged,
		proxies: settings.proxies,
	};
};

const shouldUpdateItem = (item: Item, updateInterval: number): boolean => {
	const lastUpdated = item.updated;
	return (!!lastUpdated && isOlderThan(lastUpdated, updateInterval, 'minutes')) || !lastUpdated;
};

const updatePrices = async (forced: boolean = false) => {
	try {
		const [settings, savedAlerts, savedItems] = [getSettings(), getAlerts(), getItems()];

		// delete items without alerts
		const activeItems = savedItems.filter((item) =>
			savedAlerts.find((alert) => alert.itemId === item.id)
		);
		if (activeItems.length !== savedItems.length) {
			saveItems(activeItems);
		}
		logDev('refreshing prices');

		// refresh items
		const result = await promiseAllSkippingErrors(
			activeItems.map((item) => {
				if (forced || shouldUpdateItem(item, settings.updateInterval)) {
					return new Promise<Item>((resolve, reject) => {
						const delay = Math.random() * requestDelayMax;
						setTimeout(() => {
							nodeAPI
								.getItemPrices(item, apiConfig(settings, !app.isPackaged))
								.then((result) => {
									resolve(result);
								})
								.catch((err) => {
									reject(err);
								});
						}, delay);
					});
				} else {
					return Promise.reject();
				}
			})
		);

		const items = result.filter((item) => item.storePrices && item.storePrices.length);
		if (items && items.length) {
			updateItems(items);
			logDev(`refreshed ${items.length} items`);
		}
	} catch (err) {
		console.log(err);
	}
};

const fetchAndSave = async (item: Item) => {
	const settings = getSettings();
	const newItem = await nodeAPI.getItemPrices(item, apiConfig(settings, !app.isPackaged));
	updateItem(newItem, !app.isPackaged);
	return newItem;
};

const getItemDetails = async (item: Item, forceRefresh: boolean) => {
	try {
		const [savedItem, settings] = [getItemWithId(item.id), getSettings()];

		if (savedItem) {
			if (
				didFailToFetchAllStorePrices(savedItem) ||
				shouldUpdateItem(savedItem, settings.updateInterval) ||
				forceRefresh
			) {
				logDev('fetching new 1');
				return fetchAndSave(savedItem);
			} else {
				logDev('returning saved');
				return savedItem;
			}
		} else {
			logDev('fetching new 2');
			return fetchAndSave(item);
		}
	} catch (err) {
		logDev('fetching new 3');
		return fetchAndSave(item);
	}
};

const sendNotifications = async () => {
	try {
		const [alerts, settings] = [getAlertsWithItems(), getSettings()];
		logDev('sending notifications');

		const alertsFiltered = alerts
			.filter(([alert, item]) => {
				if (alert.lastNotificationSent) {
					return isOlderThan(
						alert.lastNotificationSent,
						settings.notificationFrequency,
						'hours'
					);
				} else {
					return true;
				}
			})
			.filter(([alert, item]) => {
				const bestPrice = itemBestPrice(item, alert);

				if (bestPrice) {
					if (alert.targetPriceType === 'below') {
						if (bestPrice < alert.targetPrice) {
							return true;
						} else {
							return false;
						}
					} else {
						if (bestPrice > alert.targetPrice) {
							return true;
						} else {
							return false;
						}
					}
				} else {
					return false;
				}
			});

		alertsFiltered.forEach(([alert, item]) => {
			const bestPrice = itemBestPrice(item, alert);
			logDev('notification sent');
			logDev(alert);

			new Notification({
				title: 'CopDeck Price Alert!',
				body: `${item.name} price ${
					alert.targetPriceType === 'above' ? 'went above' : 'dropped below'
				} ${settings.currency.symbol}${alert.targetPrice}! Current best price: ${
					settings.currency.symbol
				}${bestPrice}`,
			}).show();
		});

		updateLastNotificationDateForAlerts(alertsFiltered.map(([alert, item]) => alert));
	} catch (err) {
		console.log(err);
	}
};

function setupMessageListeners() {
	ipcMain.on('search', (event, searchTerm) => {
		(async () => {
			try {
				assert(searchTerm, string());
				const settings = getSettings();
				log('searching', !app.isPackaged);
				const items = await nodeAPI.searchItems(
					searchTerm,
					apiConfig(settings, !app.isPackaged)
				);
				event.reply('search', items);
			} catch (err) {
				event.reply('search', []);
				console.log(err);
			}
		})();
	});

	ipcMain.on('getItemDetails', (event, msg) => {
		(async () => {
			try {
				const item = msg.item;
				const forceRefresh = msg.forceRefresh;
				assert(item, Item);
				assert(forceRefresh, boolean());
				const itemWithPrices = await getItemDetails(item, forceRefresh);
				event.reply('getItemDetails', itemWithPrices);
			} catch (err) {
				event.reply('getItemDetails', undefined);
				console.log(err);
			}
		})();
	});

	ipcMain.on('alertsWithItems', (event, msg) => {
		try {
			const alertsWithItems = getAlertsWithItems();
			event.reply('alertsWithItems', alertsWithItems);
		} catch (err) {
			event.reply('alertsWithItems', []);
			console.log(err);
		}
	});

	ipcMain.on('deleteAlert', (event, alert) => {
		try {
			if (is(alert, PriceAlert)) {
				deleteAlert(alert);
			}
		} catch (err) {
			console.log(err);
		}
	});

	ipcMain.on('settings', (event, msg) => {
		try {
			const settings = msg.settings;
			const proxyString = msg.proxyString;
			assert(settings, SettingsSchema);
			assert(proxyString, string());

			let proxyParseError;
			if (proxyString) {
				try {
					settings.proxies = parse(proxyString);
				} catch (err) {
					settings.proxies = [];
					proxyParseError = err['message'] ?? 'Invalid proxy format';
					log('proxy error', !app.isPackaged);
					log(err, !app.isPackaged);
				}
			}
			if (settings.updateInterval < minUpdateInterval) {
				settings.updateInterval = minUpdateInterval;
			} else if (settings.updateInterval > maxUpdateInterval) {
				settings.updateInterval = maxUpdateInterval;
			}
			saveSettings(settings);
			event.reply('settings', proxyParseError);
		} catch (err) {
			console.log(err);
			event.reply('settings', err);
		}
	});

	ipcMain.on('saveAlert', (event, msg) => {
		try {
			const item = msg.item;
			const alert = msg.alert;
			assert(alert, PriceAlert);
			assert(item, Item);

			saveAlert(alert, item);
		} catch (err) {
			console.log(err);
		}
		event.reply('refresh', {});
	});

	ipcMain.on('refresh', (event) => {
		(async () => {
			try {
				await updatePrices();
			} catch (err) {
				console.log(err);
			}
			event.reply('refresh', {});
		})();
	});

	ipcMain.on('getExchangeRates', (event, arg) => {
		const rates = getExchangeRates();
		event.returnValue = rates;
	});

	ipcMain.on('saveSettings', (event, msg) => {
		const settings = msg.settings;
		const proxyString = msg.proxyString;
		assert(settings, SettingsSchema);
		assert(proxyString, string());

		let proxyParseError;
		if (proxyString) {
			try {
				settings.proxies = parse(proxyString);
			} catch (err) {
				settings.proxies = [];
				proxyParseError = err['message'] ?? 'Invalid proxy format';
				log('proxy error', true);
				log(err, true);
			}
		}
		if (settings.updateInterval < minUpdateInterval) {
			settings.updateInterval = minUpdateInterval;
		} else if (settings.updateInterval > maxUpdateInterval) {
			settings.updateInterval = maxUpdateInterval;
		}
		saveSettings(settings);
		event.reply('saveSettings', proxyParseError);
	});

	ipcMain.on('getSettings', (event, msg) => {
		const settings = getSettings();
		mainWindow?.webContents.send('settingsUpdated', settings);
	});

	listenToSettingsChanges((settingsOld, settingsNew) => {
		if (
			settingsNew &&
			settingsOld &&
			is(settingsNew, SettingsSchema) &&
			is(settingsOld, SettingsSchema)
		) {
			if (settingsOld.currency.code !== settingsNew.currency.code) {
				updatePrices(true);
			}
			if (settingsOld.updateInterval !== settingsNew.updateInterval) {
				addRefreshPricesAlarm(true);
			}
			mainWindow?.webContents.send('settingsUpdated', settingsNew);
		}
	});
}

function addRefreshPricesAlarm(forced: boolean = false) {
	const settings = getSettings();
	if (forced || !refreshPricesTask) {
		refreshPricesTask?.stop();
		logDev('refreshed price alarm');
		refreshPricesTask = cron.schedule(`*/${settings.updateInterval} * * * *`, () => {
			(async () => {
				await updatePrices();
				await sendNotifications();
			})();
		});
	}
}

function setupAlarms() {
	addRefreshPricesAlarm();
	cacheTask = cron.schedule(`* */300 * * *`, () => {
		(async () => {
			await clearCache();
		})();
	});

	refreshExchangeRatesTask = cron.schedule(`*/720 * * * *`, () => {
		(async () => {
			await refreshExchangeRates();
		})();
	});
}

function setupServices() {
	setupMessageListeners();
	setupAlarms();

	(async () => {
		await refreshExchangeRates();
		await updatePrices();
		await sendNotifications();
	})();
}

// todo: add warning to landing page about unrecognized developer
// todo: rewrite ip block texts
// update ui with long prices
// add more guide to download page - keep app in bg
// remove noode modules from history

// checks
// todo: check proxies

// todo: nice to have
// // add goat bid
// // add proxy toggle
// // change goat currency
// todo: add country selector to settings?
