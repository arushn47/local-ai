const DeleteConfirmationModal = ({ onConfirm, onCancel, title, message }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 p-4">
        <div className="bg-neutral-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 w-full max-w-sm transform transition-all duration-300 scale-95 hover:scale-100">
            <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
            <p className="text-gray-400 mb-6">{message}</p>
            <div className="flex justify-end gap-4">
                <button
                    onClick={onCancel}
                    className="cursor-pointer px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 transform hover:scale-105"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="cursor-pointer px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold transition-all duration-200 transform hover:scale-105"
                >
                    Delete
                </button>
            </div>
        </div>
    </div>
);

export default DeleteConfirmationModal;