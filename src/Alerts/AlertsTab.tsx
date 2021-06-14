import React from 'react';
import { useState, useEffect } from 'react';
import {
	Item,
	PriceAlert,
	Currency,
	ExchangeRates,
} from '@istvankreisz/copdeck-scraper/dist/types';
import { itemBestPrice } from '@istvankreisz/copdeck-scraper';
import ItemDetail from '../Components/ItemDetail';
import AlertListItem from './AlertListItem';
import { tuple, is, array } from 'superstruct';
import { IpcRenderer } from 'electron';
const ipcRenderer: IpcRenderer = window.require('electron').ipcRenderer;

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
	const [exchangeRates, setExchangeRates] = useState<ExchangeRates>();

	useEffect(() => {
		if (prop.activeTab === 'alerts') {
			ipcRenderer.send('alertsWithItems', {});
		}
	}, [prop.activeTab]);

	useEffect(() => {
		const rates = ipcRenderer.sendSync('getExchangeRates');
		if (rates && is(rates, ExchangeRates)) {
			setExchangeRates(rates);
		}

		ipcRenderer.on('alertsWithItems', (event, alertsWithItems) => {
			if (is(alertsWithItems, array(tuple([PriceAlert, Item])))) {
				setPriceAlerts(alertsWithItems);
			}
		});
		return () => {
			ipcRenderer.removeAllListeners('alertsWithItems');
		};
	}, []);

	useEffect(() => {
		if (!selectedItem) {
			ipcRenderer.send('alertsWithItems', {});
		}
	}, [selectedItem]);

	const clickedItem = (item: Item) => {
		if (item.id !== selectedItem?.id) {
			setSelectedItem(item);
		}
	};

	const deletedAlert = (alert: PriceAlert, event) => {
		event.stopPropagation();

		ipcRenderer.send('deleteAlert', alert);
		ipcRenderer.send('alertsWithItems', {});
	};

	return (
		<>
			<div className="bg-transparent p-3 pb-0 relative w-full h-full overflow-y-scroll overflow-x-hidden">
				<h1 className="font-bold text-3xl mb-4">Price Alerts</h1>
				<ul className="my-4 flex flex-col space-y-3">
					{priceAlerts.map(([alert, item], index) => {
						let feeType = 'No Fees';
						if (alert.feeType === 'Buy') {
							feeType = 'With buyer fees';
						} else if (alert.feeType === 'Sell') {
							feeType = 'With seller fees';
						}
						return (
							<AlertListItem
								name={item.name}
								imageURL={item.imageURL?.url}
								flipImage={item.imageURL?.store.id === 'klekt'}
								key={alert.id}
								onClicked={clickedItem.bind(null, item)}
								stores={alert.stores.map((s) => s.name)}
								bestPrice={itemBestPrice(item, alert)}
								priceType={alert.priceType}
								feeType={feeType}
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
