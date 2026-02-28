export const UI = {
    loader: document.getElementById('loader'),
    toastContainer: document.getElementById('toast-container'),
    mainContent: document.getElementById('main-content'),

    showLoader() {
        this.loader.classList.remove('hidden');
    },

    hideLoader() {
        this.loader.classList.add('hidden');
    },

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        this.toastContainer.appendChild(toast);

        // Remove after animation (3s + 0.3s)
        setTimeout(() => {
            if (this.toastContainer.contains(toast)) {
                this.toastContainer.removeChild(toast);
            }
        }, 3300);
    }
};
