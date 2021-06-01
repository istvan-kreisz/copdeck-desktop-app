const log = (message: any, isLoggingEnabled: boolean) => {
	if (isLoggingEnabled) {
		console.log(message)
	}
}

export { log }
