/**
 * Orbital Mind - مدير التخزين والبيانات
 * Storage Manager
 */

class StorageManager {
    constructor(options = {}) {
        this.config = {
            storageKey: options.storageKey || 'orbital-mind-data',
            backupKey: options.storageKey || 'orbital-mind-backup',
            autoSave: options.autoSave !== false,
            autoSaveInterval: options.autoSaveInterval || 30000, // 30 ثانية
            maxBackups: options.maxBackups || 5,
            compression: options.compression || false,
            encryption: options.encryption || false
        };

        this.storage = window.localStorage;
        this.autoSaveTimer = null;
        this.unsavedChanges = false;
        this.lastSaveTime = null;

        this.callbacks = {
            onSave: null,
            onLoad: null,
            onAutoSave: null,
            onError: null,
            onConflict: null
        };

        this.data = {
            version: '1.0.0',
            timestamp: null,
            nodes: [],
            connections: [],
            view: { x: 0, y: 0, zoom: 1 },
            metadata: {}
        };
    }

    /**
     * تهيئة مدير التخزين
     */
    init(initialData = {}) {
        this.data = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            nodes: [],
            connections: [],
            view: { x: 0, y: 0, zoom: 1 },
            metadata: {},
            ...initialData
        };

        // بدء الحفظ التلقائي
        if (this.config.autoSave) {
            this.startAutoSave();
        }

        // الاستماع لتغيرات التبويب
        window.addEventListener('beforeunload', () => {
            if (this.unsavedChanges) {
                this.save();
            }
        });

