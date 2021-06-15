import ListItem from '../Components/ListItem';
import { ChevronRightIcon, TrashIcon } from '@heroicons/react/outline';
import { ALLSTORES } from '@istvankreisz/copdeck-scraper/dist/types';

const AlertListItem = ({
	imageURL,
	name,
	onClicked,
	bestPrice,
	relation,
	priceType,
	feeType,
	currency,
	targetSize,
	targetPrice,
	stores,
	onDeleted,
	flipImage,
}) => {
	return (
		<ListItem className="cursor-pointer" onClicked={onClicked}>
			<img
				style={flipImage ? { transform: 'scaleX(-1)' } : {}}
				className="flex-shrink-0 h-10 w-10 object-contain"
				src={imageURL}
				alt=""
			/>
			<div className="flex flex-col justify-start space-y-1">
				<p className="text-gray-800 font-medium text-sm flex-shrink line-clamp-2">{name}</p>
				<div className="flex space-x-1">
					<p
						className={`h-5 flex items-center text-sm flex-shrink-0 px-2 flex-grow-0 rounded-full bg-theme-purple text-white`}
					>
						{`${targetSize}`}
					</p>

					<p
						className={`h-5 flex items-center text-sm flex-shrink-0 px-2 flex-grow-0 rounded-full bg-theme-orange text-white`}
					>
						{(relation === 'above' ? '>' : '<') + currency + targetPrice}
					</p>
					<p
						className={`h-5 flex items-center text-sm flex-shrink-0 px-2 flex-grow-0 rounded-full bg-theme-yellow text-white`}
					>
						{priceType === 'ask' ? 'Ask' : 'Bid'}
					</p>
				</div>
				<div className="flex space-x-1">
					<p
						className={`h-5 flex-shrink-0 px-2 rounded-full text-sm bg-theme-green text-white`}
					>
						{`${stores.length === ALLSTORES.length ? 'All sites' : stores.join(', ')}`}
					</p>
					<p
						className={`h-5 flex items-center text-sm flex-shrink-0 px-2 flex-grow-0 rounded-full bg-theme-blue text-white`}
					>
						{feeType}
					</p>
				</div>
			</div>
			<div className="w-10 flex-shrink-0"></div>
			<div style={{ flexGrow: 200, minWidth: '5px' }}></div>
			<button
				onClick={onDeleted}
				className="cursor-pointer focus:outline-none flex-shrink-0 flex h-7 w-7 bg-red-500 rounded-full justify-center items-center"
			>
				<TrashIcon className="font-bold h-5 text-white flex-shrink-0"></TrashIcon>
			</button>

			<div className="flex-shrink-0 flex flex-col justify-center items-center">
				<p className="m-0">Best:</p>
				<p
					className={`text-gray-800 font-medium text-base ${
						bestPrice
							? ((bestPrice ?? 99999) < targetPrice && relation === 'below') ||
							  ((bestPrice ?? 99999) > targetPrice && relation === 'above')
								? 'text-green-500'
								: 'text-red-500'
							: ''
					}`}
				>
					{bestPrice ? currency + bestPrice : '-'}
				</p>
			</div>

			<ChevronRightIcon className="h-6 text-gray-400 flex-shrink-0"></ChevronRightIcon>
		</ListItem>
	);
};

export default AlertListItem;
