import './App.css';
import { CheckIcon } from '@heroicons/react/outline';
import MainTab from './Main/MainTab';
import SettingsTab from './Settings/SettingsTab';
import AlertsTab from './Alerts/AlertsTab';
import { useState, useEffect } from 'react';
import { SearchIcon, CogIcon, BellIcon, DeviceMobileIcon } from '@heroicons/react/outline';
import { Currency, EUR } from '@istvankreisz/copdeck-scraper/dist/types';
import { IpcRenderer } from 'electron';
import { SettingsSchema } from './utils/types';
import { is, number } from 'superstruct';
const ipcRenderer: IpcRenderer = window.require('electron').ipcRenderer;
import firebase from 'firebase/app';
import 'firebase/analytics';
import TextfieldPopup from './Components/TextfieldPopup';
import FirebaseContext from './context/firebaseContext';

// const firebaseConfig = {
// 	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
// 	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
// 	databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
// 	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
// 	storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
// 	messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
// 	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
// 	measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
// };

const firebaseConfig = {
	apiKey: 'AIzaSyAN-leerYH2sI4kRBp_cBKPRmjVEGcGp7s',
	authDomain: 'sneakersnshit-2e22f.firebaseapp.com',
	databaseURL: 'https://sneakersnshit-2e22f-default-rtdb.europe-west1.firebasedatabase.app',
	projectId: 'sneakersnshit-2e22f',
	storageBucket: 'sneakersnshit-2e22f.appspot.com',
	messagingSenderId: '451723603004',
	appId: '1:451723603004:web:54fcf1406c2190a0d42739',
	measurementId: 'G-VR6J8VXWFG',
};

const App = () => {
	const [activeTab, setActiveTab] = useState<'main' | 'settings' | 'alerts'>('main');
	const [currency, setCurrency] = useState<Currency>(EUR);
	const [toastMessage, setToastMessage] = useState<{ message: string; show: boolean }>({
		message: '',
		show: false,
	});
	const [firebaseApp, setFirebaseApp] = useState<any>(null);
	const [showFeedbackForm, setShowFeedbackForm] = useState(false);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			if (!firebase.apps.length) {
				firebase.initializeApp(firebaseConfig);
			}
			firebase.analytics();
			setFirebaseApp(firebase);
		}
		firebase?.analytics().logEvent('desktop_started');
	}, [window]);

	useEffect(() => {
		ipcRenderer.send('getSettings');
		ipcRenderer.on('settingsUpdated', (event, settings) => {
			if (is(settings, SettingsSchema)) {
				setCurrency(settings.currency);
			}
		});
		const openedCount = ipcRenderer.sendSync('openedCount');
		if (is(openedCount, number())) {
			if (openedCount === 3) {
				// show email capture
			}
		}
		return () => {
			ipcRenderer.removeAllListeners('settingsUpdated');
		};
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

	useEffect(() => {
		firebase?.analytics().logEvent('desktop_visited_tab', {
			tab: activeTab,
		});
	}, [activeTab]);

	const feedbackFormClosed = (feedback: string | undefined) => {
		if (feedback?.length) {
			ipcRenderer.send('sendFeedback', { message: feedback });
		}
		setShowFeedbackForm(false);
	};

	return (
		<FirebaseContext.Provider value={firebaseApp}>
			<div className="gap-0 grid grid-row-4 absolute top-0 left-0 right-0 bottom-0 text-left">
				<main style={{ height: '648px' }} className="bg-transparent relative w-full">
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
				<section className="h-8 w-full bg-theme-blue flex-grow-0">
					<button
						className="button-default w-full text-white font-bold text-center"
						onClick={setShowFeedbackForm.bind(null, true)}
					>
						Got suggestions? Click here to send feedback!
					</button>
				</section>

				<footer className="h-8 w-full bg-theme-yellow flex-grow-0">
					<a
						target="_blank"
						className="w-full h-full flex space-x-1 flex-row align-middle items-center justify-center"
						href="https://copdeck.com"
					>
						<DeviceMobileIcon
							className="text-center h-6 text-gray-800"
							aria-hidden="true"
						></DeviceMobileIcon>

						<p className="text-gray-800 font-bold">
							Coming soon to iOS! Click for more!
						</p>
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
				<TextfieldPopup
					title={'Send Feedback'}
					placeholder="Send us any suggestions, feedback, bugs you found etc."
					open={showFeedbackForm}
					close={feedbackFormClosed}
				></TextfieldPopup>
			</div>
		</FirebaseContext.Provider>
	);
};

export default App;
