// ==================== MOTOR INDEXEDDB OFFLINE-FIRST ====================
const DB_NAME = 'PisosBrillantesDB';
const DB_VERSION = 1;
const STORE_CACHE = 'datos_cache';
const STORE_PENDIENTES = 'cola_pendientes';

const syncChannel = (typeof BroadcastChannel !== 'undefined')
    ? new BroadcastChannel('pb_sync_channel')
    : null;

const PB_DB = {
    _dbPromise: null,

    abrirDB() {
        if (this._dbPromise) return this._dbPromise;
        this._dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_CACHE)) {
                    db.createObjectStore(STORE_CACHE, { keyPath: 'clave' });
                }
                if (!db.objectStoreNames.contains(STORE_PENDIENTES)) {
                    const store = db.createObjectStore(STORE_PENDIENTES, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = function(event) {
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                console.error('Error abriendo IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
        return this._dbPromise;
    },

    async guardarCache(clave, datos) {
        const db = await this.abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_CACHE], 'readwrite');
            const store = tx.objectStore(STORE_CACHE);
            const registro = {
                clave: clave,
                datos: datos,
                updatedAt: new Date().toISOString()
            };
            const req = store.put(registro);
            req.onsuccess = () => resolve(registro);
            req.onerror = () => reject(req.error);
        });
    },

    async obtenerCache(clave) {
        const db = await this.abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_CACHE], 'readonly');
            const store = tx.objectStore(STORE_CACHE);
            const req = store.get(clave);
            req.onsuccess = () => resolve(req.result ? req.result : null);
            req.onerror = () => reject(req.error);
        });
    },

    async obtenerDatosPrincipales() {
        const reg = await this.obtenerCache('principal');
        if (!reg || !reg.datos) {
            return {
                activos: [],
                ingresos: [],
                egresos: [],
                ausencias: [],
                disciplina: [],
                evaluaciones: [],
                incidentes: [],
                horasExtras: [],
                asistencia: [],
                updatedAt: null
            };
        }
        return { ...reg.datos, updatedAt: reg.updatedAt };
    },

    async actualizarDatosPrincipales(mutatorFn) {
        const actual = await this.obtenerDatosPrincipales();
        const { updatedAt, ...datosLimpios } = actual;
        const nuevo = mutatorFn(datosLimpios) || datosLimpios;
        await this.guardarCache('principal', nuevo);
        this.notificarCambio('cache_actualizado');
        return nuevo;
    },

    async agregarPendiente(operacion) {
        const db = await this.abrirDB();
        const item = {
            timestamp: new Date().toISOString(),
            titulo: operacion.titulo || operacion.accion,
            detalle: operacion.detalle || '',
            destino: operacion.destino || 'principal', // 'principal' | 'permisos'
            accion: operacion.accion,
            payload: operacion.payload || {},
            fotos: operacion.fotos || [], // [{ colaborador, archivoBase64, esEdicion }]
            estado: 'pendiente',
            errorMsg: ''
        };

        const id = await new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_PENDIENTES], 'readwrite');
            const store = tx.objectStore(STORE_PENDIENTES);
            const req = store.add(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        this.notificarCambio('pendiente_agregado', { id, item });
        return id;
    },

    async obtenerPendientes() {
        const db = await this.abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_PENDIENTES], 'readonly');
            const store = tx.objectStore(STORE_PENDIENTES);
            const req = store.getAll();
            req.onsuccess = () => {
                const lista = (req.result || []).sort((a, b) => a.id - b.id);
                resolve(lista);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async actualizarEstadoPendiente(id, estado, errorMsg = '') {
        const db = await this.abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_PENDIENTES], 'readwrite');
            const store = tx.objectStore(STORE_PENDIENTES);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const item = getReq.result;
                if (!item) return resolve();
                item.estado = estado;
                item.errorMsg = errorMsg;
                const putReq = store.put(item);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    },

    async eliminarPendiente(id) {
        const db = await this.abrirDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_PENDIENTES], 'readwrite');
            const store = tx.objectStore(STORE_PENDIENTES);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
        this.notificarCambio('pendiente_eliminado', { id });
    },

    async contarPendientes() {
        const db = await this.abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_PENDIENTES], 'readonly');
            const store = tx.objectStore(STORE_PENDIENTES);
            const req = store.count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => reject(req.error);
        });
    },

    notificarCambio(evento, detalle = {}) {
        const mensaje = { tipo: 'PB_DB_EVENT', evento, detalle, origen: window.location.pathname };
        if (syncChannel) {
            syncChannel.postMessage(mensaje);
        }
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(mensaje, '*');
            }
        } catch (e) {}
    }
};