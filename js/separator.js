// js/separator.js
import { auth, db } from './firebase-init.js';
import { collection, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    const pricingRules = {
        base: 600.00, adoptable_status: {'adoptable': 250.00, 'non_adoptable': 0}, depth_base: 150.00,
        depth_per_150mm_step: 25.00, flow_rate_base: 50.00, flow_rate_per_lps: 15.00,
        pipe_diameter_adder: { '110mm': 0, '160mm': 20.00, '225mm': 50.00, '300mm': 100.00, '450mm': 200.00, '600mm': 350.00 },
        space_multiplier: { 'Compact': 1.0, 'Standard': 1.3, 'Extended': 1.8, 'Bespoke': 3.0 },
        contaminant_adder: { 'Hydrocarbons': 150.00, 'Floatables': 50.00, 'Silt': 100.00 }
    };

    const form = document.getElementById('sudsSeparatorForm');
    const submitStatus = document.getElementById('suds_submit_status');
    const customerProjectNameInput = document.getElementById('customer_project_name');
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

    const USERS_COLLECTION = 'users';
    const PROJECTS_SUBCOLLECTION = 'projects';
    const CONFIGURATIONS_SUBCOLLECTION = 'configurations';
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    let currentUser = null; // To store the authenticated user

    // --- Firebase Auth State Listener ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (currentUser) {
            console.log("Separator Configurator: User is logged in.", currentUser.uid);
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
            submitStatus.textContent = 'Ready to save configuration.';
            submitStatus.className = '';
        } else {
            console.log("Separator Configurator: User is NOT logged in. Disabling form.");
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
            submitStatus.textContent = 'Please log in to use the configurator.';
            submitStatus.className = 'suds_status_error';
            form.reset();
            populateDepthOptions();
            // Clear any selected checkboxes visually if form.reset doesn't handle it fully
            contaminantsCheckboxes.forEach(cb => cb.checked = false);
        }
    });

    function formatCurrency(value) { return `£${value.toFixed(2)}`; }
    function populateDepthOptions() {
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
    function calculateQuote() {
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
    function updateQuoteDisplay() {
        const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        shoppingListItemsUl.innerHTML = ''; if (quote.items.length > 0) { quote.items.forEach(item => { const li = document.createElement('li'); li.innerHTML = `<span class="item-description">${item.description}</span><span class="item-cost">${formatCurrency(item.cost)}</span>`; shoppingListItemsUl.appendChild(li); }); } else { shoppingListItemsUl.innerHTML = '<li>Select options to see quote...</li>'; }
        costPriceValueSpan.textContent = formatCurrency(costPrice); sellPriceValueSpan.textContent = formatCurrency(sellPrice);
    }
    function getSelectedContaminants() { return contaminantsCheckboxes.filter(cb => cb.checked).map(cb => cb.value); }
    function getContaminantCode() {
        const selected = getSelectedContaminants(); let code = "";
        if (selected.includes("Hydrocarbons")) code += "H";
        if (selected.includes("Floatables")) code += "F";
        if (selected.includes("Silt")) code += "S";
        return code || "NONE";
    }
    function updateProductCodeDisplay() {
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
    function updateQuoteAndCode() {
        updateProductCodeDisplay();
        updateQuoteDisplay();
    }

    const elementsTriggeringUpdates = [
        chamberDepthSelect, adoptableStatusGroup, flowRateInput, pipeworkDiameterSelect,
        spaceSelect, profitMarkupInput, contaminantsGroup
    ];
    elementsTriggeringUpdates.forEach(el => {
        if (el) {
            el.addEventListener('change', updateQuoteAndCode);
            if (el.type === 'number' || el.type === 'text') {
                el.addEventListener('keyup', updateQuoteAndCode);
                el.addEventListener('input', updateQuoteAndCode);
            }
        }
    });
    if (adoptableStatusGroup) {
         Array.from(adoptableStatusGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
            radio.addEventListener('change', () => { populateDepthOptions(); });
        });
    }
    if (contaminantsGroup) {
        Array.from(contaminantsGroup.querySelectorAll('input[type="checkbox"]')).forEach(checkbox => {
            checkbox.addEventListener('change', updateQuoteAndCode);
        });
    }

    populateDepthOptions();

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
            console.log("Attempting to save Separator configuration to:", configDocRef.path);
            console.log("Payload:", JSON.stringify(payload, null, 2));


            await setDoc(configDocRef, payload);

            submitStatus.textContent = `Separator configuration saved to project "${projectName}"!`;
            submitStatus.className = 'suds_status_success';
            form.reset();
            customerProjectNameInput.value = '';
            populateDepthOptions();
            updateQuoteDisplay();

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

    window.buildSeparatorJsonPayload = buildJsonPayload;

    function buildJsonPayload() {
        const formData = new FormData(form); const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        const payload = { product_type: "hydrodynamic_separator", adoptable_status: formData.get('adoptable_status'), derived_product_name: "SEHDS " + (formData.get('hds_flow_rate') || 'N/A') + "LPS", generated_product_code: productCodeDisplay.textContent.startsWith('Please') ? null : productCodeDisplay.textContent, separator_details: { depth_mm: parseFloat(formData.get('hds_depth')) || null, flow_rate_lps: parseFloat(formData.get('hds_flow_rate')) || null, pipework_diameter: formData.get('hds_pipework_diameter'), space_available: formData.get('hds_space'), target_contaminants: getSelectedContaminants() }, quote_details: { items: quote.items, cost_price: costPrice, profit_markup_percent: markupPercent, estimated_sell_price: sellPrice } };
        return payload;
    }

    window.prefillSeparatorFormFromConfig = function(config, options = {}) {
        form.reset();
        submitStatus.textContent = '';
        form.querySelectorAll('.suds-input, .suds-select').forEach(el => el.style.borderColor = '');
        if(adoptableStatusGroup) adoptableStatusGroup.style.outline = 'none';
        if(contaminantsErrorDiv) contaminantsErrorDiv.textContent = '';
        contaminantsCheckboxes.forEach(cb => cb.checked = false); // Ensure checkboxes are cleared

        if (options.modalMode && customerProjectNameInput) {
            customerProjectNameInput.closest('.suds-form-group')?.classList.add('suds-hide');
        }
        if (options.prefillProjectName && customerProjectNameInput) {
            customerProjectNameInput.value = options.prefillProjectName;
        }

        if (config.adoptable_status) {
            const radio = form.querySelector(`input[name="adoptable_status"][value="${config.adoptable_status}"]`);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
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
                config.separator_details.target_contaminants.forEach(cont => {
                    const cb = form.querySelector(`input[name="target_contaminants[]"][value="${cont}"]`);
                    if (cb) cb.checked = true;
                });
            }
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
