import { number, object, Infer, array, record, string, union, literal } from 'superstruct';
import { Currency, Proxy } from '@istvankreisz/copdeck-scraper/dist/types';

const SettingsSchema = object({
	proxies: array(Proxy),
	currency: Currency,
	updateInterval: number(),
	notificationFrequency: number(),
	feeCalculation: object({
		countryName: string(),
		stockx: object({
			sellerLevel: union([literal(1), literal(2), literal(3), literal(4)]),
			taxes: number(),
		}),
		goat: object({
			commissionPercentage: union([literal(9.5), literal(15), literal(25)]),
			cashOutFee: union([literal(0.029), literal(0)]),
			taxes: number(),
		}),
	}),
});

type Settings = Infer<typeof SettingsSchema>;

export { SettingsSchema };
export type { Settings };
