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
import {
	ALLSTORES,
	APIConfig,
	Item,
	PriceAlert,
	Proxy,
	Store,
} from '@istvankreisz/copdeck-scraper/dist/types';
import { databaseCoordinator } from './databaseCoordinator';
import { Settings, SettingsSchema } from '../src/utils/types';
import { parse } from '../src/utils/proxyparser';
import { log } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
const { ipcMain, Notification, shell } = require('electron');
const cron = require('node-cron');

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
	// createWindow();
	// // if (BrowserWindow.getAllWindows().length === 0) {
	// // 	createWindow();
	// // }

	// app.on('activate', () => {
	// 	if (BrowserWindow.getAllWindows().length === 0) {
	// 		createWindow();
	// 	}
	// });

	// mainWindow?.webContents.on('new-window', function (event, url) {
	// 	event.preventDefault();
	// 	open(url);
	// });

	// app.on('second-instance', () => {
	// 	if (mainWindow && !!app.isPackaged) {
	// 		if (mainWindow.isMinimized()) {
	// 			mainWindow.restore();
	// 		}
	// 		mainWindow.focus();
	// 	}
	// });

	// app.on('before-quit', () => {
	// 	cacheTask?.stop();
	// 	refreshPricesTask?.stop();
	// 	refreshExchangeRatesTask?.stop();
	// });

	createWindow();

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

	mainWindow?.on('ready-to-show', () => {
		mainWindow?.show();
		mainWindow?.focus();
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
	} catch (err) {
		log(err, !app.isPackaged);
	}
};

const apiConfig = (settings: Settings, dev: boolean): APIConfig => {
	return {
		currency: settings.currency,
		isLoggingEnabled: dev,
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
				log('fetching new 1', !app.isPackaged);
				return fetchAndSave(savedItem);
			} else {
				log('returning saved', !app.isPackaged);
				return savedItem;
			}
		} else {
			log('fetching new 2', !app.isPackaged);
			return fetchAndSave(item);
		}
	} catch (err) {
		log('fetching new 3', true);
		return fetchAndSave(item);
	}
};

const sendNotifications = async () => {
	try {
		const [alerts, settings] = [getAlertsWithItems(), getSettings()];

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
			log('notification sent', !app.isPackaged);
			log(alert, !app.isPackaged);

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

// // add goat bid
// // add proxy toggle
// // change goat currency
// // Cookie: _csrf=lKuDAaP8CZOqw-LoxVrr2y5Z; csrf=xQDiRJay-RiSSEinY5fgM631qqcCElyVhLAs; _sneakers_session=v89yqHWNt2U3vHU2Rls%2F%2B0Nb66XdCEAQNBwOVGDxBx6kVnDDtALbhmo9KwDph1EISUTlerOAefWW%2FWpUuq7N--EjpYsea%2BbyqFTy3b--r7Y9SJYqJsSoxqkVP64HeA%3D%3D; ConstructorioID_client_id=e9866fda-fd26-4f06-8e18-b31e22d1ee0b; currency=JPY; OptanonConsent=isIABGlobal=false&datestamp=Sun+May+30+2021+12%3A09%3A31+GMT%2B0200+(Central+European+Summer+Time)&version=6.12.0&hosts=&consentId=ae7c1734-b0a0-4e58-b815-38e294f6e206&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A0%2CC0002%3A0%2CC0004%3A0; __stripe_mid=dca3168b-fbcc-428a-9214-4c2968f68bd34d2970; __stripe_sid=c77cc3fa-abf6-4196-a827-e3dd77e20259deb20a; OptanonAlertBoxClosed=2021-05-30T10:09:31.293Z

// todo: goat currency

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
				log('search results', !app.isPackaged);
				log(items, !app.isPackaged);
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

// todo: auto-updates
// todo: code-signing
// todo: proxies
// todo: check refresh
// todo: check notifications
// todo: add warning to landing page about unrecognized developer
// todo: add google analytics
// todo: retry when getting forbidden response
// todo: add country selector to settings?
// todo: fix warnings
