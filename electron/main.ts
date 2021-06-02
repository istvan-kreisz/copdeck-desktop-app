import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
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
import { parse, pacFormat } from '../src/utils/proxyparser';
import { log } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
const { ipcMain, Notification } = require('electron');
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';

const minUpdateInterval = 5;
const maxUpdateInterval = 1440;
const cacheAlarm = 'copdeckCacheAlarm';
const refreshPricesAlarm = 'copdeckRefreshPricesAlarm';
const refreshExchangeRatesAlarm = 'copdeckrefreshExchangeRatesAlarm';
const proxyRotationAlarm = 'copdeckProxyRotationAlarm';
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

// function showNotification(body: any) {
// new Notification({ title: NOTIFICATION_TITLE, body: body }).show();
// }

// let mainWindow: BrowserWindow | null | undefined;

// function initialize() {
// 	function createWindow() {
// 		mainWindow = new BrowserWindow({
// 			width: 380,
// 			height: 580,
// 			webPreferences: {
// 				nodeIntegration: true,
// 				contextIsolation: false,
// 				preload: path.join(__dirname, 'preload.js'),
// 			},
// 		});

// 		if (isDev) {
// 			mainWindow.loadURL('http://localhost:3000/index.html');
// 		} else {
// 			// 'build/index.html'
// 			mainWindow.loadURL(`file://${__dirname}/../index.html`);
// 		}

// 		// Hot Reloading
// 		if (isDev) {
// 			require('electron-reload')(__dirname, {
// 				electron: path.join(
// 					__dirname,
// 					'..',
// 					'..',
// 					'node_modules',
// 					'.bin',
// 					'electron' + (process.platform === 'win32' ? '.cmd' : '')
// 				),
// 				forceHardReset: false,
// 				hardResetMethod: 'exit',
// 			});
// 		}

// 		if (isDev) {
// 			mainWindow.webContents.openDevTools({ activate: false, mode: 'bottom' });
// 		}
// 	}

// 	makeSingleInstance();

// 	app.whenReady().then(() => {
// 		createWindow();
// 	});

// 	app.on('activate', () => {
// 		if (BrowserWindow.getAllWindows().length === 0) {
// 			createWindow();
// 		}
// 	});

// 	app.on('window-all-closed', () => {
// 		if (process.platform !== 'darwin') {
// 			app.quit();
// 		}
// 	});
// }

// function makeSingleInstance() {
// 	if (process.mas) return;

// 	app.requestSingleInstanceLock();

// 	app.on('second-instance', () => {
// 		if (mainWindow) {
// 			if (mainWindow.isMinimized()) {
// 				mainWindow.restore();
// 			}
// 			mainWindow.focus();
// 		}
// 	});
// }

// initialize();

function createWindow() {
	const win = new BrowserWindow({
		width: 380,
		height: 608,
		// resizable: isDev,
		resizable: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	console.log(win.getSize()[1] - win.getContentSize()[1]);
	win.setSize(380, win.getSize()[1] - win.getContentSize()[1] + 580);

	if (isDev) {
		win.loadURL('http://localhost:3000/index.html');
	} else {
		win.loadURL(`file://${__dirname}/../index.html`);
	}

	if (isDev) {
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
		win.webContents.openDevTools();
	}
}

app.whenReady().then(() => {
	// DevTools
	installExtension(REACT_DEVELOPER_TOOLS)
		.then((name) => console.log(`Added Extension:  ${name}`))
		.catch((err) => console.log('An error occurred: ', err));

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
								.getItemPrices(item, apiConfig(settings, isDev))
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
	const newItem = await nodeAPI.getItemPrices(item, apiConfig(settings, isDev));
	updateItem(newItem, isDev);
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
				log('fetching new 1', isDev);
				return fetchAndSave(savedItem);
			} else {
				log('returning saved', isDev);
				return savedItem;
			}
		} else {
			log('fetching new 2', isDev);
			return fetchAndSave(item);
		}
	} catch (err) {
		log('fetching new 3', true);
		return fetchAndSave(item);
	}
};

const addClearCacheAlarm = async () => {
	// return new Promise<void>((resolve, reject) => {
	// 	chrome.alarms.get(cacheAlarm, (a) => {
	// 		if (!a) {
	// 			chrome.alarms.create(cacheAlarm, {
	// 				periodInMinutes: 10080,
	// 			});
	// 		}
	// 		resolve();
	// 	});
	// });
};

const addRefreshExchangeRatesAlarm = async () => {
	// return new Promise<void>((resolve, reject) => {
	// 	chrome.alarms.get(refreshExchangeRatesAlarm, (a) => {
	// 		if (!a) {
	// 			chrome.alarms.create(refreshExchangeRatesAlarm, {
	// 				periodInMinutes: 720,
	// 			});
	// 		}
	// 		resolve();
	// 	});
	// });
};

