import { number, object, Infer, array, record, string } from 'superstruct';
import { Currency, Proxy } from 'copdeck-scraper/dist/types';

const SettingsSchema = object({
	proxies: array(Proxy),
	currency: Currency,
	updateInterval: number(),
	notificationFrequency: number(),
});

type Settings = Infer<typeof SettingsSchema>;

const ProxyNotificationUpdatesSchema = record(string(), number());

type ProxyNotificationUpdates = Infer<typeof ProxyNotificationUpdatesSchema>;

export { SettingsSchema, ProxyNotificationUpdatesSchema };
export type { Settings, ProxyNotificationUpdates };
