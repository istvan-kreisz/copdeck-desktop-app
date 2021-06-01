import React from 'react';
import { useState, useEffect } from 'react';
import { Item, PriceAlert, Currency } from 'copdeck-scraper/dist/types';
import { itemBestPrice } from 'copdeck-scraper';
import ItemDetail from '../Components/ItemDetail';
import AlertListItem from './AlertListItem';
import { databaseCoordinator } from '../services/databaseCoordinator';

const AlertsTab = (prop: {
	activeTab: 'main' | 'settings' | 'alerts';
	currency: Currency;
	setToastMessage: React.Dispatch<
		React.SetStateAction<{
			message: string;
			show: boolean;
		}>
	>;
}) => {
	const [priceAlerts, setPriceAlerts] = useState<[PriceAlert, Item][]>([]);
	const [selectedItem, setSelectedItem] = useState<Item | null>();

	// const { getAlertsWithItems, deleteAlert } = databaseCoordinator();

	useEffect(() => {
		if (prop.activeTab === 'alerts') {
			(async () => {
				// const alertsWithItems = await getAlertsWithItems();
				// setPriceAlerts(alertsWithItems);
			})();
		}
	}, [prop.activeTab]);

	useEffect(() => {
		if (!selectedItem) {
			(async () => {
				// const alertsWithItems = await getAlertsWithItems();
				// setPriceAlerts(alertsWithItems);
			})();
		}
	}, [selectedItem]);

	const clickedItem = (item: Item) => {
		if (item.id !== selectedItem?.id) {
			setSelectedItem(item);
		}
	};

	const deletedAlert = (alert: PriceAlert, event) => {
		event.stopPropagation();
		(async () => {
			// await deleteAlert(alert);
			// const alertsWithItems = await getAlertsWithItems();
			// setPriceAlerts(alertsWithItems);
		})();
	};

	return (
		<>
			<div className="bg-transparent p-3 pb-0 relative w-full h-full overflow-y-scroll overflow-x-hidden">
				<h1 className="font-bold mb-4">Price Alerts</h1>
				<ul className="my-4 flex flex-col space-y-3">
					{priceAlerts.map(([alert, item], index) => {
						return (
							<AlertListItem
								name={item.name}
								imageURL={item.imageURL?.url}
								flipImage={item.imageURL?.store.id === 'klekt'}
								key={alert.id}
								onClicked={clickedItem.bind(null, item)}
								stores={alert.stores.map((s) => s.name)}
								bestPrice={itemBestPrice(item, alert)}
								targetPriceType={alert.targetPriceType}
								currency={prop.currency.symbol}
								targetSize={alert.targetSize}
								targetPrice={alert.targetPrice}
								onDeleted={deletedAlert.bind(null, alert)}
							></AlertListItem>
						);
					})}
				</ul>
				{!priceAlerts.length ? (
					<>
						<p className="text-center">No alerts added yet.</p>
						<p className="text-center">Use the search tab to set price alerts.</p>
					</>
				) : null}
			</div>
			{selectedItem ? (
				<ItemDetail
					currency={prop.currency}
					selectedItem={selectedItem}
					setSelectedItem={setSelectedItem}
					setToastMessage={prop.setToastMessage}
				></ItemDetail>
			) : null}
		</>
	);
};

export default AlertsTab;
