// js/universal_chamber.js
import { auth, db } from './firebase-init.js';
import { collection, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    const pricingRules = {
        base: 50.00, system_type: {'SIC_FIC': 0, 'SERSIC_SERFIC': 150.00}, water_application: {'Surface': 0, 'Foul': 25.00},
        adoptable_status: {'adoptable': 50.00, 'non_adoptable': 0}, depth_base: 75.00, depth_per_150mm_step: 12.00,
        diameter: {'315mm': 0, '450mm': 40.00, '600mm': 90.00, '1050mm': 250.00},
        outlet_base: 15.00, inlet_base: 20.00,
        pipe_size_multiplier: {'110mm': 1.0, '160mm': 1.3, '225mm': 1.8},
        pipe_material_adder: {'PVC': 0, 'Clay': 10.00, 'Twinwall': 5.00, 'Other': 30.00}
    };

    const form = document.getElementById('sudsUniversalChamberForm');
    const submitStatus = document.getElementById('suds_submit_status');
    const customerProjectNameInput = document.getElementById('customer_project_name');

    const MAX_INLETS_SIC = 5; const MAX_INLETS_SERSIC = 3;
    let currentMaxInlets = MAX_INLETS_SIC; let activeInletPositions = [];
    const diagramInletElements = Array.from(document.querySelectorAll('.ic-chamber-diagram .ic-inlet'));
    const inletSelectorErrorDiv = document.getElementById('inlet_selector_error');
    const activeInletConfigsContainer = document.getElementById('active_inlet_configs_container');
    const chamberDiagram = document.getElementById('chamberDiagram');
    const productCodeDisplay = document.getElementById('suds_product_code_display');
    const shoppingListItemsUl = document.getElementById('shopping_list_items');
    const costPriceValueSpan = document.getElementById('cost_price_value');
    const sellPriceValueSpan = document.getElementById('sell_price_value');
    const profitMarkupInput = document.getElementById('profit_markup_percent');
    const chamberSystemTypeSelect = document.getElementById('chamber_system_type');
    const waterApplicationTypeSelect = document.getElementById('water_application_type');
    const chamberDepthSelect = document.getElementById('ic_chamber_depth');
    const chamberDiameterSelect = document.getElementById('ic_chamber_diameter');
    const adoptableStatusGroup = document.getElementById('adoptable_status_group');
    const imageUrlSicFic = 'https://cdn.prod.website-files.com/6662e401ea62d861a416088f/681cab9600a1d9280a8be059_Untitled-1.png';
    const imageUrlSersicSerfic = 'https://cdn.prod.website-files.com/6662e401ea62d861a416088f/681cb9353f66a1ba5d64391c_Untitled-2.png';

    const USERS_COLLECTION = 'users';
    const PROJECTS_SUBCOLLECTION = 'projects';
    const CONFIGURATIONS_SUBCOLLECTION = 'configurations';
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    let currentUser = null; // To store the authenticated user

    // --- Firebase Auth State Listener ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (currentUser) {
            console.log("Universal Chamber Configurator: User is logged in.", currentUser.uid);
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
            submitStatus.textContent = 'Ready to save configuration.';
            submitStatus.className = '';
        } else {
            console.log("Universal Chamber Configurator: User is NOT logged in. Disabling form.");
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
            submitStatus.textContent = 'Please log in to use the configurator.';
            submitStatus.className = 'suds_status_error';
            form.reset();
            populateDepthOptions();
            resetInlets(); // Reset inlet selection visually
        }
    });

    function resetInlets() {
        activeInletPositions = [];
        activeInletConfigsContainer.innerHTML = '';
        diagramInletElements.forEach(el => el.classList.remove('selected'));
        if(inletSelectorErrorDiv) inletSelectorErrorDiv.textContent = '';
        if(document.querySelector('.ic-chamber-diagram')) document.querySelector('.ic-chamber-diagram').style.borderColor = 'transparent';
        updateChamberSystemView(chamberSystemTypeSelect.value || 'SIC_FIC'); // Reset diagram based on current type or default
    }

    function getProductName() {
        const systemType = chamberSystemTypeSelect.value;
        const waterApp = waterApplicationTypeSelect.value;
        if (systemType === 'SERSIC_SERFIC') return waterApp === 'Foul' ? 'SERFIC' : 'SERSIC';
        else if (systemType === 'SIC_FIC') return waterApp === 'Foul' ? 'FIC' : 'SIC';
        return 'N/A';
    }
    function formatInletPositionsForCode() {
        return activeInletPositions
            .map(p => parseInt(p.split(':')[0]))
            .sort((a, b) => a - b)
            .map(h => String(h).padStart(2, '0'))
            .join('');
    }
    function formatCurrency(value) { return `£${value.toFixed(2)}`; }
    function populateDepthOptions() {
        const selectedAdoptable = document.querySelector('input[name="adoptable_status"]:checked');
        const adoptableValue = selectedAdoptable?.value;
        const currentDepthValue = chamberDepthSelect.value;
        chamberDepthSelect.innerHTML = '';
        if (!adoptableValue) {
            chamberDepthSelect.disabled = true;
            const o = document.createElement('option'); o.value = ""; o.textContent = "-- Select Adoptable Status First --"; chamberDepthSelect.appendChild(o);
            updateQuoteAndCode(); return;
        }
        chamberDepthSelect.disabled = false;
        const dO = document.createElement('option'); dO.value = ""; dO.textContent = "-- Select Depth --"; chamberDepthSelect.appendChild(dO);
        const minD = 600; const maxD = (adoptableValue === 'adoptable') ? 3000 : 6000; const inc = 150;
        for (let d = minD; d <= maxD; d += inc) { const o = document.createElement('option'); o.value = d; o.textContent = `${d}mm`; chamberDepthSelect.appendChild(o); }
        if (currentDepthValue && chamberDepthSelect.querySelector(`option[value="${currentDepthValue}"]`)) { chamberDepthSelect.value = currentDepthValue; } else { chamberDepthSelect.value = ""; }
        updateQuoteAndCode();
    }
    function calculateQuote() {
        let totalCost = 0; const items = []; const formData = new FormData(form);
        totalCost += pricingRules.base; items.push({ description: "Base Chamber", cost: pricingRules.base });
        const systemType = formData.get('chamber_system_type'); if (systemType && pricingRules.system_type[systemType]) { const c = pricingRules.system_type[systemType]; if (c > 0) items.push({ description: `System: ${systemType.replace('_', ' / ')}`, cost: c }); totalCost += c; }
        const waterApp = formData.get('water_application_type'); if (waterApp && pricingRules.water_application[waterApp]) { const c = pricingRules.water_application[waterApp]; if (c > 0) items.push({ description: `Application: ${waterApp} Water`, cost: c }); totalCost += c; }
        const adoptableStatusVal = formData.get('adoptable_status'); if (adoptableStatusVal && pricingRules.adoptable_status[adoptableStatusVal]) { const c = pricingRules.adoptable_status[adoptableStatusVal]; if (c > 0) items.push({ description: `Status: ${adoptableStatusVal.charAt(0).toUpperCase() + adoptableStatusVal.slice(1)}`, cost: c }); totalCost += c; }
        const depth = parseFloat(formData.get('ic_chamber_depth')); if (depth && depth >= 600) { let depthCost = pricingRules.depth_base; const steps = (depth - 600) / 150; depthCost += steps * pricingRules.depth_per_150mm_step; items.push({ description: `Depth: ${depth}mm`, cost: depthCost }); totalCost += depthCost; }
        const diameter = formData.get('ic_chamber_diameter'); if (diameter && pricingRules.diameter[diameter]) { const c = pricingRules.diameter[diameter]; if (c > 0) items.push({ description: `Diameter: ${diameter}`, cost: c }); totalCost += c; }
        activeInletPositions.forEach(pos => {
            const safePosId = pos.replace(":", "");
            const inletSize = form.querySelector(`#inlet_pipe_size_${safePosId}`)?.value;
            const inletMaterial = form.querySelector(`#inlet_pipe_material_${safePosId}`)?.value;
            if (inletSize || inletMaterial) {
                let inletCost = pricingRules.inlet_base;
                let description = `Inlet (${pos})`;
                if (inletSize && pricingRules.pipe_size_multiplier[inletSize]) {
                    inletCost *= pricingRules.pipe_size_multiplier[inletSize];
                    description += ` ${inletSize}`;
                }
                if (inletMaterial && pricingRules.pipe_material_adder[inletMaterial]) {
                    const materialCost = pricingRules.pipe_material_adder[inletMaterial];
                    inletCost += materialCost;
                    description += ` ${inletMaterial}`;
                    const otherInput = form.querySelector(`#inlet_pipe_material_other_${safePosId}`);
                    if (inletMaterial === 'Other' && otherInput?.value) {
                        description += ` (${otherInput.value})`;
                    }
                }
                items.push({ description: description, cost: inletCost });
                totalCost += inletCost;
            }
        });
        return { total: totalCost, items: items };
    }
    function updateQuoteDisplay() {
        const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        shoppingListItemsUl.innerHTML = ''; if (quote.items.length > 0) { quote.items.forEach(item => { const li = document.createElement('li'); li.innerHTML = `<span class="item-description">${item.description}</span><span class="item-cost">${formatCurrency(item.cost)}</span>`; shoppingListItemsUl.appendChild(li); }); } else { shoppingListItemsUl.innerHTML = '<li>Select options to see quote...</li>'; }
        costPriceValueSpan.textContent = formatCurrency(costPrice); sellPriceValueSpan.textContent = formatCurrency(sellPrice);
    }
    function updateProductCodeDisplay() {
        const productName = getProductName();
        const adoptableSelectedValue = document.querySelector('input[name="adoptable_status"]:checked')?.value;
        const depthValue = chamberDepthSelect.value;
        const diameterValue = chamberDiameterSelect.value;
        const inletsCode = formatInletPositionsForCode();
        if (productName === 'N/A' || !adoptableSelectedValue || !depthValue || !diameterValue || (activeInletPositions.length > 0 && inletsCode === '')) {
            productCodeDisplay.textContent = 'Please complete selections...'; return;
        }
        const adoptableCode = adoptableSelectedValue === 'adoptable' ? 'AD' : 'NA';
        const diameterCode = diameterValue.replace('mm', '');
        productCodeDisplay.textContent = `${productName}-${depthValue}-${diameterCode}-${inletsCode || '00'}-${adoptableCode}`;
    }
    function updateChamberSystemView(systemType) {
        const inletsToHideForSersic = ['5:00', '7:00'];
        if (chamberDiagram) chamberDiagram.style.backgroundImage = `url('${systemType === 'SERSIC_SERFIC' ? imageUrlSersicSerfic : imageUrlSicFic}')`;
        currentMaxInlets = systemType === 'SERSIC_SERFIC' ? MAX_INLETS_SERSIC : MAX_INLETS_SIC;
        diagramInletElements.forEach(el => {
            const isSersicMode = systemType === 'SERSIC_SERFIC';
            const shouldHide = isSersicMode && inletsToHideForSersic.includes(el.dataset.position);
            el.classList.toggle('hidden-inlet', shouldHide);
            if (shouldHide && el.classList.contains('selected')) {
                const position = el.dataset.position;
                const configBlock = document.getElementById(`inlet_config_${position.replace(":", "")}`);
                if (configBlock) activeInletConfigsContainer.removeChild(configBlock);
                activeInletPositions = activeInletPositions.filter(ip => ip !== position);
                el.classList.remove('selected');
            }
        });
        validateInletSelection(true);
        updateQuoteAndCode();
    }
    function createInletConfigBlock(position) {
        const safePositionId = position.replace(":", "");
        const block = document.createElement('div');
        block.className = 'inlet-config-block';
        block.id = `inlet_config_${safePositionId}`;
        block.innerHTML = `<h4>Inlet Configuration: ${position}<button type="button" class="inlet-remove-btn" data-position="${position}" title="Remove Inlet ${position}">Remove</button></h4><div class="suds-form-group"><label class="suds-label" for="inlet_pipe_size_${safePositionId}">Pipework Size:</label><select class="suds-select inlet-pipe-size" id="inlet_pipe_size_${safePositionId}" name="inlet_pipe_size_${safePositionId}" required><option value="">-- Select Size --</option><option value="110mm">110mm</option><option value="160mm">160mm</option><option value="225mm">225mm</option></select></div><div class="suds-form-group"><label class="suds-label" for="inlet_pipe_material_${safePosId}">Pipe System Material:</label><select class="suds-select inlet-material-select" id="inlet_pipe_material_${safePosId}" name="inlet_pipe_material_${safePosId}" data-position="${position}" required><option value="">-- Select Material --</option><option value="PVC">PVC</option><option value="Clay">Clay</option><option value="Twinwall">Twinwall</option><option value="Other">Other</option></select></div><div id="inlet_pipe_material_other_container_${safePosId}" class="suds-conditional-options" style="display:none;"><div class="suds-form-group"><label class="suds-label" for="inlet_pipe_material_other_${safePosId}">Specify other material:</label><input class="suds-input inlet-other-material" type="text" id="inlet_pipe_material_other_${safePosId}" name="inlet_pipe_material_other_${safePosId}"></div></div><button type="button" class="suds-button apply-all-btn" data-position="${position}" title="Apply these Size/Material settings to all other active inlets">Apply All</button>`;
        activeInletConfigsContainer.appendChild(block);
        block.querySelector('.inlet-remove-btn').addEventListener('click', handleRemoveInletClick);
        const inletMaterialSelect = block.querySelector('.inlet-material-select');
        inletMaterialSelect.addEventListener('change', handleInletMaterialChange);
        block.querySelectorAll('select, input').forEach(el => { el.addEventListener('change', updateQuoteAndCode); if (el.type === 'text' || el.type === 'number') { el.addEventListener('keyup', updateQuoteAndCode); el.addEventListener('input', updateQuoteAndCode); } });
        block.querySelector('.apply-all-btn').addEventListener('click', handleApplyToAllClick);
    }
    function validateInletSelection(isSilent = false) {
        const diagramBorderElement = document.querySelector('.ic-chamber-diagram');
        if (activeInletPositions.length === 0) {
            if (!isSilent && inletSelectorErrorDiv) {
                inletSelectorErrorDiv.textContent = 'Please select and configure at least 1 inlet.';
                if (diagramBorderElement) diagramBorderElement.style.borderColor = 'var(--suds-red)';
            }
            return false;
        }
        if(inletSelectorErrorDiv) inletSelectorErrorDiv.textContent = '';
        if (diagramBorderElement) diagramBorderElement.style.borderColor = 'transparent';
        return true;
    }
    function handleRemoveInletClick(event) {
        const position = event.target.dataset.position;
        const diagramEl = document.querySelector(`.ic-inlet[data-position="${position}"]`);
        if (diagramEl) diagramEl.click();
    }
    function handleInletMaterialChange(event) {
        const position = event.target.dataset.position;
        const safePosId = position.replace(':', '');
        const otherContainer = document.getElementById(`inlet_pipe_material_other_container_${safePosId}`);
        const otherInput = document.getElementById(`inlet_pipe_material_other_${safePosId}`);
        if(otherContainer) otherContainer.style.display = event.target.value === 'Other' ? 'block' : 'none';
        if(otherInput) {
            otherInput.required = event.target.value === 'Other';
            if (event.target.value !== 'Other') otherInput.value = '';
        }
        updateQuoteAndCode();
    }
    function updateQuoteAndCode() {
        updateProductCodeDisplay();
        updateQuoteDisplay();
    }
    function handleApplyToAllClick(event) {
        const sourcePosition = event.target.dataset.position;
        const sourceSafePosId = sourcePosition.replace(":", "");
        const sourceSizeSelect = document.getElementById(`inlet_pipe_size_${sourceSafePosId}`);
        const sourceMaterialSelect = document.getElementById(`inlet_pipe_material_${sourceSafePosId}`);
        const sourceOtherInput = document.getElementById(`inlet_pipe_material_other_${sourceSafePosId}`);
        if (!sourceSizeSelect || !sourceMaterialSelect) return;
        const sourceSize = sourceSizeSelect.value;
        const sourceMaterial = sourceMaterialSelect.value;
        const sourceOtherValue = sourceMaterial === 'Other' && sourceOtherInput ? sourceOtherInput.value : '';
        let confirmNeeded = false;
        activeInletPositions.forEach(pos => {
            if (pos === sourcePosition) return;
            const targetSafePosId = pos.replace(":", "");
            const targetSize = document.getElementById(`inlet_pipe_size_${targetSafePosId}`)?.value;
            const targetMaterial = document.getElementById(`inlet_pipe_material_${targetSafePosId}`)?.value;
            if (targetSize || targetMaterial) { confirmNeeded = true; }
        });
        let proceed = true;
        if (confirmNeeded) { proceed = confirm("Update all other active inlets with these settings? Existing selections will be overwritten."); }
        if (proceed) {
            activeInletPositions.forEach(pos => {
                if (pos === sourcePosition) return;
                const targetSafePosId = pos.replace(":", "");
                const targetSizeSelect = document.getElementById(`inlet_pipe_size_${targetSafePosId}`);
                const targetMaterialSelect = document.getElementById(`inlet_pipe_material_${targetSafePosId}`);
                const targetOtherContainer = document.getElementById(`inlet_pipe_material_other_container_${targetSafePosId}`);
                const targetOtherInput = document.getElementById(`inlet_pipe_material_other_${safePosId}`); // Corrected: Should be targetOtherInput based on targetSafePosId
                if (targetSizeSelect) targetSizeSelect.value = sourceSize;
                if (targetMaterialSelect) targetMaterialSelect.value = sourceMaterial;
                if (targetOtherContainer) targetOtherContainer.style.display = sourceMaterial === 'Other' ? 'block' : 'none';
                if (targetOtherInput) {
                    targetOtherInput.value = sourceOtherValue;
                    targetOtherInput.required = sourceMaterial === 'Other';
                }
                if(targetSizeSelect) targetSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                if(targetMaterialSelect) targetMaterialSelect.dispatchEvent(new Event('change', { bubbles: true }));
            });
            updateQuoteAndCode();
        }
    }

    const elementsTriggeringUpdates = [
        chamberSystemTypeSelect, waterApplicationTypeSelect, chamberDepthSelect,
        chamberDiameterSelect, profitMarkupInput
    ];
    elementsTriggeringUpdates.forEach(el => {
        if(el) {
            el.addEventListener('change', updateQuoteAndCode);
            if (el.type === 'number' || el.type === 'text') { el.addEventListener('keyup', updateQuoteAndCode); el.addEventListener('input', updateQuoteAndCode); }
        }
    });
    if (adoptableStatusGroup) {
        Array.from(adoptableStatusGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
            radio.addEventListener('change', () => { populateDepthOptions(); });
        });
    }
    if (chamberSystemTypeSelect) chamberSystemTypeSelect.addEventListener('change', function() { updateChamberSystemView(this.value); });
    diagramInletElements.forEach(inletEl => {
        inletEl.addEventListener('click', function() {
            if (this.classList.contains('hidden-inlet')) return;
            const position = this.dataset.position;
            if(inletSelectorErrorDiv) inletSelectorErrorDiv.textContent = '';
            const existingConfigBlock = document.getElementById(`inlet_config_${position.replace(":", "")}`);
            if (existingConfigBlock) {
                activeInletConfigsContainer.removeChild(existingConfigBlock);
                activeInletPositions = activeInletPositions.filter(ip => ip !== position);
                this.classList.remove('selected');
            } else {
                if (activeInletPositions.length < currentMaxInlets) {
                    activeInletPositions.push(position);
                    this.classList.add('selected');
                    createInletConfigBlock(position);
                } else {
                    if(inletSelectorErrorDiv) inletSelectorErrorDiv.textContent = `Maximum ${currentMaxInlets} inlets can be selected for this system type.`;
                }
            }
            validateInletSelection(true);
            updateQuoteAndCode();
        });
    });

    populateDepthOptions();
    if (chamberSystemTypeSelect) updateChamberSystemView(chamberSystemTypeSelect.value || 'SIC_FIC'); else updateChamberSystemView('SIC_FIC'); // Default to SIC/FIC if no value set initially

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (!currentUser) {
            submitStatus.textContent = 'Error: You must be logged in to save configurations.';
            submitStatus.className = 'suds_status_error';
            return;
        }

        let isValid = true;
        form.querySelectorAll('.suds-input, .suds-select').forEach(el => el.style.borderColor = '');
        if(adoptableStatusGroup) adoptableStatusGroup.style.outline = 'none';
        if(document.querySelector('.ic-chamber-diagram')) document.querySelector('.ic-chamber-diagram').style.borderColor = 'transparent';
        if(inletSelectorErrorDiv) inletSelectorErrorDiv.textContent = '';
        const adoptableSelected = form.querySelector('input[name="adoptable_status"]:checked');
        if (!adoptableSelected) { isValid = false; if(adoptableStatusGroup) adoptableStatusGroup.style.outline = '2px solid var(--suds-red)'; }
        const requiredStaticFields = form.querySelectorAll('#chamber_system_type[required], #water_application_type[required], #ic_chamber_depth[required], #ic_chamber_diameter[required]');
        requiredStaticFields.forEach(input => { if ((input.tagName === 'SELECT' && input.value === "") || (input.tagName !== 'SELECT' && !input.value.trim())) { isValid = false; input.style.borderColor = 'var(--suds-red)'; } });
        activeInletPositions.forEach(pos => {
            const safePosId = pos.replace(":", "");
            const configBlock = document.getElementById(`inlet_config_${safePosId}`);
            if (!configBlock) { isValid = false; return; } // Should not happen if activeInletPositions is correct
            configBlock.querySelectorAll('[required]').forEach(input => { if ((input.tagName === 'SELECT' && input.value === "") || (input.tagName !== 'SELECT' && !input.value.trim())) { isValid = false; input.style.borderColor = 'var(--suds-red)'; } });

            // Also validate 'Other' material input if selected
            const materialSelect = configBlock.querySelector('.inlet-material-select');
            const otherInput = configBlock.querySelector('.inlet-other-material');
            if (materialSelect?.value === 'Other' && (!otherInput?.value || !otherInput.value.trim())) {
                isValid = false;
                if (otherInput) otherInput.style.borderColor = 'var(--suds-red)';
            }
        });
        if (!validateInletSelection(false)) isValid = false;
        if (!isValid) {
            submitStatus.textContent = 'Please fill in all required fields and configure selected inlets.';
            submitStatus.className = 'suds_status_error';
            const firstInvalidField = form.querySelector('[style*="border-color: var(--suds-red)"], .ic-chamber-diagram[style*="border-color: var(--suds-red)"], [style*="outline"]');
            if (firstInvalidField) {
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstInvalidField.tagName !== 'SELECT' && firstInvalidField.type !== 'radio' && !firstInvalidField.classList.contains('ic-chamber-diagram')) {
                    firstInvalidField.focus();
                }
            } return;
        }

        const payload = buildJsonPayload();
        const projectName = customerProjectNameInput.value.trim() || DEFAULT_PROJECT_NAME;

        const urlParams = new URLSearchParams(window.location.search);
        const prefillId = urlParams.get('prefillId');

        try {
            // Correct path for saving: users/[UID]/projects/[ProjectName]/configurations/[configId]
            const configsCollectionRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, projectName, CONFIGURATIONS_SUBCOLLECTION);

            let configDocRef;
            if (prefillId) {
                configDocRef = doc(configsCollectionRef, prefillId);
                payload.firestoreId = prefillId;
                payload.savedId = prefillId;
                payload.source = urlParams.get('source') || payload.source;
                payload.configured = true;
            } else {
                configDocRef = doc(configsCollectionRef);
                payload.firestoreId = configDocRef.id;
                payload.savedId = configDocRef.id;
            }

            payload.savedTimestamp = new Date().toISOString();

            // Diagnostic log:
            console.log("Attempting to save Universal Chamber configuration to:", configDocRef.path);
            console.log("Payload:", JSON.stringify(payload, null, 2));


            await setDoc(configDocRef, payload);

            submitStatus.textContent = `Universal Chamber configuration saved to project "${projectName}"!`;
            submitStatus.className = 'suds_status_success';
            form.reset();
            customerProjectNameInput.value = '';
            resetInlets(); // Reset inlets after successful save
            populateDepthOptions(); // Re-populate depth options for clean state
            if (chamberSystemTypeSelect) updateChamberSystemView(chamberSystemTypeSelect.value || 'SIC_FIC'); // Reset system view


            if (prefillId) {
                 const newUrl = new URL(window.location.href);
                 newUrl.searchParams.delete('prefillId');
                 newUrl.searchParams.delete('projectName');
                 newUrl.searchParams.delete('source');
                 window.history.replaceState({}, document.title, newUrl.pathname);
            }

        } catch (firebaseError) {
            console.error("Error saving configuration to Firestore:", firebaseError);
            submitStatus.textContent = 'Saving configuration failed: ' + (firebaseError.message || 'Unknown error.');
            submitStatus.className = 'suds_status_error';
        }
    });

    window.buildUniversalChamberJsonPayload = buildJsonPayload;

    function buildJsonPayload() {
        const formData = new FormData(form); const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        const payload = {
            product_type: "universal_chamber",
            system_type_selection: formData.get('chamber_system_type'),
            water_application_selection: formData.get('water_application_type'),
            adoptable_status: formData.get('adoptable_status'),
            derived_product_name: getProductName(),
            generated_product_code: productCodeDisplay.textContent.startsWith('Please') ? null : productCodeDisplay.textContent,
            main_chamber: { chamber_depth_mm: parseFloat(formData.get('ic_chamber_depth')) || null, chamber_diameter: formData.get('ic_chamber_diameter') },
            inlets: [],
            quote_details: { items: quote.items, cost_price: costPrice, profit_markup_percent: markupPercent, estimated_sell_price: sellPrice }
        };
        activeInletPositions.forEach(pos => {
            const safePosId = pos.replace(":", "");
            const pipeSizeSelect = form.querySelector(`#inlet_pipe_size_${safePosId}`);
            const pipeMaterialSelect = form.querySelector(`#inlet_pipe_material_${safePosId}`);
            const inletData = { position: pos, pipe_size: pipeSizeSelect?.value || null, pipe_material: pipeMaterialSelect?.value || null };
            const otherInput = form.querySelector(`#inlet_pipe_material_other_${safePosId}`);
            if (inletData.pipe_material === 'Other' && otherInput) { inletData.pipe_material_other = otherInput.value; }
            payload.inlets.push(inletData);
        });
        return payload;
    }

    // Prefill the form from a config object (for modal editing or AI prefill)
    window.prefillUniversalChamberFormFromConfig = function(config, options = {}) {
        form.reset();
        submitStatus.textContent = '';
        form.querySelectorAll('.suds-input, .suds-select').forEach(el => el.style.borderColor = '');
        if(adoptableStatusGroup) adoptableStatusGroup.style.outline = 'none';
        resetInlets(); // Ensure all inlets are reset visually before prefilling

        if (options.modalMode && customerProjectNameInput) {
            customerProjectNameInput.closest('.suds-form-group')?.classList.add('suds-hide');
        }
        if (options.prefillProjectName && customerProjectNameInput) {
            customerProjectNameInput.value = options.prefillProjectName;
        }

        if (config.system_type_selection && chamberSystemTypeSelect) {
            chamberSystemTypeSelect.value = config.system_type_selection;
            chamberSystemTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (config.water_application_selection && waterApplicationTypeSelect) {
            waterApplicationTypeSelect.value = config.water_application_selection;
        }
        if (config.adoptable_status) {
            const radio = form.querySelector(`input[name="adoptable_status"][value="${config.adoptable_status}"]`);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        if (config.main_chamber) {
            if (config.main_chamber.chamber_depth_mm && chamberDepthSelect) {
                populateDepthOptions();
                chamberDepthSelect.value = config.main_chamber.chamber_depth_mm;
            }
            if (config.main_chamber.chamber_diameter && chamberDiameterSelect) {
                chamberDiameterSelect.value = config.main_chamber.chamber_diameter;
            }
        }
        if (Array.isArray(config.inlets) && config.inlets.length > 0) {
            // Populate activeInletPositions and create config blocks based on config.inlets
            config.inlets.forEach(inlet => {
                if (inlet.position) {
                    const diagramEl = document.querySelector(`.ic-inlet[data-position="${inlet.position}"]`);
                    if (diagramEl && !diagramEl.classList.contains('selected')) {
                        // Directly add to activeInletPositions and create block to avoid max inlet check
                        activeInletPositions.push(inlet.position);
                        diagramEl.classList.add('selected');
                        createInletConfigBlock(inlet.position);
                    }
                }
            });

            // Now, populate values within the newly created config blocks
            config.inlets.forEach(inlet => {
                const safePosId = inlet.position.replace(':', '');
                const sizeSelect = document.getElementById(`inlet_pipe_size_${safePosId}`);
                const materialSelect = document.getElementById(`inlet_pipe_material_${safePosId}`);
                if (sizeSelect && inlet.pipe_size) sizeSelect.value = inlet.pipe_size;
                if (materialSelect && inlet.pipe_material) {
                    materialSelect.value = inlet.pipe_material;
                    materialSelect.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change to show 'Other' field
                }
                if (inlet.pipe_material === 'Other') {
                    const otherInput = document.getElementById(`inlet_pipe_material_other_${safePosId}`);
                    if (otherInput && inlet.pipe_material_other) otherInput.value = inlet.pipe_material_other;
                }
            });
        }
        if (config.quote_details && typeof config.quote_details.profit_markup_percent !== 'undefined') {
            profitMarkupInput.value = config.quote_details.profit_markup_percent;
        }
        updateQuoteAndCode();

        if (config.source === 'manhole_upload' && config.firestoreId && !options.modalMode) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('prefillId', config.firestoreId);
            newUrl.searchParams.set('projectName', options.prefillProjectName || DEFAULT_PROJECT_NAME);
            newUrl.searchParams.set('source', 'manhole_upload');
            window.history.replaceState({}, document.title, newUrl.toString());
            submitStatus.textContent = 'Prefilled from Manhole Schedule. Submit to update this entry.';
            submitStatus.className = 'suds_status_info';
        }
    };
});
