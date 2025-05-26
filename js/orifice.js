// js/orifice.js
import { auth, db } from './firebase-init.js';
import { collection, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    const pricingRules = {
        base: 70.00, adoptable_status: {'adoptable': 60.00, 'non_adoptable': 0}, depth_base: 80.00,
        depth_per_150mm_step: 15.00, diameter: {'315mm': 0, '450mm': 50.00, '600mm': 110.00, '1050mm': 280.00},
        pipe_size_connection: { '110mm': 10.00, '160mm': 15.00, '225mm': 25.00 },
        orifice_plate_base: 45.00, orifice_diameter_adder: 0.25, bypass_adder: 120.00
    };

    const form = document.getElementById('sudsOrificeForm');
    const submitStatus = document.getElementById('suds_submit_status');
    const productCodeDisplay = document.getElementById('suds_product_code_display');
    const shoppingListItemsUl = document.getElementById('shopping_list_items');
    const costPriceValueSpan = document.getElementById('cost_price_value');
    const sellPriceValueSpan = document.getElementById('sell_price_value');
    const profitMarkupInput = document.getElementById('profit_markup_percent');
    const customerProjectNameInput = document.getElementById('customer_project_name');

    const chamberDepthSelect = document.getElementById('ofc_chamber_depth');
    const chamberDiameterSelect = document.getElementById('ofc_chamber_diameter');
    const adoptableStatusGroup = document.getElementById('adoptable_status_group');
    const pipeworkSizeSelect = document.getElementById('ofc_pipework_size');
    const targetFlowInput = document.getElementById('ofc_target_flow');
    const headHeightInput = document.getElementById('ofc_head_height');
    const orificeDiameterInput = document.getElementById('ofc_orifice_diameter');
    const bypassGroup = document.getElementById('bypass_group');

    const USERS_COLLECTION = 'users';
    const PROJECTS_SUBCOLLECTION = 'projects';
    const CONFIGURATIONS_SUBCOLLECTION = 'configurations';
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    let currentUser = null; // To store the authenticated user

    // --- Firebase Auth State Listener ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (currentUser) {
            console.log("Orifice Configurator: User is logged in.", currentUser.uid);
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
            submitStatus.textContent = 'Ready to save configuration.';
            submitStatus.className = '';
        } else {
            console.log("Orifice Configurator: User is NOT logged in. Disabling form.");
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
            submitStatus.textContent = 'Please log in to use the configurator.';
            submitStatus.className = 'suds_status_error';
            form.reset();
            populateDepthOptions();
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
        const minD = 600; const maxD = (adoptableValue === 'adoptable') ? 3000 : 6000; const inc = 150;
        for (let d = minD; d <= maxD; d += inc) { const o = document.createElement('option'); o.value = d; o.textContent = `${d}mm`; chamberDepthSelect.appendChild(o); }
        if (currentDepthValue && chamberDepthSelect.querySelector(`option[value="${currentDepthValue}"]`)) { chamberDepthSelect.value = currentDepthValue; } else { chamberDepthSelect.value = ""; }
        updateQuoteAndCode();
    }

    function calculateQuote() {
        let totalCost = 0; const items = []; const formData = new FormData(form);
        totalCost += pricingRules.base; items.push({ description: "Orifice Chamber Base", cost: pricingRules.base });
        const adoptableStatus = formData.get('adoptable_status'); if (adoptableStatus && pricingRules.adoptable_status[adoptableStatus]) { const c = pricingRules.adoptable_status[adoptableStatus]; if (c > 0) items.push({ description: `Status: ${adoptableStatus.charAt(0).toUpperCase() + adoptableStatus.slice(1)}`, cost: c }); totalCost += c; }
        const depth = parseFloat(formData.get('ofc_chamber_depth')); if (depth && depth >= 600) { let depthCost = pricingRules.depth_base; const steps = (depth - 600) / 150; depthCost += steps * pricingRules.depth_per_150mm_step; items.push({ description: `Depth: ${depth}mm`, cost: depthCost }); totalCost += depthCost; }
        const diameter = formData.get('ofc_chamber_diameter'); if (diameter && pricingRules.diameter[diameter]) { const c = pricingRules.diameter[diameter]; if (c > 0) items.push({ description: `Diameter: ${diameter}`, cost: c }); totalCost += c; }
        const pipeSize = formData.get('ofc_pipework_size'); if (pipeSize && pricingRules.pipe_size_connection[pipeSize]) { const connectionCost = pricingRules.pipe_size_connection[pipeSize] * 2; items.push({ description: `Inlet/Outlet Connections (${pipeSize})`, cost: connectionCost }); totalCost += connectionCost; }
        let plateCost = pricingRules.orifice_plate_base;
        const orificeDiameter = parseFloat(formData.get('ofc_orifice_diameter'));
        if (orificeDiameter && orificeDiameter > 0) {
            plateCost += orificeDiameter * pricingRules.orifice_diameter_adder;
            items.push({ description: `Orifice Plate (${orificeDiameter}mm)`, cost: plateCost });
        } else {
            items.push({ description: `Orifice Plate (Standard/Calculated)`, cost: plateCost });
        }
        totalCost += plateCost;
        const bypassRequired = formData.get('bypass_required'); if (bypassRequired === 'yes') { items.push({ description: "Bypass Included", cost: pricingRules.bypass_adder }); totalCost += pricingRules.bypass_adder; }
        return { total: totalCost, items: items };
    }

    function updateQuoteDisplay() {
        const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        shoppingListItemsUl.innerHTML = ''; if (quote.items.length > 0) { quote.items.forEach(item => { const li = document.createElement('li'); li.innerHTML = `<span class="item-description">${item.description}</span><span class="item-cost">${formatCurrency(item.cost)}</span>`; shoppingListItemsUl.appendChild(li); }); } else { shoppingListItemsUl.innerHTML = '<li>Select options to see quote...</li>'; }
        costPriceValueSpan.textContent = formatCurrency(costPrice); sellPriceValueSpan.textContent = formatCurrency(sellPrice);
    }

    function updateProductCodeDisplay() {
        const adoptableSelected = form.querySelector('input[name="adoptable_status"]:checked');
        const adoptableCode = adoptableSelected ? (adoptableSelected.value === 'adoptable' ? 'AD' : 'NA') : 'ADSTAT';
        const depth = chamberDepthSelect.value || 'DEPTH';
        const diameter = chamberDiameterSelect.value ? chamberDiameterSelect.value.replace('mm', '') : 'DIAM';
        const flow = targetFlowInput.value ? targetFlowInput.value + 'LPS' : 'FLOW';
        const head = headHeightInput.value ? headHeightInput.value + 'MHD' : 'HEAD';
        const bypassCode = document.querySelector('input[name="bypass_required"]:checked')?.value === 'yes' ? '-BY' : '';

        if (depth === 'DEPTH' || diameter === 'DIAM' || flow === 'FLOW' || head === 'HEAD' || !adoptableSelected || !chamberDepthSelect.value || !targetFlowInput.value.trim() || !headHeightInput.value.trim() || !chamberDiameterSelect.value) {
            productCodeDisplay.textContent = 'Please complete selections...';
            return;
        }
        productCodeDisplay.textContent = `OFC-${diameter}-${depth}-${flow}-${head}-${adoptableCode}${bypassCode}`;
    }

    function updateQuoteAndCode() {
        updateProductCodeDisplay();
        updateQuoteDisplay();
    }

    const elementsTriggeringUpdates = [
        chamberDepthSelect, chamberDiameterSelect, adoptableStatusGroup, pipeworkSizeSelect,
        targetFlowInput, headHeightInput, orificeDiameterInput, profitMarkupInput, bypassGroup
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
    if (bypassGroup) {
        Array.from(bypassGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
           radio.addEventListener('change', updateQuoteAndCode);
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
        const adoptableSelected = form.querySelector('input[name="adoptable_status"]:checked');
        if (!adoptableSelected) { isValid = false; if(adoptableStatusGroup) adoptableStatusGroup.style.outline = '2px solid var(--suds-red)'; }
        const requiredStaticFields = form.querySelectorAll('#ofc_chamber_depth[required], #ofc_chamber_diameter[required], #ofc_pipework_size[required], #ofc_target_flow[required], #ofc_head_height[required]');
        requiredStaticFields.forEach(input => { if ((input.tagName === 'SELECT' && input.value === "") || (input.tagName !== 'SELECT' && !input.value.trim())) { isValid = false; input.style.borderColor = 'var(--suds-red)'; } });
        if (!isValid) {
            submitStatus.textContent = 'Please fill in all required fields.'; submitStatus.className = 'suds_status_error';
            const firstInvalidField = form.querySelector('[style*="border-color: var(--suds-red)"], [style*="outline"]');
            if (firstInvalidField) {
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstInvalidField.tagName !== 'SELECT' && firstInvalidField.type !== 'radio') {
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
            console.log("Attempting to save Orifice configuration to:", configDocRef.path);
            console.log("Payload:", JSON.stringify(payload, null, 2));

            await setDoc(configDocRef, payload);

            submitStatus.textContent = `Orifice configuration saved to project "${projectName}"!`;
            submitStatus.className = 'suds_status_success';
            form.reset();
            customerProjectNameInput.value = '';
            populateDepthOptions();
            updateProductCodeDisplay();
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

    window.buildOrificeJsonPayload = buildJsonPayload;

    function buildJsonPayload() {
        const formData = new FormData(form); const quote = calculateQuote(); const costPrice = quote.total; const markupPercent = parseFloat(profitMarkupInput.value) || 0; const sellPrice = costPrice * (1 + markupPercent / 100);
        const derivedProductName = `OFC ${formData.get('ofc_target_flow') || 'N/A'}LPS`;
        const payload = {
            product_type: "orifice_flow_control",
            adoptable_status: formData.get('adoptable_status'),
            derived_product_name: derivedProductName,
            generated_product_code: productCodeDisplay.textContent.startsWith('Please') ? null : productCodeDisplay.textContent,
            chamber_details: { chamber_depth_mm: parseFloat(formData.get('ofc_chamber_depth')) || null, chamber_diameter: formData.get('ofc_chamber_diameter'), pipework_size: formData.get('ofc_pipework_size') },
            flow_control_params: { target_flow_lps: parseFloat(formData.get('ofc_target_flow')) || null, design_head_m: parseFloat(formData.get('ofc_head_height')) || null, orifice_diameter_mm: parseFloat(formData.get('ofc_orifice_diameter')) || null, bypass_required: formData.get('bypass_required') === 'yes' },
            quote_details: { items: quote.items, cost_price: costPrice, profit_markup_percent: markupPercent, estimated_sell_price: sellPrice }
        };
        return payload;
    }

    // Prefill the form from a config object (for modal editing or AI prefill)
    window.prefillOrificeFormFromConfig = function(config, options = {}) {
        form.reset();
        submitStatus.textContent = '';
        form.querySelectorAll('.suds-input, .suds-select').forEach(el => el.style.borderColor = '');
        if(adoptableStatusGroup) adoptableStatusGroup.style.outline = 'none';

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
        if (config.chamber_details) {
            if (config.chamber_details.chamber_depth_mm && chamberDepthSelect) {
                populateDepthOptions();
                chamberDepthSelect.value = config.chamber_details.chamber_depth_mm;
            }
            if (config.chamber_details.chamber_diameter && chamberDiameterSelect) {
                chamberDiameterSelect.value = config.chamber_details.chamber_diameter;
            }
            if (config.chamber_details.pipework_size && pipeworkSizeSelect) {
                pipeworkSizeSelect.value = config.chamber_details.pipework_size;
            }
        }
        if (config.flow_control_params) {
            if (typeof config.flow_control_params.target_flow_lps !== 'undefined' && targetFlowInput) {
                targetFlowInput.value = config.flow_control_params.target_flow_lps;
            }
            if (typeof config.flow_control_params.design_head_m !== 'undefined' && headHeightInput) {
                headHeightInput.value = config.flow_control_params.design_head_m;
            }
            if (typeof config.flow_control_params.orifice_diameter_mm !== 'undefined' && orificeDiameterInput) {
                orificeDiameterInput.value = config.flow_control_params.orifice_diameter_mm;
            }
            if (typeof config.flow_control_params.bypass_required !== 'undefined') {
                const val = config.flow_control_params.bypass_required ? 'yes' : 'no';
                const radio = form.querySelector(`input[name="bypass_required"][value="${val}"]`);
                if (radio) radio.checked = true;
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
