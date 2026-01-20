/**
 * Orbital Mind - الملف الرئيسي للتطبيق
 * Main Application File
 */

class OrbitalMind {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        
        // الأنظمة الفرعية
        this.physics = null;
        this.nodes = null;
        this.connections = null;
        this.interaction = null;
        this.storage = null;
        
        // حالة التطبيق
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 60;
        
        // عناصر الواجهة
        this.elements = {};
        
        this.init();
    }

    /**
     * تهيئة التطبيق
     */
    init() {
        this.setupCanvas();
        this.setupSystems();
        this.setupEventListeners();
        this.setupUI();
        this.loadData();
        this.start();
        this.showWelcome();
    }

    /**
     * إعداد Canvas
     */
    setupCanvas() {
        this.canvas = document.getElementById('orbital-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * تغيير حجم Canvas
     */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.minimapCanvas.width = 150;
        this.minimapCanvas.height = 150;
    }

    /**
     * إعداد الأنظمة
     */
    setupSystems() {
        // محرك الفيزياء
        this.physics = new PhysicsEngine({
            repulsionStrength: 1500,
            attractionStrength: 0.03,
            damping: 0.9,
            maxVelocity: 10,
            minDistance: 120,
            centerGravity: 0.005,
            borderForce: 0.3
        });

        // نظام العقد
        this.nodes = new NodeSystem({
            minSize: 60,
            maxSize: 200,
            defaultSize: 90,
            sizeByContent: true
        });

        // مدير الروابط
        this.connections = new ConnectionManager({
            defaultStrength: 2,
            interactionIncrement: 0.1
        });

        // معالج التفاعلات
        this.interaction = new InteractionHandler(this.canvas);
        
        // مدير التخزين
        this.storage = new StorageManager({
            storageKey: 'orbital-mind-data',
            autoSave: true,
            autoSaveInterval: 60000
        });

        // ربط الأنظمة ببعضها
        this.setupSystemIntegration();
    }

    /**
     * ربط الأنظمة
     */
    setupSystemIntegration() {
        // ربط نظام العقد بمحرك الفيزياء
        this.nodes.setCallbacks({
            onNodeCreate: (node) => {
                this.physics.addNode(node);
                this.storage.addNode(node);
                this.updateStats();
            },
            onNodeUpdate: (node) => {
                this.storage.updateNode(node.id, node);
                this.updateStats();
            },
            onNodeDelete: (nodeId) => {
                this.physics.removeNode(nodeId);
                this.connections.deleteNodeConnections(nodeId);
                this.storage.deleteNode(nodeId);
                this.storage.deleteNodeConnections(nodeId);
                this.updateStats();
            }
        });

        // ربط مدير الروابط بمحرك الفيزياء
        this.connections.setCallbacks({
            onConnectionCreate: (connection) => {
                this.physics.addConnection(
                    connection.source,
                    connection.target,
                    connection.strength
                );
                this.storage.addConnection(connection);
                this.updateStats();
            },
            onConnectionDelete: (connection) => {
                this.physics.removeConnection(connection.source, connection.target);
                this.storage.deleteConnection(connection.id);
                this.updateStats();
            }
        });

        // ربط معالج التفاعلات
        this.interaction.setCallbacks({
            onNodeClick: (node) => this.showNodeInfo(node),
            onNodeDoubleClick: (node) => this.editNode(node),
            onNodeDrag: (nodeId, pos) => this.handleNodeDrag(nodeId, pos),
            onNodeDrop: (nodeId, pos) => this.handleNodeDrop(nodeId, pos),
            onNodeHover: (node) => this.handleNodeHover(node),
            onSelectionChange: (selectedIds) => this.handleSelectionChange(selectedIds),
            onConnectStart: (nodeId) => this.connections.startTempConnection(nodeId),
            onConnectMove: (pos) => this.updateTempConnection(pos),
            onConnectEnd: (sourceId, targetId) => this.handleConnectEnd(sourceId, targetId),
            onContextMenu: (node, pos) => this.showContextMenu(node, pos),
            onPan: (x, y) => this.storage.setView({ x, y }),
            onZoom: (zoom, x, y) => this.storage.setView({ zoom, x, y })
        });

        // تجاوز الدوال المفقودة
        this.interaction.getNodeAtPosition = (x, y) => this.nodes.getNodeAt(x, y);
        this.interaction.moveNode = (nodeId, dx, dy) => this.moveNode(nodeId, dx, dy);
        this.interaction.createNodeAtPosition = (pos) => this.createNodeAtPosition(pos);
        this.interaction.deleteNode = (nodeId) => this.nodes.deleteNode(nodeId);
        this.interaction.getAllNodes = () => this.nodes.getAllNodes();

        // ربط مدير التخزين
        this.storage.setCallbacks({
            onLoad: (data) => this.loadFromStorage(data)
        });

        this.storage.init();
    }

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // أحداث لوحة التحكم
        document.getElementById('zoom-in-btn').addEventListener('click', () => {
            this.interaction.zoomIn();
        });
        
        document.getElementById('zoom-out-btn').addEventListener('click', () => {
            this.interaction.zoomOut();
        });
        
        document.getElementById('reset-view-btn').addEventListener('click', () => {
            this.interaction.resetZoom();
        });
        
        document.getElementById('auto-organize-btn').addEventListener('click', () => {
            this.autoOrganize();
        });

        // أحداث لوحة الإدخال
        document.getElementById('create-node').addEventListener('click', () => {
            this.createNodeFromInput();
        });
        
        document.getElementById('cancel-node').addEventListener('click', () => {
            this.hideInputPanel();
        });
        
        document.getElementById('node-content').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.createNodeFromInput();
            }
            if (e.key === 'Escape') {
                this.hideInputPanel();
            }
        });

        // نوع الإدخال
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // لوحة المعلومات
        document.getElementById('close-info').addEventListener('click', () => {
            document.getElementById('info-panel').classList.remove('active');
        });
        
        document.getElementById('delete-node').addEventListener('click', () => {
            this.deleteSelectedNode();
        });
        
        document.getElementById('duplicate-node').addEventListener('click', () => {
            this.duplicateSelectedNode();
        });

        // رسالة الترحيب
        document.getElementById('close-welcome').addEventListener('click', () => {
            document.getElementById('welcome-toast').style.display = 'none';
        });

        // قائمة السياق
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                this.handleContextAction(item.dataset.action);
            });
        });

        // قائمة السياق العالمية
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                document.getElementById('context-menu').classList.remove('active');
            }
        });

        // اختصارات لوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.showInputPanel();
            }
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.storage.manualSave();
            }
            if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.storage.download();
            }
        });
    }

    /**
     * إعداد عناصر الواجهة
     */
    setupUI() {
        this.elements = {
            inputPanel: document.getElementById('input-panel'),
            infoPanel: document.getElementById('info-panel'),
            contextMenu: document.getElementById('context-menu'),
            nodeCount: document.getElementById('node-count'),
            connectionCount: document.getElementById('connection-count'),
            fpsCounter: document.getElementById('fps-counter'),
            blackHole: document.getElementById('black-hole')
        };
    }

    /**
     * تحميل البيانات
     */
    loadData() {
        const data = this.storage.load();
        if (data) {
            this.loadFromStorage(data);
        }
    }

    /**
     * تحميل من التخزين
     */
    loadFromStorage(data) {
        // تحميل العقد
        if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach(node => {
                this.nodes.createNode(node);
                this.physics.addNode(node);
            });
        }

        // تحميل الروابط
        if (data.connections && Array.isArray(data.connections)) {
            data.connections.forEach(conn => {
                this.connections.createConnection(conn.source, conn.target, conn);
                this.physics.addConnection(conn.source, conn.target, conn.strength);
            });
        }

        // تحميل العرض
        if (data.view) {
            this.interaction.view = { ...this.interaction.view, ...data.view };
        }

        this.updateStats();
    }

    /**
     * بدء التطبيق
     */
    start() {
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.render();
        this.updateFPS();
    }

    /**
     * إيقاف التطبيق
     */
    stop() {
        this.isRunning = false;
        this.physics.stop();
    }

    /**
     * دورة العرض
     */
    render(currentTime = 0) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        // تحديث الفيزياء
        const rect = this.canvas.getBoundingClientRect();
        const bounds = {
            left: -this.interaction.view.x / this.interaction.view.zoom,
            top: -this.interaction.view.y / this.interaction.view.zoom,
            right: rect.width / this.interaction.view.zoom - this.interaction.view.x / this.interaction.view.zoom,
            bottom: rect.height / this.interaction.view.zoom - this.interaction.view.y / this.interaction.view.zoom
        };
        
        const centerX = rect.width / 2 / this.interaction.view.zoom - this.interaction.view.x / this.interaction.view.zoom;
        const centerY = rect.height / 2 / this.interaction.view.zoom - this.interaction.view.y / this.interaction.view.zoom;

        this.physics.step(centerX, centerY, bounds, deltaTime);

        // الرسم
        this.draw();

        // تحديث الخريطة المصغرة
        this.drawMinimap();

        // طلب الإطار التالي
        requestAnimationFrame((t) => this.render(t));
    }

    /**
     * الرسم على Canvas الرئيسي
     */
    draw() {
        const ctx = this.ctx;
        const view = this.interaction.view;

        // مسح Canvas
        ctx.fillStyle = 'rgba(11, 14, 20, 0.1)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        
        // تطبيق التحول
        ctx.translate(view.x, view.y);
        ctx.scale(view.zoom, view.zoom);

        // رسم شبكة الخلفية
        this.drawGrid(ctx);

        // رسم الروابط
        this.drawConnections(ctx);

        // رسم الرابط المؤقت
        this.drawTempConnection(ctx);

        // رسم العقد
        this.drawNodes(ctx);

        ctx.restore();
    }

    /**
     * رسم شبكة الخلفية
     */
    drawGrid(ctx) {
        const gridSize = 100;
        const extent = 5000;
        
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
        ctx.lineWidth = 0.5;

        // خط المركز
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
        
        for (let x = -extent; x <= extent; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, -extent);
            ctx.lineTo(x, extent);
            ctx.stroke();
        }
        
        for (let y = -extent; y <= extent; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(-extent, y);
            ctx.lineTo(extent, y);
            ctx.stroke();
        }
    }

    /**
     * رسم الروابط
     */
    drawConnections(ctx) {
        const connections = this.connections.getAllConnections();
        const nodes = this.nodes.getAllNodes();
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        connections.forEach(conn => {
            const source = nodeMap.get(conn.source);
            const target = nodeMap.get(conn.target);

            if (!source || !target) return;

            const isSelected = 
                this.nodes.selectedNode === conn.source ||
                this.nodes.selectedNode === conn.target;

            // حساب المنحنى
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const curveOffset = Math.min(distance * 0.1, 50);

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            
            // إضافة انحناء طفيف
            const perpX = -dy / distance * curveOffset;
            const perpY = dx / distance * curveOffset;
            
            ctx.quadraticCurveTo(
                midX + perpX,
                midY + perpY,
                target.x,
                target.y
            );

            // نمط الخط حسب القوة
            const strengthClass = `connection-strength-${Math.round(conn.strength)}`;
            
            ctx.strokeStyle = isSelected ? 
                'rgba(34, 211, 238, 1)' : 
                this.getConnectionColor(conn.strength);
            ctx.lineWidth = conn.strength * 0.8;
            ctx.lineCap = 'round';

            if (conn.strength >= 4) {
                ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
                ctx.shadowBlur = 10;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.stroke();
            ctx.shadowBlur = 0;
        });
    }

    /**
     * الحصول على لون الرابط حسب القوة
     */
    getConnectionColor(strength) {
        if (strength >= 4) return 'rgba(34, 211, 238, 1)';
        if (strength >= 3) return 'rgba(99, 102, 241, 0.8)';
        if (strength >= 2) return 'rgba(99, 102, 241, 0.6)';
        return 'rgba(100, 116, 139, 0.5)';
    }

    /**
     * رسم الرابط المؤقت
     */
    drawTempConnection(ctx) {
        const tempConn = this.connections.getTempConnection();
        if (!tempConn) return;

        const sourceNode = this.nodes.getNode(tempConn.sourceId);
        if (!sourceNode) return;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(tempConn.currentX, tempConn.currentY);

        ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * رسم العقد
     */
    drawNodes(ctx) {
        const nodes = this.nodes.getAllNodes();

        nodes.forEach(node => {
            const isSelected = this.nodes.selectedNode === node.id;
            const isHovered = this.interaction.state.hoveredNode?.id === node.id;

            ctx.save();
            ctx.translate(node.x, node.y);

            // تأثير التوهج
            if (isSelected || isHovered) {
                const gradient = ctx.createRadialGradient(0, 0, node.size * 0.3, 0, 0, node.size);
                gradient.addColorStop(0, `${this.getColorHex(node.color)}40`);
                gradient.addColorStop(1, 'transparent');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, node.size * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // الجسم الرئيسي
            const gradient = ctx.createRadialGradient(
                -node.size * 0.2, -node.size * 0.2, 0,
                0, 0, node.size / 2
            );
            gradient.addColorStop(0, this.getColorLight(node.color));
            gradient.addColorStop(1, this.getColorDark(node.color));

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, node.size / 2, 0, Math.PI * 2);
            ctx.fill();

            // الحدود
            ctx.strokeStyle = isSelected ? 'rgba(34, 211, 238, 0.8)' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();

            // المحتوى
            this.drawNodeContent(ctx, node);

            ctx.restore();
        });
    }

    /**
     * رسم محتوى العقدة
     */
    drawNodeContent(ctx, node) {
        const icon = this.nodes.getIcon(node.type);
        
        if (node.type === 'text' && node.content) {
            // عرض النص
            const maxWidth = node.size * 0.7;
            const fontSize = Math.max(10, node.size * 0.15);
            
            ctx.font = `${fontSize}px Cairo, sans-serif`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // تقسيم النص إذا كان طويلاً
            const words = node.content.split(' ');
            let line = '';
            const lines = [];
            
            words.forEach(word => {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > maxWidth && line !== '') {
                    lines.push(line);
                    line = word + ' ';
                } else {
                    line = testLine;
                }
            });
            lines.push(line);

            // رسم الأسطر
            const lineHeight = fontSize * 1.3;
            const startY = -((lines.length - 1) * lineHeight) / 2;
            
            lines.forEach((line, i) => {
                ctx.fillText(line.trim(), 0, startY + i * lineHeight);
            });
        } else {
            // عرض الأيقونة
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(0, 0, node.size * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * رسم الخريطة المصغرة
     */
    drawMinimap() {
        const ctx = this.minimapCtx;
        const nodes = this.nodes.getAllNodes();
        const view = this.interaction.view;

        // مسح
        ctx.fillStyle = 'rgba(11, 14, 20, 0.9)';
        ctx.fillRect(0, 0, 150, 150);

        // حساب النطاق
        const minX = Math.min(...nodes.map(n => n.x), -2000);
        const maxX = Math.max(...nodes.map(n => n.x), 2000);
        const minY = Math.min(...nodes.map(n => n.y), -2000);
        const maxY = Math.max(...nodes.map(n => n.y), 2000);

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const scale = Math.min(140 / rangeX, 140 / rangeY);

        // تحويل الإحداثيات
        const toMinimap = (x, y) => ({
            x: 75 + (x - (minX + maxX) / 2) * scale,
            y: 75 + (y - (minY + maxY) / 2) * scale
        });

        // رسم العقد
        nodes.forEach(node => {
            const pos = toMinimap(node.x, node.y);
            ctx.fillStyle = this.getColorHex(node.color);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, Math.max(2, node.size * scale * 0.5), 0, Math.PI * 2);
            ctx.fill();
        });

        // رسم إطار العرض الحالي
        const viewWidth = 150 / view.zoom;
        const viewHeight = 150 / view.zoom;
        const viewX = 75 - (view.x / scale) * view.zoom;
        const viewY = 75 - (view.y / scale) * view.zoom;

        ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            viewX - viewWidth / 2,
            viewY - viewHeight / 2,
            viewWidth,
            viewHeight
        );
    }

    /**
     * الحصول على اللون الفاتح
     */
    getColorLight(colorName) {
        const colors = {
            'planet-blue': '#60A5FA',
            'planet-indigo': '#818CF8',
            'planet-purple': '#A78BFA',
            'planet-pink': '#F472B6',
            'planet-cyan': '#67E8F9',
            'planet-green': '#34D399',
            'planet-amber': '#FBBF24',
            'planet-red': '#F87171'
        };
        return colors[colorName] || '#818CF8';
    }

    /**
     * الحصول على اللون الداكن
     */
    getColorDark(colorName) {
        const colors = {
            'planet-blue': '#1D4ED8',
            'planet-indigo': '#4F46E5',
            'planet-purple': '#7C3AED',
            'planet-pink': '#DB2777',
            'planet-cyan': '#0891B2',
            'planet-green': '#059669',
            'planet-amber': '#D97706',
            'planet-red': '#DC2626'
        };
        return colors[colorName] || '#4F46E5';
    }

    /**
     * الحصول على HEX اللون
     */
    getColorHex(colorName) {
        const colors = {
            'planet-blue': '#3B82F6',
            'planet-indigo': '#6366F1',
            'planet-purple': '#8B5CF6',
            'planet-pink': '#EC4899',
            'planet-cyan': '#22D3EE',
            'planet-green': '#10B981',
            'planet-amber': '#F59E0B',
            'planet-red': '#EF4444'
        };
        return colors[colorName] || '#6366F1';
    }

    /**
     * تحديث الإحصائيات
     */
    updateStats() {
        this.elements.nodeCount.textContent = this.nodes.getAllNodes().length;
        this.elements.connectionCount.textContent = this.connections.getAllConnections().length;
    }

    /**
     * تحديث FPS
     */
    updateFPS() {
        this.frameCount++;
        
        setInterval(() => {
            this.fps = this.frameCount;
            this.elements.fpsCounter.textContent = this.fps;
            this.frameCount = 0;
        }, 1000);
    }

    // ===== دوال التفاعل =====

    /**
     * إنشاء عقدة في موقع محدد
     */
    createNodeAtPosition(pos) {
        this.nodes.createNode({
            x: pos.x,
            y: pos.y,
            content: 'فكرة جديدة',
            type: 'text'
        });
    }

    /**
     * إنشاء عقدة من لوحة الإدخال
     */
    createNodeFromInput() {
        const textarea = document.getElementById('node-content');
        const content = textarea.value.trim();
        
        if (!content) return;

        const activeType = document.querySelector('.type-btn.active').dataset.type;
        const rect = this.canvas.getBoundingClientRect();
        
        // إنشاء في مركز الشاشة
        const x = -this.interaction.view.x / this.interaction.view.zoom + 
                  this.canvas.width / 2 / this.interaction.view.zoom;
        const y = -this.interaction.view.y / this.interaction.view.zoom + 
                  this.canvas.height / 2 / this.interaction.view.zoom;

        this.nodes.createNode({
            content,
            type: activeType,
            x,
            y
        });

        textarea.value = '';
        this.hideInputPanel();
    }

    /**
     * نقل عقدة
     */
    moveNode(nodeId, dx, dy) {
        const node = this.nodes.getNode(nodeId);
        if (node) {
            node.x += dx;
            node.y += dy;
            this.nodes.updateNode(nodeId, { x: node.x, y: node.y });
        }
    }

    /**
     * معالجة سحب العقدة
     */
    handleNodeDrag(nodeId, pos) {
        // يمكن إضافة تأثيرات بصرية هنا
    }

    /**
     * معالجة إسقاط العقدة
     */
    handleNodeDrop(nodeId, pos) {
        // التحقق من وجود الثقب الأسود
        const blackHoleRect = this.elements.blackHole.getBoundingClientRect();
        const mouseX = this.interaction.mousePosition.x;
        const mouseY = this.interaction.mousePosition.y;

        if (mouseX > blackHoleRect.left && mouseX < blackHoleRect.right &&
            mouseY > blackHoleRect.top && mouseY < blackHoleRect.bottom) {
            this.nodes.deleteNode(nodeId);
        }
    }

    /**
     * معالجة التحويم
     */
    handleNodeHover(node) {
        this.canvas.style.cursor = node ? 'pointer' : 'grab';
    }

    /**
     * معالجة تغيير التحديد
     */
    handleSelectionChange(selectedIds) {
        // تحديث الحالة البصرية
    }

    /**
     * معالجة نهاية الربط
     */
    handleConnectEnd(sourceId, targetId) {
        this.connections.createConnection(sourceId, targetId);
        this.connections.recordInteraction(sourceId, targetId);
    }

    /**
     * تحديث الرابط المؤقت
     */
    updateTempConnection(pos) {
        // يتم تحديثه تلقائياً في drawTempConnection
    }

    /**
     * إظهار لوحة الإدخال
     */
    showInputPanel() {
        this.elements.inputPanel.classList.add('active');
        document.getElementById('node-content').focus();
    }

    /**
     * إخفاء لوحة الإدخال
     */
    hideInputPanel() {
        this.elements.inputPanel.classList.remove('active');
        document.getElementById('node-content').value = '';
    }

    /**
     * إظهار معلومات العقدة
     */
    showNodeInfo(node) {
        document.getElementById('info-text').textContent = node.content || '-';
        document.getElementById('info-type').textContent = this.getTypeName(node.type);
        document.getElementById('info-connections').textContent = 
            this.connections.getNodeStrength(node.id).toFixed(1);
        document.getElementById('info-date').textContent = 
            new Date(node.createdAt).toLocaleDateString('ar-SA');

        this.elements.infoPanel.classList.add('active');
    }

    /**
     * الحصول على اسم النوع
     */
    getTypeName(type) {
        const names = {
            'text': 'نص',
            'image': 'صورة',
            'link': 'رابط'
        };
        return names[type] || type;
    }

    /**
     * تعديل عقدة
     */
    editNode(node) {
        this.showInputPanel();
        document.getElementById('node-content').value = node.content;
        
        const typeBtn = document.querySelector(`.type-btn[data-type="${node.type}"]`);
        if (typeBtn) {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            typeBtn.classList.add('active');
        }

        // حذف العقدة القديمة وإنشاء جديدة
        this.nodes.deleteNode(node.id);
    }

    /**
     * حذف العقدة المحددة
     */
    deleteSelectedNode() {
        if (this.nodes.selectedNode) {
            this.nodes.deleteNode(this.nodes.selectedNode);
            this.elements.infoPanel.classList.remove('active');
        }
    }

    /**
     * تكرار العقدة المحددة
     */
    duplicateSelectedNode() {
        if (this.nodes.selectedNode) {
            this.nodes.duplicateNode(this.nodes.selectedNode);
            this.elements.infoPanel.classList.remove('active');
        }
    }

    /**
     * إظهار قائمة السياق
     */
    showContextMenu(node, pos) {
        if (node) {
            this.nodes.selectNode(node.id);
        }

        const menu = this.elements.contextMenu;
        menu.style.left = `${pos.x}px`;
        menu.style.top = `${pos.y}px`;
        menu.classList.add('active');
    }

    /**
     * معالجة إجراءات قائمة السياق
     */
    handleContextAction(action) {
        const nodeId = this.nodes.selectedNode;
        if (!nodeId) return;

        switch (action) {
            case 'edit':
                const node = this.nodes.getNode(nodeId);
                this.editNode(node);
                break;
            case 'connect':
                this.interaction.startConnecting(nodeId);
                break;
            case 'duplicate':
                this.nodes.duplicateNode(nodeId);
                break;
            case 'color':
                const colors = ['planet-blue', 'planet-indigo', 'planet-purple', 'planet-pink', 'planet-cyan', 'planet-green', 'planet-amber', 'planet-red'];
                const currentNode = this.nodes.getNode(nodeId);
                const currentIndex = colors.indexOf(currentNode.color);
                const nextColor = colors[(currentIndex + 1) % colors.length];
                this.nodes.changeColor(nodeId, nextColor);
                break;
            case 'delete':
                this.nodes.deleteNode(nodeId);
                break;
        }

        this.elements.contextMenu.classList.remove('active');
    }

    /**
     * التنظيم التلقائي
     */
    autoOrganize() {
        // إعادة توزيع العقد بشكل متوازن
        const nodes = this.nodes.getAllNodes();
        const centerX = 0;
        const centerY = 0;
        const angleStep = (Math.PI * 2) / nodes.length;
        const radius = Math.min(300, 50 + nodes.length * 30);

        nodes.forEach((node, i) => {
            const angle = i * angleStep;
            node.x = centerX + Math.cos(angle) * radius;
            node.y = centerY + Math.sin(angle) * radius;
        });

        // محاكاة فيزيا سريعة للتجميع
        const bounds = {
            left: -2000, top: -2000, right: 2000, bottom: 2000
        };
        this.physics.simulateSettling(centerX, centerY, bounds, 50);
    }

    /**
     * إظهار رسالة الترحيب
     */
    showWelcome() {
        const hasVisited = localStorage.getItem('orbital-mind-visited');
        if (!hasVisited) {
            setTimeout(() => {
                document.getElementById('welcome-toast').style.display = 'flex';
            }, 500);
            localStorage.setItem('orbital-mind-visited', 'true');
        }
    }
}

// بدء التطبيق
document.addEventListener('DOMContentLoaded', () => {
    window.app = new OrbitalMind();
});
