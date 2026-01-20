/**
 * Orbital Mind - مدير الروابط والاتصالات
 * Connection Manager
 */

class ConnectionManager {
    constructor(options = {}) {
        this.config = {
            maxStrength: options.maxStrength || 5,
            minStrength: options.minStrength || 1,
            defaultStrength: options.defaultStrength || 2,
            updateOnInteraction: options.updateOnInteraction || true,
            interactionIncrement: options.interactionIncrement || 0.2
        };

        this.connections = new Map();
        this.connectionCounter = 0;
        this.tempConnection = null;

        this.callbacks = {
            onConnectionCreate: null,
            onConnectionUpdate: null,
            onConnectionDelete: null,
            onInteraction: null
        };
    }

    /**
     * إنشاء رابط جديد
     */
    createConnection(sourceId, targetId, options = {}) {
        // التحقق من عدم وجود الرابط مسبقاً
        if (this.connectionExists(sourceId, targetId)) {
            return this.increaseStrength(sourceId, targetId);
        }

        const id = options.id || `connection-${++this.connectionCounter}-${Date.now()}`;
        const strength = options.strength || this.config.defaultStrength;

        const connection = {
            id,
            source: sourceId,
            target: targetId,
            strength: Math.max(this.config.minStrength, Math.min(this.config.maxStrength, strength)),
            createdAt: options.createdAt || new Date().toISOString(),
            updatedAt: options.updatedAt || new Date().toISOString(),
            metadata: options.metadata || {}
        };

        this.connections.set(this.getConnectionKey(sourceId, targetId), connection);
        
        if (this.callbacks.onConnectionCreate) {
            this.callbacks.onConnectionCreate(connection);
        }

        return connection;
    }

    /**
     * الحصول على الرابط بالمعرف
     */
    getConnection(connectionId) {
        for (const [key, connection] of this.connections) {
            if (connection.id === connectionId) {
                return connection;
            }
        }
        return null;
    }

    /**
     * الحصول على الرابط بين عقدتين
     */
    getConnectionBetween(sourceId, targetId) {
        return this.connections.get(this.getConnectionKey(sourceId, targetId)) || null;
    }

    /**
     * التحقق من وجود رابط
     */
    connectionExists(sourceId, targetId) {
        return this.connections.has(this.getConnectionKey(sourceId, targetId));
    }

    /**
     * الحصول على جميع الروابط
     */
    getAllConnections() {
        return Array.from(this.connections.values());
    }

    /**
     * تحديث قوة الرابط
     */
    updateStrength(sourceId, targetId, strength) {
        const connection = this.getConnectionBetween(sourceId, targetId);
        if (!connection) return null;

        connection.strength = Math.max(
            this.config.minStrength,
            Math.min(this.config.maxStrength, strength)
        );
        connection.updatedAt = new Date().toISOString();

        if (this.callbacks.onConnectionUpdate) {
            this.callbacks.onConnectionUpdate(connection);
        }

        return connection;
    }

    /**
     * زيادة قوة الرابط
     */
    increaseStrength(sourceId, targetId, increment = null) {
        const connection = this.getConnectionBetween(sourceId, targetId);
        if (!connection) {
            return this.createConnection(sourceId, targetId);
        }

        return this.updateStrength(
            sourceId,
            targetId,
            connection.strength + (increment || this.config.interactionIncrement)
        );
    }

    /**
     * تقليل قوة الرابط
     */
    decreaseStrength(sourceId, targetId, decrement = null) {
        const connection = this.getConnectionBetween(sourceId, targetId);
        if (!connection) return null;

        return this.updateStrength(
            sourceId,
            targetId,
            connection.strength - (decrement || this.config.interactionIncrement)
        );
    }

    /**
     * حذف رابط
     */
    deleteConnection(sourceId, targetId) {
        const key = this.getConnectionKey(sourceId, targetId);
        const connection = this.connections.get(key);
        
        if (!connection) return false;

        this.connections.delete(key);
        
        if (this.callbacks.onConnectionDelete) {
            this.callbacks.onConnectionDelete(connection);
        }

        return true;
    }

    /**
     * حذف الرابط بالمعرف
     */
    deleteConnectionById(connectionId) {
        for (const [key, connection] of this.connections) {
            if (connection.id === connectionId) {
                this.connections.delete(key);
                
                if (this.callbacks.onConnectionDelete) {
                    this.callbacks.onConnectionDelete(connection);
                }
                
                return true;
            }
        }
        return false;
    }

    /**
     * حذف جميع رابط عقدة معينة
     */
    deleteConnectionsForNode(nodeId) {
        const connectionsToDelete = [];
        
        for (const [key, connection] of this.connections) {
            if (connection.source === nodeId || connection.target === nodeId) {
                connectionsToDelete.push(connection);
            }
        }

        connectionsToDelete.forEach(conn => {
            this.connections.delete(
                this.getConnectionKey(conn.source, conn.target)
            );
        });

        return connectionsToDelete.length;
    }

