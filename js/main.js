/**
 * Orbital Mind - الملف الرئيسي للتطبيق
 * Main Application File
 */

class OrbitalMind {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        
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
        
        this.init();
    }

    /**
     * تهيئة التطبيق
     */
    init() {
        this.setupCanvas();
        this.setupSystems();
        this.setupEventListeners();
        this.loadData();
        this.start();
    }

    /**
     * إعداد Canvas
     */
    setupCanvas() {
        this.canvas = document.getElementById('orbital-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * تغيير حجم Canvas
     */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * إعداد الأنظمة
     */
    setupSystems() {
        this.physics = new PhysicsEngine({
            repulsionStrength: 1500,
            attractionStrength: 0.03,
            damping: 0.9,
            maxVelocity: 10,
            minDistance: 120,
            centerGravity: 0.005,
            borderForce: 0.3
        });

        this.nodes = new NodeSystem({
            minSize: 60,
            maxSize: 200,
            defaultSize: 90,
            sizeByContent: true
        });

        this.connections = new ConnectionManager({
            defaultStrength: 2,
            interactionIncrement: 0.1
        });

        this.interaction = new InteractionHandler(this.canvas);
        
        this.storage = new StorageManager({
            storageKey: 'orbital-mind-data',
            autoSave: true,
            autoSaveInterval: 60000
        });

        this.setupSystemIntegration();
    }

    /**
     * ربط الأنظمة
     */
    setupSystemIntegration() {
        this.nodes.setCallbacks({
            onNodeCreate: (node) => {
                this.physics.addNode(node);
                this.storage.addNode(node);
            },
            onNodeUpdate: (node) => {
                this.storage.updateNode(node.id, node);
            },
            onNodeDelete: (nodeId) => {
                this.physics.removeNode(nodeId);
                this.connections.deleteNodeConnections(nodeId);
                this.storage.deleteNode(nodeId);
            }
        });

        this.connections.setCallbacks({
            onConnectionCreate: (connection) => {
                this.physics.addConnection(connection.source, connection.target, connection.strength);
                this.storage.addConnection(connection);
            },
            onConnectionDelete: (connection) => {
                this.physics.removeConnection(connection.source, connection.target);
                this.storage.deleteConnection(connection.id);
            }
        });

        this.interaction.setCallbacks({
            onNodeClick: (node) => console.log('Node clicked:', node),
            onNodeDrag: (nodeId, pos) => {
                const node = this.nodes.getNode(nodeId);
                if (node) {
                    node.x = pos.x;
                    node.y = pos.y;
                }
            },
            onPan: (x, y) => this.storage.setView({ x, y }),
            onZoom: (zoom) => this.storage.setView({ zoom })
        });
    }

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        document.getElementById('add-node').addEventListener('click', () => {
            const text = prompt('أدخل فكرتك الجديدة:');
            if (text) {
                const x = (Math.random() - 0.5) * 400;
                const y = (Math.random() - 0.5) * 400;
                this.nodes.createNode({ content: text, x, y });
            }
        });

        document.getElementById('zoom-in').addEventListener('click', () => {
            this.interaction.view.zoom *= 1.2;
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.interaction.view.zoom /= 1.2;
        });

        document.getElementById('reset-view').addEventListener('click', () => {
            this.interaction.view.zoom = 1;
            this.interaction.view.x = 0;
            this.interaction.view.y = 0;
        });
    }

    /**
     * تحميل البيانات
     */
    loadData() {
        const data = this.storage.load();
        if (data) {
            if (data.nodes) data.nodes.forEach(n => this.nodes.createNode(n));
            if (data.connections) data.connections.forEach(c => this.connections.createConnection(c.source, c.target, c));
            if (data.view) this.interaction.view = { ...this.interaction.view, ...data.view };
        }
    }

    /**
     * بدء التطبيق
     */
    start() {
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.render();
    }

    /**
     * دورة العرض
     */
    render(currentTime = 0) {
        if (!this.isRunning) return;
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        this.physics.step(0, 0, null, deltaTime);
        this.draw();
        requestAnimationFrame((t) => this.render(t));
    }

    /**
     * الرسم
     */
    draw() {
        const ctx = this.ctx;
        const view = this.interaction.view;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.canvas.width/2 + view.x, this.canvas.height/2 + view.y);
        ctx.scale(view.zoom, view.zoom);

        // رسم الروابط
        this.connections.getAllConnections().forEach(conn => {
            const s = this.nodes.getNode(conn.source);
            const t = this.nodes.getNode(conn.target);
            if (s && t) {
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(t.x, t.y);
                ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // رسم العقد
        this.nodes.getAllNodes().forEach(node => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 40, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '14px Cairo';
            ctx.fillText(node.text, node.x, node.y + 5);
        });

        ctx.restore();
    }
}

// تهيئة النظام عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    window.orbitalApp = new OrbitalMind();
});
