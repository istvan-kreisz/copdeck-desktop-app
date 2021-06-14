import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import {
	nodeAPI,
	promiseAllSkippingErrors,
	isOlderThan,
	itemBestPrice,
	didFailToFetchAllStorePrices,
	isCountryName,
} from '@istvankreisz/copdeck-scraper';
import { assert, string, is, boolean } from 'superstruct';
import {
	APIConfig,
	CountryName,
	ExchangeRates,
	Item,
	PriceAlert,
} from '@istvankreisz/copdeck-scraper/dist/types';
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
	incrementOpenedCount,
	getItemWithId,
	getAlerts,
	getIsFirstAlert,
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
let didIncrementOpenedCount = false;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 470,
		height: 768,
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

	mainWindow.setSize(450, mainWindow.getSize()[1] - mainWindow.getContentSize()[1] + 740);

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
		app.quit();
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
		const rates = await nodeAPI.getExchangeRates(apiConfig());
		saveExchangeRates(rates);
		logDev('refreshed exchange rates');
		logDev(rates);
	} catch (err) {
		logDev(err);
	}
};

const apiConfig = (): APIConfig => {
	const settings = getSettings();
	const exchangeRates = getExchangeRates();

	let countryName: CountryName = 'Austria';
	if (isCountryName(settings.feeCalculation.countryName)) {
		countryName = settings.feeCalculation.countryName;
	}

	return {
		currency: settings.currency,
		isLoggingEnabled: !app.isPackaged,
		proxies: settings.proxies,
		exchangeRates: exchangeRates,
		feeCalculation: { ...settings.feeCalculation, countryName: countryName },
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
								.getItemPrices(item, apiConfig())
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
	const newItem = await nodeAPI.getItemPrices(item, apiConfig());
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
					if (alert.relation === 'below') {
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
					alert.relation === 'above' ? 'went above' : 'dropped below'
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
				log('searching', !app.isPackaged);
				const items = await nodeAPI.searchItems(searchTerm, apiConfig());
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

	ipcMain.on('openedCount', (event, arg) => {
		if (!didIncrementOpenedCount) {
			didIncrementOpenedCount = true;
			const openedCount = incrementOpenedCount();
			event.returnValue = openedCount;
		}
	});

	ipcMain.on('getIsFirstAlert', (event, arg) => {
		event.returnValue = getIsFirstAlert();
	});

	ipcMain.on('saveSettings', (event, msg) => {
		const savedSettings = getSettings();
		const settings = msg.settings;
		const proxyString = msg.proxyString;
		assert(settings, SettingsSchema);
		assert(proxyString, string());

		let settingsError: { title: string; message: string } | undefined;
		if (proxyString) {
			try {
				settings.proxies = parse(proxyString);
			} catch (err) {
				settings.proxies = [];
				settingsError = {
					title: 'Error',
					message: err['message'] ?? 'Invalid proxy format',
				};
				log('proxy error', true);
				log(err, true);
			}
		}
		if (settings.updateInterval < minUpdateInterval) {
			settings.updateInterval = minUpdateInterval;
		} else if (settings.updateInterval > maxUpdateInterval) {
			settings.updateInterval = maxUpdateInterval;
		}
		if (
			settings.feeCalculation.stockx.taxes > 100 ||
			settings.feeCalculation.stockx.taxes < 0
		) {
			settings.feeCalculation.stockx.taxes = savedSettings.feeCalculation.stockx.taxes;
			settingsError = {
				title: 'Error',
				message: 'Taxes must be a number between 0 and 100.',
			};
		}
		if (settings.feeCalculation.goat.taxes > 100 || settings.feeCalculation.goat.taxes < 0) {
			settings.feeCalculation.goat.taxes = savedSettings.feeCalculation.goat.taxes;
			settingsError = {
				title: 'Error',
				message: 'Taxes must be a number between 0 and 100.',
			};
		}

		saveSettings(settings);
		event.reply('saveSettings', settingsError);
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
			if (
				settingsOld.currency.code !== settingsNew.currency.code ||
				settingsOld.feeCalculation.countryName !== settingsNew.feeCalculation.countryName ||
				settingsOld.feeCalculation.stockx.sellerLevel !==
					settingsNew.feeCalculation.stockx.sellerLevel ||
				settingsOld.feeCalculation.stockx.taxes !==
					settingsNew.feeCalculation.stockx.taxes ||
				settingsOld.feeCalculation.goat.cashOutFee !==
					settingsNew.feeCalculation.goat.cashOutFee ||
				settingsOld.feeCalculation.goat.commissionPercentage !==
					settingsNew.feeCalculation.goat.commissionPercentage ||
				settingsOld.feeCalculation.goat.taxes !== settingsNew.feeCalculation.goat.taxes
			) {
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

// todo: check proxies
// todo: add proxy toggle
