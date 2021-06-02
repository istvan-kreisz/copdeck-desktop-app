// const requestDelayMax = 1000

// const refreshExchangeRates = async () => {
// 	const { getSettings, getIsDevelopment, saveExchangeRates } = databaseCoordinator()

// 	const [settings, dev] = await Promise.all([getSettings(), getIsDevelopment()])

// 	try {
// 		const rates = await browserAPI.getExchangeRates(apiConfig(settings, dev))
// 		await saveExchangeRates(rates)
// 	} catch (err) {
// 		log(err, dev)
// 	}
// }

// const getItemDetails = async (item: Item, forceRefresh: boolean) => {
// 	const { getItemWithId, getIsDevelopment, getSettings } = databaseCoordinator()

// 	try {
// 		const [savedItem, dev, settings] = await Promise.all([
// 			getItemWithId(item.id),
// 			getIsDevelopment(),
// 			getSettings(),
// 		])

// 		if (savedItem) {
// 			if (
// 				didFailToFetchAllStorePrices(savedItem) ||
// 				shouldUpdateItem(savedItem, settings.updateInterval) ||
// 				forceRefresh
// 			) {
// 				log('fetching new 1', dev)
// 				return fetchAndSave(savedItem)
// 			} else {
// 				log('returning saved', dev)
// 				return savedItem
// 			}
// 		} else {
// 			log('fetching new 2', dev)
// 			return fetchAndSave(item)
// 		}
// 	} catch (err) {
// 		log('fetching new 3', true)
// 		return fetchAndSave(item)
// 	}
// }

// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
// 	if (msg.search) {
// 		;(async () => {
// 			try {
// 				const searchTerm = msg.search
// 				assert(searchTerm, string())
// 				const { getSettings, getIsDevelopment } = databaseCoordinator()
// 				const [settings, dev] = await Promise.all([getSettings(), getIsDevelopment()])
// 				log('searching', dev)
// 				const items = await browserAPI.searchItems(searchTerm, apiConfig(settings, dev))
// 				log('search results', dev)
// 				log(items, dev)
// 				sendResponse(items)
// 			} catch (err) {
// 				sendResponse([])
// 				console.log(err)
// 			}
// 		})()
// 		return true
// 	} else if (msg.getItemDetails) {
// 		;(async () => {
// 			try {
// 				const item = msg.getItemDetails?.item
// 				const forceRefresh = msg.getItemDetails?.forceRefresh
// 				assert(item, Item)
// 				assert(forceRefresh, boolean())
// 				const itemWithPrices = await getItemDetails(item, forceRefresh)
// 				sendResponse(itemWithPrices)
// 			} catch (err) {
// 				sendResponse(undefined)
// 				console.log(err)
// 			}
// 		})()
// 		return true
// 	} else if (msg.settings) {
// 		const { saveSettings, getIsDevelopment } = databaseCoordinator()
// 		;(async () => {
// 			try {
// 				const settings = msg.settings.settings
// 				const proxyString = msg.settings.proxyString
// 				assert(settings, Settings)
// 				assert(proxyString, string())
// 				const dev = await getIsDevelopment()

// 				let proxyParseError
// 				if (proxyString) {
// 					try {
// 						settings.proxies = parse(proxyString)
// 					} catch (err) {
// 						settings.proxies = []
// 						proxyParseError = err['message'] ?? 'Invalid proxy format'
// 						log('proxy error', dev)
// 						log(err, dev)
// 					}
// 				}
// 				if (settings.updateInterval < minUpdateInterval) {
// 					settings.updateInterval = minUpdateInterval
// 				} else if (settings.updateInterval > maxUpdateInterval) {
// 					settings.updateInterval = maxUpdateInterval
// 				}
// 				await saveSettings(settings)
// 				sendResponse(proxyParseError)
// 			} catch (err) {
// 				console.log(err)
// 				sendResponse(err)
// 			}
// 		})()
// 		return true
// 	} else if (msg.refresh) {
// 		;(async () => {
// 			try {
// 				await updatePrices()
// 			} catch (err) {
// 				console.log(err)
// 			}
// 			sendResponse()
// 		})()
// 		return true
// 	}
// })

