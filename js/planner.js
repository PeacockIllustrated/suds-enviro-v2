// js/planner.js
document.addEventListener('DOMContentLoaded', function() {
    // ***** MODIFICATION: Define plannerDataStorageKey and projectDataStorageKey *****
    const plannerDataStorageKey = 'sudsPlannerState';
    const projectDataStorageKey = 'sudsUserProjectsData';
    // ***** END MODIFICATION *****

    const itemListContainer = document.getElementById('placed-items-list'),
        canvas = document.getElementById('planner-canvas'),
        ctx = canvas.getContext('2d'),
        canvasContainer = document.getElementById('canvas-container'),
        componentItemsContainer = document.getElementById('component-items'),
        placeModeButton = document.getElementById('mode-place'),
        moveModeButton = document.getElementById('mode-move'),
        connectModeButton = document.getElementById('mode-connect'),
        scaleModeButton = document.getElementById('mode-scale'),
        deleteModeButton = document.getElementById('mode-delete'),
        clearButton = document.getElementById('clear-all'),
        imageUploadInput = document.getElementById('image-upload'),
        toggleOverlayButton = document.getElementById('toggle-overlay'),
        zoomResetButton = document.getElementById('zoom-reset'),
        lockBgButton = document.getElementById('lock-bg'),
        saveButton = document.getElementById('save-plan'),
        loadButton = document.getElementById('load-plan'),
        exportPngButton = document.getElementById('export-png'),
        exportListButton = document.getElementById('export-list'),
        propertiesPanel = document.getElementById('properties-panel'),
        itemLabelInput = document.getElementById('item-label'),
        bgOpacitySlider = document.getElementById('bg-opacity'),
        scaleDisplayElement = document.getElementById('scale-display'),
        canvasTooltip = document.getElementById('canvas-tooltip');

    const gridSpacing = 20,
        gridColor = 'rgba(207, 226, 243, 0.6)',
        itemRadius = 15,
        connectionColor = '#0056b3',
        connectionWidth = 2.5,
        selectionHighlightColor = '#ffc107',
        scrollZoomFactor = 1.005,
        minScale = 0.2,
        maxScale = 5.0,
        rulerColor = getComputedStyle(document.documentElement).getPropertyValue('--ruler-color').trim() || '#ff00ff',
        hoverThreshold = 6,
        isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    let placedItems = [],
        connections = [],
        currentMode = 'place',
        selectedSavedConfig = null,
        selectedToolbarElement = null,
        isConnecting = !1,
        connectionStartItemId = null,
        nextItemId = 0,
        backgroundImage = null,
        isOverlayVisible = !1,
        scale = 1.0,
        originX = 0,
        originY = 0,
        isDraggingItem = !1,
        isPanning = !1,
        isDraggingBackground = !1,
        draggedItemId = null,
        selectedItemId = null,
        lastMouseX = 0,
        lastMouseY = 0,
        bgOpacity = 1.0,
        bgImageX = 0,
        bgImageY = 0,
        isBackgroundLocked = !0,
        draggedListElement = null,
        worldScale = null,
        worldUnits = '',
        isDrawingRuler = !1,
        rulerStartPoint = null,
        rulerEndPoint = null,
        hoveredItemId = null,
        hoveredConnection = null,
        dragStartX = 0,
        dragStartY = 0;

    // Helper function to get initials for item icons
    function getInitials(name) {
        if (!name) return '?';
        // Specific handling for known product names/types
        if (name === 'SEHDS' || name.includes('Hydrodynamic Separator')) return 'HS';
        if (name.startsWith('OFC-') || name.includes('Orifice')) return 'FC';
        if (name === 'SIC' || name === 'FIC' || name.includes('Standard 5-Inlet')) return 'SC'; // Standard Chamber
        if (name === 'SERSIC' || name === 'SERFIC' || name.includes('Separation 3-Inlet')) return 'RC'; // Retention Chamber / Separation Chamber
        if (name.includes('Catchpit')) return 'CP'; // Catchpit

        // General initials for multi-word names
        const words = name.split(/[\s-/]+/);
        if (words.length > 1 && words[0].length > 0 && words[1].length > 0) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        // General initials for single-word names (first two letters)
        else if (words.length === 1 && words[0].length > 1) {
            return words[0].substring(0, 2).toUpperCase();
        }
        // Fallback for very short names or edge cases
        else if (words.length === 1 && words[0].length === 1) {
            return words[0].toUpperCase();
        } else {
            return name.substring(0, 2).toUpperCase() || '?';
        }
    }


    // MODIFIED: loadSavedComponents to pull from sudsUserProjectsData
    function loadSavedComponents() {
        componentItemsContainer.innerHTML = '';
        let allConfigs = [];
        try {
            const storedData = localStorage.getItem(projectDataStorageKey);
            if (storedData) {
                const projectsData = JSON.parse(storedData);
                if (typeof projectsData === 'object' && projectsData !== null) {
                    for (const projectName in projectsData) {
                        if (Object.hasOwnProperty.call(projectsData, projectName)) {
                            const projectConfigs = projectsData[projectName];
                            if (Array.isArray(projectConfigs)) {
                                allConfigs.push(...projectConfigs);
                            }
                        }
                    }
                } else {
                    console.warn("localStorage data for", projectDataStorageKey, "is not an object. Skipping loading from it.", projectsData);
                }
            }
        } catch (e) {
            console.error("Error parsing saved configurations from localStorage:", e);
            allConfigs = []; // Treat as no configs if parsing fails
        }

        if (allConfigs.length === 0) {
            componentItemsContainer.innerHTML = '<p style="text-align:center;font-size:0.8em;color:#6c757d;margin-top:10px;">No saved configurations found.<br>Go to a configurator page to save products.</p>';
            return;
        }

        // Sort configurations by derived_product_name for better organization
        allConfigs.sort((a, b) => {
            const nameA = (a.derived_product_name || a.product_type || '').toUpperCase();
            const nameB = (b.derived_product_name || b.product_type || '').toUpperCase();
            return nameA.localeCompare(nameB);
        });

        allConfigs.forEach((config) => {
            try {
                const configId = config.savedId;
                if (!configId) {
                    console.warn("Skipping config without savedId:", config);
                    return;
                }

                const productCode = config.generated_product_code || 'No Code';
                const productName = config.derived_product_name || 'Unnamed Product';
                const initials = getInitials(productName);

                const selectorDiv = document.createElement('div');
                selectorDiv.className = 'component-selector suds-component-item';
                selectorDiv.dataset.configId = configId;
                selectorDiv.dataset.configData = JSON.stringify(config); // Store full config data for easy access

                const itemDiv = document.createElement('div');
                itemDiv.className = 'toolbar-item suds-component-icon';
                itemDiv.title = `Select ${productName} (Code: ${productCode})`;
                itemDiv.textContent = initials;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'component-label';
                labelSpan.textContent = `${productName} (${productCode})`;

                selectorDiv.appendChild(itemDiv);
                selectorDiv.appendChild(labelSpan);
                componentItemsContainer.appendChild(selectorDiv);

                selectorDiv.addEventListener('click', handleToolbarSelection);
            } catch (itemError) {
                console.error("Error creating list item for config:", config, itemError);
            }
        });
    }

    function initializePlanner() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        loadSavedComponents(); // This will now fetch from sudsUserProjectsData
        placeModeButton.addEventListener('click', () => setMode('place'));
        moveModeButton.addEventListener('click', () => setMode('move'));
        connectModeButton.addEventListener('click', () => setMode('connect'));
        scaleModeButton.addEventListener('click', () => setMode('scale'));
        deleteModeButton.addEventListener('click', () => setMode('delete'));
        clearButton.addEventListener('click', clearAll);
        imageUploadInput.addEventListener('change', handleImageUpload);
        toggleOverlayButton.addEventListener('click', toggleImageOverlay);
        zoomResetButton.addEventListener('click', resetView);
        lockBgButton.addEventListener('click', toggleBackgroundLock);
        saveButton.addEventListener('click', savePlan);
        loadButton.addEventListener('click', loadPlan);
        exportPngButton.addEventListener('click', exportCanvasAsPng);
        exportListButton.addEventListener('click', exportListAsCsv);
        bgOpacitySlider.addEventListener('input', handleBgOpacityChange);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseout', handleMouseOut);
        canvas.addEventListener('wheel', handleWheelZoom, {
            passive: !1
        });
        itemLabelInput.addEventListener('input', handleLabelChange);
        itemListContainer.addEventListener('dragover', handleDragOver);
        loadPlan();
        setMode('place');
        updateToggleButtonState();
        updateLockBgButtonState();
        updateScaleDisplay();
        updateCursor();
        bgOpacitySlider.value = bgOpacity;
    }

    function screenToWorld(screenX, screenY) {
        return {
            x: (screenX - originX) / scale,
            y: (screenY - originY) / scale
        };
    }

    function getRawMousePos(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    function resizeCanvas() {
        canvas.width = canvasContainer.offsetWidth;
        canvas.height = canvasContainer.offsetHeight;
        redrawCanvas();
    }

    function drawGrid() {
        const worldLeft = screenToWorld(0, 0).x;
        const worldTop = screenToWorld(0, 0).y;
        const worldRight = screenToWorld(canvas.width, canvas.height).x;
        const worldBottom = screenToWorld(canvas.width, canvas.height).y;
        const startX = Math.ceil(worldLeft / gridSpacing) * gridSpacing;
        const startY = Math.ceil(worldTop / gridSpacing) * gridSpacing;
        ctx.beginPath();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5 / scale;
        for (let x = startX; x < worldRight; x += gridSpacing) {
            ctx.moveTo(x, worldTop);
            ctx.lineTo(x, worldBottom);
        }
        for (let y = startY; y < worldBottom; y += gridSpacing) {
            ctx.moveTo(worldLeft, y);
            ctx.lineTo(worldRight, y);
        }
        ctx.stroke();
    }

    function drawItems() {
        const itemDrawColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-blue').trim() || '#1d80b9';
        const itemTextColor = '#ffffff';
        placedItems.forEach(item => {
            const initials = item.configData?.derived_product_name ? getInitials(item.configData.derived_product_name) : '?';
            ctx.beginPath();
            ctx.arc(item.x, item.y, itemRadius / scale, 0, Math.PI * 2);
            ctx.fillStyle = itemDrawColor;
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 4 / scale;
            ctx.shadowOffsetY = 1 / scale;
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            const isSelectedForProp = item.id === selectedItemId;
            const isSelectedForConn = isConnecting && item.id === connectionStartItemId;
            const isHovered = item.id === hoveredItemId;
            if (isSelectedForProp || isSelectedForConn || isHovered) {
                ctx.strokeStyle = isHovered ? 'orange' : selectionHighlightColor;
                ctx.lineWidth = (isHovered ? 4 : 3) / scale;
                ctx.stroke();
            }
            const fontSize = Math.max(8, Math.min(14, 10 / scale));
            ctx.fillStyle = itemTextColor;
            ctx.font = `bold ${fontSize}px Montserrat`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initials, item.x, item.y);
            if (item.label) {
                ctx.fillStyle = '#333333';
                ctx.font = `${fontSize * 0.9}px Montserrat`;
                ctx.fillText(item.label, item.x, item.y + (itemRadius * 1.5 / scale));
            }
        });
    }

    function drawConnections() {
        if (connections.length === 0) return;
        ctx.beginPath();
        ctx.lineWidth = connectionWidth / scale;
        ctx.lineCap = 'round';
        connections.forEach(conn => {
            const item1 = placedItems.find(item => item.id === conn.item1Id);
            const item2 = placedItems.find(item => item.id === conn.item2Id);
            if (item1 && item2) {
                ctx.strokeStyle = (hoveredConnection === conn) ? 'orange' : connectionColor;
                ctx.moveTo(item1.x, item1.y);
                ctx.lineTo(item2.x, item2.y);
                ctx.stroke();
            }
        });
        ctx.lineCap = 'butt';
    }

    function drawBackgroundImage() {
        if (isOverlayVisible && backgroundImage) {
            ctx.globalAlpha = bgOpacity;
            ctx.drawImage(backgroundImage, bgImageX, bgImageY, backgroundImage.width, backgroundImage.height);
            ctx.globalAlpha = 1.0;
        }
    }

    function drawRulerLine() {
        if (!rulerStartPoint || !rulerEndPoint) return;
        ctx.beginPath();
        ctx.strokeStyle = rulerColor;
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.moveTo(rulerStartPoint.x, rulerStartPoint.y);
        ctx.lineTo(rulerEndPoint.x, rulerEndPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const pixelDist = calculateDistance(rulerStartPoint, rulerEndPoint);
        const midX = (rulerStartPoint.x + rulerEndPoint.x) / 2;
        const midY = (rulerStartPoint.y + rulerEndPoint.y) / 2;
        ctx.fillStyle = rulerColor;
        ctx.font = `bold ${12/scale}px Montserrat`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(255,255,255,0.7)';
        ctx.shadowBlur = 3 / scale;
        ctx.fillText(`${pixelDist.toFixed(1)} px`, midX, midY - (5 / scale));
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }

    function redrawCanvas(forExport = !1) {
        ctx.save();
        if (forExport) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        ctx.translate(originX, originY);
        ctx.scale(scale, scale);
        drawBackgroundImage();
        drawGrid();
        drawConnections();
        drawItems();
        if (isDrawingRuler) {
            drawRulerLine();
        }
        drawPipeLengths();
        ctx.restore();
        if (!forExport) {
            updateItemList();
        }
    }

    function drawPipeLengths() {
        if (!worldScale || worldScale <= 0 || connections.length === 0) return;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const fontSize = Math.max(6, Math.min(10, 9 / scale));
        ctx.font = `${fontSize}px Montserrat`;
        connections.forEach(conn => {
            const item1 = placedItems.find(i => i.id === conn.item1Id);
            const item2 = placedItems.find(i => i.id === conn.item2Id);
            if (item1 && item2) {
                const pixelDist = calculateDistance(item1, item2);
                const realLength = pixelDist / worldScale;
                const lengthText = `${realLength.toFixed(1)} ${worldUnits||'units'}`;
                const midX = (item1.x + item2.x) / 2;
                const midY = (item1.y + item2.y) / 2;
                ctx.save();
                ctx.fillText(lengthText, midX, midY - (5 / scale));
                ctx.restore();
            }
        });
    }

    function getOrdinalSuffix(i) {
        const j = i % 10,
            k = i % 100;
        if (j == 1 && k != 11) return i + "st";
        if (j == 2 && k != 12) return i + "nd";
        if (j == 3 && k != 13) return i + "rd";
        if (i === 1) return "First";
        if (i === 2) return "Second";
        if (i === 3) return "Third";
        return i + "th";
    }

    function updateItemList() {
        if (!itemListContainer) return;
        itemListContainer.innerHTML = '';
        if (placedItems.length === 0) {
            itemListContainer.innerHTML = '<p style="text-align:center;font-size:0.8em;color:#6c757d;margin-top:10px;">No items placed yet.</p>';
            return;
        }
        const itemIndexMap = new Map(placedItems.map((item, index) => [item.id, index]));
        placedItems.forEach((item, index) => {
            const initials = item.configData?.derived_product_name ? getInitials(item.configData.derived_product_name) : '?';
            const componentName = item.configData?.derived_product_name || 'Unknown Item';
            const productCode = item.configData?.generated_product_code || '';
            const entryDiv = document.createElement('div');
            entryDiv.className = 'placed-item-entry';
            entryDiv.draggable = !0;
            entryDiv.dataset.itemId = item.id;
            entryDiv.dataset.index = index;
            const iconSpan = document.createElement('span');
            iconSpan.className = 'item-list-icon';
            iconSpan.textContent = initials;
            entryDiv.appendChild(iconSpan);
            const detailsSpan = document.createElement('span');
            detailsSpan.className = 'item-list-details';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-list-name';
            nameSpan.textContent = componentName;
            detailsSpan.appendChild(nameSpan);
            const codeSpan = document.createElement('span');
            codeSpan.className = 'item-list-label';
            codeSpan.textContent = productCode || '(No Code)';
            detailsSpan.appendChild(codeSpan);
            const connectionsDiv = document.createElement('div');
            connectionsDiv.className = 'item-list-connections';
            let hasConnections = !1;
            connections.forEach(conn => {
                let otherItemId = -1;
                if (conn.item1Id === item.id) {
                    otherItemId = conn.item2Id;
                } else if (conn.item2Id === item.id) {
                    otherItemId = conn.item1Id;
                }
                if (otherItemId !== -1) {
                    const otherItem = placedItems.find(p => p.id === otherItemId);
                    const otherItemIndex = itemIndexMap.get(otherItemId);
                    if (otherItem && otherItemIndex !== undefined) {
                        hasConnections = !0;
                        const pixelDist = calculateDistance(item, otherItem);
                        let lengthText = '';
                        const ordinalName = getOrdinalSuffix(otherItemIndex + 1);
                        if (worldScale && worldScale > 0) {
                            const realLength = pixelDist / worldScale;
                            lengthText = `Conn to ${ordinalName}: ${realLength.toFixed(1)} ${worldUnits||'units'}`;
                        } else {
                            lengthText = `Conn to ${ordinalName}: ${pixelDist.toFixed(0)} px`;
                        }
                        const connP = document.createElement('div');
                        connP.textContent = lengthText;
                        connectionsDiv.appendChild(connP);
                    }
                }
            });
            if (hasConnections) {
                detailsSpan.appendChild(connectionsDiv);
            }
            entryDiv.appendChild(detailsSpan);
            entryDiv.addEventListener('dragstart', handleDragStart);
            entryDiv.addEventListener('dragend', handleDragEnd);
            entryDiv.addEventListener('dragenter', handleDragEnter);
            entryDiv.addEventListener('dragleave', handleDragLeave);
            entryDiv.addEventListener('drop', handleDrop);
            entryDiv.addEventListener('click', () => selectItemForProperties(item.id));
            itemListContainer.appendChild(entryDiv);
        });
    }

    function handleDragStart(event) {
        draggedListElement = event.target;
        event.dataTransfer.setData('text/plain', event.target.dataset.itemId);
        event.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            event.target.classList.add('dragging');
        }, 0);
    }

    function handleDragEnd(event) {
        if (draggedListElement) {
            draggedListElement.classList.remove('dragging');
        }
        const dragOverElements = itemListContainer.querySelectorAll('.drag-over');
        dragOverElements.forEach(el => el.classList.remove('drag-over'));
        draggedListElement = null;
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(event) {
        event.preventDefault();
        const targetElement = event.target.closest('.placed-item-entry');
        if (targetElement && targetElement !== draggedListElement) {
            targetElement.classList.add('drag-over');
        }
    }

    function handleDragLeave(event) {
        const targetElement = event.target.closest('.placed-item-entry');
        if (targetElement) {
            targetElement.classList.remove('drag-over');
        }
        if (!itemListContainer.contains(event.relatedTarget)) {
            const dragOverElements = itemListContainer.querySelectorAll('.drag-over');
            dragOverElements.forEach(el => el.classList.remove('drag-over'));
        }
    }

    function handleDrop(event) {
        event.preventDefault();
        const targetElement = event.target.closest('.placed-item-entry');
        const dragOverElements = itemListContainer.querySelectorAll('.drag-over');
        dragOverElements.forEach(el => el.classList.remove('drag-over'));
        if (targetElement && targetElement !== draggedListElement) {
            const draggedItemId = parseInt(event.dataTransfer.getData('text/plain'), 10);
            const targetItemId = parseInt(targetElement.dataset.itemId, 10);
            const draggedIndex = placedItems.findIndex(item => item.id === draggedItemId);
            let targetIndex = placedItems.findIndex(item => item.id === targetItemId);
            if (draggedIndex > -1 && targetIndex > -1) {
                const [draggedItem] = placedItems.splice(draggedIndex, 1);
                if (draggedIndex < targetIndex) {
                    targetIndex--;
                }
                placedItems.splice(targetIndex, 0, draggedItem);
                redrawCanvas();
            }
        }
        if (draggedListElement) {
            draggedListElement.classList.remove('dragging');
        }
    }

    function handleMouseDown(event) {
        const rawMousePos = getRawMousePos(event);
        const worldPos = screenToWorld(rawMousePos.x, rawMousePos.y);
        lastMouseX = rawMousePos.x;
        lastMouseY = rawMousePos.y;
        const clickedItem = findItemAt(worldPos.x, worldPos.y);
        isDraggingItem = isPanning = isDraggingBackground = isDrawingRuler = !1;
        draggedItemId = null;
        if (currentMode === 'place' || currentMode === 'move') {
            if (clickedItem) {
                selectItemForProperties(clickedItem.id);
            } else {
                deselectItemForProperties();
            }
        } else {
            deselectItemForProperties();
        }
        if (currentMode === 'place' && selectedSavedConfig && !clickedItem) {
            placeItem(worldPos.x, worldPos.y);
        } else if (currentMode === 'connect') {
            handleConnectionClick(worldPos.x, worldPos.y);
        } else if (currentMode === 'move' && clickedItem) {
            isDraggingItem = !0;
            draggedItemId = clickedItem.id;
            dragStartX = worldPos.x;
            dragStartY = worldPos.y;
            canvasContainer.classList.add('move-cursor');
        } else if (currentMode === 'delete' && clickedItem) {
            deleteItem(clickedItem.id);
        } else if (currentMode === 'scale') {
            isDrawingRuler = !0;
            rulerStartPoint = {
                x: worldPos.x,
                y: worldPos.y
            };
            rulerEndPoint = {
                x: worldPos.x,
                y: worldPos.y
            };
            redrawCanvas();
        } else if (currentMode === 'move' && !isBackgroundLocked && isOverlayVisible && backgroundImage && isPointInBackground(worldPos.x, worldPos.y)) {
            isDraggingBackground = !0;
            canvasContainer.classList.add('move-cursor');
        } else if (!clickedItem) {
            isPanning = !0;
            canvasContainer.classList.add('panning');
        }
    }

    function handleMouseMove(event) {
        const rawMousePos = getRawMousePos(event);
        const worldPos = screenToWorld(rawMousePos.x, rawMousePos.y);
        const dx = rawMousePos.x - lastMouseX;
        const dy = rawMousePos.y - lastMouseY;
        let needsRedraw = !1;
        let tooltipContent = null;
        let tooltipX = rawMousePos.x + 15;
        let tooltipY = rawMousePos.y + 10;
        if (isDraggingItem && draggedItemId !== null) {
            const item = placedItems.find(i => i.id === draggedItemId);
            if (item) {
                if (event.shiftKey) {
                    const currentDx = worldPos.x - dragStartX;
                    const currentDy = worldPos.y - dragStartY;
                    const dist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
                    if (dist > 0) {
                        const angle = Math.atan2(currentDy, currentDx);
                        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
                        item.x = dragStartX + dist * Math.cos(snappedAngle);
                        item.y = dragStartY + dist * Math.sin(snappedAngle);
                    }
                } else {
                    item.x += dx / scale;
                    item.y += dy / scale;
                }
                needsRedraw = !0;
            }
        } else if (isDraggingBackground) {
            bgImageX += dx / scale;
            bgImageY += dy / scale;
            needsRedraw = !0;
        } else if (isDrawingRuler) {
            rulerEndPoint = {
                x: worldPos.x,
                y: worldPos.y
            };
            needsRedraw = !0;
        } else if (isPanning) {
            originX += dx;
            originY += dy;
            needsRedraw = !0;
        } else if (!isTouchDevice) {
            let currentHoverItemId = null;
            let currentHoverConnection = null;
            const hoveredItem = findItemAt(worldPos.x, worldPos.y);
            if (hoveredItem) {
                currentHoverItemId = hoveredItem.id;
                const componentName = hoveredItem.configData?.derived_product_name || 'Unknown Item';
                tooltipContent = `<strong>${componentName} (ID: ${hoveredItem.id})</strong><br>${hoveredItem.label||'(No Label)'}`;
            } else {
                currentHoverConnection = findConnectionNear(worldPos.x, worldY);
                if (currentHoverConnection) {
                    const item1 = placedItems.find(i => i.id === currentHoverConnection.item1Id);
                    const item2 = placedItems.find(i => i.id === currentHoverConnection.item2Id);
                    if (item1 && item2) {
                        const pixelDist = calculateDistance(item1, item2);
                        if (worldScale && worldScale > 0) {
                            const realLength = pixelDist / worldScale;
                            tooltipContent = `Length: ${realLength.toFixed(1)} ${worldUnits||'units'}`;
                        } else {
                            tooltipContent = `Length: ${pixelDist.toFixed(0)} px`;
                        }
                    }
                }
            }
            if (tooltipContent) {
                updateTooltip(tooltipContent, tooltipX, tooltipY);
            } else {
                hideTooltip();
            }
            if (currentHoverItemId !== hoveredItemId || currentHoverConnection !== hoveredConnection) {
                hoveredItemId = currentHoverItemId;
                hoveredConnection = currentHoverConnection;
                needsRedraw = !0;
            }
        }
        lastMouseX = rawMousePos.x;
        lastMouseY = rawMousePos.y;
        if (needsRedraw) {
            redrawCanvas();
        }
    }

    function handleMouseUp(event) {
        if (isDrawingRuler) {
            isDrawingRuler = !1;
            if (rulerStartPoint && rulerEndPoint && calculateDistance(rulerStartPoint, rulerEndPoint) > 0.1) {
                setTimeout(() => setScaleFromRuler(), 0);
            } else {
                rulerStartPoint = null;
                rulerEndPoint = null;
                redrawCanvas();
            }
        }
        isDraggingItem = !1;
        isPanning = !1;
        isDraggingBackground = !1;
        draggedItemId = null;
        canvasContainer.classList.remove('panning', 'move-cursor');
        updateCursor();
    }

    function handleMouseOut(event) {
        if (isDraggingItem || isPanning || isDraggingBackground || isDrawingRuler) {
            isDraggingItem = !1;
            isPanning = !1;
            isDraggingBackground = !1;
            isDrawingRuler = !1;
            draggedItemId = null;
            rulerStartPoint = null;
            rulerEndPoint = null;
            canvasContainer.classList.remove('panning', 'move-cursor');
            updateCursor();
            redrawCanvas();
        }
        hideTooltip();
        if (hoveredItemId || hoveredConnection) {
            hoveredItemId = null;
            hoveredConnection = null;
            redrawCanvas();
        }
    }

    function handleToolbarSelection(event) {
        const targetItem = event.currentTarget;
        setMode('place'); // Always switch to place mode when a component is selected
        if (selectedToolbarElement) {
            selectedToolbarElement.classList.remove('selected');
        }
        const configDataString = targetItem.dataset.configData;
        if (configDataString) {
            try {
                selectedSavedConfig = JSON.parse(configDataString);
            } catch (e) {
                console.error("Error parsing config data from toolbar item:", e);
                selectedSavedConfig = null;
            }
        } else {
            selectedSavedConfig = null;
        }
        selectedToolbarElement = targetItem;
        selectedToolbarElement.classList.add('selected');
        updateCursor();
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    backgroundImage = img;
                    bgImageX = 0;
                    bgImageY = 0;
                    redrawCanvas();
                };
                img.onerror = function() {
                    backgroundImage = null;
                    alert("Failed to load image.");
                };
                img.src = e.target.result;
            };
            reader.onerror = function() {
                backgroundImage = null;
                alert("Failed to read file.");
            };
            reader.readAsDataURL(file);
        } else if (file) {
            alert("Please select a valid image file.");
            imageUploadInput.value = null;
        }
    }

    function toggleImageOverlay() {
        isOverlayVisible = !isOverlayVisible;
        updateToggleButtonState();
        redrawCanvas();
    }

    function updateToggleButtonState() {
        toggleOverlayButton.classList.toggle('active', isOverlayVisible);
        toggleOverlayButton.title = isOverlayVisible ? "Hide background image" : "Show background image";
    }

    function handleLabelChange(event) {
        if (selectedItemId !== null) {
            const item = placedItems.find(i => i.id === selectedItemId);
            if (item) {
                item.label = event.target.value;
                redrawCanvas();
            }
        }
    }

    function handleBgOpacityChange(event) {
        bgOpacity = parseFloat(event.target.value);
        if (isOverlayVisible && backgroundImage) {
            redrawCanvas();
        }
    }

    function handleWheelZoom(event) {
        event.preventDefault();
        const rawMousePos = getRawMousePos(event);
        const scrollDelta = event.deltaY;
        const zoomAmount = Math.pow(scrollZoomFactor, -scrollDelta * 0.1);
        zoom(zoomAmount, rawMousePos.x, rawMousePos.y);
    }

    function toggleBackgroundLock() {
        isBackgroundLocked = !isBackgroundLocked;
        updateLockBgButtonState();
        updateCursor();
    }

    function updateLockBgButtonState() {
        lockBgButton.textContent = isBackgroundLocked ? 'Unlock BG' : 'Lock BG';
        lockBgButton.title = isBackgroundLocked ? 'Unlock background movement' : 'Lock background movement';
        lockBgButton.classList.toggle('active', isBackgroundLocked);
    }

    function placeItem(worldX, worldY) {
        if (!selectedSavedConfig) {
            return;
        }
        const newItemId = nextItemId++;
        placedItems.push({
            x: worldX,
            y: worldY,
            type: selectedSavedConfig.product_type || 'unknown', // Use product_type from config
            id: newItemId,
            label: '',
            configData: selectedSavedConfig // Store the full config data with the placed item
        });
        if (selectedToolbarElement) {
            selectedToolbarElement.classList.remove('selected');
        }
        selectedSavedConfig = null; // Deselect after placing
        selectedToolbarElement = null;
        updateCursor();
        redrawCanvas();
    }

    function handleConnectionClick(worldX, worldY) {
        const clickedItem = findItemAt(worldX, worldY);
        if (clickedItem) {
            if (!isConnecting) {
                isConnecting = !0;
                connectionStartItemId = clickedItem.id;
            } else {
                if (clickedItem.id !== connectionStartItemId) {
                    const alreadyExists = connections.some(conn => (conn.item1Id === connectionStartItemId && conn.item2Id === clickedItem.id) || (conn.item1Id === clickedItem.id && conn.item2Id === connectionStartItemId));
                    if (!alreadyExists) {
                        connections.push({
                            item1Id: connectionStartItemId,
                            item2Id: clickedItem.id
                        });
                    }
                }
                isConnecting = !1;
                connectionStartItemId = null;
            }
        } else {
            if (isConnecting) { // If clicked on empty space while connecting, cancel connection mode
                isConnecting = !1;
                connectionStartItemId = null;
            }
        }
        updateCursor();
        redrawCanvas();
    }

    function deleteItem(itemId) {
        placedItems = placedItems.filter(item => item.id !== itemId);
        connections = connections.filter(conn => conn.item1Id !== itemId && conn.item2Id !== itemId);
        if (selectedItemId === itemId) {
            deselectItemForProperties();
        }
        redrawCanvas();
    }

    function findItemAt(worldX, worldY) {
        const clickRadius = itemRadius / scale;
        for (let i = placedItems.length - 1; i >= 0; i--) {
            const item = placedItems[i];
            const dx = worldX - item.x;
            const dy = worldY - item.y;
            if (dx * dx + dy * dy <= clickRadius * clickRadius) {
                return item;
            }
        }
        return null;
    }

    function isPointInBackground(worldX, worldY) {
        if (!backgroundImage) return !1;
        return worldX >= bgImageX && worldX <= bgImageX + backgroundImage.width && worldY >= bgImageY && worldY <= bgImageY + backgroundImage.height;
    }

    function setMode(newMode) {
        if (isDraggingItem || isPanning || isDraggingBackground || isDrawingRuler) return;
        currentMode = newMode;
        isConnecting = !1;
        connectionStartItemId = null;
        isDrawingRuler = !1;
        rulerStartPoint = null;
        rulerEndPoint = null;
        // Deselect toolbar item if not in 'place' mode
        if (selectedToolbarElement && newMode !== 'place') {
            selectedToolbarElement.classList.remove('selected');
            selectedSavedConfig = null;
            selectedToolbarElement = null;
        }
        deselectItemForProperties(); // Always deselect item when changing mode
        placeModeButton.classList.toggle('active', newMode === 'place');
        moveModeButton.classList.toggle('active', newMode === 'move');
        connectModeButton.classList.toggle('active', newMode === 'connect');
        scaleModeButton.classList.toggle('active', newMode === 'scale');
        deleteModeButton.classList.toggle('active', newMode === 'delete');
        updateCursor();
        redrawCanvas(); // Redraw to clear potential selection/hover states
    }

    function updateCursor() {
        canvasContainer.classList.remove('panning', 'move-cursor', 'crosshair-cursor', 'pointer-cursor', 'copy-cursor', 'locked-cursor', 'grab-cursor');
        if (isPanning) {
            canvasContainer.classList.add('panning');
            return;
        }
        if (isDraggingItem || isDraggingBackground) {
            canvasContainer.classList.add('move-cursor');
            return;
        }
        switch (currentMode) {
            case 'place':
                canvasContainer.classList.add(selectedSavedConfig ? 'copy-cursor' : 'crosshair-cursor');
                break;
            case 'move':
                canvasContainer.classList.add('move-cursor');
                break;
            case 'connect':
                canvasContainer.classList.add(isConnecting ? 'pointer-cursor' : 'crosshair-cursor');
                break;
            case 'scale':
                canvasContainer.classList.add('crosshair-cursor');
                break;
            case 'delete':
                canvasContainer.classList.add('pointer-cursor');
                break;
            default:
                canvasContainer.classList.add('grab-cursor');
                break;
        }
        if (!canvasContainer.classList.contains('copy-cursor') && !canvasContainer.classList.contains('move-cursor') && !canvasContainer.classList.contains('crosshair-cursor') && !canvasContainer.classList.contains('pointer-cursor')) {
            canvasContainer.classList.add('grab-cursor');
        }
    }

    function selectItemForProperties(itemId) {
        if (selectedItemId !== itemId) {
            selectedItemId = itemId;
            const item = placedItems.find(i => i.id === itemId);
            if (item) {
                itemLabelInput.value = item.label || '';
                propertiesPanel.style.display = 'block';
                redrawCanvas();
            } else {
                deselectItemForProperties();
            }
        }
    }

    function deselectItemForProperties() {
        if (selectedItemId !== null) {
            selectedItemId = null;
            propertiesPanel.style.display = 'none';
            itemLabelInput.value = '';
            redrawCanvas();
        }
    }

    function zoom(factor, centerX, centerY) {
        const worldPos = screenToWorld(centerX, centerY);
        scale = Math.max(minScale, Math.min(maxScale, scale * factor));
        originX = centerX - worldPos.x * scale;
        originY = centerY - worldPos.y * scale;
        redrawCanvas();
    }

    function resetView() {
        scale = 1.0;
        originX = 0;
        originY = 0;
        bgImageX = 0;
        bgImageY = 0;
        redrawCanvas();
    }

    function calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function setScaleFromRuler() {
        const pixelDist = calculateDistance(rulerStartPoint, rulerEndPoint);
        if (pixelDist <= 0) {
            rulerStartPoint = null;
            rulerEndPoint = null;
            redrawCanvas();
            return;
        }
        setTimeout(() => {
            const realLengthStr = prompt(`Enter the real-world length this line represents (pixel length: ${pixelDist.toFixed(1)} px):`);
            if (realLengthStr === null) {
                rulerStartPoint = null;
                rulerEndPoint = null;
                redrawCanvas();
                return;
            }
            const realLength = parseFloat(realLengthStr);
            if (isNaN(realLength) || realLength <= 0) {
                alert("Invalid length entered.");
                rulerStartPoint = null;
                rulerEndPoint = null;
                redrawCanvas();
                return;
            }
            const unitsStr = prompt("Enter the units for this length (e.g., m, ft):", worldUnits || 'm');
            if (unitsStr === null) {
                rulerStartPoint = null;
                rulerEndPoint = null;
                redrawCanvas();
                return;
            }
            worldScale = pixelDist / realLength;
            worldUnits = unitsStr.trim() || 'units';
            updateScaleDisplay();
            rulerStartPoint = null;
            rulerEndPoint = null;
            redrawCanvas();
        }, 10);
    }

    function updateScaleDisplay() {
        if (worldScale && worldScale > 0) {
            const pixelsPerUnit = worldScale;
            scaleDisplayElement.textContent = `Scale: 1 ${worldUnits||'unit'} ≈ ${pixelsPerUnit.toFixed(1)} px`;
            scaleDisplayElement.title = `Current scale is ${worldScale.toFixed(4)} pixels per ${worldUnits||'unit'}`;
        } else {
            scaleDisplayElement.textContent = "Scale not set";
            scaleDisplayElement.title = "Use Scale mode to set scale";
        }
    }

    function findConnectionNear(worldX, worldY) {
        let closestConn = null;
        let minDistSq = Infinity;
        const threshold = hoverThreshold / scale;
        for (const conn of connections) {
            const item1 = placedItems.find(i => i.id === conn.item1Id);
            const item2 = placedItems.find(i => i.id === conn.item2Id);
            if (!item1 || !item2) continue;
            const distSq = pointLineSegmentDistanceSq(worldX, worldY, item1.x, item1.y, item2.x, item2.y);
            if (distSq < threshold * threshold && distSq < minDistSq) {
                minDistSq = distSq;
                closestConn = conn;
            }
        }
        return closestConn;
    }

    function pointLineSegmentDistanceSq(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        const dx = px - projX;
        const dy = py - projY;
        return dx * dx + dy * dy;
    }

    function updateTooltip(text, screenX, screenY) {
        if (!canvasTooltip) return;
        canvasTooltip.innerHTML = text;
        canvasTooltip.style.display = 'block';
        const containerRect = canvasContainer.getBoundingClientRect();
        let left = screenX + 15;
        let top = screenY + 10;
        if (left + canvasTooltip.offsetWidth > containerRect.width) {
            left = screenX - canvasTooltip.offsetWidth - 10;
        }
        if (top + canvasTooltip.offsetHeight > containerRect.height) {
            top = screenY - canvasTooltip.offsetHeight - 5;
        }
        if (left < 0) left = 5;
        if (top < 0) top = 5;
        canvasTooltip.style.left = `${left}px`;
        canvasTooltip.style.top = `${top}px`;
    }

    function hideTooltip() {
        if (canvasTooltip) {
            canvasTooltip.style.display = 'none';
        }
    }

    function savePlan() {
        try {
            const planData = {
                items: placedItems,
                connections: connections,
                nextId: nextItemId,
                bgPos: {
                    x: bgImageX,
                    y: bgImageY
                },
                bgLocked: isBackgroundLocked,
                worldScale: worldScale,
                worldUnits: worldUnits,
                bgOpacity: bgOpacity, // Save opacity too
                isOverlayVisible: isOverlayVisible // Save visibility
            };
            localStorage.setItem(plannerDataStorageKey, JSON.stringify(planData));
            alert("Plan saved successfully!");
        } catch (error) {
            console.error("Error saving plan:", error);
            alert("Error saving plan. Check browser storage limits.");
        }
    }

    function loadPlan() {
        try {
            const jsonData = localStorage.getItem(plannerDataStorageKey);
            if (jsonData) {
                const planData = JSON.parse(jsonData);
                if (planData && Array.isArray(planData.items) && Array.isArray(planData.connections)) {
                    placedItems = planData.items;
                    // Ensure configData is parsed if it was stringified in old save format
                    placedItems.forEach(item => {
                        if (typeof item.configData === 'string') {
                            try {
                                item.configData = JSON.parse(item.configData);
                            } catch (e) {
                                console.error("Error parsing configData for item:", item, e);
                                item.configData = {}; // Fallback to empty if parsing fails
                            }
                        }
                        if (item.label === undefined) item.label = ''; // Ensure label exists
                    });

                    connections = planData.connections;
                    nextItemId = planData.nextId || calculateNextId(); // Use saved nextId or recalculate

                    if (planData.bgPos) {
                        bgImageX = planData.bgPos.x ?? 0;
                        bgImageY = planData.bgPos.y ?? 0;
                    } else {
                        bgImageX = 0;
                        bgImageY = 0;
                    }

                    isBackgroundLocked = planData.bgLocked ?? !0;
                    updateLockBgButtonState();

                    worldScale = planData.worldScale ?? null;
                    worldUnits = planData.worldUnits ?? '';
                    updateScaleDisplay();

                    bgOpacity = planData.bgOpacity ?? 1.0; // Load opacity
                    bgOpacitySlider.value = bgOpacity;

                    isOverlayVisible = planData.isOverlayVisible ?? true; // Load visibility
                    updateToggleButtonState();

                    // If a background image was set, try to re-render it
                    // NOTE: The actual image data is NOT saved in localStorage due to size limits.
                    // User will need to re-upload if they want the image back after a refresh/new session.
                    // We just load its position/opacity/visibility state.
                    if (backgroundImage) { // Only if image already exists from previous load
                        redrawCanvas();
                    } else {
                        // If no image loaded from scratch, reset view state
                        resetView(); // Only reset view if no image is present to start with
                    }
                    redrawCanvas(); // Redraw after loading all states
                } else {
                    console.warn("Invalid plan data structure in localStorage. Resetting plan.", planData);
                    localStorage.removeItem(plannerDataStorageKey);
                    initializeEmptyPlanState();
                    redrawCanvas();
                }
            } else {
                initializeEmptyPlanState();
                redrawCanvas();
            }
        } catch (error) {
            console.error("Error loading plan:", error);
            alert("Error loading plan. Plan might be corrupted or too large.");
            localStorage.removeItem(plannerDataStorageKey); // Clear potentially corrupted data
            initializeEmptyPlanState();
            redrawCanvas();
        }
    }

    function initializeEmptyPlanState() {
        placedItems = [];
        connections = [];
        nextItemId = 0;
        backgroundImage = null; // Ensure image is cleared
        isOverlayVisible = false; // Reset visibility
        imageUploadInput.value = null; // Clear file input
        deselectItemForProperties(); // Hide properties panel
        updateToggleButtonState(); // Update toggle button state
        bgImageX = 0;
        bgImageY = 0;
        isBackgroundLocked = !0;
        updateLockBgButtonState();
        scale = 1.0;
        originX = 0;
        originY = 0;
        bgOpacity = 1.0;
        bgOpacitySlider.value = bgOpacity;
        worldScale = null;
        worldUnits = '';
        updateScaleDisplay();
    }

    function calculateNextId() {
        return placedItems.reduce((maxId, item) => Math.max(maxId, item.id), -1) + 1;
    }

    function exportCanvasAsPng() {
        if (canvas.width === 0 || canvas.height === 0) {
            alert("Cannot export empty canvas.");
            return;
        }
        try {
            redrawCanvas(!0); // Draw for export (white background)
            let dataUrl = '';
            try {
                dataUrl = canvas.toDataURL('image/png');
            } catch (e) {
                console.error("Error getting data URL:", e);
                alert(`Could not get image data. Error: ${e.message}`);
                return;
            }
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'drainage-plan.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("Error exporting canvas:", error);
            alert(`Could not export canvas. Error: ${error.message}`);
        } finally {
             redrawCanvas(); // Redraw to restore normal canvas state after export
        }
    }

    function exportListAsCsv() {
        if (connections.length === 0) {
            alert("No connections to export.");
            return;
        }
        const header = "Item1_ID,Item1_Name,Item1_Label,Item2_ID,Item2_Name,Item2_Label,Length,Units\n";
        const escapeCsv = (str) => {
            if (str === null || str === undefined) return '';
            const string = String(str);
            if (string.includes('"') || string.includes(',') || string.includes('\n')) {
                return `"${string.replace(/"/g,'""')}"`;
            }
            return string;
        };
        const rows = connections.map(conn => {
            const item1 = placedItems.find(i => i.id === conn.item1Id);
            const item2 = placedItems.find(i => i.id === conn.item2Id);
            if (!item1 || !item2) return null;
            const name1 = item1.configData?.derived_product_name || 'Unknown';
            const name2 = item2.configData?.derived_product_name || 'Unknown';
            const pixelDist = calculateDistance(item1, item2);
            let lengthStr = '';
            let unitStr = '';
            if (worldScale && worldScale > 0) {
                lengthStr = (pixelDist / worldScale).toFixed(2);
                unitStr = worldUnits || 'units';
            } else {
                lengthStr = pixelDist.toFixed(0);
                unitStr = 'px';
            }
            return [item1.id, escapeCsv(name1), escapeCsv(item1.label), item2.id, escapeCsv(name2), escapeCsv(item2.label), lengthStr, unitStr].join(',');
        }).filter(row => row !== null).join('\n');
        const csvString = header + rows;
        try {
            const blob = new Blob([csvString], {
                type: 'text/csv;charset=utf-8;'
            });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'planner-connections.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting list as CSV:", error);
            alert("Could not export list.");
        }
    }

    function clearAll() {
        if (confirm("Are you sure you want to clear the entire plan? This includes the background image and scale setting, and cannot be undone.")) {
            isConnecting = !1;
            connectionStartItemId = null;
            backgroundImage = null; // Clear image object
            isOverlayVisible = !1;
            imageUploadInput.value = null; // Clear selected file in input
            deselectItemForProperties(); // Hide properties panel
            updateToggleButtonState(); // Update toggle button state
            initializeEmptyPlanState(); // Reset all plan data
            if (selectedToolbarElement) { // Deselect component in toolbar
                selectedToolbarElement.classList.remove('selected');
                selectedSavedConfig = null;
                selectedToolbarElement = null;
            }
            setMode('place'); // Reset to default mode
            redrawCanvas(); // Final redraw
        }
    }

    // Initialize the planner when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePlanner);
    } else {
        initializePlanner();
    }
});
