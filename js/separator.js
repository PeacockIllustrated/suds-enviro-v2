// js/separator.js
document.addEventListener('DOMContentLoaded', function() {
    const pricingRules = { /* ... (your existing pricingRules) ... */
        base: 600.00, adoptable_status: {'adoptable': 250.00, 'non_adoptable': 0}, depth_base: 150.00,
        depth_per_150mm_step: 25.00, flow_rate_base: 50.00, flow_rate_per_lps: 15.00,
        pipe_diameter_adder: { '110mm': 0, '160mm': 20.00, '225mm': 50.00, '300mm': 100.00, '450mm': 200.00, '600mm': 350.00 },
        space_multiplier: { 'Compact': 1.0, 'Standard': 1.3, 'Extended': 1.8, 'Bespoke': 3.0 },
        contaminant_adder: { 'Hydrocarbons': 150.00, 'Floatables': 50.00, 'Silt': 100.00 }
    };

    const form = document.getElementById('sudsSeparatorForm');
    const submitStatus = document.getElementById('suds_submit_status');
    const customerProjectNameInput = document.getElementById('customer_project_name'); // New input
    // ... (all other existing DOM references for separator.js)
    const productCodeDisplay = document.getElementById('suds_product_code_display');
    const shoppingListItemsUl = document.getElementById('shopping_list_items');
    const costPriceValueSpan = document.getElementById('cost_price_value');
    const sellPriceValueSpan = document.getElementById('sell_price_value');
    const profitMarkupInput = document.getElementById('profit_markup_percent');
    const chamberDepthSelect = document.getElementById('hds_depth');
    const adoptableStatusGroup = document.getElementById('adoptable_status_group');
    const flowRateInput = document.getElementById('hds_flow_rate');
    const pipeworkDiameterSelect = document.getElementById('hds_pipework_diameter');
    const spaceSelect = document.getElementById('hds_space');
    const contaminantsGroup = document.getElementById('contaminants_group');
    const contaminantsCheckboxes = contaminantsGroup ? Array.from(contaminantsGroup.querySelectorAll('input[type="checkbox"]')) : [];
    const contaminantsErrorDiv = document.getElementById('contaminants_error');


    const projectDataStorageKey = 'sudsUserProjectsData'; // New localStorage key
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    // --- Helper Functions --- (Keep all your existing helper functions)
    function formatCurrency(value) { /* ... no change ... */ return `£${value.toFixed(2)}`; }
    function populateDepthOptions() { /* ... no change, ensure it calls updateQuoteAndCode ... */
        const selectedAdoptable = document.querySelector('input[name="adoptable_status"]:checked');
        const adoptableValue = selectedAdoptable?.value;
        const currentDepthValue = chamberDepthSelect.value;
        chamberDepthSelect.innerHTML = '';
        if (!adoptableValue) {
            chamberDepthSelect.disabled = true; const o = document.createElement('option'); o.value = ""; o.textContent = "-- Select Adoptable Status First --"; chamberDepthSelect.appendChild(o);
            updateQuoteAndCode(); return;
        }
        chamberDepthSelect.disabled = false; const dO = document.createElement('option'); dO.value = ""; dO.textContent = "-- Select Depth --"; chamberDepthSelect.appendChild(dO);
        const minD = 1000; const maxD = (adoptableValue === 'adoptable') ? 3000 : 6000; const inc = 150;
        for (let d = minD; d <= maxD; d += inc) { const o = document.createElement('option'); o.value = d; o.textContent = `${d}mm`; chamberDepthSelect.appendChild(o); }
        if (currentDepthValue && chamberDepthSelect.querySelector(`option[value="${currentDepthValue}"]`)) { chamberDepthSelect.value = currentDepthValue; } else { chamberDepthSelect.value = ""; }
        updateQuoteAndCode();
    }
    function calculateQuote() { /* ... no change ... */
        let totalCost = 0; const items = []; const formData = new FormData(form);
        totalCost += pricingRules.base; items.push({ description: "Separator Base Unit", cost: pricingRules.base });
        const adoptableStatusVal = formData.get('adoptable_status'); if (adoptableStatusVal && pricingRules.adoptable_status[adoptableStatusVal]) { const c = pricingRules.adoptable_status[adoptableStatusVal]; if (c > 0) items.push({ description: `Status: ${adoptableStatusVal.charAt(0).toUpperCase() + adoptableStatusVal.slice(1)}`, cost: c }); totalCost += c; }
        const depth = parseFloat(formData.get('hds_depth')); if (depth && depth >= 1000) { let depthCost = pricingRules.depth_base; const steps = (depth - 1000) / 150; depthCost += steps * pricingRules.depth_per_150mm_step; items.push({ description: `Depth: ${depth}mm`, cost: depthCost }); totalCost += depthCost; }
        const flowRate = parseFloat(formData.get('hds_flow_rate')); if (flowRate && flowRate > 0) { let flowCost = pricingRules.flow_rate_base + (flowRate * pricingRules.flow_rate_per_lps); items.push({ description: `Design Flow: ${flowRate} L/s`, cost: flowCost }); totalCost += flowCost; }
        const pipeDiameter = formData.get('hds_pipework_diameter'); if (pipeDiameter && pricingRules.pipe_diameter_adder[pipeDiameter]) { const c = pricingRules.pipe_diameter_adder[pipeDiameter]; if (c > 0) items.push({ description: `Pipework Connections: ${pipeDiameter}`, cost: c * 2 }); totalCost += (c * 2); }
        const space = formData.get('hds_space'); if (space && pricingRules.space_multiplier[space]) { const multiplier = pricingRules.space_multiplier[space]; if (multiplier !== 1.0) items.push({ description: `Size Class: ${space} (x${multiplier} Base Cost Adj.)`, cost: pricingRules.base * (multiplier - 1) }); totalCost += pricingRules.base * (multiplier - 1); }
        const selectedContaminants = getSelectedContaminants(); let contaminantTotal = 0; selectedContaminants.forEach(cont => { if (pricingRules.contaminant_adder[cont]) { contaminantTotal += pricingRules.contaminant_adder[cont]; } }); if (contaminantTotal > 0) { items.push({ description: `Target Contaminants (${selectedContaminants.join(', ')})`, cost: contaminantTotal }); totalCost += contaminantTotal; }
        return { total: totalCost, items: items };
    }
    function updateQuoteDisplay() { /* ... no change ... */
        const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        shoppingListItemsUl.innerHTML = ''; if (quote.items.length > 0) { quote.items.forEach(item => { const li = document.createElement('li'); li.innerHTML = `<span class="item-description">${item.description}</span><span class="item-cost">${formatCurrency(item.cost)}</span>`; shoppingListItemsUl.appendChild(li); }); } else { shoppingListItemsUl.innerHTML = '<li>Select options to see quote...</li>'; }
        costPriceValueSpan.textContent = formatCurrency(costPrice); sellPriceValueSpan.textContent = formatCurrency(sellPrice);
    }
    function getSelectedContaminants() { /* ... no change ... */ return contaminantsCheckboxes.filter(cb => cb.checked).map(cb => cb.value); }
    function getContaminantCode() { /* ... no change ... */
        const selected = getSelectedContaminants(); let code = "";
        if (selected.includes("Hydrocarbons")) code += "H";
        if (selected.includes("Floatables")) code += "F";
        if (selected.includes("Silt")) code += "S";
        return code || "NONE";
    }
    function updateProductCodeDisplay() { /* ... no change ... */
        const name = "SEHDS";
        const adoptableSelectedValue = document.querySelector('input[name="adoptable_status"]:checked')?.value;
        const depthValue = chamberDepthSelect.value;
        const flowValue = flowRateInput.value;
        const spaceValue = spaceSelect.value;
        const contaminantsCodeValue = getContaminantCode();
        if (!adoptableSelectedValue || !depthValue || !flowRateInput.value.trim() || !spaceValue || contaminantsCodeValue === 'NONE') {
            productCodeDisplay.textContent = 'Please complete selections...'; return;
        }
        const adoptableCode = adoptableSelectedValue === 'adoptable' ? 'AD' : 'NA';
        const depthCode = depthValue;
        const flowCode = flowValue + 'LPS';
        const spaceCode = spaceValue.substring(0, 3).toUpperCase();
        productCodeDisplay.textContent = `${name}-${flowCode}-${spaceCode}-${depthCode}-${contaminantsCodeValue}-${adoptableCode}`;
    }
    function updateQuoteAndCode() { /* ... no change ... */
        updateProductCodeDisplay();
        updateQuoteDisplay();
    }
    // --- End Helper Functions ---

    const elementsTriggeringUpdates = [ /* ... (no change, ensure contaminantsGroup is included if not already) ... */
        chamberDepthSelect, adoptableStatusGroup, flowRateInput, pipeworkDiameterSelect,
        spaceSelect, profitMarkupInput, contaminantsGroup
    ];
    elementsTriggeringUpdates.forEach(el => { /* ... (no change) ... */
        if (el) {
            el.addEventListener('change', updateQuoteAndCode);
            if (el.type === 'number' || el.type === 'text') {
                el.addEventListener('keyup', updateQuoteAndCode);
                el.addEventListener('input', updateQuoteAndCode);
            }
        }
    });
    if (adoptableStatusGroup) { /* ... (no change) ... */
         Array.from(adoptableStatusGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
            radio.addEventListener('change', () => { populateDepthOptions(); });
        });
    }
    if (contaminantsGroup) { /* ... (no change, assuming this was already correct) ... */
        Array.from(contaminantsGroup.querySelectorAll('input[type="checkbox"]')).forEach(checkbox => {
            checkbox.addEventListener('change', updateQuoteAndCode);
        });
    }

    populateDepthOptions(); // Initial call

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        // ... (validation logic remains the same) ...
        let isValid = true;
        form.querySelectorAll('.suds-input, .suds-select').forEach(el => el.style.borderColor = '');
        if(adoptableStatusGroup) adoptableStatusGroup.style.outline = 'none';
        if(contaminantsErrorDiv) contaminantsErrorDiv.textContent = '';
        if(contaminantsGroup) contaminantsGroup.style.outline = 'none';
        const adoptableSelected = form.querySelector('input[name="adoptable_status"]:checked');
        if (!adoptableSelected) { isValid = false; if(adoptableStatusGroup) adoptableStatusGroup.style.outline = '2px solid var(--suds-red)'; }
        const selectedContaminants = getSelectedContaminants();
        if (selectedContaminants.length === 0) {
            isValid = false;
            if(contaminantsErrorDiv) contaminantsErrorDiv.textContent = 'Please select at least one target contaminant.';
            if(contaminantsGroup) contaminantsGroup.style.outline = '2px solid var(--suds-red)';
        }
        const requiredStaticFields = form.querySelectorAll('#hds_depth[required], #hds_flow_rate[required], #hds_pipework_diameter[required], #hds_space[required]');
        requiredStaticFields.forEach(input => { if ((input.tagName === 'SELECT' && input.value === "") || (input.tagName !== 'SELECT' && !input.value.trim())) { isValid = false; input.style.borderColor = 'var(--suds-red)'; } });
        if (!isValid) {
            submitStatus.textContent = 'Please fill in all required fields.'; submitStatus.className = 'suds_status_error';
            const firstInvalidField = form.querySelector('[style*="border-color: var(--suds-red)"], [style*="outline"]');
            if (firstInvalidField) {
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstInvalidField.tagName !== 'SELECT' && firstInvalidField.type !== 'radio' && firstInvalidField.type !== 'checkbox' && firstInvalidField.id !== 'contaminants_group') {
                    firstInvalidField.focus();
                }
            } return;
        }
        // --- END Validation ---

        const payload = buildJsonPayload();
        const projectName = customerProjectNameInput.value.trim() || DEFAULT_PROJECT_NAME;

        // Check for prefillId in URL
        const urlParams = new URLSearchParams(window.location.search);
        const prefillId = urlParams.get('prefillId');

        try {
            let allProjects = {};
            const existingProjectsRaw = localStorage.getItem(projectDataStorageKey);
            if (existingProjectsRaw) {
                try {
                    allProjects = JSON.parse(existingProjectsRaw);
                    if (typeof allProjects !== 'object' || allProjects === null) allProjects = {};
                } catch (e) {
                    allProjects = {};
                }
            }
            if (!allProjects[projectName]) {
                allProjects[projectName] = [];
            }

            // If prefillId is present, replace the matching config
            let replaced = false;
            if (prefillId) {
                const idx = allProjects[projectName].findIndex(cfg => cfg.savedId === prefillId);
                if (idx !== -1) {
                    // Preserve the source tag and any other visual tags
                    payload.source = allProjects[projectName][idx].source || undefined;
                    payload.savedId = prefillId;
                    payload.savedTimestamp = new Date().toISOString();
                    allProjects[projectName][idx] = payload;
                    replaced = true;
                }
            }
            if (!replaced) {
                payload.savedId = `suds-sep-${Date.now()}`;
                payload.savedTimestamp = new Date().toISOString();
                allProjects[projectName].push(payload);
            }
            localStorage.setItem(projectDataStorageKey, JSON.stringify(allProjects));
            submitStatus.textContent = replaced ? 'Configuration updated and replaced original manhole-uploaded component.' : `Separator configuration saved to project: ${projectName}!`;
            submitStatus.className = 'suds_status_success';
            form.reset();
            customerProjectNameInput.value = '';
            populateDepthOptions();
            updateQuoteDisplay();
        } catch (storageError) {
            submitStatus.textContent = 'Saving to local storage failed: ' + (storageError.message || 'Unknown error.');
            submitStatus.className = 'suds_status_error';
        }
    });

    function buildJsonPayload() { /* ... (no change from your existing function) ... */
        const formData = new FormData(form); const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        const payload = { product_type: "hydrodynamic_separator", adoptable_status: formData.get('adoptable_status'), derived_product_name: "SEHDS " + (formData.get('hds_flow_rate') || 'N/A') + "LPS", generated_product_code: productCodeDisplay.textContent.startsWith('Please') ? null : productCodeDisplay.textContent, separator_details: { depth_mm: parseFloat(formData.get('hds_depth')) || null, flow_rate_lps: parseFloat(formData.get('hds_flow_rate')) || null, pipework_diameter: formData.get('hds_pipework_diameter'), space_available: formData.get('hds_space'), target_contaminants: getSelectedContaminants() }, quote_details: { items: quote.items, cost_price: costPrice, profit_markup_percent: markupPercent, estimated_sell_price: sellPrice } };
        return payload;
    }

    window.prefillFormFromAIScheduleData = function(data) { /* ... (no change - still a placeholder) ... */
        console.log("Attempting to prefill Separator form with AI data:", data);
        updateQuoteAndCode();
    };

    // --- Modal Prefill and Modal Mode Support ---
    // Prefill the form from a config object (for modal editing)
    window.prefillSeparatorFormFromConfig = function(config, options = {}) {
        if (!config || typeof config !== 'object') return;
        // Remove project/customer input if in modal mode
        if (options.modalMode && customerProjectNameInput) {
            customerProjectNameInput.closest('.suds-form-group')?.classList.add('suds-hide');
        }
        // Adoptable status
        if (config.adoptable_status) {
            const radio = form.querySelector(`input[name="adoptable_status"][value="${config.adoptable_status}"]`);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        // Separator details
        if (config.separator_details) {
            if (config.separator_details.depth_mm && chamberDepthSelect) {
                populateDepthOptions();
                chamberDepthSelect.value = config.separator_details.depth_mm;
            }
            if (typeof config.separator_details.flow_rate_lps !== 'undefined' && flowRateInput) {
                flowRateInput.value = config.separator_details.flow_rate_lps;
            }
            if (config.separator_details.pipework_diameter && pipeworkDiameterSelect) {
                pipeworkDiameterSelect.value = config.separator_details.pipework_diameter;
            }
            if (config.separator_details.space_available && spaceSelect) {
                spaceSelect.value = config.separator_details.space_available;
            }
            if (Array.isArray(config.separator_details.target_contaminants) && contaminantsGroup) {
                Array.from(contaminantsGroup.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
                    cb.checked = config.separator_details.target_contaminants.includes(cb.value);
                });
            }
        }
        // Quote details
        if (config.quote_details && typeof config.quote_details.profit_markup_percent !== 'undefined') {
            profitMarkupInput.value = config.quote_details.profit_markup_percent;
        }
        updateProductCodeDisplay();
        updateQuoteDisplay();
    };

    // Utility for modal: reset/hide project/customer input
    window.setSeparatorModalMode = function(isModal) {
        if (customerProjectNameInput) {
            const group = customerProjectNameInput.closest('.suds-form-group');
            if (group) group.style.display = isModal ? 'none' : '';
        }
    };
    // --- End Modal Prefill and Modal Mode Support ---
});
