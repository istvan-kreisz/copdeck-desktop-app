import React from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'

const Popup = ({ title, message, open, close }) => {
	function closeModal() {
		close()
	}

	return (
		<Transition show={open} as={Fragment}>
			<Dialog
				as="div"
				style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
				className="fixed inset-0 z-10 overflow-y-auto"
				static
				open={open}
				onClose={closeModal}
			>
				<div className="min-h-screen px-4 text-center">
					<Transition.Child
						as={Fragment}
						enter="ease-out duration-300"
						enterFrom="opacity-0"
						enterTo="opacity-100"
						leave="ease-in duration-200"
						leaveFrom="opacity-100"
						leaveTo="opacity-0"
					>
						<Dialog.Overlay className="fixed inset-0" />
					</Transition.Child>

					{/* This element is to trick the browser into centering the modal contents. */}
					<span className="inline-block h-screen align-middle" aria-hidden="true">
						&#8203;
					</span>
					<Transition.Child
						as={Fragment}
						enter="ease-out duration-300"
						enterFrom="opacity-0 scale-95"
						enterTo="opacity-100 scale-100"
						leave="ease-in duration-200"
						leaveFrom="opacity-100 scale-100"
						leaveTo="opacity-0 scale-95"
					>
						<div className="inline-block sm:w-72 max-w-md p-6 my-8 overflow-hidden text-center align-middle transition-all transform bg-white shadow-xl rounded-2xl">
							<div className="flex flex-col justify-center items-center space-y-8">
								<Dialog.Title as="h3" className="text-2xl font-medium leading-6">
									{title}
								</Dialog.Title>
								<div className="mt-2">
									<p className="text-base">{message}</p>
								</div>

								<div className="mt-12">
									<button
										className="button-default h-10 w-24 text-white bg-theme-orange hover:bg-theme-orange-dark rounded-xl"
										onClick={closeModal}
									>
										Okay
									</button>
								</div>
							</div>
						</div>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition>
	)
}

export default Popup
