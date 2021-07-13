import React from 'react';
import { useEffect, useState, useRef } from 'react';
import { assert, is, string } from 'superstruct';
import {
	Item,
	Store,
	Currency,
	ALLSTORES,
	FeeType,
	ALLFEETYPES,
} from '@istvankreisz/copdeck-scraper/dist/types';
import { bestStoreInfo } from '@istvankreisz/copdeck-scraper';
import AddAlertModal from '../Main/AddAlertModal';
import { ChevronLeftIcon, RefreshIcon, QuestionMarkCircleIcon } from '@heroicons/react/outline';
import LoadingIndicator from '../Components/LoadingIndicator';
import Popup from '../Components/Popup';
import { IpcRenderer } from 'electron';
const ipcRenderer: IpcRenderer = window.require('electron').ipcRenderer;

const ItemDetail = (prop: {
	selectedItem: Item;
	setSelectedItem: (callback: (item: Item | null | undefined) => Item | null | undefined) => void;
	currency: Currency;
	setToastMessage: React.Dispatch<
		React.SetStateAction<{
			message: string;
			show: boolean;
		}>
	>;
}) => {
	const container = useRef<HTMLDivElement>(null);
	const [showAddPriceAlertModal, setShowAddPriceAlertModal] = useState(false);
	const [priceType, setPriceType] = useState<'ask' | 'bid'>('ask');
	const [feeType, setFeeType] = useState<FeeType>('None');
	const didClickBack = useRef(false);

	const [telltipMessage, setTelltipMessage] = useState<{
		title: string;
		message: JSX.Element | string;
		show: boolean;
	}>({
		title: '',
		message: '',
		show: false,
	});

	const [isLoadingPrices, setIsLoadingPrices] = useState(false);

	const storeInfo = bestStoreInfo(prop.selectedItem);

	const updateItem = (forceRefresh: boolean) => {
		setIsLoadingPrices(true);
		ipcRenderer.send('getItemDetails', { item: prop.selectedItem, forceRefresh: forceRefresh });
	};

	useEffect(() => {
		didClickBack.current = false;
		if (prop.selectedItem) {
			updateItem(false);
		}
		let isFirst = true;

		ipcRenderer.on('getItemDetails', (event, item) => {
			try {
				assert(item, Item);
				if (!didClickBack.current) {
					prop.setSelectedItem((current) => (current ? item : null));

					if (isFirst) {
						const hasOldSizing = !!item.storePrices.find((prices) => {
							return !!prices.inventory.find((price) => {
								return (
									price.size.toLowerCase().includes('y') ||
									price.size.toLowerCase().includes('w') ||
									price.size.toLowerCase().includes('m') ||
									price.size.toLowerCase().includes('c')
								);
							});
						});
						console.log(hasOldSizing);
						isFirst = false;
						updateItem(hasOldSizing);
					}
				}
			} catch {}
			setIsLoadingPrices(false);
		});
		return () => {
			ipcRenderer.removeAllListeners('getItemDetails');
		};
	}, []);

	useEffect(() => {
		if (!showAddPriceAlertModal) {
			if (container.current) {
				container.current.scrollTo(0, 0);
			}
		}
	}, [showAddPriceAlertModal]);

	const backClicked = () => {
		didClickBack.current = true;
		prop.setSelectedItem(() => null);
	};

	const sizeSet = new Set<string>();
	const allStores =
		prop.selectedItem?.storePrices.filter((prices) => prices.inventory.length) ?? [];
	allStores.forEach((store) => {
		return store.inventory.map((inventoryItem) => {
			sizeSet.add(inventoryItem.size);
		});
	});
	const allSizes = Array.from(sizeSet).sort((a, b) => {
		const regex = /[\d|,|.|e|E|\+]+/g;
		const aNum = parseFloat(a.match(regex)?.[0] ?? '');
		const bNum = parseFloat(b.match(regex)?.[0] ?? '');
		if (aNum < bNum) return -1;
		if (aNum > bNum) return 1;
		return 0;
	});

	const price = (
		size: string,
		store: Store
	): { ask: [string, number]; bid: [string, number]; buyLink?: string; sellLink?: string } => {
		const prices = allStores
			.find((s) => s.store.id === store.id)
			?.inventory.find((inventoryItem) => inventoryItem.size === size);
		const storeInfo = prop.selectedItem.storeInfo.find((s) => s.store.id === store.id);
		const ask = prices?.lowestAsk;
		const bid = prices?.highestBid;
		let askPrice: number | null | undefined = ask?.noFees;
		let bidPrice: number | null | undefined = bid?.noFees;
		if (feeType !== 'None') {
			askPrice = feeType === 'Buy' ? ask?.withBuyerFees : ask?.withSellerFees;
			bidPrice = feeType === 'Buy' ? bid?.withBuyerFees : bid?.withSellerFees;
		}
		const askInfo: [string, number] = askPrice
			? [prop.currency.symbol + askPrice, askPrice]
			: ['-', 0];

		const bidInfo: [string, number] = bidPrice
			? [prop.currency.symbol + bidPrice, bidPrice]
			: ['-', 0];
		const regex = /[\d|,|.|e|E|\+]+/g;
		const sizeNum = parseFloat(size.match(regex)?.[0] ?? '');
		const sizeQuery = store.id === 'goat' || store.id === 'stockx' ? `size=${sizeNum}` : '';
		return {
			ask: askInfo,
			bid: bidInfo,
			buyLink: storeInfo?.buyUrl + sizeQuery,
			sellLink: storeInfo?.sellUrl,
		};
	};

	const prices = (
		size: string
	): {
		prices: {
			primaryText: string;
			secondaryText: string;
			buyLink?: string;
			sellLink?: string;
			store: Store;
		}[];
		lowest?: Store;
		highest?: Store;
	} => {
		const prices = ALLSTORES.map((store) => {
			const p = price(size, store);
			return {
				priceText: priceType === 'ask' ? p.ask[0] : p.bid[0],
				secondaryPriceText: priceType === 'ask' ? p.bid[0] : p.ask[0],
				price: priceType === 'ask' ? p.ask[1] : p.bid[1],
				buyLink: p.buyLink,
				sellLink: p.sellLink,
				store: store,
			};
		});
		const realPrices = prices.filter((price) => price.priceText !== '-');
		let lowest: Store | undefined;
		let highest: Store | undefined;
		if (realPrices.length) {
			lowest = realPrices.reduce((prev, current) => {
				return prev.price < current.price ? prev : current;
			})?.store;
			highest = realPrices.reduce((prev, current) => {
				return prev.price > current.price ? prev : current;
			})?.store;
		}

		return {
			lowest: lowest,
			highest: highest,
			prices: prices.map((p) => {
				return {
					primaryText: p.priceText,
					secondaryText: p.secondaryPriceText,
					buyLink: p.buyLink,
					sellLink: p.sellLink,
					store: p.store,
				};
			}),
		};
	};

	const setToastMessage = (message: string, show: boolean) => {
		if (show && ipcRenderer.sendSync('getIsFirstAlert')) {
			setTelltipMessage({
				title: 'Price Alert Notifications',
				message:
					"Price alerts send you notifications on your computer when the item's price reaches your target. To make sure they work properly you need to enable notifications for CopDeck in your Mac or Windows system settings and leave the CopDeck app running.",
				show: true,
			});
		} else {
			prop.setToastMessage({ message, show });
		}
	};

	return (
		<>
			<div ref={container} className="bg-default flex-col fixed inset-0 overflow-y-scroll">
				<section className="relative bg-white w-screen h-48 ">
					<img
						className="w-48 h-full object-contain mx-auto"
						src={prop.selectedItem.imageURL?.url}
						style={
							prop.selectedItem.imageURL?.store.id === 'klekt'
								? { transform: 'scaleX(-1)' }
								: {}
						}
						alt=""
					/>
					<button
						onClick={backClicked}
						className="cursor-pointer flex h-8 w-8 bg-black absolute top-6 left-6 rounded-full justify-center items-center"
					>
						<ChevronLeftIcon className="font-bold h-5 text-white flex-shrink-0"></ChevronLeftIcon>
					</button>
				</section>
				<section className="p-3">
					<p>{storeInfo?.brand?.toUpperCase()}</p>
					<h1 className="my-2 font-bold">{prop.selectedItem.name}</h1>
					<div className="my-4 flex flex-row justify-around">
						<div className="flex flex-col items-center">
							<p className="text-gray-800 font-bold text-base m-0">
								{prop.selectedItem.id}
							</p>
							<p className="m-0">Style</p>
						</div>
						{prop.selectedItem.retailPrice ? (
							<div className="flex flex-col items-center">
								<p className="text-gray-800 font-bold text-base m-0">
									{prop.selectedItem.retailPrice
										? prop.currency.symbol + prop.selectedItem.retailPrice
										: '-'}
								</p>
								<p className="m-0">Retail Price</p>
							</div>
						) : null}
					</div>
				</section>

				<section className="bg-default2 w-screen p-3">
					<div className="flex flex-col justify-between items-start flex-nowrap">
						<h2 className="text-2xl">Price comparison</h2>
						<p className="text-xs">Click on a price to open the buy / sell page</p>
					</div>

					<div className="flex flex-col justify-start mt-2 mb-8 space-y-2">
						<div className="flex flex-row items-center space-x-2">
							<h3 className="text-sm w-12 font-bold">Prices:</h3>
							<button
								className={`button-default w-16 h-8 flex-shrink-0 flex-grow-0 rounded-full border-2 border-theme-blue ${
									priceType === 'ask'
										? 'bg-theme-blue text-white'
										: 'text-gray-800 dark:text-white  border-2'
								}`}
								onClick={setPriceType.bind(null, 'ask')}
							>
								Ask
							</button>
							<button
								className={`button-default w-16 h-8 flex-shrink-0 flex-grow-0 rounded-full border-2 border-theme-blue ${
									priceType === 'bid'
										? 'bg-theme-blue text-white'
										: 'text-gray-800 dark:text-white'
								}`}
								onClick={setPriceType.bind(null, 'bid')}
							>
								Bid
							</button>
						</div>

						<div className="flex flex-row items-center space-x-2">
							<h3 className="text-sm w-12 font-bold">Fees:</h3>
							{ALLFEETYPES.map((type) => {
								return (
									<button
										key={type}
										className={`button-default w-16 h-8 flex-shrink-0 flex-grow-0 rounded-full border-2 border-theme-purple ${
											type === feeType
												? 'bg-theme-purple text-white'
												: 'text-gray-800 dark:text-white'
										}`}
										onClick={setFeeType.bind(null, type)}
									>
										{type}
									</button>
								);
							})}
						</div>
					</div>

					<div className="flex flex-row items-center space-x-1">
						<button
							onClick={updateItem.bind(null, true)}
							className="flex flex-row cursor-pointer focus:outline-none space-x-1 justify-center items-center"
						>
							<p className="text-theme-orange">Refresh prices</p>
							<RefreshIcon className="font-bold h-4 text-theme-orange flex-shrink-0"></RefreshIcon>
						</button>
						<QuestionMarkCircleIcon
							onClick={setTelltipMessage.bind(null, {
								title: 'Price refresh',
								message: `Prices will automatically get refreshed based on your "Refresh frequency" setting on the Settings tab. Sometimes not all prices might load at first, in that case you can use this button to manually refresh prices.`,
								show: true,
							})}
							className="h-4 cursor-pointer text-gray-800 dark:text-gray-400 dark font-semibold flex-shrink-0"
						></QuestionMarkCircleIcon>
					</div>
					<ul className="w-full flex flex-col space-y-2 mt-1">
						<li
							key={'header'}
							className="grid grid-cols-4 gap-x-4 justify-items-center"
						>
							<p className="h-7 rounded-full flex justify-center items-center w-16 justify-self-start">
								Sizes
							</p>
							{ALLSTORES.map((store) => {
								return (
									<a
										href={
											prop.selectedItem.storeInfo.find(
												(s) => s.store.id === store.id
											)?.url
										}
										target="_blank"
										key={store.id}
										className="h-8 text-gray-800 dark:text-gray-400 text-lg font-bold rounded-full flex justify-center items-center w-20 cursor-pointer"
									>
										{store.name}
									</a>
								);
							})}
							<p className="flex-grow"></p>
						</li>

						{!isLoadingPrices
							? allSizes
									.map((size) => {
										return { size: size, prices: prices(size) };
									})
									.map((row) => {
										return (
											<li
												key={row.size}
												className="grid grid-cols-4 gap-x-4 justify-items-center"
											>
												<p className="bg-gray-300 dark:bg-gray-900 h-8 text-sm rounded-full flex justify-center items-center w-20 justify-self-start">
													{row.size}
												</p>
												{row.prices.prices.map((price) => {
													let bubbleStyling = '';
													if (price.primaryText !== '-') {
														if (
															price.store.id ===
																row.prices.lowest?.id &&
															(feeType === 'Buy' ||
																feeType === 'None')
														) {
															bubbleStyling =
																'border-2 border-green-500';
														} else if (
															price.store.id ===
																row.prices.highest?.id &&
															(feeType === 'Sell' ||
																feeType === 'None')
														) {
															bubbleStyling =
																'border-2 border-red-500';
														} else {
															bubbleStyling = 'border-2 border-white';
														}
													}

													return (
														<a
															href={
																feeType === 'Sell'
																	? price.sellLink
																	: price.buyLink
															}
															target="_blank"
															className="flex flex-col items-center"
														>
															<div
																className={`h-8 space-x-1 rounded-full flex flex-row justify-center items-center w-20 ${bubbleStyling}`}
																key={price.store.id}
															>
																<p className="text-base text-gray-600">
																	{price.primaryText}
																</p>
																{price.store.id === 'goat' &&
																price.primaryText !== '-' ? (
																	<QuestionMarkCircleIcon
																		onClick={setTelltipMessage.bind(
																			null,
																			{
																				title: 'GOAT prices',
																				message: (
																					<ul className="list-inside text-left">
																						<li>
																							*GOAT
																							prices
																							always
																							show the
																							price
																							for new
																							items
																							with
																							undamaged
																							boxes
																							and
																							regular
																							shipping.
																							To visit
																							their
																							website
																							for more
																							price
																							options
																							click on
																							"GOAT"
																							in the
																							first
																							row.
																						</li>
																					</ul>
																				),
																				show: true,
																			}
																		)}
																		className="h-3 cursor-pointer text-gray-800 dark:text-gray-400 font-bold flex-shrink-0"
																	></QuestionMarkCircleIcon>
																) : null}
															</div>
															<p
																style={{ fontSize: '11px' }}
																className="text-gray-400"
															>
																{(priceType === 'ask'
																	? 'Bid:'
																	: 'Ask:') + price.secondaryText}
															</p>
														</a>
													);
												})}
												<p className="flex-grow"></p>
											</li>
										);
									})
							: null}
					</ul>
					<div className="mt-6 ml-4 mb-3">
						{isLoadingPrices ? (
							<LoadingIndicator
								key="loading"
								title="Loading Prices"
							></LoadingIndicator>
						) : null}
					</div>
				</section>
				<section className="bg-default2 w-screen p-3">
					{prop.selectedItem.storePrices.length ? (
						<button
							style={{ fontWeight: 'normal' }}
							className="-mt-3 mb-4 mx-auto button-default h-9 flex-shrink-0 flex-grow-0 rounded-full font-thin bg-black dark:bg-gray-600 text-white"
							onClick={setShowAddPriceAlertModal.bind(null, true)}
						>
							Add price alert
						</button>
					) : null}
				</section>
			</div>

			{showAddPriceAlertModal ? (
				<AddAlertModal
					currency={prop.currency}
					selectedItem={prop.selectedItem}
					showAddPriceAlertModal={showAddPriceAlertModal}
					setShowAddPriceAlertModal={setShowAddPriceAlertModal}
					setToastMessage={setToastMessage}
				></AddAlertModal>
			) : null}
			<Popup
				title={telltipMessage?.title}
				message={telltipMessage?.message}
				open={telltipMessage?.show}
				close={setTelltipMessage.bind(null, {
					title: telltipMessage?.title ?? '',
					message: telltipMessage?.message ?? '',
					show: false,
				})}
			></Popup>
		</>
	);
};

export default ItemDetail;
