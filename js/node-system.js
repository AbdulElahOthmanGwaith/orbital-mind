/**
 * Orbital Mind - نظام إدارة العقد (الكواكب)
 * Node Management System
 */

class NodeSystem {
    constructor(options = {}) {
        this.config = {
            minSize: options.minSize || 50,
            maxSize: options.maxSize || 180,
            defaultSize: options.defaultSize || 80,
            sizeByContent: options.sizeByContent || true,
            colors: options.colors || [
                'planet-blue',
                'planet-indigo',
                'planet-purple',
                'planet-pink',
                'planet-cyan',
                'planet-green',
                'planet-amber',
                'planet-red'
            ],
            icons: {
                text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
                </svg>`,
                image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                </svg>`,
                link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>`
            }
        };

        this.nodes = new Map();
        this.nodeCounter = 0;
        this.selectedNode = null;
        this.hoveredNode = null;

        this.callbacks = {
            onNodeCreate: null,
            onNodeSelect: null,
            onNodeUpdate: null,
            onNodeDelete: null,
            onNodeHover: null
        };
    }

    /**
     * إنشاء عقدة جديدة
     */
    createNode(data) {
        const id = data.id || `node-${++this.nodeCounter}-${Date.now()}`;
        const type = data.type || 'text';
        const content = data.content || '';
        const color = data.color || this.getRandomColor();
        
        // حساب الحجم بناءً على المحتوى
        let size = data.size || this.config.defaultSize;
        if (this.config.sizeByContent && content) {
            const contentLength = content.length;
            size = Math.max(
                this.config.minSize,
                Math.min(this.config.maxSize, 60 + Math.sqrt(contentLength) * 8)
            );
        }

        const node = {
            id,
            type,
            content,
            color,
            size,
            x: data.x || 0,
            y: data.y || 0,
            rotation: data.rotation || (Math.random() * 30 - 15),
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            metadata: data.metadata || {}
        };

        this.nodes.set(id, node);
        
        if (this.callbacks.onNodeCreate) {
            this.callbacks.onNodeCreate(node);
        }
        
        return node;
    }

    /**
     * الحصول على عقدة بالمعرف
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    /**
     * الحصول على جميع العقد
     */
    getAllNodes() {
        return Array.from(this.nodes.values());
    }

    /**
     * تحديث عقدة
     */
    updateNode(nodeId, updates) {
        const node = this.nodes.get(nodeId);
        if (!node) return null;

        Object.assign(node, updates, {
            updatedAt: new Date().toISOString()
        });

        // إعادة حساب الحجم إذا تغير المحتوى
        if (updates.content !== undefined && this.config.sizeByContent) {
            node.size = Math.max(
                this.config.minSize,
                Math.min(this.config.maxSize, 60 + Math.sqrt(updates.content.length) * 8)
            );
        }

        if (this.callbacks.onNodeUpdate) {
            this.callbacks.onNodeUpdate(node);
        }

        return node;
    }

    /**
     * حذف عقدة
     */
    deleteNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;

        this.nodes.delete(nodeId);
        
        if (this.selectedNode === nodeId) {
            this.selectedNode = null;
        }

        if (this.callbacks.onNodeDelete) {
            this.callbacks.onNodeDelete(nodeId);
        }

        return true;
    }

    /**
     * تكرار عقدة
     */
    duplicateNode(nodeId) {
        const original = this.nodes.get(nodeId);
        if (!original) return null;

        const newNode = this.createNode({
            content: original.content,
            type: original.type,
            color: this.getRandomColor(),
            x: original.x + 50,
            y: original.y + 50,
            metadata: { ...original.metadata }
        });

        return newNode;
    }

    /**
     * تغيير لون عقدة
     */
    changeColor(nodeId, color) {
        if (!this.config.colors.includes(color)) {
            color = this.getRandomColor();
        }
        return this.updateNode(nodeId, { color });
    }

    /**
     * الحصول على لون عشوائي
     */
    getRandomColor() {
        return this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
    }

    /**
     * الحصول على الأيقونة حسب النوع
     */
    getIcon(type) {
        return this.config.icons[type] || this.config.icons.text;
    }

    /**
     * تحديد عقدة
     */
    selectNode(nodeId) {
        const previousId = this.selectedNode;
        this.selectedNode = nodeId;

        if (this.callbacks.onNodeSelect) {
            this.callbacks.onNodeSelect(nodeId, previousId);
        }

        return nodeId;
    }

    /**
     * إلغاء تحديد العقدة الحالية
     */
    deselectNode() {
        const previousId = this.selectedNode;
        this.selectedNode = null;

        if (this.callbacks.onNodeSelect) {
            this.callbacks.onNodeSelect(null, previousId);
        }
    }

    /**
     * الحصول على العقدة في موقع محدد
     */
    getNodeAt(x, y, threshold = 20) {
        for (const [id, node] of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= node.size / 2 + threshold) {
                return node;
            }
        }
        return null;
    }

    /**
     * الحصول على أقرب عقدة
     */
    getNearestNode(x, y, excludeId = null) {
        let nearest = null;
        let minDistance = Infinity;

        for (const [id, node] of this.nodes) {
            if (id === excludeId) continue;
            
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                nearest = node;
            }
        }

        return nearest;
    }

    /**
     * البحث في العقد
     */
    search(query, options = {}) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        const limit = options.limit || 50;

        for (const [id, node] of this.nodes) {
            if (results.length >= limit) break;

            const contentMatch = node.content.toLowerCase().includes(lowerQuery);
            const typeMatch = node.type.toLowerCase().includes(lowerQuery);

            if (contentMatch || typeMatch) {
                results.push({
                    node,
                    score: contentMatch ? 2 : 1,
                    matches: contentMatch ? [node.content] : []
                });
            }
        }

        // ترتيب النتائج
        results.sort((a, b) => b.score - a.score);

        return results;
    }

    /**
     * الحصول على العقد المرتبطة
     */
    getConnectedNodes(nodeId, connections) {
        const connected = [];
        
        for (const connection of connections) {
            if (connection.source === nodeId) {
                connected.push(connection.target);
            } else if (connection.target === nodeId) {
                connected.push(connection.source);
            }
        }

        return connected;
    }

    /**
     * حساب درجة الترابط
     */
    calculateConnectionDegree(nodeId, connections) {
        let degree = 0;
        
        for (const connection of connections) {
            if (connection.source === nodeId || connection.target === nodeId) {
                degree += connection.strength;
            }
        }

        return degree;
    }

    /**
     * الحصول على إحصائيات العقد
     */
    getStats() {
        const typeCount = {};
        const colorCount = {};
        
        for (const node of this.nodes.values()) {
            typeCount[node.type] = (typeCount[node.type] || 0) + 1;
            colorCount[node.color] = (colorCount[node.color] || 0) + 1;
        }

        return {
            total: this.nodes.size,
            byType: typeCount,
            byColor: colorCount,
            selected: this.selectedNode ? 1 : 0
        };
    }

    /**
     * تعيين ردود النداء
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * تصدير البيانات
     */
    export() {
        return {
            nodes: Array.from(this.nodes.entries()),
            nodeCounter: this.nodeCounter
        };
    }

    /**
     * استيراد البيانات
     */
    import(data) {
        this.nodes = new Map(data.nodes || []);
        this.nodeCounter = data.nodeCounter || 0;
    }

    /**
     * مسح جميع العقد
     */
    clear() {
        this.nodes.clear();
        this.nodeCounter = 0;
        this.selectedNode = null;
    }

    /**
     * الحصول على البيانات بصيغة JSON
     */
    toJSON() {
        return JSON.stringify(Array.from(this.nodes.values()), null, 2);
    }

    /**
     * إنشاء من JSON
     */
    fromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.nodes.clear();
            data.forEach(node => this.nodes.set(node.id, node));
            return true;
        } catch (e) {
            console.error('فشل استيراد البيانات:', e);
            return false;
        }
    }
}

// تصدير للاستخدام العام
window.NodeSystem = NodeSystem;
