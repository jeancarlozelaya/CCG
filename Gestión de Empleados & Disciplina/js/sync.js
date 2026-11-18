// ==================== MOTOR DE SINCRONIZACIÓN ====================
const PB_SYNC = {
    enProgreso: false,

    async descargarDesdeServidor(mostrarOverlay = true) {
        if (!navigator.onLine) {
            Swal.fire('Sin conexión', 'No hay internet para descargar datos del servidor. Seguirá trabajando con la copia local.', 'warning');
            return false;
        }

        const pendientesCount = await PB_DB.contarPendientes();
        if (pendientesCount > 0 && mostrarOverlay) {
            const confirmacion = await Swal.fire({
                title: 'Tienes cambios sin sincronizar',
                html: `Hay <strong>${pendientesCount} cambio(s)</strong> en la cola pendientes de subir.<br><br>
                       Si descargas ahora sin sincronizar primero, la vista local volverá al estado del servidor (aunque tus cambios seguirán en la cola hasta que sincronices).<br><br>
                       ¿Qué deseas hacer?`,
                icon: 'warning',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Sincronizar primero',
                denyButtonText: 'Descargar de todas formas',
                cancelButtonText: 'Cancelar'
            });

            if (confirmacion.isConfirmed) {
                return await this.sincronizarTodo();
            } else if (!confirmacion.isDenied) {
                return false;
            }
        }

        if (mostrarOverlay) {
            $('#overlay').css('display', 'flex');
            $('#loadingMessage p').text('Descargando datos desde el servidor...');
        }

        try {
            const respuesta = await fetch(SCRIPT_URL_OBTENER + '?t=' + Date.now());
            const data = await respuesta.json();

            if (data.error) {
                throw new Error(data.mensaje || data.error);
            }

            const datosNormalizados = {
                activos: (data.activos || []).map(corregirFecha),
                ingresos: (data.ingresos || []).map(corregirFecha),
                egresos: (data.egresos || []).map(corregirFecha),
                ausencias: (data.ausencias || []).map(corregirFecha),
                disciplina: (data.disciplina || []).map(corregirFecha),
                evaluaciones: (data.evaluaciones || []).map(corregirFecha),
                incidentes: (data.incidentes || []).map(corregirFecha),
                horasExtras: (data.horasExtras || []).map(corregirFecha),
                asistencia: (data.asistencia || []).map(corregirFecha)
            };

            await PB_DB.guardarCache('principal', datosNormalizados);

            // También intentar refrescar permisos silenciosamente
            try {
                const respPerm = await fetch(PERMISOS_GESTION_URL + '?accion=listar&t=' + Date.now());
                const dataPerm = await respPerm.json();
                if (dataPerm && dataPerm.success) {
                    await PB_DB.guardarCache('permisos', dataPerm.solicitudes || []);
                }
            } catch (ePerm) {
                console.warn('No se pudieron refrescar permisos:', ePerm.message);
            }

            PB_DB.notificarCambio('servidor_descargado');
            return true;
        } catch (error) {
            console.error('Error descargando desde servidor:', error);
            if (mostrarOverlay) {
                Swal.fire('Error de conexión', 'No se pudo descargar desde el servidor: ' + error.message, 'error');
            }
            return false;
        } finally {
            if (mostrarOverlay) {
                $('#overlay').hide();
                $('#loadingMessage p').text('');
            }
        }
    },

    async _enviarPostPrincipal(paramsObj) {
        const body = new URLSearchParams();
        for (const [k, v] of Object.entries(paramsObj)) {
            if (v !== undefined && v !== null) {
                body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
            }
        }

        const res = await fetch(SCRIPT_URL_ENVIAR, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString()
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const text = await res.text();
        // Algunos endpoints devuelven "Éxito" y registrar_asistencia_mensual devuelve JSON
        if (text.trim().startsWith('{')) {
            const json = JSON.parse(text);
            if (!json.success) throw new Error(json.error || 'Error en servidor');
            return json;
        }

        if (text.trim() !== 'Éxito') {
            throw new Error(text || 'Respuesta inesperada del servidor');
        }
        return text;
    },

    async _procesarItem(item) {
        if (item.destino === 'permisos') {
            const fd = new FormData();
            fd.append('accion', item.accion);
            fd.append('codigo', item.payload.codigo);
            fd.append('estado', item.payload.estado);

            const res = await fetch(PERMISOS_GESTION_URL, { method: 'POST', body: fd });
            const text = await res.text();
            let parsed = null;
            try { parsed = JSON.parse(text); } catch (e) {}
            if (parsed && !parsed.success) throw new Error(parsed.error || 'Error actualizando permiso');
            if (!parsed && !text.includes('Éxito') && !text.includes('success')) {
                throw new Error(text.substring(0, 120));
            }
            return;
        }

        // Destino principal (Google Apps Script)
        const params = { accion: item.accion, ...item.payload };
        await this._enviarPostPrincipal(params);

        // Si el item trae fotos adjuntas en Base64, subirlas después de registrar/editar
        if (item.fotos && item.fotos.length > 0) {
            for (const fotoObj of item.fotos) {
                await this._enviarPostPrincipal({
                    accion: 'subir_foto',
                    colaborador: fotoObj.colaborador,
                    archivo: fotoObj.archivoBase64,
                    esEdicion: fotoObj.esEdicion ? 'true' : 'false'
                });
            }
        }
    },

    async sincronizarTodo() {
        if (this.enProgreso) return false;
        if (!navigator.onLine) {
            Swal.fire('Sin internet', 'Conéctate a internet antes de sincronizar.', 'warning');
            return false;
        }

        const pendientes = await PB_DB.obtenerPendientes();
        if (pendientes.length === 0) {
            Swal.fire('Todo al día', 'No hay cambios pendientes por sincronizar.', 'info');
            return true;
        }

        this.enProgreso = true;
        let exitosos = 0;
        let errores = 0;

        $('#overlay').css('display', 'flex');

        try {
            for (let i = 0; i < pendientes.length; i++) {
                const item = pendientes[i];
                $('#loadingMessage p').text(`Sincronizando ${i + 1} de ${pendientes.length}: ${item.titulo}...`);

                try {
                    await this._procesarItem(item);
                    await PB_DB.eliminarPendiente(item.id);
                    exitosos++;
                } catch (err) {
                    console.error(`Error sincronizando item #${item.id}:`, err);
                    await PB_DB.actualizarEstadoPendiente(item.id, 'error', err.message);
                    errores++;
                    // Detener si hay dependencia de orden o continuar? Detener evita inconsistencias en FIFO
                    break;
                }
            }

            if (errores === 0) {
                $('#loadingMessage p').text('Actualizando copia local desde el servidor...');
                await this.descargarDesdeServidor(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Sincronización Completa',
                    html: `Se sincronizaron <strong>${exitosos}</strong> cambio(s) correctamente.`,
                    timer: 2500
                });
                return true;
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sincronización detenida por error',
                    html: `Se sincronizaron <strong>${exitosos}</strong> cambio(s), pero falló un elemento.<br>
                           Revisa la lista de pendientes para ver el detalle del error.`,
                });
                return false;
            }
        } finally {
            this.enProgreso = false;
            $('#overlay').hide();
            $('#loadingMessage p').text('');
            PB_DB.notificarCambio('sync_finalizado');
        }
    },

    async abrirModalColaPendientes(onUpdateCallback) {
        const pendientes = await PB_DB.obtenerPendientes();

        if (pendientes.length === 0) {
            Swal.fire({
                icon: 'success',
                title: 'Sin cambios pendientes',
                text: 'Todos tus datos están sincronizados.',
                confirmButtonText: 'Entendido'
            });
            return;
        }

        let listaHtml = '<div id="lista-cola-pendientes" style="max-height: 400px; overflow-y: auto; padding-right: 4px;">';
        pendientes.forEach((p, idx) => {
            const fecha = new Date(p.timestamp).toLocaleString('es-ES');
            const tieneError = p.estado === 'error';
            const badgeFotos = (p.fotos && p.fotos.length > 0)
                ? `<span class="badge bg-info ms-1"><i class="fas fa-camera me-1"></i>${p.fotos.length} foto(s)</span>`
                : '';

            listaHtml += `
                <div class="pending-item-card ${tieneError ? 'error' : ''}" data-id="${p.id}">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; color: #2c3e50; font-size: 0.92rem;">
                            #${idx + 1} - ${p.titulo} ${badgeFotos}
                        </div>
                        ${p.detalle ? `<div style="font-size: 0.82rem; color: #555; margin-top: 2px;">${p.detalle}</div>` : ''}
                        <div style="font-size: 0.72rem; color: #888; margin-top: 3px;">
                            <i class="fas fa-clock me-1"></i>${fecha}
                        </div>
                        ${tieneError ? `<div class="text-danger small mt-1"><i class="fas fa-exclamation-circle me-1"></i>Error: ${p.errorMsg}</div>` : ''}
                    </div>
                    <button class="btn btn-outline-danger btn-sm btn-descartar-pendiente" data-id="${p.id}" title="Descartar este cambio pendiente">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`;
        });
        listaHtml += '</div>';

        const result = await Swal.fire({
            title: `<i class="fas fa-cloud-upload-alt text-warning me-2"></i>Cambios Pendientes (${pendientes.length})`,
            html: `
                <p class="text-muted small mb-3">Los cambios se enviarán a Google Sheets en el orden mostrado cuando presiones sincronizar.</p>
                ${listaHtml}
            `,
            width: window.innerWidth < 576 ? '95%' : '680px',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-sync-alt me-2"></i>Sincronizar Todo Ahora',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#2ecc71',
            didOpen: () => {
                $(document).off('click', '.btn-descartar-pendiente').on('click', '.btn-descartar-pendiente', async function() {
                    const id = parseInt($(this).data('id'), 10);
                    const conf = await Swal.fire({
                        title: '¿Descartar este cambio?',
                        text: 'Se eliminará de la cola de sincronización (nota: recarga desde el servidor si quieres revertir la vista local).',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, descartar',
                        cancelButtonText: 'Cancelar'
                    });
                    if (conf.isConfirmed) {
                        await PB_DB.eliminarPendiente(id);
                        if (onUpdateCallback) onUpdateCallback();
                        PB_SYNC.abrirModalColaPendientes(onUpdateCallback);
                    }
                });
            },
            willClose: () => {
                $(document).off('click', '.btn-descartar-pendiente');
            }
        });

        if (result.isConfirmed) {
            await this.sincronizarTodo();
            if (onUpdateCallback) onUpdateCallback();
        }
    }
};