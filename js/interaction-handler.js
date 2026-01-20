/**
 * Orbital Mind - معالج التفاعلات
 * Interaction Handler
 */

class InteractionHandler {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.config = {
            doubleClickDelay: options.doubleClickDelay || 300,
            dragThreshold: options.dragThreshold || 5,
            zoomMin: options.zoomMin || 0.2,
            zoomMax: options.zoomMax || 3,
            zoomSpeed: options.zoomSpeed || 0.1,
            panSpeed: options.panSpeed || 1
        };

        this.state = {
            isDragging: false,
            isPanning: false,
            isConnecting: false,
            isSelecting: false,
            dragStart: { x: 0, y: 0 },
            dragCurrent: { x: 0, y: 0 },
            selectedNodes: new Set(),
            hoveredNode: null,
            lastClickTime: 0,
            lastClickNode: null
        };

        this.view = {
            x: 0,
            y: 0,
            zoom: 1,
            targetX: 0,
            targetY: 0,
            targetZoom: 1
        };

        this.callbacks = {
            onNodeClick: null,
            onNodeDoubleClick: null,
            onNodeDrag: null,
            onNodeDrop: null,
            onNodeHover: null,
            onSelectionChange: null,
            onPan: null,
            onZoom: null,
            onConnectStart: null,
            onConnectMove: null,
            onConnectEnd: null,
            onContextMenu: null,
            onKeyDown: null
        };

        this.isMouseDown = false;
        this.mousePosition = { x: 0, y: 0 };
        
