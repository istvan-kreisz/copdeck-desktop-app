import { nodeAPI } from '@istvankreisz/copdeck-scraper';
import { assert, string, is, boolean } from 'superstruct';
import { databaseCoordinator } from '../databaseCoordinator';
import { Settings, SettingsSchema } from '../../src/utils/types';
import { parse } from '../../src/utils/proxyparser';
import { log } from '../../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { APIConfig, Item, PriceAlert } from '@istvankreisz/copdeck-scraper/dist/types';

const minUpdateInterval = 5;
const maxUpdateInterval = 1440;

function setupMessageListeners(
	app: Electron.App,
	ipcMain: Electron.IpcMain,
	apiConfig: (settings: Settings, dev: boolean) => APIConfig,
	getItemDetails: (item: Item, forceRefresh: boolean) => Promise<Item>,
	updatePrices: (forced?: boolean) => Promise<void>
) {
	const {
		getAlertsWithItems,
		getSettings,
		getExchangeRates,
		saveAlert,
		saveSettings,
		deleteAlert,
	} = databaseCoordinator();

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
}

export { setupMessageListeners };
