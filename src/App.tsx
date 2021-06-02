import React from 'react';
import logo from './logo.svg';
import './App.css';
import { CheckIcon } from '@heroicons/react/outline';
import MainTab from './Main/MainTab';
import SettingsTab from './Settings/SettingsTab';
import AlertsTab from './Alerts/AlertsTab';
import { useState, useEffect } from 'react';
import { SearchIcon, CogIcon, BellIcon, DeviceMobileIcon } from '@heroicons/react/outline';
// import { databaseCoordinator } from '../electron/services/databaseCoordinator'
import { Currency, EUR } from '@istvankreisz/copdeck-scraper/dist/types';

const App = () => {
	const [activeTab, setActiveTab] = useState<'main' | 'settings' | 'alerts'>('main');
	const [currency, setCurrency] = useState<Currency>(EUR);
	const [toastMessage, setToastMessage] = useState<{ message: string; show: boolean }>({
		message: '',
		show: false,
	});

	// const { listenToSettingsChanges } = databaseCoordinator();

	useEffect(() => {
		(async () => {
			// await listenToSettingsChanges((settings) => {
			// 	setCurrency(settings.currency);
			// });
		})();
		// chrome.runtime.sendMessage({ refresh: true })
	}, []);

	const hideToast = () => {
		setToastMessage({ message: toastMessage?.message ?? '', show: false });
	};

	useEffect(() => {
		let interval;
		if (toastMessage.show) {
			interval = setTimeout(() => {
				hideToast();
			}, 2000);
		}
		return () => {
			if (interval) clearTimeout(interval);
		};
	}, [toastMessage]);

	const selectedTab = (tab: 'main' | 'settings' | 'alerts') => {
		setActiveTab(tab);
	};

	const clickedLink = () => {
		// chrome.tabs.create({ url: 'https://copdeck.com' })
	};

	return (
		<div className="gap-0 grid grid-row-3 absolute top-0 left-0 right-0 bottom-0 text-left">
			<main style={{ height: '500px' }} className="bg-transparent relative w-full">
				<div className={`h-full ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
					<SettingsTab setToastMessage={setToastMessage}></SettingsTab>
				</div>
				<div className={`h-full ${activeTab === 'main' ? 'block' : 'hidden'}`}>
					<MainTab setToastMessage={setToastMessage} currency={currency}></MainTab>
				</div>
				<div className={`h-full ${activeTab === 'alerts' ? 'block' : 'hidden'}`}>
					<AlertsTab
						setToastMessage={setToastMessage}
						currency={currency}
						activeTab={activeTab}
					></AlertsTab>
				</div>
			</main>
			<section className="bg-white w-full flex h-12 border-gray-400 shadow-xl">
				<button
					className={`outline-none group focus:outline-none flex-1 ${
						activeTab === 'settings' ? 'bg-gray-200 shadow-xl' : ''
					}`}
					onClick={selectedTab.bind(null, 'settings')}
				>
					<CogIcon
						className={`mx-auto text-center h-6 w-6 ${
							activeTab === 'settings' ? 'text-gray-800' : 'text-gray-500'
						}`}
						aria-hidden="true"
					></CogIcon>
					<p
						className={`text-xs font-medium ${
							activeTab === 'settings' ? 'text-gray-800' : 'text-gray-500'
						}`}
					>
						Settings
					</p>
				</button>
				<button
					className={`outline-none group focus:outline-none flex-1 ${
						activeTab === 'main' ? 'bg-gray-200 shadow-xl' : ''
					}`}
					onClick={selectedTab.bind(null, 'main')}
				>
					<SearchIcon
						className={`mx-auto text-center h-6 w-6 ${
							activeTab === 'main' ? 'text-gray-800' : 'text-gray-500'
						}`}
						aria-hidden="true"
					></SearchIcon>
					<p
						className={`text-xs font-medium ${
							activeTab === 'main' ? 'text-gray-800' : 'text-gray-500'
						}`}
					>
						Search
					</p>
				</button>
				<button
					className={`outline-none group focus:outline-none flex-1 ${
						activeTab === 'alerts' ? 'bg-gray-200 shadow-xl' : ''
					}`}
					onClick={selectedTab.bind(null, 'alerts')}
				>
					<BellIcon
						className={`mx-auto text-center h-6 w-6 ${
							activeTab === 'alerts' ? 'text-gray-800' : 'text-gray-500'
						}`}
						aria-hidden="true"
					></BellIcon>
					<p
						className={`text-xs font-medium ${
							activeTab === 'alerts' ? 'text-gray-800' : 'text-gray-500'
						}`}
					>
						Alerts
					</p>
				</button>
			</section>
			<footer className="h-8 w-full bg-theme-yellow flex-grow-0">
				<a
					onClick={clickedLink}
					className="w-full h-full flex space-x-1 flex-row align-middle items-center justify-center"
					href="https://copdeck.com"
				>
					<DeviceMobileIcon
						className="text-center h-6 text-gray-800"
						aria-hidden="true"
					></DeviceMobileIcon>

					<p className="text-gray-800 font-bold">Coming soon to iOS! Click for more!</p>
				</a>
			</footer>
			<div
				onClick={hideToast}
				className={`fixed bottom-3 left-3 right-3 h-10 flex items-center text-white bg-green-500 shadow-lg rounded-lg overflow-hidden mx-auto transition duration-500 ease-in-out transform ${
					toastMessage.show
						? '-translate-y-4 opacity-100'
						: 'translate-y-0 opacity-0 pointer-events-none'
				}`}
			>
				<CheckIcon className="ml-3 font-bold h-6 text-white flex-shrink-0"></CheckIcon>

				<div className="flex items-center px-2">
					<p className="text-white text-base">{toastMessage.message}</p>
				</div>
			</div>
		</div>
	);
};

export default App;
