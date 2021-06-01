import React from 'react'
import ListItem from '../Components/ListItem'
import { ChevronRightIcon } from '@heroicons/react/outline'

const MainListItem = ({ imageURL, name, currency, onClicked, children, flipImage }) => {
	return (
		<ListItem className="cursor-pointer" onClicked={onClicked}>
			<img
				style={flipImage ? { transform: 'scaleX(-1)' } : {}}
				className="flex-shrink-0 h-10 w-10 object-contain"
				src={imageURL}
				alt=""
			/>
			<p className="text-gray-800 font-medium flex-shrink line-clamp-2">{name}</p>
			<div style={{ flexGrow: 200 }}></div>
			<ChevronRightIcon className="h-6 text-gray-400 flex-shrink-0"></ChevronRightIcon>
		</ListItem>
	)
}

export default MainListItem
