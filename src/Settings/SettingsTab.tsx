import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Currency, ALLCURRENCIES, EUR } from '@istvankreisz/copdeck-scraper/dist/types';
import { QuestionMarkCircleIcon } from '@heroicons/react/solid';
import Popup from '../Components/Popup';
import { stringify } from '../utils/proxyparser';
import { is } from 'superstruct';
import { SettingsSchema } from '../utils/types';
import { IpcRenderer } from 'electron';
const ipcRenderer: IpcRenderer = window.require('electron').ipcRenderer;

const SettingsTab = (prop: {
	setToastMessage: React.Dispatch<
		React.SetStateAction<{
			message: string;
			show: boolean;
		}>
	>;
}) => {
	const proxyTextField = useRef<HTMLTextAreaElement>(null);
	const currencySelector = useRef<HTMLDivElement>(null);
	const goatShippingFeeField = useRef<HTMLInputElement>(null);
	const goatVATField = useRef<HTMLInputElement>(null);

	const [updateInterval, setUpdateInterval] = useState('5');
	const [notificationFrequency, setNotificationFrequency] = useState('24');
	const [selectedCurrency, setSelectedCurrency] = useState<Currency>(EUR);
	const [stockxLevel, setStockxLevel] = useState<1 | 2 | 3 | 4>(1);
	const [goatCommissionFee, setGoatCommissionFee] = useState<9.5 | 15 | 25>(9.5);
	const [includeGoatCashoutFee, setIncludeGoatCashoutFee] = useState<boolean>(true);
	const [goatShippingFee, setGoatShippingFee] = useState<40 | number>(40);
	const [goatVAT, setGoatVAT] = useState<number>(0);
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
			}
		});

		ipcRenderer.on('saveSettings', (event, response) => {
			if (response) {
				setTelltipMessage({
					title: 'Invalid proxy format',
					message: response,
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

		ipcRenderer.send('saveSettings', {
			settings: {
				proxies: [],
				currency: selectedCurrency,
				updateInterval: interval,
				notificationFrequency: notificationInterval,
			},
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

	const stockxLevelSelected = (event: { target: HTMLSelectElement }) => {
		const value = parseInt(event.target.value);
		if (value === 1 || value === 2 || value === 3 || value === 4) {
			setStockxLevel(value);
		}
	};

	const goatCommissionFeeSelected = (event: { target: HTMLSelectElement }) => {
		const value = parseInt(event.target.value);
		if (value === 9.5 || value === 15 || value === 25) {
			setGoatCommissionFee(value);
		}
	};

	const goatIncludeCashoutFeeSelected = (event: { target: HTMLSelectElement }) => {
		const value = event.target.value;
		setIncludeGoatCashoutFee(value === 'include');
	};

	return (
		<>
			<div className="bg-gray-100 p-3 w-full h-full overflow-y-scroll overflow-x-hidden">
				<h1 key="header" className="font-bold text-3xl mb-4">
					Settings
				</h1>

				<form key="form" onSubmit={saveSettings} className="flex flex-col">
					<h3 className="text-xl font-bold mt-0 mb-1">Currency</h3>

					<div className="flex flex-row space-x-2 items-start" ref={currencySelector}>
						{ALLCURRENCIES.map((currency) => currency.code).map((currency) => {
							return (
								<div
									key={currency}
									className="flex flex-row items-center space-x-2 m-0"
								>
									<label className="text-lg text-gray-800 m-0" htmlFor={currency}>
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
									/>
								</div>
							);
						})}
					</div>

					<div className="flex flex-row items-center mt-6 mb-1 space-x-1">
						<h3 className="text-xl font-bold">Proxies</h3>
						<QuestionMarkCircleIcon
							onClick={setTelltipMessage.bind(null, {
								title: 'Proxies',
								message: `In most cases you don't need to use proxies, but if you want to be extra safe you can add your own proxies here. The app will take care of rotating them automatically. Make sure you click on "Save Settings" on the bottom of this page. You can also just use a VPN app to hide your IP.`,
								show: true,
							})}
							className="h-4 cursor-pointer text-gray-800 flex-shrink-0"
						></QuestionMarkCircleIcon>
					</div>

					<textarea
						ref={proxyTextField}
						style={{ resize: 'none' }}
						id="proxies"
						placeholder="Add a list of proxies here, separated by commas, spaces or newlines. Use the following format: user:pw@ip:port OR ip:port"
						name="proxies"
						rows={3}
						className="w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-6"
					></textarea>

					<div className="flex flex-row items-center mt-6 mb-1 space-x-1">
						<h3 className="text-xl font-bold">Refresh frequency</h3>
						<QuestionMarkCircleIcon
							onClick={setTelltipMessage.bind(null, {
								title: 'Refresh frequency',
								message:
									"How often the app fetches new prices. Lower settings give you more accurate data but if you use the tool a lot, there's a small chance that some requests may get blocked. In that case you can try using proxies or a VPN.",
								show: true,
							})}
							className="h-4 cursor-pointer text-gray-800 flex-shrink-0"
						></QuestionMarkCircleIcon>
					</div>

					<label htmlFor="pricefield">{`${updateInterval} mins`}</label>

					<input
						type="range"
						min="5"
						max="1440"
						className="focus:outline-none slider w-full bg-white rounded-xl border  border-theme-blue text-base outline-none leading-6"
						id="myRange"
						value={updateInterval}
						onChange={changedInterval}
					/>

					<div className="flex flex-row items-center mt-6 mb-1 space-x-1">
						<h3 className="text-xl font-bold">Notification frequency</h3>
						<QuestionMarkCircleIcon
							onClick={setTelltipMessage.bind(null, {
								title: 'Notification frequency',
								message: `How often the app will send you notifications if an item's price reaches your target price. Make sure notifications are enabled in your system settings.`,
								show: true,
							})}
							className="h-4 cursor-pointer text-gray-800 flex-shrink-0"
						></QuestionMarkCircleIcon>
					</div>

					<label htmlFor="pricefield">{`${notificationFrequency} hours`}</label>

					<input
						type="range"
						min="1"
						max="168"
						className="focus:outline-none slider w-full bg-white rounded-xl border  border-theme-blue text-base outline-none leading-6"
						id="notificationFrequency"
						value={notificationFrequency}
						onChange={changedNotificationFrequency}
					/>

					<h3 className="text-xl font-bold mt-6 mb-1">Buyer & Seller fee calculation</h3>

					<h4 className="text-lg font-bold mt-2 mb-1">StockX</h4>
					<h5 className="text-base font-bold mb-1">Seller level</h5>

					<select
						className="w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
						onChange={stockxLevelSelected}
						name="type"
						id="type"
					>
						<option value="1">Level 1</option>
						<option value="2">Level 2</option>
						<option value="3">Level 3</option>
						<option value="4">Level 4</option>
					</select>

					<h4 className="text-lg font-bold mt-2 mb-1">GOAT</h4>
					<h5 className="text-base font-bold mb-1">Commission fee percentage</h5>

					<select
						className="w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
						onChange={goatCommissionFeeSelected}
						name="type"
						id="type"
					>
						<option value="9.5">9.5%</option>
						<option value="15">15%</option>
						<option value="25">25%</option>
					</select>

					<h5 className="text-base font-bold mb-1">Include cash-out fee (2.9%)</h5>

					<select
						className="w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
						onChange={goatIncludeCashoutFeeSelected}
						name="type"
						id="type"
					>
						<option value="include">Include</option>
						<option value="dontinclude">Don't include</option>
					</select>

					<h5 className="text-base font-bold mb-1">Shipping fee</h5>

					<div className="flex flex-row flex-nowrap space-x-2 items-center">
						<input
							className="w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
							ref={goatShippingFeeField}
							type="number"
							name="goatShippingFeeField"
							id="goatShippingFeeField"
						/>
						<p className="text-xl font-medium">$</p>
					</div>

					<h5 className="text-base font-bold mb-1">VAT</h5>
					<div className="flex flex-row flex-nowrap space-x-2 items-center">
						<input
							className="w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-8"
							ref={goatVATField}
							type="number"
							name="goatVATField"
							id="goatVATField"
						/>
						<p className="text-xl font-medium">%</p>
					</div>

					<input
						className="mt-4 w-full button-default text-white bg-theme-orange hover:bg-theme-orange-dark rounded-lg bg h-10 shadow-md border-transparent"
						type="submit"
						value="Save Settings"
					/>
				</form>
				<div className="mt-5 mb-2 border border-gray-300"></div>
				<div className="flex flex-row flex-nowrap items-center">
					<h3 className="text-lg font-bold text-gray-600">Got questions?</h3>
					<a
						target="_blank"
						href="https://copdeck.com/contact"
						className="button-default text-theme-blue border-transparent underline"
						type="submit"
					>
						Contact us!
					</a>
				</div>
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
