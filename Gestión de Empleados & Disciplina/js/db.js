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
            destino: operacion.destino || 'principal', // 'principal' | 'permisos' | 'buzon' | 'carnets'
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

// ==================== INTEGRACIÓN DE SUBPÁGINAS EN IFRAME ====================
(function inicializarIntegracionSubpagina() {
    if (typeof window === 'undefined' || !window.parent || window.parent === window) return;

    function inyectarEstilosSubpagina() {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head || document.getElementById('pb-inline-iframe-style')) return;
        const st = document.createElement('style');
        st.id = 'pb-inline-iframe-style';
        st.textContent = `
            html, body {
                height: auto !important;
                min-height: 0 !important;
                overflow-x: hidden !important;
                overflow-y: hidden !important;
            }
            body.subpage-body {
                display: flow-root !important;
                padding: 4px !important;
            }
            #contenedor-sugerencias > div,
            #contenedor-carnets > div,
            #contenedor-permisos > div {
                max-height: none !important;
                overflow-y: visible !important;
            }
        `;
        head.appendChild(st);
    }

    function calcularAlturaContenido() {
        const body = document.body;
        if (!body) return 450;
        let maxBottom = 0;
        const children = body.children;
        for (let i = 0; i < children.length; i++) {
            const el = children[i];
            const tag = el.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') continue;
            if (el.id === 'overlay' || el.id === '__pb_swal_shadow' || el.classList.contains('modal') || el.classList.contains('swal2-container')) continue;
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.position === 'fixed') continue;
            const rect = el.getBoundingClientRect();
            const mb = parseFloat(cs.marginBottom) || 0;
            const bottom = rect.bottom + window.scrollY + mb;
            if (bottom > maxBottom) maxBottom = bottom;
        }
        const bodyPb = parseFloat(window.getComputedStyle(body).paddingBottom) || 0;
        return Math.max(450, Math.ceil(maxBottom + bodyPb + 16));
    }

    let ultimaAlturaEnviada = 0;
    function reportarAltura(forzar = false) {
        if (!document.body) return;
        const altura = calcularAlturaContenido();
        if (forzar || Math.abs(altura - ultimaAlturaEnviada) > 2) {
            ultimaAlturaEnviada = altura;
            try {
                window.parent.postMessage({ tipo: 'PB_IFRAME_ALTURA', altura }, '*');
            } catch (e) {}
        }
    }

    function intentarRegistrarPuenteDirecto() {
        try {
            if (typeof window.parent.__pbRegistrarSubpagina === 'function') {
                window.parent.__pbRegistrarSubpagina(window);
                return true;
            }
        } catch (e) {}
        return false;
    }

    // Puente completo por postMessage (compatible con file://, didOpen, preConfirm, willClose, DOM dinámico, Chart.js y archivos)
    function instalarPuentePostMessageFallback() {
        if (!window.Swal || window.Swal.__pbBridged) return;

        const sesionesSwal = new Map();
        let reqCounter = 0;
        let reqActivoId = null;
        let shadowEl = null;
        let shadowObserver = null;
        let validationMsgCapturado = '';

        function obtenerRutaIndice(el) {
            const path = [];
            let curr = el;
            while (curr && curr !== shadowEl) {
                const parent = curr.parentNode;
                if (!parent) return null;
                path.unshift(Array.prototype.indexOf.call(parent.children, curr));
                curr = parent;
            }
            return curr === shadowEl ? path : null;
        }

        function resolverRutaIndice(path) {
            if (!shadowEl || !Array.isArray(path)) return null;
            let curr = shadowEl;
            for (const idx of path) {
                if (!curr || !curr.children || !curr.children[idx]) return null;
                curr = curr.children[idx];
            }
            return curr;
        }

        function enviarParcheContenedor(targetEl) {
            if (!reqActivoId || !shadowEl || !targetEl) return;
            if (targetEl.querySelector && targetEl.querySelector('canvas')) return;
            const path = targetEl === shadowEl ? [] : obtenerRutaIndice(targetEl);
            if (!path) return;
            try {
                window.parent.postMessage({
                    tipo: 'PB_SWAL_PATCH_HTML',
                    reqId: reqActivoId,
                    targetId: targetEl.id || '',
                    path,
                    html: targetEl.innerHTML
                }, '*');
            } catch (e) {}
        }

        function obtenerOCrearShadow(htmlStr) {
            limpiarShadow();
            shadowEl = document.createElement('div');
            shadowEl.id = '__pb_swal_shadow';
            shadowEl.style.cssText = 'position:absolute;left:-99999px;top:0;width:600px;visibility:hidden;pointer-events:none;';
            shadowEl.innerHTML = htmlStr || '';
            (document.body || document.documentElement).appendChild(shadowEl);

            if (typeof MutationObserver !== 'undefined') {
                const pendientesMut = new Set();
                let programado = false;
                shadowObserver = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        if (m.type !== 'childList') continue;
                        let node = m.target;
                        while (node && node !== shadowEl && !node.id) {
                            node = node.parentNode;
                        }
                        if (node) pendientesMut.add(node);
                    }
                    if (!programado && pendientesMut.size > 0) {
                        programado = true;
                        setTimeout(() => {
                            programado = false;
                            const lista = Array.from(pendientesMut);
                            pendientesMut.clear();
                            lista.forEach(el => enviarParcheContenedor(el));
                        }, 16);
                    }
                });
                shadowObserver.observe(shadowEl, { childList: true, subtree: true });
            }

            return shadowEl;
        }

        function limpiarShadow() {
            if (shadowObserver) {
                try { shadowObserver.disconnect(); } catch (e) {}
                shadowObserver = null;
            }
            if (shadowEl && shadowEl.parentNode) {
                shadowEl.remove();
            }
            shadowEl = null;
        }

        function base64AFile(fileObj) {
            const bin = atob(fileObj.base64);
            const len = bin.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
            return new File([bytes], fileObj.name || 'archivo.jpg', {
                type: fileObj.type || 'image/jpeg',
                lastModified: fileObj.lastModified || Date.now()
            });
        }

        function aplicarCamposAlShadow(fields) {
            if (!shadowEl || !fields) return;
            Object.entries(fields).forEach(([id, val]) => {
                const el = shadowEl.querySelector('#' + CSS.escape(id));
                if (!el) return;
                if (el.type === 'file') {
                    try {
                        const dt = new DataTransfer();
                        if (val && val.__pbFile && val.base64) {
                            dt.items.add(base64AFile(val));
                        }
                        el.files = dt.files;
                    } catch (e) {}
                } else if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = Boolean(val);
                } else {
                    el.value = val !== null && val !== undefined ? val : '';
                }
            });
        }

        // Interceptar <style> agregados durante didOpen para retransmitirlos a Gestión de Empleados
        if (document.head && !document.head.__pbPostMsgStyleHooked) {
            const origAppend = document.head.appendChild.bind(document.head);
            document.head.appendChild = function(node) {
                const res = origAppend(node);
                if (reqActivoId && node && node.tagName === 'STYLE') {
                    try {
                        window.parent.postMessage({
                            tipo: 'PB_SWAL_STYLE',
                            reqId: reqActivoId,
                            css: node.textContent
                        }, '*');
                    } catch (e) {}
                }
                return res;
            };
            document.head.__pbPostMsgStyleHooked = true;
        }

        // Interceptar Chart.js si se crea sobre un canvas del shadow durante didOpen
        if (typeof window.Chart === 'function' && !window.Chart.__pbPostMsgHooked) {
            const OrigChart = window.Chart;
            const BridgedChart = function(ctxOrEl, config) {
                const canvas = ctxOrEl && ctxOrEl.canvas ? ctxOrEl.canvas : ctxOrEl;
                if (reqActivoId && shadowEl && canvas && shadowEl.contains(canvas)) {
                    try {
                        const configLimpia = JSON.parse(JSON.stringify(config));
                        window.parent.postMessage({
                            tipo: 'PB_SWAL_CHART',
                            reqId: reqActivoId,
                            canvasId: canvas.id,
                            config: configLimpia
                        }, '*');
                    } catch (e) {}
                    return { destroy: () => {}, update: () => {} };
                }
                return new OrigChart(ctxOrEl, config);
            };
            Object.assign(BridgedChart, OrigChart);
            BridgedChart.prototype = OrigChart.prototype;
            BridgedChart.__pbPostMsgHooked = true;
            window.Chart = BridgedChart;
        }

        // Escuchar eventos que envía Gestión de Empleados hacia este iframe
        window.addEventListener('message', async (event) => {
            if (!event.data || !event.data.tipo) return;
            const { tipo, reqId } = event.data;
            const sesion = sesionesSwal.get(reqId);

            if (tipo === 'PB_SWAL_DID_OPEN' && sesion) {
                reqActivoId = reqId;
                const sEl = obtenerOCrearShadow(sesion.html || '');
                if (typeof sesion.didOpen === 'function') {
                    try {
                        sesion.didOpen(sEl);
                    } catch (err) {
                        console.error('Error en didOpen remoto:', err);
                    }
                }
                return;
            }

            if (tipo === 'PB_SWAL_EVENT' && shadowEl && reqId === reqActivoId) {
                const target = event.data.targetId
                    ? shadowEl.querySelector('#' + CSS.escape(event.data.targetId))
                    : resolverRutaIndice(event.data.path);
                if (target) {
                    if (target.type === 'checkbox' || target.type === 'radio') {
                        target.checked = Boolean(event.data.checked);
                    } else if (event.data.value !== undefined) {
                        target.value = event.data.value;
                    }
                    target.dispatchEvent(new Event(event.data.eventType || 'input', { bubbles: true }));
                    if (window.jQuery) {
                        try { window.jQuery(target).trigger(event.data.eventType || 'input'); } catch (e) {}
                    }
                }
                return;
            }

            if (tipo === 'PB_SWAL_CLICK' && shadowEl && reqId === reqActivoId) {
                const target = event.data.targetId
                    ? shadowEl.querySelector('#' + CSS.escape(event.data.targetId))
                    : resolverRutaIndice(event.data.path);
                if (target) {
                    try { target.click(); } catch (e) {
                        if (window.jQuery) window.jQuery(target).trigger('click');
                    }
                }
                return;
            }

            if (tipo === 'PB_SWAL_INVOKE') {
                try {
                    const fn = new Function('event', event.data.code || '');
                    fn.call(window, { type: event.data.eventType || 'click' });
                } catch (err) {
                    console.error('Error ejecutando acción remota desde Swal:', err);
                }
                return;
            }

            if (tipo === 'PB_SWAL_PRECONFIRM' && sesion) {
                aplicarCamposAlShadow(event.data.fields);
                validationMsgCapturado = '';
                try {
                    const val = typeof sesion.preConfirm === 'function' ? await sesion.preConfirm() : true;
                    if (val === false || validationMsgCapturado) {
                        window.parent.postMessage({
                            tipo: 'PB_SWAL_PRECONFIRM_RES',
                            reqId,
                            valid: false,
                            validationMessage: validationMsgCapturado || ''
                        }, '*');
                    } else {
                        sesion.ultimoValor = val;
                        window.parent.postMessage({
                            tipo: 'PB_SWAL_PRECONFIRM_RES',
                            reqId,
                            valid: true
                        }, '*');
                    }
                } catch (err) {
                    window.parent.postMessage({
                        tipo: 'PB_SWAL_PRECONFIRM_RES',
                        reqId,
                        valid: false,
                        validationMessage: err.message || 'Error de validación'
                    }, '*');
                }
                return;
            }

            if (tipo === 'PB_SWAL_WILL_CLOSE' && sesion) {
                if (typeof sesion.willClose === 'function') {
                    try { sesion.willClose(shadowEl); } catch (e) {}
                }
                if (reqActivoId === reqId) {
                    reqActivoId = null;
                    limpiarShadow();
                }
                return;
            }

            if (tipo === 'PB_SWAL_RESULT' && sesion) {
                sesionesSwal.delete(reqId);
                const result = event.data.result || { isDismissed: true };
                if (result.isConfirmed && sesion.ultimoValor !== undefined) {
                    result.value = sesion.ultimoValor;
                }
                sesion.resolve(result);
            }
        });

        const origSwal = window.Swal;
        origSwal.getPopup = function() {
            return shadowEl || document.querySelector('.swal2-popup');
        };
        origSwal.getHtmlContainer = function() {
            return shadowEl || document.querySelector('.swal2-html-container');
        };
        origSwal.showValidationMessage = function(msg) {
            validationMsgCapturado = msg || '';
            try {
                window.parent.postMessage({ tipo: 'PB_SWAL_VALIDATION', msg: validationMsgCapturado }, '*');
            } catch (e) {}
        };
        origSwal.close = function() {
            try {
                window.parent.postMessage({ tipo: 'PB_SWAL_CLOSE' }, '*');
            } catch (e) {}
        };

        origSwal.fire = function(...args) {
            let opts = {};
            if (args.length === 1 && args[0] && typeof args[0] === 'object') {
                opts = Object.assign({}, args[0]);
            } else {
                opts = { title: args[0], html: args[1], icon: args[2] };
            }

            const reqId = 'pb_swal_' + (++reqCounter) + '_' + Date.now();
            const safeOpts = {};
            const camposSerializables = [
                'title', 'titleText', 'html', 'text', 'icon', 'footer',
                'showConfirmButton', 'showCancelButton', 'showDenyButton', 'showCloseButton',
                'confirmButtonText', 'cancelButtonText', 'denyButtonText',
                'confirmButtonColor', 'cancelButtonColor', 'denyButtonColor',
                'timer', 'timerProgressBar', 'toast', 'position', 'width', 'maxWidth',
                'background', 'backdrop', 'input', 'inputLabel', 'inputPlaceholder',
                'inputValue', 'inputOptions', 'inputAttributes', 'allowOutsideClick',
                'allowEscapeKey', 'customClass'
            ];
            camposSerializables.forEach(k => {
                if (opts[k] !== undefined) safeOpts[k] = opts[k];
            });

            return new Promise((resolve) => {
                sesionesSwal.set(reqId, {
                    html: opts.html || '',
                    didOpen: opts.didOpen,
                    preConfirm: opts.preConfirm,
                    willClose: opts.willClose,
                    ultimoValor: undefined,
                    resolve
                });
                window.parent.postMessage({
                    tipo: 'PB_SWAL_FIRE',
                    reqId,
                    opts: safeOpts,
                    hasDidOpen: typeof opts.didOpen === 'function',
                    hasPreConfirm: typeof opts.preConfirm === 'function',
                    hasWillClose: typeof opts.willClose === 'function'
                }, '*');
            });
        };
        origSwal.__pbBridged = true;
    }

    function iniciarObservadores() {
        inyectarEstilosSubpagina();
        if (!intentarRegistrarPuenteDirecto()) {
            instalarPuentePostMessageFallback();
        }
        reportarAltura(true);

        if (typeof ResizeObserver !== 'undefined' && document.body) {
            const ro = new ResizeObserver(() => reportarAltura(false));
            ro.observe(document.body);
        }
        if (typeof MutationObserver !== 'undefined' && document.body) {
            const mo = new MutationObserver(() => reportarAltura(false));
            mo.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
        window.addEventListener('resize', () => reportarAltura(true));
        setInterval(() => reportarAltura(false), 300);
    }

    inyectarEstilosSubpagina();
    intentarRegistrarPuenteDirecto();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarObservadores);
    } else {
        iniciarObservadores();
    }
    window.addEventListener('load', () => {
        inyectarEstilosSubpagina();
        intentarRegistrarPuenteDirecto();
        reportarAltura(true);
    });
})();