        return this;
    }

    /**
     * تعيين البيانات
     */
    setData(data) {
        this.data = {
            ...this.data,
            ...data,
            timestamp: new Date().toISOString()
        };
        this.unsavedChanges = true;
    }

    /**
     * الحصول على البيانات
     */
    getData() {
        return { ...this.data };
    }

    /**
     * إضافة عقدة
     */
    addNode(node) {
        this.data.nodes.push(node);
        this.unsavedChanges = true;
        return node;
    }

    /**
     * تحديث عقدة
     */
    updateNode(nodeId, updates) {
        const index = this.data.nodes.findIndex(n => n.id === nodeId);
        if (index !== -1) {
            this.data.nodes[index] = {
                ...this.data.nodes[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.unsavedChanges = true;
            return this.data.nodes[index];
        }
        return null;
    }

    /**
     * حذف عقدة
     */
    deleteNode(nodeId) {
        const index = this.data.nodes.findIndex(n => n.id === nodeId);
        if (index !== -1) {
            this.data.nodes.splice(index, 1);
            this.unsavedChanges = true;
            return true;
        }
        return false;
    }

    /**
     * إضافة رابط
     */
    addConnection(connection) {
        this.data.connections.push(connection);
        this.unsavedChanges = true;
        return connection;
    }

    /**
     * حذف رابط
     */
    deleteConnection(connectionId) {
        const index = this.data.connections.findIndex(c => c.id === connectionId);
        if (index !== -1) {
            this.data.connections.splice(index, 1);
            this.unsavedChanges = true;
            return true;
        }
        return false;
    }

    /**
     * حذف روابط عقدة
     */
    deleteNodeConnections(nodeId) {
        const originalCount = this.data.connections.length;
        this.data.connections = this.data.connections.filter(
            c => c.source !== nodeId && c.target !== nodeId
        );
        const deletedCount = originalCount - this.data.connections.length;
        
        if (deletedCount > 0) {
            this.unsavedChanges = true;
        }
        
        return deletedCount;
    }

    /**
     * تحديث العرض
     */
    setView(view) {
        this.data.view = { ...this.data.view, ...view };
        this.unsavedChanges = true;
    }

    /**
     * تعيين البيانات الوصفية
     */
    setMetadata(metadata) {
        this.data.metadata = { ...this.data.metadata, ...metadata };
        this.unsavedChanges = true;
    }

    /**
     * حفظ البيانات
     */
    save() {
        try {
            const dataToSave = {
                ...this.data,
                timestamp: new Date().toISOString()
            };

            const serialized = this.serialize(dataToSave);
            this.storage.setItem(this.config.storageKey, serialized);

            // إنشاء نسخة احتياطية
            this.createBackup(dataToSave);

            this.unsavedChanges = false;
            this.lastSaveTime = new Date();

            if (this.callbacks.onSave) {
                this.callbacks.onSave(dataToSave);
            }

            return true;
        } catch (error) {
            console.error('خطأ في الحفظ:', error);
            
            if (this.callbacks.onError) {
                this.callbacks.onError('save', error);
            }
            
            return false;
        }
    }

    /**
     * تحميل البيانات
     */
    load() {
        try {
            const serialized = this.storage.getItem(this.config.storageKey);
            
            if (!serialized) {
                return this.loadBackup();
            }

            const data = this.deserialize(serialized);
            
            if (this.validateData(data)) {
                this.data = data;
                this.unsavedChanges = false;

                if (this.callbacks.onLoad) {
                    this.callbacks.onLoad(data);
                }

                return data;
            } else {
                console.warn('بيانات غير صالحة، محاولة تحميل النسخة الاحتياطية');
                return this.loadBackup();
            }
        } catch (error) {
            console.error('خطأ في التحميل:', error);
            
            if (this.callbacks.onError) {
                this.callbacks.onError('load', error);
            }
            
            return this.loadBackup();
        }
    }

    /**
     * تحميل نسخة احتياطية
     */
    loadBackup() {
        try {
            const backups = this.getBackups();
            
            if (backups.length > 0) {
                // تحميل أحدث نسخة احتياطية
                const latestBackup = backups[0];
                const data = this.deserialize(latestBackup.data);
                
                if (this.validateData(data)) {
                    this.data = data;
                    
                    if (this.callbacks.onConflict) {
                        this.callbacks.onConflict('backup-loaded', data);
                    }
                    
                    return data;
                }
            }
            
            return null;
        } catch (error) {
            console.error('خطأ في تحميل النسخة الاحتياطية:', error);
            return null;
        }
    }

    /**
     * إنشاء نسخة احتياطية
     */
    createBackup(data) {
        try {
            const backups = this.getBackups();
            const backup = {
                timestamp: new Date().toISOString(),
                data: this.serialize(data)
            };

            backups.unshift(backup);

            // الحفاظ على الحد الأقصى للنسخ الاحتياطية
            while (backups.length > this.config.maxBackups) {
                backups.pop();
            }

            // حفظ النسخ الاحتياطية
            this.storage.setItem(
                this.config.backupKey,
                JSON.stringify(backups)
            );
        } catch (error) {
            console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
        }
    }

    /**
     * الحصول على النسخ الاحتياطية
     */
    getBackups() {
        try {
            const serialized = this.storage.getItem(this.config.backupKey);
            return serialized ? JSON.parse(serialized) : [];
        } catch {
            return [];
        }
    }

    /**
     * حذف النسخ الاحتياطية
     */
    clearBackups() {
        this.storage.removeItem(this.config.backupKey);
    }

    /**
     * تسلسل البيانات
     */
    serialize(data) {
        let serialized = JSON.stringify(data);
        
        if (this.config.compression) {
            try {
                serialized = this.compress(serialized);
            } catch (error) {
                console.warn('فشل الضغط، استخدام البيانات غير مضغوطة');
            }
        }
        
        return serialized;
    }

    /**
     * إلغاء تسلسل البيانات
     */
    deserialize(serialized) {
        let data = serialized;
        
        if (this.config.compression) {
            try {
                data = this.decompress(serialized);
            } catch (error) {
                console.warn('فشل فك الضغط، استخدام البيانات كما هي');
            }
        }
        
        return JSON.parse(data);
    }

    /**
     * ضغط البيانات (إذا كان مدعوماً)
     */
    compress(str) {
        // استخدام Base64 للتخزين
        return btoa(unescape(encodeURIComponent(str)));
    }

    /**
     * فك ضغط البيانات
     */
    decompress(str) {
        return decodeURIComponent(escape(atob(str)));
    }

    /**
     * التحقق من صحة البيانات
     */
    validateData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // التحقق من الإصدار
        if (data.version && !this.isCompatibleVersion(data.version)) {
            console.warn('إصدار غير متوافق:', data.version);
            return false;
        }

        // التحقق من المصفوفات
        if (!Array.isArray(data.nodes)) {
            data.nodes = [];
        }
        
        if (!Array.isArray(data.connections)) {
            data.connections = [];
        }

        return true;
    }

    /**
     * التحقق من توافق الإصدار
     */
    isCompatibleVersion(version) {
        const major = parseInt(version.split('.')[0]);
        return major === 1;
    }

    /**
     * تصدير البيانات
     */
    export(format = 'json') {
        const data = {
            ...this.data,
            exportedAt: new Date().toISOString(),
            exportFormat: format
        };

        switch (format) {
            case 'json':
                return {
                    data: JSON.stringify(data, null, 2),
                    mimeType: 'application/json',
                    extension: 'json'
                };
            
            case 'minified':
                return {
                    data: JSON.stringify(data),
                    mimeType: 'application/json',
                    extension: 'min.json'
                };
            
            default:
                return {
                    data: JSON.stringify(data, null, 2),
                    mimeType: 'application/json',
                    extension: 'json'
                };
        }
    }

    /**
     * استيراد البيانات
     */
    import(dataString) {
        try {
            const data = JSON.parse(dataString);
            
            if (this.validateData(data)) {
                this.data = {
                    ...this.data,
                    ...data,
                    importedAt: new Date().toISOString()
                };
                this.unsavedChanges = true;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('خطأ في الاستيراد:', error);
            return false;
        }
    }

    /**
     * بدء الحفظ التلقائي
     */
    startAutoSave() {
        this.stopAutoSave();
        
        this.autoSaveTimer = setInterval(() => {
            if (this.unsavedChanges) {
                this.save();
                
                if (this.callbacks.onAutoSave) {
                    this.callbacks.onAutoSave();
                }
            }
        }, this.config.autoSaveInterval);
    }

    /**
     * إيقاف الحفظ التلقائي
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * حفظ يدوي
     */
    manualSave() {
        return this.save();
    }

    /**
     * الحصول على حالة الحفظ
     */
    getSaveStatus() {
        return {
            hasUnsavedChanges: this.unsavedChanges,
            lastSaveTime: this.lastSaveTime,
            autoSaveEnabled: this.config.autoSave,
            nodeCount: this.data.nodes.length,
            connectionCount: this.data.connections.length
        };
    }

    /**
     * مسح جميع البيانات
     */
    clear() {
        this.data = {
            version: '1.0.0',
            timestamp: null,
            nodes: [],
            connections: [],
            view: { x: 0, y: 0, zoom: 1 },
            metadata: {}
        };
        this.unsavedChanges = false;
        
        this.storage.removeItem(this.config.storageKey);
    }

    /**
     * تعيين ردود النداء
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * إنشاء ملف للتحميل
     */
    download(format = 'json') {
        const { data, mimeType, extension } = this.export(format);
        
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `orbital-mind-${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * قراءة ملف
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const result = this.import(e.target.result);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}

// تصدير للاستخدام العام
window.StorageManager = StorageManager;
