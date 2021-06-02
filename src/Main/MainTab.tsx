import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { array, is } from 'superstruct';
import ItemDetail from '../Components/ItemDetail';
import LoadingIndicator from '../Components/LoadingIndicator';
import MainListItem from './MainListItem';
import { Item, Currency } from '@istvankreisz/copdeck-scraper/dist/types';
import { IpcRenderer } from 'electron';
const ipcRenderer: IpcRenderer = window.require('electron').ipcRenderer;

const MainTab = (prop: {
	currency: Currency;
	setToastMessage: React.Dispatch<
		React.SetStateAction<{
			message: string;
			show: boolean;
		}>
	>;
}) => {
	const [searchState, setSearchState] = useState<Item[] | null | 'searching'>(null);
	const [selectedItem, setSelectedItem] = useState<Item | null>();

	const searchBar = useRef<HTMLInputElement>(null);

	useEffect(() => {
		ipcRenderer.on('search', (event, response) => {
			if (is(response, array(Item))) {
				if (response.length) {
					setSearchState(response);
				} else {
					setSearchState([]);
				}
			} else {
				setSearchState([]);
			}
		});
		return () => {
			ipcRenderer.removeAllListeners('search');
		};
	}, []);

	const search = () => {
		setSearchState('searching');
		if (searchBar.current?.value) {
			ipcRenderer.send('search', searchBar.current?.value);
		}
	};

	const clickedItem = (item: Item) => {
		if (item.id !== selectedItem?.id) {
			setSelectedItem(item);
		}
	};

	const handleKeyDown = (event) => {
		if (event.key === 'Enter') {
			search();
		}
	};

	return (
		<>
			<div className="bg-transparent p-3 pb-0 relative w-full h-full overflow-y-scroll overflow-x-hidden">
				<div className="flex flex-row flex-nowrap w-full max-w-full space-x-2">
					<input
						placeholder="Search sneakers"
						className="h-10 flex-grow rounded-lg focus:outline-none shadow-md text-md border-none m-0"
						ref={searchBar}
						type="text"
						onKeyDown={handleKeyDown}
					/>
					<button
						className="button-default text-white bg-theme-orange hover:bg-theme-orange-dark rounded-lg bg h-10 shadow-md border-transparent"
						onClick={search}
					>
						Search
					</button>
				</div>
				<ul className="my-4 flex flex-col space-y-3">
					{typeof searchState === 'object'
						? searchState?.map((item, index) => {
								return (
									<MainListItem
										key={item.id}
										imageURL={item.imageURL?.url}
										name={item.name}
										flipImage={item.imageURL?.store.id === 'klekt'}
										currency={'USD'}
										onClicked={clickedItem.bind(null, item)}
									>
										<p>{item.name}</p>
									</MainListItem>
								);
						  })
						: null}
				</ul>
				{searchState === 'searching' ? (
					<LoadingIndicator key="loading" title="Loading"></LoadingIndicator>
				) : null}
				{typeof searchState === 'object' && searchState && searchState['length'] === 0 ? (
					<p key="noresults">No Results</p>
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

export default MainTab;
