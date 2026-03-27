// ===========================================
// FIREBASE CONFIGURATION
// ===========================================
const firebaseConfig = {
    apiKey: "AIzaSyDgm6P2T7DCLCy4ROuPNu6WtE_PIzoMvWk",
    authDomain: "re-coin-magelang-2026.firebaseapp.com",
    databaseURL: "https://re-coin-magelang-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "re-coin-magelang-2026",
    storageBucket: "re-coin-magelang-2026.firebasestorage.app",
    messagingSenderId: "864198166030",
    appId: "1:864198166030:web:62e91d05f706592a2f9e5f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let currentMerchant = {
    id: null,
    nama_toko: "",
    nama_pemilik: "",
    phone: "",
    alamat: "",
    saldo: 0
};

let products = [];
let orders = [];
let withdrawals = [];
let notifications = [];
let editingProductId = null;
let selectedImageFile = null;
let selectedOrder = null;
let currentFilter = "all";

const ADMIN_WA = "6289524538835";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// ===========================================
// UTILITY FUNCTIONS
// ===========================================
function formatRupiah(angka) {
    if (angka === undefined || angka === null) return 'Rp 0';
    return 'Rp ' + angka.toLocaleString('id-ID');
}

function showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.className = `notification-toast ${type}`;
    notif.innerHTML = message;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {
        console.log('Sound not supported');
    }
}

// ===========================================
// SESSION MANAGEMENT
// ===========================================
function saveMerchantSession() {
    if (!currentMerchant.id) return;
    
    const sessionData = {
        id: currentMerchant.id,
        loginTime: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
    };
    localStorage.setItem('recoin_merchant_session', JSON.stringify(sessionData));
}

function clearMerchantSession() {
    localStorage.removeItem('recoin_merchant_session');
}

function checkAutoLogin() {
    const sessionJson = localStorage.getItem('recoin_merchant_session');
    if (!sessionJson) return false;
    
    try {
        const session = JSON.parse(sessionJson);
        if (session.expiresAt && session.expiresAt > Date.now()) {
            db.ref('/merchants/' + session.id).once('value', (snap) => {
                if (snap.exists()) {
                    const merchantData = snap.val();
                    loginSuccess(session.id, merchantData);
                } else {
                    clearMerchantSession();
                    showLoginPage();
                }
            });
            return true;
        } else {
            clearMerchantSession();
            return false;
        }
    } catch (e) {
        return false;
    }
}

// ===========================================
// AUTHENTICATION
// ===========================================
function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('btn-login').classList.add('active');
    document.getElementById('btn-register').classList.remove('active');
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('btn-register').classList.add('active');
    document.getElementById('btn-login').classList.remove('active');
}

function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('dashboard-page').style.display = 'none';
}

function merchantRegister() {
    const namaToko = document.getElementById('reg-nama-toko').value.trim();
    const namaPemilik = document.getElementById('reg-nama-pemilik').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const alamat = document.getElementById('reg-alamat').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    
    if (!namaToko || !namaPemilik || !phone || !alamat || !password) {
        showNotification('Semua field harus diisi!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password minimal 6 karakter', 'error');
        return;
    }
    
    if (password !== password2) {
        showNotification('Password tidak cocok!', 'error');
        return;
    }
    
    const phoneClean = phone.replace(/\D/g, '');
    const merchantId = 'mch_' + Date.now();
    
    const merchantData = {
        id: merchantId,
        nama_toko: namaToko,
        nama_pemilik: namaPemilik,
        phone: phoneClean,
        alamat: alamat,
        password: password,
        saldo: 0,
        created_at: Date.now(),
        status: 'active'
    };
    
    db.ref('/merchants/' + merchantId).set(merchantData)
        .then(() => {
            showNotification('Pendaftaran berhasil! Silakan login.', 'success');
            showLoginForm();
            document.getElementById('reg-nama-toko').value = '';
            document.getElementById('reg-nama-pemilik').value = '';
            document.getElementById('reg-phone').value = '';
            document.getElementById('reg-alamat').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-password2').value = '';
        })
        .catch(error => {
            showNotification('Gagal mendaftar: ' + error.message, 'error');
        });
}

