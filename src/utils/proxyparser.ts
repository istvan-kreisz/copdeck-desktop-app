import { Proxy } from 'copdeck-scraper/dist/types'
import { shuffleArray } from 'copdeck-scraper'

function parse(input: string): Proxy[] {
	return stringToArray(input).map(stringToProxy)
}

function stringToArray(input: string): string[] {
	if (!/[ ,\n]+/g.test(input) && input.split(/\w:\d/g).length > 2) {
		throw new Error('Invalid delimiter')
	}
	return input.split(/[ ,\n]+/g)
}

function stringToProxy(input: string): Proxy {
	return { ...getAddress(input), ...getProtocol(input), ...getAuth(input) }
}

function getAddress(input: string): { host: string; port: number } {
	if (input.includes('@')) {
		input = input.substring(input.lastIndexOf('@') + 1)
	} else if (input.includes('://')) {
		input = input.split('://')[1]
	}
	if (!input.includes(':')) {
		throw new Error('Invalid address')
	}
	const host = input.split(':')[0]
	const port = parseInt(input.split(':')[1])
	if (/^\w+$/.test(host)) {
		throw new Error('Invalid host')
	}
	if (isNaN(port)) {
		throw new Error('Invalid port')
	}
	return { host: host, port: port }
}

function getProtocol(input: string): { protocol: string } {
	if (!input.includes('://')) {
		return { protocol: 'http' }
	}
	const protocol = input.split('://')[0]
	if (protocol.length < 3 || protocol.length > 6) {
		throw new Error('Invalid protocol')
	}
	return { protocol }
}

function getAuth(input: string): { auth: { username: string; password: string } } | undefined {
	if (!input.includes('@')) {
		return undefined
	}
	if (input.includes('://')) {
		input = input.split('://')[1]
	}
	input = input.substring(0, input.lastIndexOf('@'))
	if (!input.includes(':')) {
		throw new Error('Invalid auth')
	}
	const [username, password] = input.split(':')
	return { auth: { username, password } }
}

function stringify(proxies: Proxy[]): string {
	const proxyStrings = proxies.map((proxy) => {
		let string = ''
		if (proxy.protocol !== 'http') {
			string += proxy.protocol + '://'
		}
		let auth = proxy.auth
		if (auth) {
			string += `${auth.username}:${auth.password}@`
		}
		string += `${proxy.host}:${proxy.port}`
		return string
	})
	return proxyStrings.join('\n')
}

function pacFormat(proxies: Proxy[]): string {
	const proxyStrings = proxies.map((proxy) => {
		let string = ''
		if (proxy.protocol === 'http') {
			string = 'PROXY '
		}
		if (proxy.protocol === 'https') {
			string = 'HTTPS '
		}

		let auth = proxy.auth
		if (auth) {
			string += `${auth.username}:${auth.password}@`
		}
		string += `${proxy.host}:${proxy.port}`
		return string
	})
	return shuffleArray(proxyStrings).join('; ')
}

export { parse, stringify, pacFormat }
