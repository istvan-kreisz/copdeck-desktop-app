import { array, assert, boolean, is } from 'superstruct';
import { Item, PriceAlert, EUR, ExchangeRates } from '@istvankreisz/copdeck-scraper/dist/types';
import { removeDuplicates } from '@istvankreisz/copdeck-scraper';
import { SettingsSchema } from '../src/utils/types';
import { log } from '../src/utils/logger';
import type { Settings } from '../src/utils/types';

const Store = require('electron-store');

declare type AlertWithItem = [PriceAlert, Item];

const databaseCoordinator = () => {
	const store = new Store();

	const defaultSettings: Settings = {
		currency: EUR,
		updateInterval: 60,
		notificationFrequency: 24,
		darkModeOn: false,
		proxies: [],
		feeCalculation: {
			countryName: 'Austria',
			stockx: {
				sellerLevel: 1,
				taxes: 0,
				successfulShipBonus: false,
				quickShipBonus: false,
			},
			goat: {
				commissionPercentage: 9.5,
				cashOutFee: 0,
				taxes: 0,
			},
			klekt: {
				taxes: 0,
			},
		},
	};

	const set = (key: string, value: any) => {
		store.set({
			[key]: value,
		});
	};

	const get = (key: string) => {
		return store.get(key);
	};

	const getCachedItemWithId = (id: string): Item | undefined => {
		const cachedItems = get('cachedItems');
		if (is(cachedItems, array(Item))) {
			return cachedItems.find((item) => item.id == id);
		}
	};

	const getSavedItemWithId = (id: string): Item | undefined => {
		const items = get('items');
		if (is(items, array(Item))) {
			return items.find((item) => item.id == id);
		}
	};

	const getItemWithId = (id: string): Item | undefined => {
		try {
			const item = getSavedItemWithId(id);
			return item ?? getCachedItemWithId(id);
		} catch (err) {
			return getCachedItemWithId(id);
		}
	};

	const getItems = (): Array<Item> => {
		const items = get('items');
		if (is(items, array(Item))) {
			return items;
		} else {
			return [];
		}
	};

	const incrementOpenedCount = (): number => {
		const currentOpenedCount: number = get('openedCount') ?? 0;
		const newOpenedCount = currentOpenedCount + 1;
		set('openedCount', newOpenedCount);
		return newOpenedCount;
	};

	const getAlerts = (): Array<PriceAlert> => {
		const alerts = get('alerts');
		if (is(alerts, array(PriceAlert))) {
			return alerts;
		} else {
			return [];
		}
	};

	const getIsFirstAlert = (): boolean => {
		const isFirstAlert = get('isFirstAlert');
		if (is(isFirstAlert, boolean())) {
			return isFirstAlert;
		} else {
			set('isFirstAlert', false);
			return true;
		}
	};

	const getSettings = (): Settings => {
		const settings = get('settings');
		if (settings !== undefined && settings?.darkModeOn === undefined) {
			settings.darkModeOn = false;
		}
		if (is(settings, SettingsSchema)) {
			return settings;
		} else {
			saveSettings(defaultSettings);
			return defaultSettings;
		}
	};

	const getExchangeRates = (): ExchangeRates | undefined => {
		const exchangeRates = get('exchangeRates');
		if (
			is(exchangeRates, ExchangeRates) &&
			exchangeRates.chf &&
			exchangeRates.gbp &&
			exchangeRates.nok &&
			exchangeRates.usd
		) {
			return exchangeRates;
		} else {
			return {
				usd: 1.1891,
				gbp: 0.8567,
				chf: 1.0954,
				nok: 10.2673,
				updated: new Date().getTime(),
			};
		}
	};

	const listenToSettingsChanges = (
		callback: (oldValue?: Settings, newValue?: Settings) => void
	) => {
		store.onDidChange('settings', (newValue: any, oldValue: any) => {
			if (newValue !== undefined && newValue?.darkModeOn === undefined) {
				newValue.darkModeOn = false;
			}
			if (newValue && is(newValue, SettingsSchema)) {
				if (oldValue && is(oldValue, SettingsSchema)) {
					callback(oldValue, newValue);
				} else {
					callback(undefined, newValue);
				}
			}
		});
		const settings = get('settings');
		if (settings) {
			if (settings !== undefined && settings?.darkModeOn === undefined) {
				settings.darkModeOn = false;
			}
			assert(settings, SettingsSchema);
			callback(undefined, settings);
		}
	};

	const getAlertsWithItems = (): Array<AlertWithItem> => {
		const alerts = getAlerts();
		const items = getItems();
		const alertsWithItems: AlertWithItem[] = [];
		alerts.forEach((alert) => {
			const item = items.find((item) => item.id === alert.itemId);
			if (item) {
				alertsWithItems.push([alert, item]);
			}
		});
		return alertsWithItems;
	};

	const saveItem = (item: Item) => {
		const items = getItems();
		const newItems = items.filter((i) => item.id !== i.id);
		item.updated = new Date().getTime();
		newItems.push(item);
		saveItems(newItems);
	};

	const setCache = (items: Item[]) => {
		set('cachedItems', items);
	};

	const cacheItem = (item: Item) => {
		const cachedItems = get('cachedItems');
		if (is(cachedItems, array(Item))) {
			const newItems = cachedItems.filter((i) => item.id !== i.id);
			item.updated = new Date().getTime();
			newItems.push(item);
			setCache(newItems);
		} else {
			item.updated = new Date().getTime();
			setCache([item]);
		}
	};

	const saveItems = (items: Item[]) => {
		set('items', items);
	};

	const updateItems = (items: Item[]) => {
		if (!items.length) return;
		const filteredItems = removeDuplicates(items);
		const i = getItems();

		const newItems = i.filter((i) => !filteredItems.find((it) => it.id === i.id));
		filteredItems.forEach((item, index) => {
			item.updated = new Date().getTime();
			newItems.push(item);
		});
		if (newItems.length > 0) {
			saveItems(newItems);
		} else {
			return;
		}
	};

	const updateItem = (item: Item, isLoggingEnabled: boolean) => {
		try {
			if (getSavedItemWithId(item.id)) {
				log('saving item', isLoggingEnabled);
				log(item, isLoggingEnabled);
				saveItem(item);
			} else {
				log('caching item', isLoggingEnabled);
				log(item, isLoggingEnabled);
				cacheItem(item);
			}
		} catch (err) {
			log('caching item', isLoggingEnabled);
			log(item, isLoggingEnabled);
			cacheItem(item);
		}
	};

	const saveAlert = (alert: PriceAlert, item: Item) => {
		const alerts = getAlerts();
		set('alerts', [...alerts, alert]);
		saveItem(item);
	};

	const saveSettings = (settings: Settings) => {
		set('settings', settings);
	};

	const saveExchangeRates = (exchangeRates: ExchangeRates) => {
		set('exchangeRates', exchangeRates);
	};

	const deleteItemWithId = (itemId: string) => {
		const items = getItems();
		const newItems = items.filter((i) => itemId !== i.id);
		if (newItems.length !== items.length) {
			saveItems(newItems);
		}
	};

	const clearItemCache = () => {
		set('cachedItems', []);
	};

	const deleteAlert = (alert: PriceAlert) => {
		const alerts = getAlerts();
		const newAlerts = alerts.filter((a) => alert.id !== a.id);
		if (newAlerts.length !== alerts.length) {
			set('alerts', newAlerts);

			if (!newAlerts.find((a) => a.itemId === alert.itemId)) {
				deleteItemWithId(alert.itemId);
			}
		}
	};

	const updateLastNotificationDateForAlerts = (alertsToUpdate: PriceAlert[]) => {
		const savedAlerts = getAlerts();
		const updatedAlerts = savedAlerts.map((savedAlert) => {
			const alert = alertsToUpdate.find((a) => savedAlert.id === a.id);
			if (alert) {
				savedAlert.lastNotificationSent = new Date().getTime();
			}
			return savedAlert;
		});
		set('alerts', updatedAlerts);
	};

	return {
		store: store,
		getAlertsWithItems: getAlertsWithItems,
		getItems: getItems,
		incrementOpenedCount: incrementOpenedCount,
		getItemWithId: getItemWithId,
		getAlerts: getAlerts,
		getIsFirstAlert: getIsFirstAlert,
		getSettings: getSettings,
		getExchangeRates: getExchangeRates,
		listenToSettingsChanges: listenToSettingsChanges,
		updateItem: updateItem,
		saveItems: saveItems,
		updateItems: updateItems,
		saveAlert: saveAlert,
		saveSettings: saveSettings,
		saveExchangeRates: saveExchangeRates,
		deleteAlert: deleteAlert,
		clearItemCache: clearItemCache,
		updateLastNotificationDateForAlerts: updateLastNotificationDateForAlerts,
	};
};

export { databaseCoordinator };
