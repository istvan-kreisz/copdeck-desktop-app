import React from 'react';
import { useState, useRef, useEffect, useContext } from 'react';
import {
	Currency,
	ALLCURRENCIES,
	EUR,
	ALLCOUNTRIES,
	CountryName,
} from '@istvankreisz/copdeck-scraper/dist/types';
import { isCountryName } from '@istvankreisz/copdeck-scraper';

import { QuestionMarkCircleIcon } from '@heroicons/react/solid';
import Popup from '../Components/Popup';
import { stringify } from '../utils/proxyparser';
import { is } from 'superstruct';
import { SettingsSchema, Settings } from '../utils/types';
import { IpcRenderer } from 'electron';
const ipcRenderer: IpcRenderer = window.require('electron').ipcRenderer;
import FirebaseContext from '../context/firebaseContext';

const SettingsTab = (prop: {
	setToastMessage: React.Dispatch<
		React.SetStateAction<{
			message: string;
			show: boolean;
		}>
	>;
}) => {
	const proxyTextField = useRef<HTMLTextAreaElement>(null);
	const goatTaxesField = useRef<HTMLInputElement>(null);
	const stockxTaxesField = useRef<HTMLInputElement>(null);

	const firebase = useContext(FirebaseContext);

	const [updateInterval, setUpdateInterval] = useState('5');
	const [darkModeOn, setDarkModeOn] = useState(false);
	const [versionNumber, setVersionNumber] = useState<string>();
	const [notificationFrequency, setNotificationFrequency] = useState('24');
	const [selectedCurrency, setSelectedCurrency] = useState<Currency>(EUR);
	const [country, setCountry] = useState<CountryName>('Austria');
	const [stockxLevel, setStockxLevel] = useState<1 | 2 | 3 | 4 | 5>(1);
	const [includeStockXQuickShipBonus, setIncludeStockXQuickShipBonus] = useState<
		'include' | 'dontinclude'
	>('include');
	const [includeStockXSuccessfulShipBonus, setIncludeStockXSuccessfulShipBonus] = useState<
		'include' | 'dontinclude'
	>('include');
	const [goatCommissionFee, setGoatCommissionFee] = useState<9.5 | 15 | 20>(9.5);
	const [includeGoatCashoutFee, setIncludeGoatCashoutFee] = useState<'include' | 'dontinclude'>(
		'include'
	);

	const [telltipMessage, setTelltipMessage] = useState<{
		title: string;
		message: string;
		show: boolean;
	}>({
		title: '',
		message: '',
		show: false,
	});

	useEffect(() => {
		const versionNumber = ipcRenderer.sendSync('getVersionNumber');
		setVersionNumber(versionNumber);

		ipcRenderer.send('getSettings');
		ipcRenderer.on('settingsUpdated', (event, settings) => {
			if (is(settings, SettingsSchema)) {
				setSelectedCurrency(settings.currency);
				const proxyField = proxyTextField.current;
				if (proxyField) {
					proxyField.value = stringify(settings.proxies);
				}
				setNotificationFrequency(`${settings.notificationFrequency}`);
				setUpdateInterval(`${settings.updateInterval}`);
				const countryName = settings.feeCalculation.countryName;
				if (isCountryName(countryName)) {
					setCountry(countryName);
				}
				setDarkModeOn(settings.darkModeOn);
				setStockxLevel(settings.feeCalculation.stockx.sellerLevel);
				if (stockxTaxesField.current) {
					stockxTaxesField.current.value = `${settings.feeCalculation.stockx.taxes}`;
				}
				setGoatCommissionFee(settings.feeCalculation.goat.commissionPercentage);
				setIncludeGoatCashoutFee(
					settings.feeCalculation.goat.cashOutFee === 0.029 ? 'include' : 'dontinclude'
				);
				setIncludeStockXQuickShipBonus(
					settings.feeCalculation.stockx.quickShipBonus ? 'include' : 'dontinclude'
				);
				setIncludeStockXSuccessfulShipBonus(
					settings.feeCalculation.stockx.successfulShipBonus ? 'include' : 'dontinclude'
				);

				if (goatTaxesField.current) {
					goatTaxesField.current.value = `${settings.feeCalculation.goat.taxes}`;
				}
			}
		});

		ipcRenderer.on('saveSettings', (event, response) => {
			if (response && response.title && response.message) {
				setTelltipMessage({
					title: response.title,
					message: response.message,
					show: true,
				});
			} else {
				prop.setToastMessage({ message: 'Settings saved', show: true });
			}
		});

		return () => {
			ipcRenderer.removeAllListeners('settingsUpdated');
			ipcRenderer.removeAllListeners('saveSettings');
		};
	}, []);

	const saveSettings = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const interval = parseFloat(updateInterval ?? '');
		const notificationInterval = parseFloat(notificationFrequency ?? '24');

		const newSettings: Settings = {
			proxies: [],
			currency: selectedCurrency,
			updateInterval: interval,
			notificationFrequency: notificationInterval,
			darkModeOn: darkModeOn,
			feeCalculation: {
				countryName: country,
				stockx: {
					sellerLevel: stockxLevel,
					taxes: parseFloat(stockxTaxesField.current?.value ?? '') ?? 0,
					quickShipBonus: includeStockXQuickShipBonus === 'include' && stockxLevel >= 4,
					successfulShipBonus:
						includeStockXSuccessfulShipBonus === 'include' && stockxLevel >= 4,
				},
				goat: {
					commissionPercentage: goatCommissionFee,
					cashOutFee: includeGoatCashoutFee === 'include' ? 0.029 : 0,
					taxes: parseFloat(goatTaxesField.current?.value ?? '') ?? 0,
				},
			},
		};

		ipcRenderer.send('saveSettings', {
			settings: newSettings,
			proxyString: proxyTextField.current?.value ?? '',
		});
	};

	const changedInterval = (event: { target: HTMLInputElement }) => {
		setUpdateInterval(event.target.value);
	};

	const changedNotificationFrequency = (event: { target: HTMLInputElement }) => {
		setNotificationFrequency(event.target.value);
	};

	const changedCurrency = (event: { target: HTMLInputElement }) => {
		const currencyCode = event.target.value;
		const currency = ALLCURRENCIES.find((c) => c.code === currencyCode);
		if (currency) {
			setSelectedCurrency(currency);
		}
	};

	const changedDarkModeState = (event: { target: HTMLInputElement }) => {
		const darkModeState = event.target.value;
		if (darkModeState) {
			setDarkModeOn(darkModeState === 'On');
		}
	};

	const countrySelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		if (isCountryName(value)) {
			const countryName: CountryName = value;
			setCountry(countryName);
		}
	};

	const stockxLevelSelected = (event: { target: HTMLSelectElement }) => {
		const value = parseInt(event.target.value);
		if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
			setStockxLevel(value);
		}
	};

	const goatCommissionFeeSelected = (event: { target: HTMLSelectElement }) => {
		const value = parseFloat(event.target.value);
		if (value === 9.5 || value === 15 || value === 20) {
			setGoatCommissionFee(value);
		}
	};

	const goatIncludeCashoutFeeSelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		if (value === 'include' || value === 'dontinclude') {
			setIncludeGoatCashoutFee(value);
		}
	};
	const stockXSuccessfulShipBonusSelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		if (value === 'include' || value === 'dontinclude') {
			setIncludeStockXSuccessfulShipBonus(value);
		}
	};
	const stockXQuickShipBonusSelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		if (value === 'include' || value === 'dontinclude') {
			setIncludeStockXQuickShipBonus(value);
		}
	};

	const headerWithTellTip = (header: string, tellTip: { title: string; message: string }) => {
		return (
			<div className="flex flex-row items-center mb-1 space-x-1">
				<h3 className="text-xl font-bold">{header}</h3>
				<QuestionMarkCircleIcon
					onClick={setTelltipMessage.bind(null, {
						title: tellTip.title,
						message: tellTip.message,
						show: true,
					})}
					className="h-4 cursor-pointer text-gray-800 dark:text-gray-400 flex-shrink-0"
				></QuestionMarkCircleIcon>
			</div>
		);
	};

	const subheaderWithTellTip = (header: string, tellTip: { title: string; message: string }) => {
		return (
			<div className="flex flex-row items-center mt-2 mb-1 space-x-1">
				<h5 className="text-base font-bold">{header}</h5>
				<QuestionMarkCircleIcon
					onClick={setTelltipMessage.bind(null, {
						title: tellTip.title,
						message: tellTip.message,
						show: true,
					})}
					className="h-4 cursor-pointer text-gray-800 dark:text-gray-400 flex-shrink-0"
				></QuestionMarkCircleIcon>
			</div>
		);
	};

	const clickedDonate = () => {
		firebase?.analytics().logEvent('desktop_clicked_donate', {});
	};

	const clickedDiscord = () => {
		firebase?.analytics().logEvent('desktop_clicked_discord', {});
	};

	return (
		<>
			<div className="bg-default p-3 w-full h-full overflow-y-scroll overflow-x-hidden">
				<h1 key="header" className="font-bold text-3xl mb-4">
					Settings
				</h1>

				<form id="settings" key="form" onSubmit={saveSettings} className="flex flex-col">
					<h3 className="text-xl font-bold mt-0 mb-1">Dark Mode</h3>

					<div className="flex flex-row space-x-2 items-start">
						{['On', 'Off'].map((state) => {
							return (
								<div
									key={state}
									className="flex flex-row items-center space-x-2 m-0"
								>
									<label className="text-lg m-0" htmlFor={state}>
										{state}
									</label>

									<input
										type="radio"
										id={state}
										name="darkmode"
										value={state}
										checked={state === (darkModeOn ? 'On' : 'Off')}
										onChange={changedDarkModeState}
										className="h-5 w-5 text-theme-blue rounded-full m-0"
										style={{ color: 'rgba(0, 2, 252, 1)) !important' }}
									/>
								</div>
							);
						})}
					</div>

					<div className="my-5 border border-gray-300 dark:border-gray-700"></div>

					<h3 className="text-xl font-bold mt-0 mb-1">Currency</h3>

					<div className="flex flex-row space-x-2 items-start">
						{ALLCURRENCIES.map((currency) => currency.code).map((currency) => {
							return (
								<div
									key={currency}
									className="flex flex-row items-center space-x-2 m-0"
								>
									<label className="text-lg m-0" htmlFor={currency}>
										{currency}
									</label>

									<input
										type="radio"
										id={currency}
										name="currency"
										value={currency}
										checked={currency === selectedCurrency.code}
										onChange={changedCurrency}
										className="h-5 w-5 text-theme-blue rounded-full m-0"
										style={{ color: 'rgba(0, 2, 252, 1))' }}
									/>
								</div>
							);
						})}
					</div>

					<div className="my-5 border border-gray-300 dark:border-gray-700"></div>

					{headerWithTellTip('Proxies', {
						title: 'Proxies',
						message: `In most cases you don't need to use proxies, but if you want to be extra safe you can add your own proxies here. The app will take care of rotating them automatically. Make sure you click on "Save Settings" on the bottom of this page. You can also just use a VPN app to hide your IP.`,
					})}

					<textarea
						ref={proxyTextField}
						style={{ resize: 'none' }}
						id="proxies"
						placeholder="Add a list of proxies here, separated by commas, spaces or newlines. Use the following format: user:pw@ip:port OR ip:port"
						name="proxies"
						rows={3}
						className="w-full"
					></textarea>

					<div className="my-5 border border-gray-300 dark:border-gray-700"></div>

					{headerWithTellTip('Refresh frequency', {
						title: 'Refresh frequency',
						message:
							"How often the app fetches new prices. Lower settings give you more accurate data but if you use the tool a lot, there's a small chance that some requests may get blocked. In that case you can try using proxies or a VPN.",
					})}

					<label htmlFor="pricefield">{`${updateInterval} mins`}</label>

					<input
						type="range"
						min="5"
						max="1440"
						className="focus:outline-none slider w-full"
						id="myRange"
						value={updateInterval}
						onChange={changedInterval}
					/>

					<div className="my-5 border border-gray-300 dark:border-gray-700"></div>

					{headerWithTellTip('Notification frequency', {
						title: 'Notification frequency',
						message: `How often the app will send you notifications if an item's price reaches your target price. Make sure notifications are enabled in your system settings.`,
					})}

					<label htmlFor="pricefield">{`${notificationFrequency} hours`}</label>

					<input
						type="range"
						min="1"
						max="168"
						className="focus:outline-none slider w-full"
						id="notificationFrequency"
						value={notificationFrequency}
						onChange={changedNotificationFrequency}
					/>

					<div className="my-8 border border-gray-300 dark:border-gray-700"></div>

					<h3 className="text-xl font-bold mb-1">Fee calculation</h3>

					<h4 className="text-lg font-bold mt-2 mb-1">Country</h4>

					<select
						className="w-full"
						onChange={countrySelected}
						name="type"
						id="type"
						value={country}
					>
						{ALLCOUNTRIES.map((country) => {
							return (
								<option key={country.code} value={country.name}>
									{country.name}
								</option>
							);
						})}
					</select>

					<h4 className="text-lg font-bold mt-4 mb-1">StockX</h4>
					<h5 className="text-base font-bold mb-1">Seller level</h5>

					<select
						className="w-full"
						onChange={stockxLevelSelected}
						name="type"
						id="type"
						value={stockxLevel}
					>
						<option value="1">Level 1</option>
						<option value="2">Level 2</option>
						<option value="3">Level 3</option>
						<option value="4">Level 4</option>
						<option value="5">Level 5</option>
					</select>

					{subheaderWithTellTip('Taxes', {
						title: 'StockX Taxes',
						message:
							'In some countries, extra taxes and duties may be added to the price at checkout. If this applies to you, you can specify the amount here.',
					})}

					<div className="flex flex-row flex-nowrap space-x-2 items-center">
						<input
							className="w-full rounded-xl"
							ref={stockxTaxesField}
							type="number"
							name="stockxTaxesField"
							id="stockxTaxesField"
							step=".01"
						/>
						<p className="text-xl font-medium">%</p>
					</div>

					{stockxLevel >= 4 ? (
						<>
							<div className="flex flex-row items-center mt-2 mb-1 space-x-1">
								<h5 className="text-base font-bold">
									StockX quick ship bonus (-1%)
								</h5>
							</div>

							<select
								className="w-full"
								onChange={stockXQuickShipBonusSelected}
								name="type"
								id="type"
								value={includeStockXQuickShipBonus}
							>
								<option value="include">Include</option>
								<option value="dontinclude">Don't include</option>
							</select>

							<div className="flex flex-row items-center mt-2 mb-1 space-x-1">
								<h5 className="text-base font-bold">
									StockX successful ship bonus (-1%)
								</h5>
							</div>

							<select
								className="w-full"
								onChange={stockXSuccessfulShipBonusSelected}
								name="type"
								id="type"
								value={includeStockXSuccessfulShipBonus}
							>
								<option value="include">Include</option>
								<option value="dontinclude">Don't include</option>
							</select>
						</>
					) : null}

					<h4 className="text-lg font-bold mt-4 mb-1">GOAT</h4>
					{subheaderWithTellTip('Commission fee percentage', {
						title: 'GOAT Commission fee',
						message:
							'GOAT charges a commission fee on every sale. The fee can be 9.5%, 15% or 20% depending on your seller rating.',
					})}

					<select
						className="w-full"
						onChange={goatCommissionFeeSelected}
						name="type"
						id="type"
						value={goatCommissionFee}
					>
						<option value="9.5">9.5%</option>
						<option value="15">15%</option>
						<option value="20">20%</option>
					</select>

					{subheaderWithTellTip('Include cash-out fee (2.9%)', {
						title: 'GOAT Cash-out fee',
						message: `When you withdraw money from your GOAT account, you have to pay a 2.9% cash-out fee. Set this to "Don't include" if you don't want this to be included in the price calculation.`,
					})}

					<select
						className="w-full"
						onChange={goatIncludeCashoutFeeSelected}
						name="type"
						id="type"
						value={includeGoatCashoutFee}
					>
						<option value="include">Include</option>
						<option value="dontinclude">Don't include</option>
					</select>

					{subheaderWithTellTip('Taxes', {
						title: 'GOAT Taxes',
						message:
							'In some countries, extra taxes and duties may be added to the price at checkout. If this applies to you, you can specify the amount here.',
					})}

					<div className="flex flex-row flex-nowrap space-x-2 items-center">
						<input
							className="w-full rounded-xl"
							ref={goatTaxesField}
							type="number"
							step=".01"
							name="goatTaxesField"
							id="goatTaxesField"
						/>
						<p className="text-xl font-medium">%</p>
					</div>

					<input
						className="mt-8 w-full button-default text-white bg-theme-orange hover:bg-theme-orange-dark rounded-lg bg h-10 shadow-md border-transparent"
						type="submit"
						value="Save Settings"
					/>
				</form>
				<div className="mt-5 mb-2 border border-gray-300 dark:border-gray-700"></div>
				<div className="flex flex-col items-start">
					<p className="text-base font-bold text-gray-600">
						CopDeck Price Alerts is and will always be free. If you'd like to support
						the development so we can bring you a lot more awesomeness (like our{' '}
						<a
							className="text-theme-blue dark:text-blue-400 border-transparent underline"
							target="_blank"
							href="https://copdeck.com"
						>
							CopDeck iOS app
						</a>
						), you can help us out by donating. Any amount means a lot to us!
					</p>
					<a
						target="_blank"
						href="https://copdeck.com/donate"
						className="button-default p-0 text-lg mt-2 text-theme-blue dark:text-blue-400 border-transparent underline"
						type="submit"
						onClick={clickedDonate}
					>
						Donate now!
					</a>
				</div>
				<div className="mt-3 mb-2 border border-gray-300 dark:border-gray-700"></div>

				<div className="flex flex-col justify-start">
					<div className="flex flex-row flex-nowrap items-center">
						<h3 className="text-lg font-bold text-gray-600">Got questions?</h3>
						<a
							target="_blank"
							href="https://copdeck.com/contact"
							className="button-default text-theme-blue dark:text-blue-400 border-transparent underline"
							type="submit"
						>
							Contact us!
						</a>
					</div>
					<div className="mt-3 flex flex-nowrap items-center">
						<a
							target="_blank"
							href="https://discord.com/invite/cQh6VTvXas"
							className="button-default p-0 text-theme-blue dark:text-blue-400 border-transparent underline"
							type="submit"
							onClick={clickedDiscord}
						>
							Join us on Discord!
						</a>
					</div>
				</div>
				<div className="mt-3 mb-2 border border-gray-300 dark:border-gray-700"></div>

				<p className="text-base font-bold text-gray-600">
					{'CopDeck Price Alerts v' + versionNumber}
				</p>
			</div>
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

export default SettingsTab;