function merchantLogin() {
    const username = document.getElementById('merchant-username').value.trim();
    const password = document.getElementById('merchant-password').value;
    
    if (!username || !password) {
        showNotification('Username dan password harus diisi!', 'error');
        return;
    }
    
    const phoneClean = username.replace(/\D/g, '');
    
    db.ref('/merchants').orderByChild('phone').equalTo(phoneClean).once('value', (snap) => {
        if (!snap.exists()) {
            showNotification('Akun tidak ditemukan!', 'error');
            return;
        }
        
        let merchantData = null;
        let merchantId = null;
        snap.forEach(child => {
            merchantData = child.val();
            merchantId = child.key;
        });
        
        if (merchantData.password !== password) {
            showNotification('Password salah!', 'error');
            return;
        }
        
        loginSuccess(merchantId, merchantData);
    });
}

function loginSuccess(merchantId, merchantData) {
    // Cleanup old listeners
    if (window.ordersListener) {
        db.ref('/merchant_orders/' + currentMerchant.id).off('value', window.ordersListener);
    }
    if (window.saldoListener) {
        db.ref('/merchants/' + currentMerchant.id + '/saldo').off('value', window.saldoListener);
    }
    
    currentMerchant = {
        id: merchantId,
        nama_toko: merchantData.nama_toko,
        nama_pemilik: merchantData.nama_pemilik,
        phone: merchantData.phone,
        alamat: merchantData.alamat,
        saldo: merchantData.saldo || 0
    };
    
    saveMerchantSession();
    
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'block';
    
    // Update UI
    document.getElementById('merchant-name').innerHTML = currentMerchant.nama_toko;
    document.getElementById('merchant-avatar').innerHTML = currentMerchant.nama_toko.charAt(0).toUpperCase();
    document.getElementById('merchant-balance').innerHTML = formatRupiah(currentMerchant.saldo);
    document.getElementById('stat-saldo').innerHTML = formatRupiah(currentMerchant.saldo);
    document.getElementById('withdraw-saldo').innerHTML = formatRupiah(currentMerchant.saldo);
    
    // Load data
    loadProducts();
    loadOrders();
    loadWithdrawals();
    loadNotifications();
    startSaldoListener();
    
    showNotification('Selamat datang, ' + currentMerchant.nama_toko + '!');
}

function merchantLogout() {
    if (window.ordersListener) {
        db.ref('/merchant_orders/' + currentMerchant.id).off('value', window.ordersListener);
    }
    if (window.saldoListener) {
        db.ref('/merchants/' + currentMerchant.id + '/saldo').off('value', window.saldoListener);
    }
    
    clearMerchantSession();
    showLoginPage();
    showNotification('Anda telah logout', 'info');
}

// ===========================================
// SALDO LISTENER
// ===========================================
function startSaldoListener() {
    if (!currentMerchant.id) return;
    
    window.saldoListener = db.ref('/merchants/' + currentMerchant.id + '/saldo').on('value', (snap) => {
        const newSaldo = snap.val() || 0;
        const oldSaldo = currentMerchant.saldo;
        
        currentMerchant.saldo = newSaldo;
        
        document.getElementById('merchant-balance').innerHTML = formatRupiah(newSaldo);
        document.getElementById('stat-saldo').innerHTML = formatRupiah(newSaldo);
        document.getElementById('withdraw-saldo').innerHTML = formatRupiah(newSaldo);
        
        if (newSaldo > oldSaldo) {
            const tambah = newSaldo - oldSaldo;
            showNotification(`💰 Saldo bertambah ${formatRupiah(tambah)}!`, 'success');
            playNotificationSound();
            addNotification('Saldo Bertambah', `Saldo Anda bertambah ${formatRupiah(tambah)} dari penjualan`, 'saldo');
        }
    });
}

