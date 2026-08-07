/**
 * PWA Registration and Utilities
 * Handles service worker registration, push notifications, and offline support
 */

class PWAManager {
  constructor() {
    this.registration = null;
    this.pushSubscription = null;
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    
    this.init();
  }

  async init() {
    // Check if already installed
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
        console.log('✅ Service Worker registered:', this.registration.scope);
        
        // Check for updates periodically
        setInterval(() => this.checkForUpdates(), 60 * 60 * 1000); // Every hour
        
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
      this.showToast('App installed successfully!', 'success');
    });

    // Online/Offline status
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Initial online status
    this.updateOnlineStatus();
  }

  // Check for service worker updates
  async checkForUpdates() {
    if (this.registration) {
      try {
        await this.registration.update();
        console.log('🔄 Checked for updates');
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }
  }

  // Install prompt
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log('Install prompt not available');
      return false;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted install prompt');
    } else {
      console.log('User dismissed install prompt');
    }
    
    this.deferredPrompt = null;
    return outcome === 'accepted';
  }

  showInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.classList.remove('d-none');
      installBtn.addEventListener('click', () => this.promptInstall());
    }

    // Show install banner
    this.showInstallBanner();
  }

  hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.classList.add('d-none');
    }
    this.hideInstallBanner();
  }

  showInstallBanner() {
    // Don't show if already installed or dismissed recently
    if (this.isInstalled || localStorage.getItem('pwa-banner-dismissed')) {
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-banner';
    banner.innerHTML = `
      <div class="pwa-banner-content">
        <img src="/assets/icons/icon-72x72.png" alt="App Icon" class="pwa-banner-icon">
        <div class="pwa-banner-text">
          <strong>Install Student ERP</strong>
          <span>Add to home screen for quick access</span>
        </div>
      </div>
      <div class="pwa-banner-actions">
        <button class="btn btn-primary btn-sm" id="pwa-banner-install">Install</button>
        <button class="btn btn-link btn-sm" id="pwa-banner-dismiss">Not now</button>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .pwa-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        padding: 1rem;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 10000;
        animation: slideUp 0.3s ease;
      }
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .pwa-banner-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .pwa-banner-icon {
        width: 48px;
        height: 48px;
        border-radius: 8px;
      }
      .pwa-banner-text {
        display: flex;
        flex-direction: column;
      }
      .pwa-banner-text strong { color: #1e3a5f; }
      .pwa-banner-text span { color: #6b7280; font-size: 0.875rem; }
      .pwa-banner-actions { display: flex; gap: 0.5rem; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('pwa-banner-install').addEventListener('click', () => {
      this.promptInstall();
      this.hideInstallBanner();
    });

    document.getElementById('pwa-banner-dismiss').addEventListener('click', () => {
      localStorage.setItem('pwa-banner-dismissed', Date.now());
      this.hideInstallBanner();
    });
  }

  hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.remove();
    }
  }

  // Push Notifications
  async subscribeToPush() {
    if (!this.registration) {
      console.error('Service worker not registered');
      return null;
    }

    try {
      // Check permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Get VAPID public key from server
      const response = await fetch('/api/notifications/vapid-public-key');
      const { publicKey } = await response.json();

      // Subscribe
      this.pushSubscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(this.pushSubscription)
      });

      console.log('✅ Push subscription successful');
      return this.pushSubscription;

    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }

  async unsubscribeFromPush() {
    if (!this.pushSubscription) {
      return;
    }

    try {
      await this.pushSubscription.unsubscribe();
      
      // Notify server
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ endpoint: this.pushSubscription.endpoint })
      });

      this.pushSubscription = null;
      console.log('✅ Push unsubscription successful');

    } catch (error) {
      console.error('Push unsubscription failed:', error);
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Online/Offline handling
  handleOnline() {
    this.isOnline = true;
    this.updateOnlineStatus();
    this.showToast('You are back online!', 'success');
    
    // Trigger background sync
    if (this.registration && 'sync' in self.registration) {
      this.registration.sync.register('sync-offline-data');
    }
  }

  handleOffline() {
    this.isOnline = false;
    this.updateOnlineStatus();
    this.showToast('You are offline. Some features may be limited.', 'warning');
  }

  updateOnlineStatus() {
    const indicator = document.getElementById('online-status-indicator');
    if (indicator) {
      indicator.className = this.isOnline ? 'online' : 'offline';
      indicator.title = this.isOnline ? 'Online' : 'Offline';
    }

    document.body.classList.toggle('offline-mode', !this.isOnline);
  }

  // Utility methods
  showToast(message, type = 'info') {
    // Check if Bootstrap toast is available
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
      const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
      
      const toast = document.createElement('div');
      toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'primary'} border-0`;
      toast.setAttribute('role', 'alert');
      toast.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      `;
      
      toastContainer.appendChild(toast);
      const bsToast = new bootstrap.Toast(toast);
      bsToast.show();
      
      toast.addEventListener('hidden.bs.toast', () => toast.remove());
    } else {
      // Fallback
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '11000';
    document.body.appendChild(container);
    return container;
  }

  // Store data for offline use
  async storeOfflineData(key, data) {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  // Retrieve offline data
  getOfflineData(key, maxAge = 24 * 60 * 60 * 1000) {
    try {
      const stored = localStorage.getItem(`offline_${key}`);
      if (!stored) return null;
      
      const { data, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(`offline_${key}`);
        return null;
      }
      
      return data;
    } catch (error) {
      return null;
    }
  }

  // Queue action for offline sync
  async queueOfflineAction(action) {
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    queue.push({
      ...action,
      id: Date.now(),
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('offline_queue', JSON.stringify(queue));
  }

  // Get install instructions based on browser/OS
  getInstallInstructions() {
    const ua = navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(ua)) {
      return {
        steps: [
          'Tap the Share button (square with arrow)',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to confirm'
        ],
        icon: 'ios-share'
      };
    }
    
    if (/Android/.test(ua)) {
      return {
        steps: [
          'Tap the menu button (three dots)',
          'Tap "Add to Home Screen" or "Install App"',
          'Tap "Add" to confirm'
        ],
        icon: 'android-menu'
      };
    }
    
    return {
      steps: [
        'Click the install icon in the address bar',
        'Or use browser menu to install',
        'Confirm installation'
      ],
      icon: 'desktop-install'
    };
  }
}

// Initialize PWA Manager
const pwa = new PWAManager();

// Export for global access
window.PWAManager = pwa;

// Convenience functions
window.installApp = () => pwa.promptInstall();
window.subscribeToPush = () => pwa.subscribeToPush();
window.unsubscribeFromPush = () => pwa.unsubscribeFromPush();
