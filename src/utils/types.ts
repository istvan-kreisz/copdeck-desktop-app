import {
	number,
	object,
	Infer,
	array,
	string,
	union,
	literal,
	boolean,
	defaulted,
} from 'superstruct';
import { Currency, Proxy } from '@istvankreisz/copdeck-scraper/dist/types';

const SettingsSchema = object({
	proxies: array(Proxy),
	currency: Currency,
	updateInterval: number(),
	notificationFrequency: number(),
	darkModeOn: boolean(),
	feeCalculation: object({
		countryName: string(),
		stockx: object({
			sellerLevel: union([literal(1), literal(2), literal(3), literal(4), literal(5)]),
			taxes: number(),
			successfulShipBonus: defaulted(boolean(), false),
			quickShipBonus: defaulted(boolean(), false),
		}),
		goat: object({
			commissionPercentage: union([literal(9.5), literal(15), literal(20)]),
			cashOutFee: union([literal(0.029), literal(0)]),
			taxes: number(),
		}),
		klekt: object({
			taxes: number(),
		}),
	}),
});

type Settings = Infer<typeof SettingsSchema>;

export { SettingsSchema };
export type { Settings };