// ===========================================
// PRODUCT MANAGEMENT
// ===========================================
function loadProducts() {
    if (!currentMerchant.id) return;
    
    db.ref('/products').orderByChild('merchant_id').equalTo(currentMerchant.id).on('value', (snap) => {
        products = [];
        const data = snap.val() || {};
        
        for (let id in data) {
            products.push({ id: id, ...data[id] });
        }
        
        displayProducts();
        updateStats();
        updateLowStock();
    });
}

function displayProducts() {
    const grid = document.getElementById('product-grid');
    
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>Belum ada produk. Klik "Tambah Produk" untuk mulai berjualan.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    products.forEach(product => {
        const stockClass = product.stock <= 5 ? 'stock-low' : '';
        html += `
            <div class="product-card">
                <div class="product-image">
                    <img src="${product.image || 'https://via.placeholder.com/300x200/00b894/ffffff?text=Produk'}" 
                         onerror="this.src='https://via.placeholder.com/300x200/00b894/ffffff?text=Produk'">
                </div>
                <div class="product-info">
                    <div class="product-name">${escapeHtml(product.name)}</div>
                    <div class="product-price">${formatRupiah(product.price)}</div>
                    <div class="product-stock ${stockClass}">
                        <i class="fas fa-box"></i> Stok: ${product.stock || 0}
                    </div>
                    <div class="product-actions">
                        <button class="btn-edit" onclick="editProduct('${product.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="deleteProduct('${product.id}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

function openProductModal(productId = null) {
    editingProductId = productId;
    selectedImageFile = null;
    
    document.getElementById('preview-img').style.display = 'none';
    document.getElementById('image-preview').style.display = 'flex';
    document.getElementById('upload-progress').style.display = 'none';
    
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            document.getElementById('modal-title').innerHTML = 'Edit Produk';
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-price').value = product.price || '';
            document.getElementById('product-stock').value = product.stock || '';
            document.getElementById('product-description').value = product.description || '';
            
            if (product.image && !product.image.includes('placeholder')) {
                const previewImg = document.getElementById('preview-img');
                previewImg.src = product.image;
                previewImg.style.display = 'block';
                document.getElementById('image-preview').style.display = 'none';
            }
        }
    } else {
        document.getElementById('modal-title').innerHTML = 'Tambah Produk';
        document.getElementById('product-name').value = '';
        document.getElementById('product-price').value = '';
        document.getElementById('product-stock').value = '0';
        document.getElementById('product-description').value = '';
    }
    
    document.getElementById('product-modal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
    editingProductId = null;
    selectedImageFile = null;
}

function triggerFileInput() {
    document.getElementById('file-input').click();
}

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showNotification('Hanya file gambar yang diperbolehkan!', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Ukuran gambar maksimal 5MB!', 'error');
        return;
    }
    
    selectedImageFile = file;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImg = document.getElementById('preview-img');
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        document.getElementById('image-preview').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function uploadImage(file, productId) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        
        const progressBar = document.getElementById('upload-progress');
        const progressInner = document.getElementById('upload-progress-bar');
        progressBar.style.display = 'block';
        
        const fileName = `products/${currentMerchant.id}/${productId}_${Date.now()}.jpg`;
        const storageRef = storage.ref().child(fileName);
        const uploadTask = storageRef.put(file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressInner.style.width = progress + '%';
            },
            (error) => {
                progressBar.style.display = 'none';
                reject(error);
            },
            async () => {
                const url = await uploadTask.snapshot.ref.getDownloadURL();
                progressBar.style.display = 'none';
                resolve(url);
            }
        );
    });
}

async function saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    const price = parseInt(document.getElementById('product-price').value) || 0;
    const stock = parseInt(document.getElementById('product-stock').value) || 0;
    const description = document.getElementById('product-description').value.trim();
    
    if (!name) {
        showNotification('Nama produk harus diisi!', 'error');
        return;
    }
    
    if (price <= 0) {
        showNotification('Harga harus lebih dari 0!', 'error');
        return;
    }
    
    showNotification('Menyimpan produk...', 'info');
    
    const productData = {
        merchant_id: currentMerchant.id,
        merchant_name: currentMerchant.nama_toko,
        name: name,
        price: price,
        stock: stock,
        description: description,
        delivery_takeaway: true,
        updated_at: Date.now()
    };
    
    if (editingProductId) {
        const existingProduct = products.find(p => p.id === editingProductId);
        if (existingProduct && existingProduct.image) {
            productData.image = existingProduct.image;
        }
        
        if (selectedImageFile) {
            try {
                const imageUrl = await uploadImage(selectedImageFile, editingProductId);
                productData.image = imageUrl;
            } catch (error) {
                showNotification('Gagal upload gambar: ' + error.message, 'error');
                return;
            }
        }
        
        db.ref('/products/' + editingProductId).update(productData)
            .then(() => {
                showNotification('Produk berhasil diupdate!', 'success');
                closeProductModal();
            })
            .catch(error => {
                showNotification('Gagal update: ' + error.message, 'error');
            });
    } else {
        const newRef = db.ref('/products').push();
        const newProductId = newRef.key;
        productData.created_at = Date.now();
        
        if (selectedImageFile) {
            try {
                const imageUrl = await uploadImage(selectedImageFile, newProductId);
                productData.image = imageUrl;
            } catch (error) {
                showNotification('Gagal upload gambar: ' + error.message, 'error');
                return;
            }
        } else {
            productData.image = 'https://via.placeholder.com/300x200/00b894/ffffff?text=Produk';
        }
        
        newRef.set(productData)
            .then(() => {
                showNotification('Produk berhasil ditambahkan!', 'success');
                closeProductModal();
                addNotification('Produk Baru', `${name} telah ditambahkan ke toko Anda`, 'product');
            })
            .catch(error => {
                showNotification('Gagal tambah: ' + error.message, 'error');
            });
    }
}

function editProduct(productId) {
    openProductModal(productId);
}

function deleteProduct(productId) {
    if (confirm('Yakin ingin menghapus produk ini?')) {
        db.ref('/products/' + productId).remove()
            .then(() => {
                showNotification('Produk dihapus', 'success');
            })
            .catch(error => {
                showNotification('Gagal hapus: ' + error.message, 'error');
            });
    }
}

// ===========================================
// ORDERS MANAGEMENT
// ===========================================
function loadOrders() {
    if (!currentMerchant.id) return;
    
    window.ordersListener = db.ref('/merchant_orders/' + currentMerchant.id).on('value', (snap) => {
        const oldCount = orders.length;
        orders = [];
        const data = snap.val() || {};
        
        for (let id in data) {
            orders.push({ id: id, ...data[id] });
        }
        
        orders.sort((a, b) => b.timestamp - a.timestamp);
        
        displayOrders();
        updateStats();
        updateOrderBadge();
        
        // Check for new orders
        if (orders.length > oldCount && oldCount > 0) {
            const newOrders = orders.slice(0, orders.length - oldCount);
            newOrders.forEach(order => {
                const totalOrder = order.items ? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
                addNotification('Pesanan Baru!', `Pesanan #${order.id.slice(-8)} sebesar ${formatRupiah(totalOrder)} masuk`, 'order');
                playNotificationSound();
            });
        }
    });
}