// const addClearCacheAlarm = async () => {
// 	return new Promise<void>((resolve, reject) => {
// 		chrome.alarms.get(cacheAlarm, (a) => {
// 			if (!a) {
// 				chrome.alarms.create(cacheAlarm, {
// 					periodInMinutes: 10080,
// 				})
// 			}
// 			resolve()
// 		})
// 	})
// }

// const addRefreshExchangeRatesAlarm = async () => {
// 	return new Promise<void>((resolve, reject) => {
// 		chrome.alarms.get(refreshExchangeRatesAlarm, (a) => {
// 			if (!a) {
// 				chrome.alarms.create(refreshExchangeRatesAlarm, {
// 					periodInMinutes: 720,
// 				})
// 			}
// 			resolve()
// 		})
// 	})
// }

// const addrefreshPricesAlarm = async (deleteIfExists: boolean) => {
// 	const { getSettings } = databaseCoordinator()
// 	try {
// 		const settings = await getSettings()

// 		return new Promise<void>((resolve, reject) => {
// 			chrome.alarms.get(refreshPricesAlarm, (a) => {
// 				if (deleteIfExists) {
// 					if (a) {
// 						chrome.alarms.clear(refreshPricesAlarm, (wasCleared) => {
// 							if (wasCleared) {
// 								chrome.alarms.create(refreshPricesAlarm, {
// 									periodInMinutes: settings.updateInterval,
// 								})
// 							}
// 							resolve()
// 						})
// 					} else {
// 						chrome.alarms.create(refreshPricesAlarm, {
// 							periodInMinutes: settings.updateInterval,
// 						})
// 						resolve()
// 					}
// 				} else {
// 					if (!a) {
// 						chrome.alarms.create(refreshPricesAlarm, {
// 							periodInMinutes: settings.updateInterval,
// 						})
// 					}
// 					resolve()
// 				}
// 			})
// 		})
// 	} catch (err) {
// 		console.log(err)
// 	}
// }

// const sendNotifications = async () => {
// 	const {
// 		getSettings,
// 		updateLastNotificationDateForAlerts,
// 		getIsDevelopment,
// 		getAlertsWithItems,
// 	} = databaseCoordinator()
// 	try {
// 		const [alerts, settings, dev] = await Promise.all([
// 			getAlertsWithItems(),
// 			getSettings(),
// 			getIsDevelopment(),
// 		])

// 		const alertsFiltered = alerts
// 			.filter(([alert, item]) => {
// 				if (alert.lastNotificationSent) {
// 					return isOlderThan(
// 						alert.lastNotificationSent,
// 						settings.notificationFrequency,
// 						'hours'
// 					)
// 				} else {
// 					return true
// 				}
// 			})
// 			.filter(([alert, item]) => {
// 				const bestPrice = itemBestPrice(item, alert)

// 				if (bestPrice) {
// 					if (alert.targetPriceType === 'below') {
// 						if (bestPrice < alert.targetPrice) {
// 							return true
// 						} else {
// 							return false
// 						}
// 					} else {
// 						if (bestPrice > alert.targetPrice) {
// 							return true
// 						} else {
// 							return false
// 						}
// 					}
// 				} else {
// 					return false
// 				}
// 			})

// 		alertsFiltered.forEach(([alert, item]) => {
// 			const bestPrice = itemBestPrice(item, alert)
// 			log('notification sent', dev)
// 			log(alert, dev)
// 			chrome.notifications.create(
// 				uuidv4(),
// 				{
// 					type: 'basic',
// 					iconUrl: 'icon-48.png',
// 					title: 'CopDeck Price Alert!',
// 					message: `${item.name} price ${
// 						alert.targetPriceType === 'above' ? 'went above' : 'dropped below'
// 					} ${settings.currency.symbol}${alert.targetPrice}! Current best price: ${
// 						settings.currency.symbol
// 					}${bestPrice}`,
// 					priority: 2,
// 				},
// 				() => {
// 					console.log('Error:', chrome.runtime.lastError)
// 				}
// 			)
// 		})

