// js/catchpit.js
document.addEventListener('DOMContentLoaded', function() {
    const pricingRules = { /* ... (your existing pricingRules) ... */
        base: 40.00,
        type_adder: { 'Standard': 0, 'Bucket': 30.00, 'Dual Filter': 75.00 },
        adoptable_status: {'adoptable': 50.00, 'non_adoptable': 0},
        depth_base: 50.00,
        depth_per_150mm_step: 10.00,
        pipe_diameter_adder: { '110mm': 0, '160mm': 5.00, '225mm': 15.00 },
        pollutant_adder: { 'Silt': 0, 'Leaves': 10.00, 'Oils': 50.00, 'All': 70.00 },
        removable_bucket_adder: 20.00
    };

    const form = document.getElementById('sudsCatchpitForm');
    const submitStatus = document.getElementById('suds_submit_status');
    const productCodeDisplay = document.getElementById('suds_product_code_display');
    const shoppingListItemsUl = document.getElementById('shopping_list_items');
    const costPriceValueSpan = document.getElementById('cost_price_value');
    const sellPriceValueSpan = document.getElementById('sell_price_value');
    const profitMarkupInput = document.getElementById('profit_markup_percent');
    const customerProjectNameInput = document.getElementById('customer_project_name'); // New input

    const catchpitTypeSelect = document.getElementById('cp_type');
    const chamberDepthSelect = document.getElementById('cp_depth');
    const adoptableStatusGroup = document.getElementById('adoptable_status_group');
    const pipeworkDiameterSelect = document.getElementById('cp_pipework_diameter');
    const targetPollutantSelect = document.getElementById('cp_target_pollutant');
    const removableBucketGroup = document.getElementById('removable_bucket_group');

    const projectDataStorageKey = 'sudsUserProjectsData'; // New localStorage key
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    // --- Migration for old data (run once) ---
    function migrateOldConfigs() {
        const oldConfigKey = 'sudsSavedConfigs';
        const oldDataRaw = localStorage.getItem(oldConfigKey);
        const newDataRaw = localStorage.getItem(projectDataStorageKey);

        if (oldDataRaw && !newDataRaw) { // Only migrate if old exists and new doesn't
            try {
                const oldConfigs = JSON.parse(oldDataRaw);
                if (Array.isArray(oldConfigs) && oldConfigs.length > 0) {
                    const migratedProjects = {
                        "_MIGRATED_DEFAULT_": oldConfigs
                    };
                    localStorage.setItem(projectDataStorageKey, JSON.stringify(migratedProjects));
                    // localStorage.removeItem(oldConfigKey); // Optionally remove old key after successful migration
                    console.log("Old configurations migrated to new project structure.");
                    alert("Previously saved configurations have been moved to a default migrated project category.");
                } else if (Array.isArray(oldConfigs) && oldConfigs.length === 0) {
                    // localStorage.removeItem(oldConfigKey); // Remove empty old array
                }
            } catch (e) {
                console.error("Error migrating old configurations:", e);
            }
        }
    }
    migrateOldConfigs(); // Call migration check on script load
    // --- End Migration ---


    function formatCurrency(value) { return `£${value.toFixed(2)}`; }

    function populateDepthOptions() { /* ... (no change from your existing function) ... */
        const selectedAdoptable = document.querySelector('input[name="adoptable_status"]:checked');
        const adoptableValue = selectedAdoptable?.value;
        const currentDepthValue = chamberDepthSelect.value;
        chamberDepthSelect.innerHTML = '';
        if (!adoptableValue) {
            chamberDepthSelect.disabled = true;
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-- Select Adoptable Status First --";
            chamberDepthSelect.appendChild(defaultOption);
            updateProductCodeDisplay();
            updateQuoteDisplay();
            return;
        }
        chamberDepthSelect.disabled = false;
        const selectDepthOption = document.createElement('option');
        selectDepthOption.value = "";
        selectDepthOption.textContent = "-- Select Depth --";
        chamberDepthSelect.appendChild(selectDepthOption);
        const minDepth = 600;
        const maxDepth = (adoptableValue === 'adoptable') ? 3000 : 6000;
        const increment = 150;
        for (let depth = minDepth; depth <= maxDepth; depth += increment) {
            const option = document.createElement('option');
            option.value = depth;
            option.textContent = `${depth}mm`;
            chamberDepthSelect.appendChild(option);
        }
        if (currentDepthValue && chamberDepthSelect.querySelector(`option[value="${currentDepthValue}"]`)) {
            chamberDepthSelect.value = currentDepthValue;
        } else {
            chamberDepthSelect.value = "";
        }
        updateProductCodeDisplay();
        updateQuoteDisplay();
    }

    function calculateQuote() { /* ... (no change from your existing function) ... */
        let totalCost = 0;
        const items = [];
        const formData = new FormData(form);
        totalCost += pricingRules.base;
        items.push({ description: "Catchpit Base Unit", cost: pricingRules.base });
        const cpType = formData.get('cp_type');
        if (cpType && pricingRules.type_adder[cpType]) {
            const cost = pricingRules.type_adder[cpType];
            if (cost > 0) items.push({ description: `Type: ${cpType}`, cost: cost });
            totalCost += cost;
        }
        const adoptableStatus = formData.get('adoptable_status');
        if (adoptableStatus && pricingRules.adoptable_status[adoptableStatus]) {
            const cost = pricingRules.adoptable_status[adoptableStatus];
            if (cost > 0) items.push({ description: `Status: ${adoptableStatus.charAt(0).toUpperCase() + adoptableStatus.slice(1)}`, cost: cost });
            totalCost += cost;
        }
        const depth = parseFloat(formData.get('cp_depth'));
        if (depth && depth >= 600) {
            let depthCost = pricingRules.depth_base;
            const steps = (depth - 600) / 150;
            depthCost += steps * pricingRules.depth_per_150mm_step;
            items.push({ description: `Depth: ${depth}mm`, cost: depthCost });
            totalCost += depthCost;
        }
        const pipeDiameter = formData.get('cp_pipework_diameter');
        if (pipeDiameter && pricingRules.pipe_diameter_adder[pipeDiameter]) {
            const cost = pricingRules.pipe_diameter_adder[pipeDiameter];
            if (cost > 0) items.push({ description: `Pipe Connections: ${pipeDiameter}`, cost: cost * 2 });
            totalCost += (cost * 2);
        }
        const pollutant = formData.get('cp_target_pollutant');
        if (pollutant && pricingRules.pollutant_adder[pollutant]) {
            const cost = pricingRules.pollutant_adder[pollutant];
            if (cost > 0) items.push({ description: `Target: ${pollutant}`, cost: cost });
            totalCost += cost;
        }
        const removableBucket = formData.get('removable_bucket');
        if (removableBucket === 'yes') {
            items.push({ description: "Removable Bucket", cost: pricingRules.removable_bucket_adder });
            totalCost += pricingRules.removable_bucket_adder;
        }
        return { total: totalCost, items: items };
    }

    function updateQuoteDisplay() { /* ... (no change from your existing function) ... */
        const quote = calculateQuote();
        const costPrice = quote.total;
        const markupPercent = parseFloat(profitMarkupInput.value) || 0;
        const sellPrice = costPrice * (1 + markupPercent / 100);
        shoppingListItemsUl.innerHTML = '';
        if (quote.items.length > 0) {
            quote.items.forEach(item => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span class="item-description">${item.description}</span><span class="item-cost">${formatCurrency(item.cost)}</span>`;
                shoppingListItemsUl.appendChild(listItem);
            });
        } else {
            shoppingListItemsUl.innerHTML = '<li>Select options to see quote...</li>';
        }
        costPriceValueSpan.textContent = formatCurrency(costPrice);
        sellPriceValueSpan.textContent = formatCurrency(sellPrice);
    }

    function getShortCode(value, mapping) { /* ... (no change) ... */
        return mapping[value] || value.substring(0, 3).toUpperCase();
    }

    function updateProductCodeDisplay() { /* ... (no change from your existing function) ... */
        const name = "SECP";
        const typeCodeMapping = { "Standard": "STD", "Bucket": "BKT", "Dual Filter": "DFL" };
        const pollutantCodeMapping = { "Silt": "SIL", "Leaves": "LEA", "Oils": "OIL", "All": "ALL" };
        const type = catchpitTypeSelect.value ? getShortCode(catchpitTypeSelect.value, typeCodeMapping) : 'TYPE';
        const pollutant = targetPollutantSelect.value ? getShortCode(targetPollutantSelect.value, pollutantCodeMapping) : 'POLL';
        const pipeDia = pipeworkDiameterSelect.value ? pipeworkDiameterSelect.value.replace('mm', '') : 'DIA';
        const depth = chamberDepthSelect.value || 'DEPTH';
        const bucketCode = document.querySelector('input[name="removable_bucket"]:checked')?.value === 'yes' ? 'RB' : 'NR';
        const adoptableSelected = form.querySelector('input[name="adoptable_status"]:checked');
        const adoptableCode = adoptableSelected ? (adoptableSelected.value === 'adoptable' ? 'AD' : 'NA') : 'ADSTAT';

        if (type === 'TYPE' || pollutant === 'POLL' || pipeDia === 'DIA' || depth === 'DEPTH' || !adoptableSelected || !chamberDepthSelect.value) {
            productCodeDisplay.textContent = 'Please complete selections...';
            return;
        }
        productCodeDisplay.textContent = `${name}-${type}-${pollutant}-${pipeDia}-${depth}-${bucketCode}-${adoptableCode}`;
    }


    function updateQuoteAndCode() { /* ... (no change) ... */
        updateProductCodeDisplay();
        updateQuoteDisplay();
    }

    const elementsTriggeringUpdates = [ /* ... (no change) ... */
        catchpitTypeSelect, chamberDepthSelect, adoptableStatusGroup,
        pipeworkDiameterSelect, targetPollutantSelect, removableBucketGroup,
        profitMarkupInput
    ];
    elementsTriggeringUpdates.forEach(element => { /* ... (no change) ... */
        if (element) {
            element.addEventListener('change', updateQuoteAndCode);
            if (element.type === 'number' || element.type === 'text') {
                element.addEventListener('keyup', updateQuoteAndCode);
                element.addEventListener('input', updateQuoteAndCode);
            }
        }
    });
    if (adoptableStatusGroup) { /* ... (no change) ... */
        Array.from(adoptableStatusGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
            radio.addEventListener('change', () => {
                populateDepthOptions();
            });
        });
    }
    if (removableBucketGroup) { /* ... (no change) ... */
        Array.from(removableBucketGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
            radio.addEventListener('change', updateQuoteAndCode);
        });
    }

    populateDepthOptions();

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        // ... (validation logic remains the same) ...
        let isValid = true;
        form.querySelectorAll('.suds-input, .suds-select').forEach(el => el.style.borderColor = '');
        if (adoptableStatusGroup) adoptableStatusGroup.style.outline = 'none';
        const adoptableSelected = form.querySelector('input[name="adoptable_status"]:checked');
        if (!adoptableSelected) {
            isValid = false;
            if (adoptableStatusGroup) adoptableStatusGroup.style.outline = '2px solid var(--suds-red)';
        }
        const requiredStaticFields = form.querySelectorAll('#cp_type[required], #cp_depth[required], #cp_pipework_diameter[required], #cp_target_pollutant[required]');
        requiredStaticFields.forEach(input => {
            if ((input.tagName === 'SELECT' && input.value === "") || (input.tagName !== 'SELECT' && !input.value.trim())) {
                isValid = false;
                input.style.borderColor = 'var(--suds-red)';
            }
        });
        const bucketSelected = form.querySelector('input[name="removable_bucket"]:checked');
        if (!bucketSelected) {
             isValid = false;
        }
        if (!isValid) {
            submitStatus.textContent = 'Please fill in all required fields.';
            submitStatus.className = 'suds_status_error';
            const firstInvalidField = form.querySelector('[style*="border-color: var(--suds-red)"], [style*="outline"]');
            if (firstInvalidField) {
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstInvalidField.tagName !== 'SELECT' && firstInvalidField.type !== 'radio') {
                    firstInvalidField.focus();
                }
            }
            return;
        }
        // --- END Validation ---

        const payload = buildJsonPayload(); // payload already contains product data
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
                payload.savedId = `suds-cp-${Date.now()}`;
                payload.savedTimestamp = new Date().toISOString();
                allProjects[projectName].push(payload);
            }
            localStorage.setItem(projectDataStorageKey, JSON.stringify(allProjects));
            submitStatus.textContent = replaced ? 'Configuration updated and replaced original manhole-uploaded component.' : `Catchpit configuration saved to project: ${projectName}!`;
            submitStatus.className = 'suds_status_success';
            form.reset();
            customerProjectNameInput.value = '';
            populateDepthOptions();
            updateProductCodeDisplay();
            updateQuoteDisplay();
        } catch (storageError) {
            submitStatus.textContent = 'Saving to local storage failed: ' + (storageError.message || 'Unknown error.');
            submitStatus.className = 'suds_status_error';
        }
    });

    function buildJsonPayload() { /* ... (no change from your existing function) ... */
        const formData = new FormData(form);
        const quote = calculateQuote();
        const costPrice = quote.total;
        const markupPercent = parseFloat(profitMarkupInput.value) || 0;
        const sellPrice = costPrice * (1 + markupPercent / 100);
        let derivedProductName = "Catchpit";
        const cpTypeValue = formData.get('cp_type');
        if (cpTypeValue) {
            derivedProductName = `Catchpit (${cpTypeValue})`;
        }
        const payload = {
            product_type: "catchpit",
            derived_product_name: derivedProductName,
            generated_product_code: productCodeDisplay.textContent.startsWith('Please') ? null : productCodeDisplay.textContent,
            adoptable_status: formData.get('adoptable_status'),
            catchpit_details: {
                catchpit_type: cpTypeValue,
                depth_mm: parseFloat(formData.get('cp_depth')) || null,
                pipework_diameter: formData.get('cp_pipework_diameter'),
                target_pollutant: formData.get('cp_target_pollutant'),
                removable_bucket: formData.get('removable_bucket') === 'yes'
            },
            quote_details: {
                items: quote.items,
                cost_price: costPrice,
                profit_markup_percent: markupPercent,
                estimated_sell_price: sellPrice
            }
        };
        return payload;
    }


    window.prefillFormFromAIScheduleData = function(data) { /* ... (no change - still a placeholder) ... */
        console.log("Attempting to prefill Catchpit form with AI data:", data);
        updateQuoteAndCode();
    };

    // --- Modal Prefill and Modal Mode Support ---
    // Prefill the form from a config object (for modal editing)
    window.prefillCatchpitFormFromConfig = function(config, options = {}) {
        // options: { modalMode: true/false }
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
        // Catchpit details
        if (config.catchpit_details) {
            if (config.catchpit_details.catchpit_type && catchpitTypeSelect) {
                catchpitTypeSelect.value = config.catchpit_details.catchpit_type;
            }
            if (config.catchpit_details.depth_mm && chamberDepthSelect) {
                // Ensure options are populated first
                populateDepthOptions();
                chamberDepthSelect.value = config.catchpit_details.depth_mm;
            }
            if (config.catchpit_details.pipework_diameter && pipeworkDiameterSelect) {
                pipeworkDiameterSelect.value = config.catchpit_details.pipework_diameter;
            }
            if (config.catchpit_details.target_pollutant && targetPollutantSelect) {
                targetPollutantSelect.value = config.catchpit_details.target_pollutant;
            }
            if (typeof config.catchpit_details.removable_bucket !== 'undefined') {
                const val = config.catchpit_details.removable_bucket ? 'yes' : 'no';
                const radio = form.querySelector(`input[name="removable_bucket"][value="${val}"]`);
                if (radio) radio.checked = true;
            }
        }
        // Quote details
        if (config.quote_details && typeof config.quote_details.profit_markup_percent !== 'undefined') {
            profitMarkupInput.value = config.quote_details.profit_markup_percent;
        }
        // Product code display
        updateQuoteAndCode();
    };

    // Utility for modal: reset/hide project/customer input
    window.setCatchpitModalMode = function(isModal) {
        if (customerProjectNameInput) {
            const group = customerProjectNameInput.closest('.suds-form-group');
            if (group) group.style.display = isModal ? 'none' : '';
        }
    };
    // --- End Modal Prefill and Modal Mode Support ---
});