function displayOrders() {
    const container = document.getElementById('orders-container');
    let filteredOrders = orders;
    
    if (currentFilter !== 'all') {
        filteredOrders = orders.filter(o => o.status === currentFilter);
    }
    
    if (filteredOrders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Tidak ada pesanan</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    filteredOrders.forEach(order => {
        const totalOrder = order.items ? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
        const statusClass = `status-${order.status}`;
        
        let statusText = '';
        if (order.status === 'diproses') statusText = 'Menunggu Diproses';
        else if (order.status === 'dikirim') statusText = 'Sedang Dikirim';
        else if (order.status === 'selesai') statusText = 'Selesai';
        
        html += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">#${order.id.slice(-8)}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-items">
                    ${order.items ? order.items.map(item => `${item.name} x${item.quantity}`).join(', ') : '-'}
                </div>
                <div class="order-total">Total: ${formatRupiah(totalOrder)}</div>
                <div class="order-actions">
                    <button class="btn-view" onclick="viewOrderDetail('${order.id}')">
                        <i class="fas fa-eye"></i> Detail
                    </button>`;
        
        if (order.status === 'diproses') {
            html += `<button class="btn-process" onclick="updateOrderStatus('${order.id}', 'dikirim')">
                        <i class="fas fa-truck"></i> Proses & Kirim
                    </button>`;
        } else if (order.status === 'dikirim') {
            html += `<button class="btn-ship" onclick="updateOrderStatus('${order.id}', 'selesai')" disabled style="opacity:0.5">
                        <i class="fas fa-check"></i> Menunggu Konfirmasi Pembeli
                    </button>`;
        }
        
        html += `</div></div>`;
    });
    
    container.innerHTML = html;
}

function viewOrderDetail(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    selectedOrder = order;
    
    const totalOrder = order.items ? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
    
    let itemsHtml = '';
    if (order.items) {
        order.items.forEach(item => {
            itemsHtml += `
                <div class="order-detail-row">
                    <span>${item.name}</span>
                    <span>${item.quantity}x</span>
                    <span>${formatRupiah(item.price)}</span>
                    <span>${formatRupiah(item.price * item.quantity)}</span>
                </div>
            `;
        });
    }
    
    let deliveryHtml = '';
    if (order.delivery) {
        const address = order.delivery.address || `${order.delivery.lat}, ${order.delivery.lng}`;
        deliveryHtml = `
            <div class="order-detail-card">
                <h4><i class="fas fa-truck"></i> Informasi Pengiriman</h4>
                <div class="order-detail-row">
                    <span>Alamat</span>
                    <span>${address}</span>
                </div>
                ${order.delivery.maps_url ? `
                    <a href="${order.delivery.maps_url}" target="_blank" class="maps-link">
                        <i class="fas fa-map-marker-alt"></i> Buka di Google Maps
                    </a>
                ` : ''}
            </div>
        `;
    }
    
    const detailHtml = `
        <div class="order-detail-card">
            <h4><i class="fas fa-info-circle"></i> Informasi Pesanan</h4>
            <div class="order-detail-row">
                <span>No. Pesanan</span>
                <span>#${order.id.slice(-8)}</span>
            </div>
            <div class="order-detail-row">
                <span>Tanggal</span>
                <span>${formatDate(order.timestamp)}</span>
            </div>
            <div class="order-detail-row">
                <span>Pembeli</span>
                <span>${order.user_id || '-'}</span>
            </div>
            <div class="order-detail-row">
                <span>Status</span>
                <span class="order-status status-${order.status}">${order.status}</span>
            </div>
        </div>
        
        <div class="order-detail-card">
            <h4><i class="fas fa-box"></i> Detail Produk</h4>
            <div class="order-detail-header">
                <span>Produk</span>
                <span>Qty</span>
                <span>Harga</span>
                <span>Subtotal</span>
            </div>
            ${itemsHtml}
            <div class="order-detail-total">
                <span>Total Pesanan</span>
                <span>${formatRupiah(totalOrder)}</span>
            </div>
        </div>
        
        ${deliveryHtml}
    `;
    
    document.getElementById('order-detail-content').innerHTML = detailHtml;
    
    const actionButtons = document.getElementById('order-action-buttons');
    if (order.status === 'diproses') {
        actionButtons.innerHTML = `
            <button class="btn-primary" onclick="updateOrderStatus('${order.id}', 'dikirim')">
                <i class="fas fa-truck"></i> Proses & Kirim Pesanan
            </button>
            <button class="btn-secondary" onclick="closeOrderModal()">Tutup</button>
        `;
    } else {
        actionButtons.innerHTML = `
            <button class="btn-secondary" onclick="closeOrderModal()">Tutup</button>
        `;
    }
    
    document.getElementById('order-modal').style.display = 'flex';
}

function closeOrderModal() {
    document.getElementById('order-modal').style.display = 'none';
    selectedOrder = null;
}

function updateOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const userId = order.user_id;
    if (!userId) {
        showNotification('Data user tidak ditemukan', 'error');
        return;
    }
    
    showNotification('Mengupdate status...', 'info');
    
    const updates = {};
    updates[`/transactions/${userId}/${orderId}/status`] = newStatus;
    updates[`/merchant_orders/${currentMerchant.id}/${orderId}/status`] = newStatus;
    
    if (newStatus === 'dikirim') {
        updates[`/transactions/${userId}/${orderId}/delivery_sent_at`] = Date.now();
        updates[`/merchant_orders/${currentMerchant.id}/${orderId}/delivery_sent_at`] = Date.now();
    }
    
    db.ref().update(updates)
        .then(() => {
            showNotification(`Status pesanan diupdate menjadi ${newStatus}`, 'success');
            closeOrderModal();
            
            // Send WhatsApp notification
            if (newStatus === 'dikirim') {
                const pesan = `*PESANAN ANDA TELAH DIKIRIM*\n\n` +
                             `Halo kak! Pesanan #${orderId.slice(-8)} sudah kami kirim.\n` +
                             `Silakan cek aplikasi RE-COIN untuk konfirmasi penerimaan.\n\n` +
                             `Terima kasih telah berbelanja di ${currentMerchant.nama_toko}! 🚀`;
                window.open(`https://wa.me/${userId}?text=${encodeURIComponent(pesan)}`, '_blank');
            }
            
            addNotification('Status Pesanan', `Pesanan #${orderId.slice(-8)} telah di${newStatus === 'dikirim' ? 'kirim' : 'update'}`, 'order');
        })
        .catch(error => {
            showNotification('Gagal update: ' + error.message, 'error');
        });
}

