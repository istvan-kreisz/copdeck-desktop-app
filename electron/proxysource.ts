const request = require('request-promise');
const JSDOM = require('jsdom').JSDOM;

class ProxySource {
	url: string;

	constructor(url = 'https://www.free-proxy-list.com/') {
		this.url = url;
	}

	async getProxys(page) {
		let html = await request(this.url, { qs: { page } });
		let jsdom = new JSDOM(html);
		let { document } = jsdom.window;
		let nodes = document.querySelectorAll('.proxy-list tbody tr');
		return [...nodes].map((x) => tr2proxy(x));
	}
}

function tr2proxy(tr) {
	const [
		_0,
		_1,
		_2,
		ip,
		_3,
		_4,
		_5,
		port,
		_6,
		country,
		_7,
		city,
		_8,
		speed,
		_9,
		latency,
		_10,
		uptime,
		_11,
		type,
		_12,
		anonymity,
		_13,
		updated,
	] = [...tr.childNodes].map((x) => x.textContent.trim());
	return {
		ip,
		port,
		country,
		city,
		speed,
		latency,
		uptime,
		type,
		anonymity,
		updated,
		url: type === 'https' ? `https://${ip}:${port}` : `http://${ip}:${port}`,
	};
}

export { ProxySource };
