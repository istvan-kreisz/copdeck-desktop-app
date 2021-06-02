import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Currency, ALLCURRENCIES, EUR } from '@istvankreisz/copdeck-scraper/dist/types';
import { QuestionMarkCircleIcon } from '@heroicons/react/solid';
import Popup from '../Components/Popup';
import { stringify } from '../utils/proxyparser';
import { Switch } from '@headlessui/react';

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

	const [updateInterval, setUpdateInterval] = useState('5');
	const [notificationFrequency, setNotificationFrequency] = useState('24');
	const [selectedCurrency, setSelectedCurrency] = useState<Currency>(EUR);
	const [telltipMessage, setTelltipMessage] = useState<{
		title: string;
		message: string;
		show: boolean;
	}>({
		title: '',
		message: '',
		show: false,
	});
	const [enabled, setEnabled] = useState(false);

	// const { listenToSettingsChanges } = databaseCoordinator();

	useEffect(() => {
		(async () => {
			// await listenToSettingsChanges((settings) => {
			// 	setSelectedCurrency(settings.currency);
			// 	const proxyField = proxyTextField.current;
			// 	if (proxyField) {
			// 		proxyField.value = stringify(settings.proxies);
			// 	}
			// 	setNotificationFrequency(`${settings.notificationFrequency}`);
			// 	setUpdateInterval(`${settings.updateInterval}`);
			// });
		})();
	}, []);

	const saveSettings = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const interval = parseFloat(updateInterval ?? '');
		const notificationInterval = parseFloat(notificationFrequency ?? '24');

		// chrome.runtime.sendMessage(
		// 	{
		// 		settings: {
		// 			settings: {
		// 				proxies: [],
		// 				currency: selectedCurrency,
		// 				updateInterval: interval,
		// 				notificationFrequency: notificationInterval,
		// 			},
		// 			proxyString: proxyTextField.current?.value ?? '',
		// 		},
		// 	},
		// 	(response) => {
		// 		if (response) {
		// 			setTelltipMessage({
		// 				title: 'Invalid proxy format',
		// 				message: response,
		// 				show: true,
		// 			})
		// 		} else {
		// 			prop.setToastMessage({ message: 'Settings saved', show: true })
		// 		}
		// 	}
		// )
	};

	const changedInterval = (event: { target: HTMLInputElement }) => {
		setUpdateInterval(event.target.value);
	};

	const changedNotificationFrequency = (event: { target: HTMLInputElement }) => {
		setNotificationFrequency(event.target.value);
	};

	const changedCurrency = (event: { target: HTMLInputElement }) => {
		const currencyCode = event.target.value['code'];
		const currency = ALLCURRENCIES.find((c) => c.code === currencyCode);
		if (currency) {
			setSelectedCurrency(currency);
		}
	};

	const clickedContact = () => {
		// chrome.tabs.create({ url: 'https://copdeck.com/contact' })
	};

	return (
		<>
			<div className="bg-gray-100 p-3 w-full h-full overflow-y-scroll overflow-x-hidden">
				<h1 key="header" className="font-bold mb-4">
					Settings
				</h1>

				<form key="form" onSubmit={saveSettings} className="flex flex-col">
					<h3 className="text-base font-bold mt-0 mb-1">Currency</h3>

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

					<div className="flex flex-row items-center mt-2 mb-1 space-x-1">
						<h3 className="text-base font-bold">Proxies</h3>
						<QuestionMarkCircleIcon
							onClick={setTelltipMessage.bind(null, {
								title: 'Proxies',
								message: `Add a list of proxies here if you're a heavy user and you're worried about your IP getting blocked by one of the supported sites. The extension will take care of rotating them automatically. Make sure you click on "Save Settings" on the bottom of this page. Alternatively, you can just use a VPN on your computer.`,
								show: true,
							})}
							className="h-4 cursor-pointer text-gray-800 flex-shrink-0"
						></QuestionMarkCircleIcon>
					</div>

					{/* <div className="py-16">
						<Switch
							checked={enabled}
							onChange={setEnabled}
							className={`${enabled ? 'bg-teal-900' : 'bg-teal-700'}
          relative inline-flex flex-shrink-0 h-[38px] w-[74px] border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus-visible:ring-2  focus-visible:ring-white focus-visible:ring-opacity-75`}
						>
							<span className="sr-only">Use setting</span>
							<span
								aria-hidden="true"
								className={`${enabled ? 'translate-x-9' : 'translate-x-0'}
            pointer-events-none inline-block h-[34px] w-[34px] rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200`}
							/>
						</Switch>
					</div>
 */}
					<textarea
						ref={proxyTextField}
						style={{ resize: 'none' }}
						id="proxies"
						placeholder="Add a list of proxies here, separated by commas, spaces or newlines"
						name="proxies"
						rows={2}
						className="w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-6"
					></textarea>

					<div className="flex flex-row items-center mt-2 mb-1 space-x-1">
						<h3 className="text-base font-bold">Refresh frequency</h3>
						<QuestionMarkCircleIcon
							onClick={setTelltipMessage.bind(null, {
								title: 'Refresh frequency',
								message:
									"How often the extension fetches new prices. Lower settings give you more accurate data but may increase the risk of your IP getting blocked by a resell site. If you're a heavy user we recommend using proxies or a VPN.",
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

					<div className="flex flex-row items-center mt-2 mb-1 space-x-1">
						<h3 className="text-base font-bold">Notification frequency</h3>
						<QuestionMarkCircleIcon
							onClick={setTelltipMessage.bind(null, {
								title: 'Notification frequency',
								message: `How often the extension will send you Chrome notifications if an item's price stays below your target price. Make sure notifications are enabled in your Chrome and system settings.`,
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

					<input
						className="mt-4 w-full button-default text-white bg-theme-orange hover:bg-theme-orange-dark rounded-lg bg h-10 shadow-md border-transparent"
						type="submit"
						value="Save Settings"
					/>
				</form>
				<div className="mt-5 mb-2 border border-gray-300"></div>
				<div className="flex flex-row flex-nowrap items-center">
					<h3 className="text-lg font-bold text-gray-600">Got questions?</h3>
					<button
						onClick={clickedContact}
						className="button-default text-theme-blue border-transparent underline"
						type="submit"
					>
						Contact us!
					</button>
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