function updateOrderBadge() {
    const pendingCount = orders.filter(o => o.status === 'diproses').length;
    const badge = document.getElementById('order-badge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// ===========================================
// WITHDRAWAL MANAGEMENT
// ===========================================
function loadWithdrawals() {
    if (!currentMerchant.id) return;
    
    db.ref('/withdrawals').orderByChild('merchant_id').equalTo(currentMerchant.id).on('value', (snap) => {
        withdrawals = [];
        const data = snap.val() || {};
        
        for (let id in data) {
            withdrawals.push({ id: id, ...data[id] });
        }
        
        withdrawals.sort((a, b) => b.timestamp - a.timestamp);
        displayWithdrawHistory();
    });
}

function displayWithdrawHistory() {
    const container = document.getElementById('withdraw-history-list');
    
    if (withdrawals.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada riwayat penarikan</div>';
        return;
    }
    
    let html = '';
    withdrawals.forEach(w => {
        const statusClass = w.status === 'pending' ? 'status-pending' : 'status-success';
        const statusText = w.status === 'pending' ? 'Diproses' : 'Selesai';
        
        html += `
            <div class="withdraw-item">
                <div>
                    <div class="withdraw-amount">${formatRupiah(w.amount)}</div>
                    <div style="font-size: 12px; color: var(--gray);">${formatDate(w.timestamp)}</div>
                    <div style="font-size: 11px;">${w.method} - ${w.details.substring(0, 30)}...</div>
                </div>
                <span class="withdraw-status ${statusClass}">${statusText}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function requestWithdrawal() {
    const method = document.getElementById('withdraw-method').value;
    const details = document.getElementById('withdraw-details').value.trim();
    const amount = parseInt(document.getElementById('withdraw-amount').value) || 0;
    
    if (!details) {
        showNotification('Isi detail rekening!', 'error');
        return;
    }
    
    if (amount < 50000) {
        showNotification('Minimal penarikan Rp 50.000', 'error');
        return;
    }
    
    if (amount > currentMerchant.saldo) {
        showNotification('Saldo tidak mencukupi!', 'error');
        return;
    }
    
    const withdrawId = 'wd_' + Date.now();
    const withdrawData = {
        id: withdrawId,
        merchant_id: currentMerchant.id,
        merchant_name: currentMerchant.nama_toko,
        method: method,
        details: details,
        amount: amount,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    db.ref('/withdrawals/' + withdrawId).set(withdrawData)
        .then(() => {
            const newSaldo = currentMerchant.saldo - amount;
            return db.ref('/merchants/' + currentMerchant.id + '/saldo').set(newSaldo);
        })
        .then(() => {
            showNotification('Permintaan penarikan dikirim!', 'success');
            
            document.getElementById('withdraw-details').value = '';
            document.getElementById('withdraw-amount').value = '';
            
            addNotification('Penarikan Saldo', `Penarikan ${formatRupiah(amount)} melalui ${method} sedang diproses`, 'withdraw');
            
            const pesan = `*PENARIKAN SALDO MERCHANT*\n` +
                         `Merchant: ${withdrawData.merchant_name}\n` +
                         `ID: ${withdrawData.merchant_id}\n` +
                         `Jumlah: Rp ${withdrawData.amount.toLocaleString('id-ID')}\n` +
                         `Metode: ${withdrawData.method}\n` +
                         `Detail: ${withdrawData.details}`;
            window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(pesan)}`, '_blank');
        })
        .catch(error => {
            showNotification('Gagal: ' + error.message, 'error');
        });
}

// ===========================================
// NOTIFICATIONS
// ===========================================
function loadNotifications() {
    if (!currentMerchant.id) return;
    
    db.ref('/notifications/' + currentMerchant.id).on('value', (snap) => {
        notifications = [];
        const data = snap.val() || {};
        
        for (let id in data) {
            notifications.push({ id: id, ...data[id] });
        }
        
        notifications.sort((a, b) => b.timestamp - a.timestamp);
        displayNotifications();
        updateNotificationCount();
    });
}

function addNotification(title, message, type = 'info') {
    if (!currentMerchant.id) return;
    
    const notifId = 'notif_' + Date.now();
    const notifData = {
        title: title,
        message: message,
        type: type,
        timestamp: Date.now(),
        read: false
    };
    
    db.ref('/notifications/' + currentMerchant.id + '/' + notifId).set(notifData);
}

function displayNotifications() {
    const container = document.getElementById('notification-list');
    
    if (notifications.length === 0) {
        container.innerHTML = '<div class="empty-notif">Tidak ada notifikasi</div>';
        return;
    }
    
    let html = '';
    notifications.slice(0, 10).forEach(notif => {
        const unreadClass = !notif.read ? 'unread' : '';
        html += `
            <div class="notification-item ${unreadClass}" onclick="markNotificationRead('${notif.id}')">
                <div class="notification-title">${escapeHtml(notif.title)}</div>
                <div class="notification-message">${escapeHtml(notif.message)}</div>
                <div class="notification-time">${formatDate(notif.timestamp)}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateNotificationCount() {
    const unreadCount = notifications.filter(n => !n.read).length;
    document.getElementById('notif-count').textContent = unreadCount;
}

function markNotificationRead(notifId) {
    db.ref('/notifications/' + currentMerchant.id + '/' + notifId + '/read').set(true);
}

function toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    panel.classList.toggle('show');
}

function closeNotifications() {
    document.getElementById('notification-panel').classList.remove('show');
}

// ===========================================
// STATISTICS
// ===========================================
function updateStats() {
    document.getElementById('stat-produk').innerHTML = products.length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(o => o.timestamp >= today.getTime());
    document.getElementById('stat-pesanan-baru').innerHTML = todayOrders.length;
    
    const todaySales = todayOrders.reduce((sum, order) => {
        const total = order.items ? order.items.reduce((s, item) => s + (item.price * item.quantity), 0) : 0;
        return sum + total;
    }, 0);
    document.getElementById('stat-penjualan-hari').innerHTML = formatRupiah(todaySales);
}

function updateLowStock() {
    const container = document.getElementById('low-stock');
    const lowStockProducts = products.filter(p => p.stock <= 5 && p.stock > 0);
    
    if (lowStockProducts.length === 0) {
        container.innerHTML = '<div class="empty-state">Semua stok aman</div>';
        return;
    }
    
    let html = '';
    lowStockProducts.forEach(product => {
        html += `
            <div class="low-stock-item">
                <div>
                    <div class="product-name">${escapeHtml(product.name)}</div>
                    <div class="product-stock stock-low">Stok: ${product.stock}</div>
                </div>
                <button class="btn-edit-small" onclick="editProduct('${product.id}')">Tambah Stok</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateRecentOrders() {
    const container = document.getElementById('recent-orders');
    const recentOrders = orders.filter(o => o.status !== 'selesai').slice(0, 5);
    
    if (recentOrders.length === 0) {
        container.innerHTML = '<div class="empty-state">Tidak ada pesanan terbaru</div>';
        return;
    }
    
    let html = '';
    recentOrders.forEach(order => {
        const totalOrder = order.items ? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
        const statusClass = `status-${order.status}`;
        
        html += `
            <div class="recent-order-item" onclick="viewOrderDetail('${order.id}')">
                <div class="recent-order-id">#${order.id.slice(-8)}</div>
                <div class="recent-order-total">${formatRupiah(totalOrder)}</div>
                <div class="recent-order-status ${statusClass}">${order.status}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ===========================================
// PROFILE MANAGEMENT
// ===========================================
function loadProfile() {
    document.getElementById('profile-nama-toko').value = currentMerchant.nama_toko || '';
    document.getElementById('profile-nama-pemilik').value = currentMerchant.nama_pemilik || '';
    document.getElementById('profile-phone').value = currentMerchant.phone || '';
    document.getElementById('profile-alamat').value = currentMerchant.alamat || '';
}

function updateProfile() {
    const updates = {
        nama_toko: document.getElementById('profile-nama-toko').value,
        nama_pemilik: document.getElementById('profile-nama-pemilik').value,
        phone: document.getElementById('profile-phone').value,
        alamat: document.getElementById('profile-alamat').value
    };
    
    db.ref('/merchants/' + currentMerchant.id).update(updates)
        .then(() => {
            currentMerchant.nama_toko = updates.nama_toko;
            currentMerchant.nama_pemilik = updates.nama_pemilik;
            currentMerchant.phone = updates.phone;
            currentMerchant.alamat = updates.alamat;
            
            document.getElementById('merchant-name').innerHTML = updates.nama_toko;
            document.getElementById('merchant-avatar').innerHTML = updates.nama_toko.charAt(0).toUpperCase();
            showNotification('Profil berhasil diupdate!', 'success');
        })
        .catch(error => {
            showNotification('Gagal update: ' + error.message, 'error');
        });
}

// ===========================================
// NAVIGATION
// ===========================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function goToProfile() {
    document.querySelector('[data-section="profile"]').click();
}

function goToOrders() {
    document.querySelector('[data-section="orders"]').click();
}

function goToProducts() {
    document.querySelector('[data-section="products"]').click();
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ===========================================
// SIDEBAR NAVIGATION
// ===========================================
document.querySelectorAll('.sidebar-menu li').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        
        const section = this.getAttribute('data-section');
        if (!section) return;
        
        document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');
        
        const titles = {
            dashboard: 'Dashboard',
            products: 'Produk Saya',
            orders: 'Pesanan',
            withdraw: 'Penarikan Saldo',
            profile: 'Profil Toko'
        };
        document.getElementById('page-title').innerHTML = titles[section] || section;
        
        if (section === 'profile') loadProfile();
        
        if (window.innerWidth <= 768) closeSidebar();
    });
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.getAttribute('data-filter');
        displayOrders();
    });
});

// ===========================================
// INITIALIZATION
// ===========================================
window.onload = function() {
    showLoginForm();
    
    if (!checkAutoLogin()) {
        showLoginPage();
    }
    
    // Close modal on outside click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });
    
    console.log('🚀 RE-COIN Merchant Dashboard siap!');
    console.log('💰 Fitur: Notifikasi pesanan masuk realtime');
    console.log('💸 Fitur: Penarikan saldo otomatis');
    console.log('📦 Fitur: Manajemen produk lengkap');
};
