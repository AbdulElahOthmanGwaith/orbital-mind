/**
 * Orbital Mind - محرك الفيزياء للحوسبة المكانية
 * Physics Engine for Spatial Computing
 */

class PhysicsEngine {
    constructor(options = {}) {
        this.config = {
            repulsionStrength: options.repulsionStrength || 1000,
            attractionStrength: options.attractionStrength || 0.05,
            damping: options.damping || 0.85,
            maxVelocity: options.maxVelocity || 15,
            minDistance: options.minDistance || 100,
            centerGravity: options.centerGravity || 0.01,
            borderForce: options.borderForce || 0.5,
            timeStep: options.timeStep || 1 / 60
        };

        this.nodes = [];
        this.connections = [];
        this.velocity = new Map();
        this.forces = new Map();
        
        this.isRunning = false;
        this.animationFrame = null;
        
        this.callbacks = {
            onUpdate: null,
            onSettle: null
        };
    }

    /**
     * إضافة عقدة للنظام
     */
    addNode(node) {
        this.nodes.push(node);
        this.velocity.set(node.id, { x: 0, y: 0 });
        this.forces.set(node.id, { x: 0, y: 0 });
    }

    /**
     * إزالة عقدة من النظام
     */
    removeNode(nodeId) {
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        this.velocity.delete(nodeId);
        this.forces.delete(nodeId);
    }

    /**
     * إضافة رابط بين عقدتين
     */
    addConnection(nodeId1, nodeId2, strength = 1) {
        this.connections.push({
            source: nodeId1,
            target: nodeId2,
            strength: Math.max(0.1, Math.min(1, strength)),
            currentLength: this.calculateDistance(nodeId1, nodeId2)
        });
    }

    /**
     * إزالة رابط
     */
    removeConnection(nodeId1, nodeId2) {
        this.connections = this.connections.filter(
            c => !(c.source === nodeId1 && c.target === nodeId2) &&
                 !(c.source === nodeId2 && c.target === nodeId1)
        );
    }

    /**
     * حساب المسافة بين عقدتين
     */
    calculateDistance(nodeId1, nodeId2) {
        const node1 = this.nodes.find(n => n.id === nodeId1);
        const node2 = this.nodes.find(n => n.id === nodeId2);
        if (!node1 || !node2) return this.config.minDistance;
        
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * حساب قوة الطرد بين عقدتين
     */
    calculateRepulsion(node1, node2) {
        const dx = node1.x - node2.x;
        const dy = node1.y - node2.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 1) distance = 1;
        
        const force = this.config.repulsionStrength / (distance * distance);
        
        return {
            x: (dx / distance) * force,
            y: (dy / distance) * force
        };
    }

    /**
     * حساب قوة الجذب بين عقدتين مرتبطتين
     */
    calculateAttraction(node1, node2, connection) {
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const targetDistance = this.config.minDistance * (1 + (1 - connection.strength));
        const displacement = distance - targetDistance;
        
        const force = displacement * this.config.attractionStrength * connection.strength;
        
        return {
            x: (dx / distance) * force,
            y: (dy / distance) * force
        };
    }

    /**
     * حساب قوة الجاذبية نحو المركز
     */
    calculateCenterGravity(node, centerX, centerY) {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        return {
            x: (dx / distance) * this.config.centerGravity * distance * 0.01,
            y: (dy / distance) * this.config.centerGravity * distance * 0.01
        };
    }

    /**
     * حساب قوة الحدود
     */
    calculateBorderForce(node, bounds) {
        const force = { x: 0, y: 0 };
        const margin = 200;
        const strength = this.config.borderForce;
        
        if (node.x < bounds.left + margin) {
            force.x = (bounds.left + margin - node.x) * strength * 0.01;
        }
        if (node.x > bounds.right - margin) {
            force.x = (bounds.right - margin - node.x) * strength * 0.01;
        }
        if (node.y < bounds.top + margin) {
            force.y = (bounds.top + margin - node.y) * strength * 0.01;
        }
        if (node.y > bounds.bottom - margin) {
            force.y = (bounds.bottom - margin - node.y) * strength * 0.01;
        }
        
        return force;
    }

    /**
     * تهيئة القوى
     */
    initializeForces() {
        for (const node of this.nodes) {
            this.forces.set(node.id, { x: 0, y: 0 });
        }
    }

