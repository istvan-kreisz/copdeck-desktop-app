import React from 'react'
import ListItem from '../Components/ListItem'
import { ChevronRightIcon, TrashIcon } from '@heroicons/react/outline'

const AlertListItem = ({
	imageURL,
	name,
	onClicked,
	bestPrice,
	targetPriceType,
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
				<p className="text-gray-800 font-medium flex-shrink line-clamp-2">{name}</p>
				<div className="flex space-x-1">
					<p
						className={`h-5 flex items-center flex-shrink-0 px-2 flex-grow-0 rounded-full bg-theme-purple text-white`}
					>
						{`${targetSize}`}
					</p>

					<p
						className={`h-5 flex items-center flex-shrink-0 px-2 flex-grow-0 rounded-full bg-theme-orange text-white`}
					>
						{(targetPriceType === 'above' ? '>' : '<') + currency + targetPrice}
					</p>
				</div>
				<div className="flex space-x-1">
					<p className={`h-5 flex-shrink-0 px-2 rounded-full bg-theme-green text-white`}>
						{`${stores.join(', ')}`}
					</p>
				</div>
			</div>
			<div style={{ flexGrow: 200 }}></div>
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
							? ((bestPrice ?? 99999) < targetPrice && targetPriceType === 'below') ||
							  ((bestPrice ?? 99999) > targetPrice && targetPriceType === 'above')
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
	)
}

export default AlertListItem
