import { databaseCoordinator } from '../databaseCoordinator';
import { isOlderThan, itemBestPrice } from '@istvankreisz/copdeck-scraper';
import { log } from '../../src/utils/logger';
import { app } from 'electron';

const sendNotifications = () => {
	const { getAlertsWithItems, getSettings, updateLastNotificationDateForAlerts } =
		databaseCoordinator();


	// try {
	// 	const [alerts, settings] = [getAlertsWithItems(), getSettings()];
	// 	const alertsFiltered = alerts
	// 		.filter(([alert, item]) => {
	// 			if (alert.lastNotificationSent) {
	// 				return isOlderThan(
	// 					alert.lastNotificationSent,
	// 					settings.notificationFrequency,
	// 					'hours'
	// 				);
	// 			} else {
	// 				return true;
	// 			}
	// 		})
	// 		.filter(([alert, item]) => {
	// 			const bestPrice = itemBestPrice(item, alert);
	// 			if (bestPrice) {
	// 				if (alert.targetPriceType === 'below') {
	// 					if (bestPrice < alert.targetPrice) {
	// 						return true;
	// 					} else {
	// 						return false;
	// 					}
	// 				} else {
	// 					if (bestPrice > alert.targetPrice) {
	// 						return true;
	// 					} else {
	// 						return false;
	// 					}
	// 				}
	// 			} else {
	// 				return false;
	// 			}
	// 		});
	// 	alertsFiltered.forEach(([alert, item]) => {
	// 		const bestPrice = itemBestPrice(item, alert);
	// 		log('notification sent', !app.isPackaged);
	// 		log(alert, !app.isPackaged);
	// 		new Notification({
	// 			title: 'CopDeck Price Alert!',
	// 			body: `${item.name} price ${
	// 				alert.targetPriceType === 'above' ? 'went above' : 'dropped below'
	// 			} ${settings.currency.symbol}${alert.targetPrice}! Current best price: ${
	// 				settings.currency.symbol
	// 			}${bestPrice}`,
	// 		}).show();
	// 	});
	// 	updateLastNotificationDateForAlerts(alertsFiltered.map(([alert, item]) => alert));
	// } catch (err) {
	// 	console.log(err);
	// }
};

export { sendNotifications };