        this.bindEvents();
    }

    /**
     * ربط الأحداث
     */
    bindEvents() {
        // أحداث الماوس
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));

        // أحداث اللمس
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // أحداث لوحة المفاتيح
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // نافذة الأحداث
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * تحويل الإحداثيات من الشاشة إلى العالم
     */
    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (screenX - rect.left - this.view.x) / this.view.zoom;
        const y = (screenY - rect.top - this.view.y) / this.view.zoom;
        return { x, y };
    }

    /**
     * تحويل الإحداثيات من العالم إلى الشاشة
     */
    worldToScreen(worldX, worldY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = worldX * this.view.zoom + this.view.x + rect.left;
        const y = worldY * this.view.zoom + this.view.y + rect.top;
        return { x, y };
    }

    /**
     * التعامل مع ضغط الماوس
     */
    handleMouseDown(e) {
        if (e.button !== 0 && e.button !== 2) return;
        
        e.preventDefault();
        this.isMouseDown = true;
        
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        this.state.dragStart = { ...worldPos };
        this.state.dragCurrent = { ...worldPos };

        if (e.button === 2) {
            // ضغط يمين - بدء النقل
            this.state.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
        } else {
            // ضغط يسار
            const node = this.getNodeAtPosition(worldPos.x, worldPos.y);
            
            if (node) {
                if (e.shiftKey || e.ctrlKey) {
                    // إضافة/إزالة من التحديد
                    this.toggleNodeSelection(node.id);
                } else if (this.state.selectedNodes.size > 1) {
                    // نقل مجموعة محددة
                    this.state.isDragging = true;
                    this.draggedNode = node.id;
                } else {
                    // تحديد ونقل عقدة واحدة
                    this.selectNode(node.id);
                    this.state.isDragging = true;
                    this.draggedNode = node.id;
                }

                if (this.callbacks.onNodeClick) {
                    this.callbacks.onNodeClick(node, e);
                }
            } else {
                // ضغط على مساحة فارغة
                if (!e.shiftKey && !e.ctrlKey) {
                    this.clearSelection();
                }
            }
        }
    }

    /**
     * التعامل مع حركة الماوس
     */
    handleMouseMove(e) {
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        this.mousePosition = worldPos;
        this.state.dragCurrent = { ...worldPos };

        if (this.state.isPanning) {
            // نقل العرض
            const dx = e.movementX;
            const dy = e.movementY;
            this.pan(dx, dy);
            
            if (this.callbacks.onPan) {
                this.callbacks.onPan(this.view.x, this.view.y);
            }
        } else if (this.state.isDragging && this.draggedNode) {
            // نقل العقدة
            const dx = worldPos.x - this.state.dragStart.x;
            const dy = worldPos.y - this.state.dragStart.y;
            
            this.moveNode(this.draggedNode, dx, dy);
            this.state.dragStart = { ...worldPos };

            if (this.callbacks.onNodeDrag) {
                this.callbacks.onNodeDrag(this.draggedNode, worldPos);
            }
        } else if (this.state.isConnecting && this.connectingNode) {
            // تحديث خط الربط المؤقت
            if (this.callbacks.onConnectMove) {
                this.callbacks.onConnectMove(worldPos);
            }
        } else {
            // التحقق من التحويم
            const node = this.getNodeAtPosition(worldPos.x, worldPos.y);
            this.handleNodeHover(node);
        }
    }

    /**
     * التعامل مع رفع الماوس
     */
    handleMouseUp(e) {
        if (e.button !== 0 && e.button !== 2) return;
        
        e.preventDefault();
        this.isMouseDown = false;

        if (this.state.isPanning) {
            this.state.isPanning = false;
            this.canvas.style.cursor = 'grab';
        }

        if (this.state.isDragging) {
            this.state.isDragging = false;
            
            if (this.callbacks.onNodeDrop) {
                this.callbacks.onNodeDrop(this.draggedNode, this.mousePosition);
            }
            
            this.draggedNode = null;
        }

        if (this.state.isConnecting) {
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            const targetNode = this.getNodeAtPosition(worldPos.x, worldPos.y);
            
            if (targetNode && targetNode.id !== this.connectingNode) {
                if (this.callbacks.onConnectEnd) {
                    this.callbacks.onConnectEnd(this.connectingNode, targetNode.id);
                }
            }
            
            this.state.isConnecting = false;
            this.connectingNode = null;
        }
    }

    /**
     * التعامل مع عجلة الماوس
     */
    handleWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? -this.config.zoomSpeed : this.config.zoomSpeed;
        const newZoom = Math.max(
            this.config.zoomMin,
            Math.min(this.config.zoomMax, this.view.zoom + delta)
        );

        // التكبير نحو موقع الماوس
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldBefore = this.screenToWorld(mouseX, mouseY);
        
        this.view.zoom = newZoom;
        
        const worldAfter = this.screenToWorld(mouseX, mouseY);
        
        this.view.x += (worldAfter.x - worldBefore.x) * this.view.zoom;
        this.view.y += (worldAfter.y - worldBefore.y) * this.view.zoom;

        if (this.callbacks.onZoom) {
            this.callbacks.onZoom(this.view.zoom, this.view.x, this.view.y);
        }
    }

    /**
     * التعامل مع قائمة السياق
     */
    handleContextMenu(e) {
        e.preventDefault();

        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        const node = this.getNodeAtPosition(worldPos.x, worldPos.y);

        if (node) {
            this.selectNode(node.id);
        }

        if (this.callbacks.onContextMenu) {
            this.callbacks.onContextMenu(node, { x: e.clientX, y: e.clientY }, e);
        }
    }

    /**
     * التعامل مع النقر المزدوج
     */
    handleDoubleClick(e) {
        e.preventDefault();

        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        const node = this.getNodeAtPosition(worldPos.x, worldPos.y);

        if (node) {
            if (this.callbacks.onNodeDoubleClick) {
                this.callbacks.onNodeDoubleClick(node, e);
            }
        } else {
            // إنشاء عقدة جديدة في الموقع
            this.createNodeAtPosition(worldPos);
        }
    }

    /**
     * التعامل مع اللمس
     */
    handleTouchStart(e) {
        e.preventDefault();

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const worldPos = this.screenToWorld(touch.clientX, touch.clientY);
            
            this.state.dragStart = { ...worldPos };
            this.state.dragCurrent = { ...worldPos };
            
            const node = this.getNodeAtPosition(worldPos.x, worldPos.y);
            if (node) {
                this.selectNode(node.id);
                this.state.isDragging = true;
                this.draggedNode = node.id;
            } else {
                this.clearSelection();
            }
        } else if (e.touches.length === 2) {
            // تكبير اللمس
            this.state.isPinching = true;
            this.initialPinchDistance = this.getPinchDistance(e.touches);
            this.initialZoom = this.view.zoom;
        }
    }

    /**
     * التعامل مع حركة اللمس
     */
    handleTouchMove(e) {
        e.preventDefault();

        if (this.state.isDragging && e.touches.length === 1) {
            const touch = e.touches[0];
            const worldPos = this.screenToWorld(touch.clientX, touch.clientY);
            
            const dx = worldPos.x - this.state.dragStart.x;
            const dy = worldPos.y - this.state.dragStart.y;
            
            this.moveNode(this.draggedNode, dx, dy);
            this.state.dragStart = { ...worldPos };
        } else if (this.state.isPinching && e.touches.length === 2) {
            const currentDistance = this.getPinchDistance(e.touches);
            const scale = currentDistance / this.initialPinchDistance;
            
            this.view.zoom = Math.max(
                this.config.zoomMin,
                Math.min(this.config.zoomMax, this.initialZoom * scale)
            );
        }
    }

    /**
     * التعامل مع نهاية اللمس
     */
    handleTouchEnd(e) {
        this.state.isDragging = false;
        this.state.isPinching = false;
        this.draggedNode = null;
    }

    /**
     * التعامل مع ضغط المفاتيح
     */
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedNodes();
                break;
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.selectAllNodes();
                }
                break;
            case 'Escape':
                this.clearSelection();
                this.cancelConnecting();
                break;
            case ' ':
                e.preventDefault();
                this.centerView();
                break;
            case '=':
            case '+':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.zoomIn();
                }
                break;
            case '-':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.zoomOut();
                }
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.resetZoom();
                }
                break;
        }

        if (this.callbacks.onKeyDown) {
            this.callbacks.onKeyDown(e);
        }
    }

    /**
     * التعامل مع رفع المفاتيح
     */
    handleKeyUp(e) {
        // يمكن إضافة معالجة لرفع المفاتيح هنا
    }

    /**
     * التعامل مع تغيير حجم النافذة
     */
    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * نقل العرض
     */
    pan(dx, dy) {
        this.view.x += dx * this.config.panSpeed;
        this.view.y += dy * this.config.panSpeed;
    }

    /**
     * تكبير
     */
    zoom(factor, centerX, centerY) {
        const newZoom = Math.max(
            this.config.zoomMin,
            Math.min(this.config.zoomMax, this.view.zoom * factor)
        );

        const worldBefore = this.screenToWorld(centerX, centerY);
        this.view.zoom = newZoom;
        const worldAfter = this.screenToWorld(centerX, centerY);

        this.view.x += (worldAfter.x - worldBefore.x) * this.view.zoom;
        this.view.y += (worldAfter.y - worldBefore.y) * this.view.zoom;
    }

    /**
     * تكبير للداخل
     */
    zoomIn() {
        this.zoom(1.2, this.canvas.width / 2, this.canvas.height / 2);
    }

    /**
     * تكبير للخارج
     */
    zoomOut() {
        this.zoom(0.8, this.canvas.width / 2, this.canvas.height / 2);
    }

    /**
     * إعادة تعيين التكبير
     */
    resetZoom() {
        this.view.zoom = 1;
        this.view.x = 0;
        this.view.y = 0;
    }

    /**
     * توسيط العرض
     */
    centerView() {
        const nodes = this.getAllNodes();
        if (nodes.length === 0) {
            this.resetZoom();
            return;
        }

        // حساب مركز العقد
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const width = maxX - minX + 200;
        const height = maxY - minY + 200;

        const scaleX = this.canvas.width / width;
        const scaleY = this.canvas.height / height;
        this.view.zoom = Math.min(scaleX, scaleY, 2);

        const worldCenter = this.screenToWorld(
            this.canvas.width / 2,
            this.canvas.height / 2
        );

        this.view.x = (this.canvas.width / 2) - centerX * this.view.zoom;
        this.view.y = (this.canvas.height / 2) - centerY * this.view.zoom;
    }

    /**
     * بدء الربط
     */
    startConnecting(nodeId) {
        this.state.isConnecting = true;
        this.connectingNode = nodeId;

        if (this.callbacks.onConnectStart) {
            this.callbacks.onConnectStart(nodeId);
        }
    }

    /**
     * إلغاء الربط
     */
    cancelConnecting() {
        this.state.isConnecting = false;
        this.connectingNode = null;
    }

    /**
     * تحديد عقدة
     */
    selectNode(nodeId) {
        if (!this.state.selectedNodes.has(nodeId)) {
            this.state.selectedNodes.add(nodeId);
            
            if (this.callbacks.onSelectionChange) {
                this.callbacks.onSelectionChange(Array.from(this.state.selectedNodes));
            }
        }
    }

    /**
     * إضافة/إزالة عقدة من التحديد
     */
    toggleNodeSelection(nodeId) {
        if (this.state.selectedNodes.has(nodeId)) {
            this.state.selectedNodes.delete(nodeId);
        } else {
            this.state.selectedNodes.add(nodeId);
        }

        if (this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange(Array.from(this.state.selectedNodes));
        }
    }

    /**
     * مسح التحديد
     */
    clearSelection() {
        this.state.selectedNodes.clear();
        
        if (this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange([]);
        }
    }

    /**
     * تحديد جميع العقد
     */
    selectAllNodes() {
        const nodes = this.getAllNodes();
        nodes.forEach(node => this.state.selectedNodes.add(node.id));
        
        if (this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange(Array.from(this.state.selectedNodes));
        }
    }

    /**
     * حذف العقد المحددة
     */
    deleteSelectedNodes() {
        this.state.selectedNodes.forEach(nodeId => {
            this.deleteNode(nodeId);
        });
        this.clearSelection();
    }

    /**
     * التعامل مع التحويم على العقدة
     */
    handleNodeHover(node) {
        if (node !== this.state.hoveredNode) {
            if (this.callbacks.onNodeHover) {
                this.callbacks.onNodeHover(node);
            }
            this.state.hoveredNode = node;
        }
    }

    /**
     * تعيين ردود النداء
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * الدوال التي يجب تعريفها في الكلاس الرئيسي
     */
    getNodeAtPosition(x, y) { return null; }
    moveNode(nodeId, dx, dy) {}
    createNodeAtPosition(pos) {}
    deleteNode(nodeId) {}
    getAllNodes() { return []; }
}

// تصدير للاستخدام العام
window.InteractionHandler = InteractionHandler;