// 		await updateLastNotificationDateForAlerts(alertsFiltered.map(([alert, item]) => alert))
// 	} catch (err) {
// 		console.log(err)
// 	}
// }

// chrome.alarms.onAlarm.addListener(async (alarm) => {
// 	if (alarm.name === refreshPricesAlarm) {
// 		await updatePrices()
// 		await sendNotifications()
// 	} else if (alarm.name === cacheAlarm) {
// 		await clearCache()
// 	} else if (alarm.name === refreshExchangeRatesAlarm) {
// 		await refreshExchangeRates()
// 	} else if (alarm.name === proxyRotationAlarm) {
// 		const { getSettings, getIsDevelopment } = databaseCoordinator()
// 		const [settings, dev] = await Promise.all([getSettings(), getIsDevelopment()])
// 		await updateProxies(settings.proxies, dev)
// 	}
// })

// chrome.runtime.onStartup.addListener(async () => {
// 	chrome.runtime.setUninstallURL('https://copdeck.com/extensionsurvey')
// })

// chrome.runtime.onInstalled.addListener(async () => {
// 	await Promise.all([
// 		addrefreshPricesAlarm(false),
// 		addClearCacheAlarm(),
// 		addRefreshExchangeRatesAlarm(),
// 		refreshExchangeRates(),
// 	])
// })

// const startProxyRotation = async () => {
// 	return new Promise<void>((resolve, reject) => {
// 		chrome.alarms.get(proxyRotationAlarm, (a) => {
// 			if (!a) {
// 				chrome.alarms.create(proxyRotationAlarm, {
// 					periodInMinutes: 60,
// 				})
// 			}
// 			resolve()
// 		})
// 	})
// }

// const resetProxyRotation = async () => {
// 	return new Promise<void>((resolve, reject) => {
// 		chrome.alarms.clear(proxyRotationAlarm, () => {
// 			resolve()
// 		})
// 	})
// }

// const updateProxies = async (proxies: Proxy[], dev: boolean): Promise<void> => {
// 	const proxiesString = pacFormat(proxies)
// 	const pacScriptConfig = {
// 		mode: 'pac_script',
// 		pacScript: {
// 			data: `function FindProxyForURL(url, host) {
//                 if (dnsDomainIs(host, ".goat.com") || shExpMatch(host, '*2fwotdvm2o-dsn.algolia.net*') || shExpMatch(host, '*apiv2.klekt.com*') || dnsDomainIs(host, ".stockx.com")) {
//                     return "${proxiesString}";
//                 } else {
//                     return "DIRECT";
//                 }
//             }`,
// 		},
// 	}

// 	return new Promise(async (resolve, reject) => {
// 		chrome.proxy.settings.set({ value: pacScriptConfig, scope: 'regular' }, () => {
// 			resolve()
// 		})
// 	})
// }

// const updateProxySettings = async (proxies: Proxy[], dev: boolean): Promise<void> => {
// 	if (proxies.length < 2) {
// 		try {
// 			await resetProxyRotation()
// 		} catch (err) {}

// 		if (proxies.length === 0) {
// 			return new Promise<void>((resolve, reject) => {
// 				chrome.proxy.settings.clear({}, () => {
// 					resolve()
// 				})
// 			})
// 		}
// 	}

// 	await updateProxies(proxies, dev)
// 	if (proxies.length > 1) {
// 		await startProxyRotation()
// 	}
// 	if (dev) {
// 		return new Promise<void>((resolve, reject) => {
// 			chrome.proxy.settings.get({}, function (config) {
// 				log(JSON.stringify(config), dev)
// 				resolve()
// 			})
// 		})
// 	}
// }

// chrome.proxy.onProxyError.addListener(async (err) => {
// 	const { getIsDevelopment } = databaseCoordinator()
// 	const dev = await getIsDevelopment()

// 	log('proxy error', dev)
// 	log(err, dev)
// })

// chrome.storage.onChanged.addListener(async function (changes, namespace) {
// 	const { getIsDevelopment } = databaseCoordinator()
// 	const dev = await getIsDevelopment()