    /**
     * حساب جميع القوى
     */
    calculateForces(centerX, centerY, bounds) {
        this.initializeForces();
        
        // قوة الطرد بين جميع العقد
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const node1 = this.nodes[i];
                const node2 = this.nodes[j];
                
                const repulsion = this.calculateRepulsion(node1, node2);
                
                const force1 = this.forces.get(node1.id);
                const force2 = this.forces.get(node2.id);
                
                force1.x += repulsion.x;
                force1.y += repulsion.y;
                force2.x -= repulsion.x;
                force2.y -= repulsion.y;
            }
        }
        
        // قوة الجذب للروابط
        for (const connection of this.connections) {
            const node1 = this.nodes.find(n => n.id === connection.source);
            const node2 = this.nodes.find(n => n.id === connection.target);
            
            if (node1 && node2) {
                const attraction = this.calculateAttraction(node1, node2, connection);
                
                const force1 = this.forces.get(node1.id);
                const force2 = this.forces.get(node2.id);
                
                force1.x += attraction.x;
                force1.y += attraction.y;
                force2.x -= attraction.x;
                force2.y -= attraction.y;
            }
        }
        
        // قوة الجاذبية نحو المركز
        for (const node of this.nodes) {
            const centerForce = this.calculateCenterGravity(node, centerX, centerY);
            const force = this.forces.get(node.id);
            force.x += centerForce.x;
            force.y += centerForce.y;
        }
        
        // قوة الحدود
        for (const node of this.nodes) {
            const borderForce = this.calculateBorderForce(node, bounds);
            const force = this.forces.get(node.id);
            force.x += borderForce.x;
            force.y += borderForce.y;
        }
    }

    /**
     * تحديث السرعات والمواقع
     */
    updatePositions(deltaTime = 1) {
        let totalMovement = 0;
        const dt = deltaTime * this.config.timeStep * 60;
        
        for (const node of this.nodes) {
            const force = this.forces.get(node.id);
            const velocity = this.velocity.get(node.id);
            
            // تحديث السرعة
            velocity.x += force.x * dt;
            velocity.y += force.y * dt;
            
            // تطبيق التخميد
            velocity.x *= this.config.damping;
            velocity.y *= this.config.damping;
            
            // تحديد السرعة القصوى
            const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
            if (speed > this.config.maxVelocity) {
                velocity.x = (velocity.x / speed) * this.config.maxVelocity;
                velocity.y = (velocity.y / speed) * this.config.maxVelocity;
            }
            
            // تحديث الموقع
            const oldX = node.x;
            const oldY = node.y;
            node.x += velocity.x * dt;
            node.y += velocity.y * dt;
            
            totalMovement += Math.abs(node.x - oldX) + Math.abs(node.y - oldY);
        }
        
        return totalMovement;
    }

    /**
     * خطوة واحدة من المحاكاة
     */
    step(centerX, centerY, bounds, deltaTime = 1) {
        this.calculateForces(centerX, centerY, bounds);
        const movement = this.updatePositions(deltaTime);
        
        if (this.callbacks.onUpdate) {
            this.callbacks.onUpdate(this.nodes, this.connections);
        }
        
        return movement;
    }

    /**
     * بدء المحاكاة المستمرة
     */
    start(centerX, centerY, bounds) {
        if (this.isRunning) return;
        
        this.isRunning = true;
        let lastTime = performance.now();
        
        const animate = (currentTime) => {
            if (!this.isRunning) return;
            
            const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
            lastTime = currentTime;
            
            const movement = this.step(centerX, centerY, bounds, deltaTime);
            
            // إيقاف عندما يستقر النظام
            if (movement < 0.5 && this.callbacks.onSettle) {
                this.callbacks.onSettle();
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * إيقاف المحاكاة
     */
    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * محاكاة سريعة للتجميع
     */
    simulateSettling(centerX, centerY, bounds, iterations = 100) {
        for (let i = 0; i < iterations; i++) {
            this.calculateForces(centerX, centerY, bounds);
            this.updatePositions(1);
        }
    }

    /**
     * الحصول على حالة النظام
     */
    getState() {
        return {
            nodes: this.nodes.map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                velocity: this.velocity.get(n.id)
            })),
            connections: this.connections.map(c => ({
                source: c.source,
                target: c.target,
                strength: c.strength
            })),
            totalEnergy: this.calculateTotalEnergy()
        };
    }

    /**
     * حساب الطاقة الكلية للنظام
     */
    calculateTotalEnergy() {
        let kinetic = 0;
        let potential = 0;
        
        // الطاقة الحركية
        for (const [id, velocity] of this.velocity) {
            kinetic += velocity.x * velocity.x + velocity.y * velocity.y;
        }
        
        // الطاقة الكامنة
        for (const connection of this.connections) {
            const distance = this.calculateDistance(connection.source, connection.target);
            potential += connection.strength * distance;
        }
        
        return {
            kinetic: Math.sqrt(kinetic),
            potential: Math.sqrt(potential),
            total: Math.sqrt(kinetic) + Math.sqrt(potential)
        };
    }

    /**
     * تعيين ردود النداء
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * مسح النظام
     */
    clear() {
        this.nodes = [];
        this.connections = [];
        this.velocity.clear();
        this.forces.clear();
        this.stop();
    }
}

// تصدير للاستخدام العام
window.PhysicsEngine = PhysicsEngine;
