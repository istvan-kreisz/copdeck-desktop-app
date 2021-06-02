import { number, object, Infer, array, record, string } from 'superstruct';
import { Currency, Proxy } from 'copdeck-scraper/dist/types';

const SettingsSchema = object({
	proxies: array(Proxy),
	currency: Currency,
	updateInterval: number(),
	notificationFrequency: number(),
});

type Settings = Infer<typeof SettingsSchema>;

export { SettingsSchema };
export type { Settings };