    /**
     * الحصول على روابط عقدة معينة
     */
    getConnectionsForNode(nodeId) {
        const nodeConnections = [];
        
        for (const connection of this.connections.values()) {
            if (connection.source === nodeId || connection.target === nodeId) {
                nodeConnections.push(connection);
            }
        }

        return nodeConnections;
    }

    /**
     * الحصول على جيران عقدة معينة
     */
    getNeighbors(nodeId) {
        const neighbors = [];
        
        for (const connection of this.connections.values()) {
            if (connection.source === nodeId) {
                neighbors.push({ id: connection.target, strength: connection.strength });
            } else if (connection.target === nodeId) {
                neighbors.push({ id: connection.source, strength: connection.strength });
            }
        }

        return neighbors;
    }

    /**
     * حساب قوة الترابط الكلية لعقدة
     */
    getNodeStrength(nodeId) {
        let totalStrength = 0;
        
        for (const connection of this.connections.values()) {
            if (connection.source === nodeId || connection.target === nodeId) {
                totalStrength += connection.strength;
            }
        }

        return totalStrength;
    }

    /**
     * تسجيل تفاعل بين عقدتين
     */
    recordInteraction(nodeId1, nodeId2) {
        if (!this.config.updateOnInteraction) return;

        this.increaseStrength(nodeId1, nodeId2);

        if (this.callbacks.onInteraction) {
            this.callbacks.onInteraction(nodeId1, nodeId2);
        }
    }

    /**
     * إنشاء رابط مؤقت للسحب
     */
    startTempConnection(sourceId, x, y) {
        this.tempConnection = {
            sourceId,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y
        };
        
        return this.tempConnection;
    }

    /**
     * تحديث الرابط المؤقت
     */
    updateTempConnection(x, y) {
        if (!this.tempConnection) return;
        
        this.tempConnection.currentX = x;
        this.tempConnection.currentY = y;
        
        return this.tempConnection;
    }

    /**
     * إنهاء الرابط المؤقت
     */
    endTempConnection(targetId = null) {
        const temp = this.tempConnection;
        this.tempConnection = null;
        
        if (temp && targetId) {
            return this.createConnection(temp.sourceId, targetId);
        }
        
        return null;
    }

    /**
     * إلغاء الرابط المؤقت
     */
    cancelTempConnection() {
        this.tempConnection = null;
    }

    /**
     * الحصول على الرابط المؤقت
     */
    getTempConnection() {
        return this.tempConnection;
    }

    /**
     * البحث عن الروابط
     */
    searchConnections(query, options = {}) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        const limit = options.limit || 50;

        for (const connection of this.connections.values()) {
            if (results.length >= limit) break;
            
            // البحث في البيانات الوصفية
            if (connection.metadata) {
                const metadataStr = JSON.stringify(connection.metadata).toLowerCase();
                if (metadataStr.includes(lowerQuery)) {
                    results.push(connection);
                }
            }
        }

        return results;
    }

    /**
     * الحصول على إحصائيات الروابط
     */
    getStats() {
        let totalStrength = 0;
        const strengthDistribution = {
            weak: 0,
            medium: 0,
            strong: 0,
            veryStrong: 0
        };

        for (const connection of this.connections.values()) {
            totalStrength += connection.strength;
            
            if (connection.strength <= 1.5) {
                strengthDistribution.weak++;
            } else if (connection.strength <= 3) {
                strengthDistribution.medium++;
            } else if (connection.strength <= 4) {
                strengthDistribution.strong++;
            } else {
                strengthDistribution.veryStrong++;
            }
        }

        return {
            total: this.connections.size,
            totalStrength,
            averageStrength: this.connections.size > 0 
                ? totalStrength / this.connections.size 
                : 0,
            distribution: strengthDistribution
        };
    }

    /**
     * تعيين ردود النداء
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * إنشاء مفتاح رابط فريد
     */
    getConnectionKey(sourceId, targetId) {
        return [sourceId, targetId].sort().join('::');
    }

    /**
     * تصدير البيانات
     */
    export() {
        return {
            connections: Array.from(this.connections.entries()),
            connectionCounter: this.connectionCounter
        };
    }

    /**
     * استيراد البيانات
     */
    import(data) {
        this.connections = new Map(data.connections || []);
        this.connectionCounter = data.connectionCounter || 0;
    }

    /**
     * مسح جميع الروابط
     */
    clear() {
        this.connections.clear();
        this.connectionCounter = 0;
        this.tempConnection = null;
    }

    /**
     * الحصول على البيانات بصيغة JSON
     */
    toJSON() {
        return JSON.stringify(Array.from(this.connections.values()), null, 2);
    }

    /**
     * إنشاء من JSON
     */
    fromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.connections.clear();
            data.forEach(conn => {
                this.connections.set(
                    this.getConnectionKey(conn.source, conn.target),
                    conn
                );
            });
            return true;
        } catch (e) {
            console.error('فشل استيراد الروابط:', e);
            return false;
        }
    }
}

// تصدير للاستخدام العام
window.ConnectionManager = ConnectionManager;
