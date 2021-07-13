import React from 'react';
import { useRef, useState, useContext, useEffect } from 'react';
import {
	Item,
	StorePrices,
	PriceAlert,
	Currency,
	FeeType,
} from '@istvankreisz/copdeck-scraper/dist/types';
import { v4 as uuidv4 } from 'uuid';
import Popup from '../Components/Popup';
import { IpcRenderer } from 'electron';
const ipcRenderer: IpcRenderer = window.require('electron').ipcRenderer;
import FirebaseContext from '../context/firebaseContext';
import { is } from 'superstruct';

const AddAlertModal = (prop: {
	selectedItem: Item;
	showAddPriceAlertModal: boolean;
	setShowAddPriceAlertModal: (show: boolean) => void;
	currency: Currency;
	setToastMessage: (message: string, show: boolean) => void;
}) => {
	const [selectedStores, setSelectedStores] = useState<StorePrices[]>([]);
	const [selectedSize, setSelectedSize] = useState<string>();
	const [relation, setRelation] = useState<'above' | 'below'>('below');
	const [feeType, setFeeType] = useState<FeeType>('None');
	const [priceType, setPriceType] = useState<'ask' | 'bid'>('ask');

	const firebase = useContext(FirebaseContext);

	useEffect(() => {
		firebase?.analytics().logEvent('desktop_visited_add_alert', {});
	}, []);

	const [error, setError] = useState<{ message: string; show: boolean }>({
		message: '',
		show: false,
	});

	const storeSelector = useRef<HTMLDivElement>(null);
	const priceField = useRef<HTMLInputElement>(null);

	const selectableStores = (): StorePrices[] => {
		return prop.selectedItem?.storePrices.filter((prices) => prices.inventory.length) ?? [];
	};

	const sizeSet = new Set<string>();
	selectedStores.forEach((store) => {
		return store.inventory.map((inventoryItem) => {
			sizeSet.add(inventoryItem.size);
		});
	});
	const selectableSizes = Array.from(sizeSet);

	if (!selectedSize && selectableSizes && selectableSizes.length) {
		setSelectedSize(selectableSizes[0]);
	}

	const storeToggled = (event: { target: HTMLInputElement }) => {
		const isChecked = event.target.checked;
		const storeName = event.target.value;
		const store = selectableStores().find((s) => s.store.id === storeName);
		if (!store) {
			if (storeName === 'all') {
				if (isChecked) {
					setSelectedStores(selectableStores());
				} else {
					setSelectedStores([]);
				}
			}
			return;
		}

		setSelectedStores((stores) => {
			if (isChecked) {
				if (!stores.find((s) => s.store.id === storeName)) {
					const newValue = [...stores, store];
					return newValue;
				} else {
					return stores;
				}
			} else {
				return stores.filter((s) => s.store.id !== storeName);
			}
		});
	};

	const sizeSelected = (event: { target: HTMLSelectElement }) => {
		setSelectedSize(event.target.value);
	};

	const priceTypeSelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		if (value === 'ask' || value === 'bid') {
			setPriceType(value);
		}
	};

	const relationSelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		if (value === 'above' || value === 'below') {
			setRelation(value);
		}
	};

	const feeTypeSelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		if (is(value, FeeType)) {
			setFeeType(value);
		}
	};

	const storeLabel = (store: StorePrices): string => {
		let label = store.store.name;
		if (selectedSize) {
			const hasSelectedSize = store.inventory.find(
				(inventoryItem) => inventoryItem.size === selectedSize
			);
			if (!hasSelectedSize) {
				label += ' (size not available)';
			}
		}
		return label;
	};

	const addAlert = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const price = parseFloat(priceField.current?.value ?? '');

		if (
			!price ||
			!selectedSize ||
			!selectedStores.length ||
			!prop.selectedItem ||
			(relation !== 'above' && relation !== 'below')
		) {
			setError({ message: 'Please fill out all the fields', show: true });
			return;
		}
		const newAlert: PriceAlert = {
			name: prop.selectedItem.name ?? '',
			id: uuidv4(),
			itemId: prop.selectedItem?.id ?? '',
			targetPrice: price,
			relation: relation,
			priceType: priceType,
			feeType: feeType,
			targetSize: selectedSize,
			stores: selectedStores.map((store) => store.store),
		};

		ipcRenderer.send('saveAlert', { alert: newAlert, item: prop.selectedItem });
		prop.setToastMessage('Added price alert', true);
		prop.setShowAddPriceAlertModal(false);

		firebase?.analytics().logEvent('desktop_added_alert', {});
	};

	return (
		<>
			<div className="fixed inset-0 bg-default p-3">
				<h1 className="font-bold mb-4">Add Price Alert</h1>

				<form onSubmit={addAlert} className="flex flex-col">
					<h3 className="text-base font-bold mt-2 mb-1">1. Select store(s)</h3>
					<div className="flex flex-col space-y-0 items-start" ref={storeSelector}>
						<div key={'all'} className="flex flex-row items-center space-x-2 m-0">
							<label htmlFor={'all'} className="text-lg text-gray-800 m-0">
								All
							</label>
							<input
								name={'all'}
								value={'all'}
								type="checkbox"
								className="h-5 w-5 text-theme-blue rounded m-0"
								onChange={storeToggled}
								checked={selectableStores().length === selectedStores.length}
							></input>
						</div>

						{selectableStores().map((store) => {
							return (
								<div
									key={store.store.id}
									className="flex flex-row items-center space-x-2 m-0"
								>
									<label
										htmlFor={store.store.id}
										className="text-lg text-gray-800 m-0"
									>
										{storeLabel(store)}
									</label>
									<input
										name={store.store.id}
										value={store.store.id}
										type="checkbox"
										className="h-5 w-5 text-theme-blue rounded m-0"
										onChange={storeToggled}
										checked={selectedStores.includes(store)}
									></input>
								</div>
							);
						})}
					</div>
					<h3 className="text-base font-bold mt-4 mb-1">2. Select size</h3>

					<select
						className="w-full bg-default2 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
						onChange={sizeSelected}
						name="size"
						id="size"
						value={selectedSize}
					>
						{selectableSizes.map((size) => {
							return (
								<option key={size} value={size}>
									{size}
								</option>
							);
						})}
					</select>
					<h3 className="text-base font-bold mt-4 mb-1">{`3. Notify me when`}</h3>

					<select
						className="w-full bg-default2 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
						onChange={priceTypeSelected}
						name="type"
						id="type"
						value={priceType}
					>
						<option value="ask">Ask price</option>
						<option value="bid">Bid price</option>
					</select>
					<h3 className="text-base font-bold mt-1 mb-1">{`goes`}</h3>

					<select
						className="w-full bg-default2 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
						onChange={relationSelected}
						name="relation"
						id="relation"
						value={relation}
					>
						<option value="below">Below</option>
						<option value="above">Above</option>
					</select>

					<h3 className="text-base font-bold mt-1 mb-1">{`target price:`}</h3>

					<div className="flex items-center space-x-2">
						<input
							className="w-full bg-default2 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
							ref={priceField}
							type="number"
							name="pricefield"
							id="pricefield"
						/>
						<p className="text-xl font-medium">{prop.currency.symbol}</p>
					</div>

					<h3 className="text-base font-bold mt-1 mb-1">{`including:`}</h3>
					<select
						className="w-full bg-default2 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
						onChange={feeTypeSelected}
						name="feeType"
						id="feeType"
						value={feeType}
					>
						<option value="None">No fees</option>
						<option value="Sell">Seller fees</option>
						<option value="Buy">Buyer fees</option>
					</select>

					<input
						className="mt-4 button-default text-white bg-theme-orange hover:bg-theme-orange-dark rounded-lg bg h-10 shadow-md border-transparent"
						type="submit"
						value="Add alert"
					/>
				</form>
				<button
					className="mt-2 w-full button-default text-theme-orange rounded-lg bg h-10"
					onClick={prop.setShowAddPriceAlertModal.bind(null, false)}
				>
					Cancel
				</button>
			</div>
			<Popup
				title="Oh-oh"
				message={error?.message}
				open={error?.show}
				close={setError.bind(null, { message: error?.message ?? '', show: false })}
			></Popup>
		</>
	);
};

export default AddAlertModal;
