import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useRef } from 'react';

const TextfieldPopup = ({ title, placeholder, open, close }) => {
	const textField = useRef<HTMLTextAreaElement>(null);

	function closeModal() {
		console.log('asasdsd');
		close();
	}

	function sendFeedback() {
		const feedback = textField.current?.value;
		close(feedback);
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
				<div className="min-h-screen mx-auto text-center">
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
						<div className="inline-block w-96 p-6 my-8 overflow-hidden text-center align-middle transition-all transform bg-white shadow-xl rounded-2xl">
							<div className="flex flex-col justify-center items-center">
								<Dialog.Title as="h3" className="text-2xl font-medium leading-6">
									{title}
								</Dialog.Title>

								<textarea
									ref={textField}
									style={{ resize: 'none' }}
									id="textfield"
									placeholder={placeholder}
									name="textfield"
									rows={6}
									className="mt-8 w-full bg-white rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none leading-6"
								></textarea>

								<button
									className="mt-8 w-full button-default text-white bg-theme-orange hover:bg-theme-orange-dark rounded-lg bg h-10 shadow-md border-transparent"
									onClick={sendFeedback}
								>
									Send
								</button>

								<button
									className="mt-3 w-full button-default text-theme-orange rounded-lg bg"
									onClick={closeModal}
								>
									Cancel
								</button>
							</div>
						</div>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition>
	);
};

export default TextfieldPopup;
