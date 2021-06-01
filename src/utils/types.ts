import { number, object, Infer, array, record, string } from 'superstruct'
import { Currency, Proxy } from 'copdeck-scraper/dist/types'

const Settings = object({
	proxies: array(Proxy),
	currency: Currency,
	updateInterval: number(),
	notificationFrequency: number(),
})

type Settings = Infer<typeof Settings>

const ProxyNotificationUpdates = record(string(), number())

type ProxyNotificationUpdates = Infer<typeof ProxyNotificationUpdates>

export { Settings, ProxyNotificationUpdates }