const addrefreshPricesAlarm = async (deleteIfExists: boolean) => {
	// try {
	// 	const settings = await getSettings();
	// 	return new Promise<void>((resolve, reject) => {
	// 		chrome.alarms.get(refreshPricesAlarm, (a) => {
	// 			if (deleteIfExists) {
	// 				if (a) {
	// 					chrome.alarms.clear(refreshPricesAlarm, (wasCleared) => {
	// 						if (wasCleared) {
	// 							chrome.alarms.create(refreshPricesAlarm, {
	// 								periodInMinutes: settings.updateInterval,
	// 							});
	// 						}
	// 						resolve();
	// 					});
	// 				} else {
	// 					chrome.alarms.create(refreshPricesAlarm, {
	// 						periodInMinutes: settings.updateInterval,
	// 					});
	// 					resolve();
	// 				}
	// 			} else {
	// 				if (!a) {
	// 					chrome.alarms.create(refreshPricesAlarm, {
	// 						periodInMinutes: settings.updateInterval,
	// 					});
	// 				}
	// 				resolve();
	// 			}
	// 		});
	// 	});
	// } catch (err) {
	// 	console.log(err);
	// }
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
			log('notification sent', isDev);
			log(alert, isDev);
			// chrome.notifications.create(
			// 	uuidv4(),
			// 	{
			// 		type: 'basic',
			// 		iconUrl: 'icon-48.png',
			// 		title: 'CopDeck Price Alert!',
			// 		message: `${item.name} price ${
			// 			alert.targetPriceType === 'above' ? 'went above' : 'dropped below'
			// 		} ${settings.currency.symbol}${alert.targetPrice}! Current best price: ${
			// 			settings.currency.symbol
			// 		}${bestPrice}`,
			// 		priority: 2,
			// 	},
			// 	() => {
			// 		console.log('Error:', chrome.runtime.lastError);
			// 	}
			// );
		});

		await updateLastNotificationDateForAlerts(alertsFiltered.map(([alert, item]) => alert));
	} catch (err) {
		console.log(err);
	}
};

// chrome.alarms.onAlarm.addListener(async (alarm) => {
// 	if (alarm.name === refreshPricesAlarm) {
// 		await updatePrices();
// 		await sendNotifications();
// 	} else if (alarm.name === cacheAlarm) {
// 		await clearCache();
// 	} else if (alarm.name === refreshExchangeRatesAlarm) {
// 		await refreshExchangeRates();
// 	} else if (alarm.name === proxyRotationAlarm) {
// 		const [settings, dev] = await Promise.all([getSettings(), getIsDevelopment()]);
// 		await updateProxies(settings.proxies, dev);
// 	}
// });

// chrome.runtime.onStartup.addListener(async () => {
// 	chrome.runtime.setUninstallURL('https://copdeck.com/extensionsurvey');
// });

// chrome.runtime.onInstalled.addListener(async () => {
// 	await Promise.all([
// 		addrefreshPricesAlarm(false),
// 		addClearCacheAlarm(),
// 		addRefreshExchangeRatesAlarm(),
// 		refreshExchangeRates(),
// 	]);
// });

const startProxyRotation = async () => {
	// return new Promise<void>((resolve, reject) => {
	// 	chrome.alarms.get(proxyRotationAlarm, (a) => {
	// 		if (!a) {
	// 			chrome.alarms.create(proxyRotationAlarm, {
	// 				periodInMinutes: 60,
	// 			});
	// 		}
	// 		resolve();
	// 	});
	// });
};

const resetProxyRotation = async () => {
	// return new Promise<void>((resolve, reject) => {
	// 	chrome.alarms.clear(proxyRotationAlarm, () => {
	// 		resolve();
	// 	});
	// });
};

const updateProxies = async (proxies: Proxy[], dev: boolean): Promise<void> => {
	// const proxiesString = pacFormat(proxies);
	// const pacScriptConfig = {
	// 	mode: 'pac_script',
	// 	pacScript: {
	// 		data: `function FindProxyForURL(url, host) {
	//             if (dnsDomainIs(host, ".goat.com") || shExpMatch(host, '*2fwotdvm2o-dsn.algolia.net*') || shExpMatch(host, '*apiv2.klekt.com*') || dnsDomainIs(host, ".stockx.com")) {
	//                 return "${proxiesString}";
	//             } else {
	//                 return "DIRECT";
	//             }
	//         }`,
	// 	},
	// };
	// return new Promise(async (resolve, reject) => {
	// 	chrome.proxy.settings.set({ value: pacScriptConfig, scope: 'regular' }, () => {
	// 		resolve();
	// 	});
	// });
};