// 	if (dev) {
// 		for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
// 			log(`Storage key "${key}" in namespace "${namespace}" changed.`, dev)
// 			log(`Old value was "${oldValue}", new value is "${newValue}".`, dev)
// 		}
// 	}

// 	const settingsNew = changes.settings?.newValue
// 	const settingsOld = changes.settings?.oldValue
// 	if (settingsNew && settingsOld && is(settingsNew, Settings) && is(settingsOld, Settings)) {
// 		if (settingsOld.currency.code !== settingsNew.currency.code) {
// 			await updatePrices(true)
// 		}
// 		if (settingsOld.updateInterval !== settingsNew.updateInterval) {
// 			await addrefreshPricesAlarm(true)
// 		}
// 		if (JSON.stringify(settingsOld.proxies) !== JSON.stringify(settingsNew.proxies)) {
// 			await updateProxySettings(settingsNew.proxies, dev)
// 		}
// 	}
// })

// const sendProxyNotificationIfNeeded = async (url?: string) => {
// 	const store = ALLSTORES.find(
// 		(store) => url?.includes('//' + store.id + '.') || url?.includes('www.' + store.id + '.')
// 	)

// 	if (store) {
// 		const { getProxyNotificationUpdates, saveProxyNotificationUpdates } = databaseCoordinator()
// 		const [proxyNotificationUpdates] = await Promise.all([getProxyNotificationUpdates()])
// 		const lastUpdate = proxyNotificationUpdates[store.id]
// 		if (!lastUpdate || (lastUpdate && isOlderThan(lastUpdate, 72, 'hours'))) {
// 			chrome.notifications.create(
// 				'copdeckproxywarning',
// 				{
// 					type: 'basic',
// 					iconUrl: 'icon-48.png',
// 					title: 'Active Proxy Warning',
// 					message: `You have proxies enabled for this site. You can disable them in CopDeck extension settings.`,
// 					priority: 2,
// 				},
// 				() => {
// 					console.log('Error:', chrome.runtime.lastError)
// 				}
// 			)

// 			proxyNotificationUpdates[store.id] = new Date().getTime()
// 			saveProxyNotificationUpdates(proxyNotificationUpdates)
// 		}
// 	}
// }

// chrome.tabs.onActivated.addListener(function (activeInfo) {
// 	chrome.tabs.get(activeInfo.tabId, function (tab) {
// 		;(async () => {
// 			await sendProxyNotificationIfNeeded(tab.url)
// 		})()
// 	})
// })

// chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
// 	if (tab.active && change.url) {
// 		;(async () => {
// 			await sendProxyNotificationIfNeeded(change.url)
// 		})()
// 	}
// })

// // add goat bid
// // add proxy toggle
// // change goat currency
// // Cookie: _csrf=lKuDAaP8CZOqw-LoxVrr2y5Z; csrf=xQDiRJay-RiSSEinY5fgM631qqcCElyVhLAs; _sneakers_session=v89yqHWNt2U3vHU2Rls%2F%2B0Nb66XdCEAQNBwOVGDxBx6kVnDDtALbhmo9KwDph1EISUTlerOAefWW%2FWpUuq7N--EjpYsea%2BbyqFTy3b--r7Y9SJYqJsSoxqkVP64HeA%3D%3D; ConstructorioID_client_id=e9866fda-fd26-4f06-8e18-b31e22d1ee0b; currency=JPY; OptanonConsent=isIABGlobal=false&datestamp=Sun+May+30+2021+12%3A09%3A31+GMT%2B0200+(Central+European+Summer+Time)&version=6.12.0&hosts=&consentId=ae7c1734-b0a0-4e58-b815-38e294f6e206&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A0%2CC0002%3A0%2CC0004%3A0; __stripe_mid=dca3168b-fbcc-428a-9214-4c2968f68bd34d2970; __stripe_sid=c77cc3fa-abf6-4196-a827-e3dd77e20259deb20a; OptanonAlertBoxClosed=2021-05-30T10:09:31.293Z

export {};
