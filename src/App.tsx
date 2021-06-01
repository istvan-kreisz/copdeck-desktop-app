import React from 'react'
import logo from './logo.svg'
import './App.css'
import { Currency, EUR } from 'copdeck-scraper/dist/types'
import { CheckIcon } from '@heroicons/react/outline'

function App() {
	return (
		<div className="App">
			<header className="App-header">
				<img src={logo} className="App-logo" alt="logo" />
				<p>
					Edit <code>src/App.tsx</code> and save to reload.
				</p>
				<h3 className="text-red-600">{EUR.symbol}</h3>
				<h3 className="text-red-600">{EUR.symbol}</h3>
				<h3>{EUR.symbol}</h3>
				<h3>{EUR.symbol}</h3>
				<h3>{EUR.symbol}</h3>
				<h3>{EUR.symbol}</h3>
				<CheckIcon></CheckIcon>
				<CheckIcon></CheckIcon>
				<CheckIcon></CheckIcon>

				<a
					className="App-link"
					href="https://reactjs.org"
					target="_blank"
					rel="noopener noreferrer"
				>
					Learn React
				</a>
			</header>
		</div>
	)
}

export default App