const updateProxySettings = async (proxies: Proxy[], dev: boolean): Promise<void> => {
	// if (proxies.length < 2) {
	// 	try {
	// 		await resetProxyRotation();
	// 	} catch (err) {}
	// 	if (proxies.length === 0) {
	// 		return new Promise<void>((resolve, reject) => {
	// 			chrome.proxy.settings.clear({}, () => {
	// 				resolve();
	// 			});
	// 		});
	// 	}
	// }
	// await updateProxies(proxies, dev);
	// if (proxies.length > 1) {
	// 	await startProxyRotation();
	// }
	// if (dev) {
	// 	return new Promise<void>((resolve, reject) => {
	// 		chrome.proxy.settings.get({}, function (config) {
	// 			log(JSON.stringify(config), dev);
	// 			resolve();
	// 		});
	// 	});
	// }
};

// chrome.storage.onChanged.addListener(async function (changes, namespace) {
// 	listenToSettingsChanges((settingsOld, settingsNew) => {
// 		if (
// 			settingsNew &&
// 			settingsOld &&
// 			is(settingsNew, SettingsSchema) &&
// 			is(settingsOld, SettingsSchema)
// 		) {
// 			if (settingsOld.currency.code !== settingsNew.currency.code) {
// 				updatePrices(true);
// 			}
// 			if (settingsOld.updateInterval !== settingsNew.updateInterval) {
// 				addrefreshPricesAlarm(true);
// 			}
// 			if (JSON.stringify(settingsOld.proxies) !== JSON.stringify(settingsNew.proxies)) {
// 				updateProxySettings(settingsNew.proxies, isDev);
// 			}
// 		}
// 	});
// });

// // add goat bid
// // add proxy toggle
// // change goat currency
// // Cookie: _csrf=lKuDAaP8CZOqw-LoxVrr2y5Z; csrf=xQDiRJay-RiSSEinY5fgM631qqcCElyVhLAs; _sneakers_session=v89yqHWNt2U3vHU2Rls%2F%2B0Nb66XdCEAQNBwOVGDxBx6kVnDDtALbhmo9KwDph1EISUTlerOAefWW%2FWpUuq7N--EjpYsea%2BbyqFTy3b--r7Y9SJYqJsSoxqkVP64HeA%3D%3D; ConstructorioID_client_id=e9866fda-fd26-4f06-8e18-b31e22d1ee0b; currency=JPY; OptanonConsent=isIABGlobal=false&datestamp=Sun+May+30+2021+12%3A09%3A31+GMT%2B0200+(Central+European+Summer+Time)&version=6.12.0&hosts=&consentId=ae7c1734-b0a0-4e58-b815-38e294f6e206&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A0%2CC0002%3A0%2CC0004%3A0; __stripe_mid=dca3168b-fbcc-428a-9214-4c2968f68bd34d2970; __stripe_sid=c77cc3fa-abf6-4196-a827-e3dd77e20259deb20a; OptanonAlertBoxClosed=2021-05-30T10:09:31.293Z

ipcMain.on('search', (event, searchTerm) => {
	(async () => {
		try {
			assert(searchTerm, string());
			const settings = getSettings();
			log('searching', isDev);
			const items = await nodeAPI.searchItems(searchTerm, apiConfig(settings, isDev));
			log('search results', isDev);
			log(items, isDev);
			event.sender.send('search', items);
		} catch (err) {
			event.sender.send('search', []);
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
			event.sender.send('getItemDetails', itemWithPrices);
		} catch (err) {
			event.sender.send('getItemDetails', undefined);
			console.log(err);
		}
	})();
});

ipcMain.on('settings', (event, msg) => {
	(async () => {
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
					log('proxy error', isDev);
					log(err, isDev);
				}
			}
			if (settings.updateInterval < minUpdateInterval) {
				settings.updateInterval = minUpdateInterval;
			} else if (settings.updateInterval > maxUpdateInterval) {
				settings.updateInterval = maxUpdateInterval;
			}
			saveSettings(settings);
			event.sender.send('settings', proxyParseError);
		} catch (err) {
			console.log(err);
			event.sender.send('settings', err);
		}
	})();
});

ipcMain.on('saveAlert', (event, msg) => {
	(async () => {
		try {
			const item = msg.item;
			const alert = msg.alert;
			assert(alert, PriceAlert);
			assert(item, Item);

			saveAlert(alert, item);
		} catch (err) {
			console.log(err);
		}
		event.sender.send('refresh', {});
	})();
});

ipcMain.on('refresh', (event) => {
	(async () => {
		try {
			await updatePrices();
		} catch (err) {
			console.log(err);
		}
		event.sender.send('refresh', {});
	})();
});

ipcMain.on('getExchangeRates', (event, arg) => {
	const rates = getExchangeRates();
	event.returnValue = rates;
});

// todo: tailwind purge
