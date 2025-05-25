// js/catchpit.js
import { auth, db } from './firebase-init.js';
import { collection, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    const pricingRules = {
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
    const customerProjectNameInput = document.getElementById('customer_project_name');

    const catchpitTypeSelect = document.getElementById('cp_type');
    const chamberDepthSelect = document.getElementById('cp_depth');
    const adoptableStatusGroup = document.getElementById('adoptable_status_group');
    const pipeworkDiameterSelect = document.getElementById('cp_pipework_diameter');
    const targetPollutantSelect = document.getElementById('cp_target_pollutant');
    const removableBucketGroup = document.getElementById('removable_bucket_group');

    const USERS_COLLECTION = 'users';
    const PROJECTS_SUBCOLLECTION = 'projects';
    const CONFIGURATIONS_SUBCOLLECTION = 'configurations';
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    let currentUser = null; // To store the authenticated user

    // --- Firebase Auth State Listener ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (currentUser) {
            console.log("Catchpit Configurator: User is logged in.", currentUser.uid);
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
            submitStatus.textContent = 'Ready to save configuration.';
            submitStatus.className = '';
        } else {
            console.log("Catchpit Configurator: User is NOT logged in. Disabling form.");
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
            submitStatus.textContent = 'Please log in to use the configurator.';
            submitStatus.className = 'suds_status_error';
            // Also reset form and clear any pre-filled data that might be visible if not authenticated
            form.reset();
            populateDepthOptions(); // Reset depth options after reset
        }
    });

    function formatCurrency(value) { return `£${value.toFixed(2)}`; }

    function populateDepthOptions() {
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

    function calculateQuote() {
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

    function updateQuoteDisplay() {
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

    function getShortCode(value, mapping) {
        return mapping[value] || value.substring(0, 3).toUpperCase();
    }

    function updateProductCodeDisplay() {
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

    function updateQuoteAndCode() {
        updateProductCodeDisplay();
        updateQuoteDisplay();
    }

    const elementsTriggeringUpdates = [
        catchpitTypeSelect, chamberDepthSelect, adoptableStatusGroup,
        pipeworkDiameterSelect, targetPollutantSelect, removableBucketGroup,
        profitMarkupInput
    ];
    elementsTriggeringUpdates.forEach(element => {
        if (element) {
            element.addEventListener('change', updateQuoteAndCode);
            if (element.type === 'number' || element.type === 'text') {
                element.addEventListener('keyup', updateQuoteAndCode);
                element.addEventListener('input', updateQuoteAndCode);
            }
        }
    });
    if (adoptableStatusGroup) {
        Array.from(adoptableStatusGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
            radio.addEventListener('change', () => {
                populateDepthOptions();
            });
        });
    }
    if (removableBucketGroup) {
        Array.from(removableBucketGroup.querySelectorAll('input[type="radio"]')).forEach(radio => {
            radio.addEventListener('change', updateQuoteAndCode);
        });
    }

    populateDepthOptions(); // Initial call

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (!currentUser) {
            submitStatus.textContent = 'Error: You must be logged in to save configurations.';
            submitStatus.className = 'suds_status_error';
            return;
        }

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

        const payload = buildJsonPayload();
        const projectName = customerProjectNameInput.value.trim() || DEFAULT_PROJECT_NAME;

        // Check for prefillId in URL parameters (for editing manhole-uploaded items)
        const urlParams = new URLSearchParams(window.location.search);
        const prefillId = urlParams.get('prefillId');

        try {
            // Reference to the user's projects collection
            const userProjectsCollectionRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION);
            // Reference to the specific project's configurations subcollection
            const projectConfigsCollectionRef = collection(userProjectsCollectionRef, projectName, CONFIGURATIONS_SUBCOLLECTION);

            let configDocRef;
            if (prefillId) {
                // If prefillId is present, update the existing document
                configDocRef = doc(projectConfigsCollectionRef, prefillId);
                payload.firestoreId = prefillId; // Ensure payload includes the Firestore ID
                payload.savedId = prefillId; // Keep savedId consistent with firestoreId
                payload.source = urlParams.get('source') || payload.source; // Preserve source tag if it was provided via URL
                payload.configured = true; // Mark as configured
            } else {
                // For new configurations, let Firestore generate a unique ID
                configDocRef = doc(projectConfigsCollectionRef);
                payload.firestoreId = configDocRef.id; // Store Firestore document ID in payload
                payload.savedId = configDocRef.id; // Also use as savedId for consistency
            }

            payload.savedTimestamp = new Date().toISOString(); // Always update timestamp on save

            await setDoc(configDocRef, payload); // Save/update the document in Firestore

            submitStatus.textContent = `Catchpit configuration saved to project "${projectName}"!`;
            submitStatus.className = 'suds_status_success';
            form.reset();
            customerProjectNameInput.value = '';
            populateDepthOptions();
            updateProductCodeDisplay();
            updateQuoteDisplay();

            // Clear prefillId from URL after successful save of a prefilled item
            if (prefillId) {
                 const newUrl = new URL(window.location.href);
                 newUrl.searchParams.delete('prefillId');
                 newUrl.searchParams.delete('projectName'); // Also remove project name from URL if used for prefill
                 newUrl.searchParams.delete('source');
                 window.history.replaceState({}, document.title, newUrl.pathname);
            }

        } catch (firebaseError) {
            console.error("Error saving configuration to Firestore:", firebaseError);
            submitStatus.textContent = 'Saving configuration failed: ' + (firebaseError.message || 'Unknown error.');
            submitStatus.className = 'suds_status_error';
        }
    });

    // Export the payload builder for use in modals (e.g., in all_configs.js)
    window.buildCatchpitJsonPayload = buildJsonPayload;

    function buildJsonPayload() {
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

    // Prefill the form from a config object (for modal editing or AI prefill)
    window.prefillCatchpitFormFromConfig = function(config, options = {}) {
        // Reset form first to clear any previous selections/errors
        form.reset();
        submitStatus.textContent = ''; // Clear status message
        form.querySelectorAll('.suds-input, .suds-select').forEach(el => el.style.borderColor = '');
        if (adoptableStatusGroup) adoptableStatusGroup.style.outline = 'none';

        // Remove project/customer input if in modal mode
        if (options.modalMode && customerProjectNameInput) {
            customerProjectNameInput.closest('.suds-form-group')?.classList.add('suds-hide');
        }

        // Apply prefill data
        // Customer/Project Name is not prefilled in modal context
        if (options.prefillProjectName && customerProjectNameInput) {
            customerProjectNameInput.value = options.prefillProjectName;
        }

        // Adoptable status
        if (config.adoptable_status) {
            const radio = form.querySelector(`input[name="adoptable_status"][value="${config.adoptable_status}"]`);
            if (radio) {
                radio.checked = true;
                // Trigger change event to populate depth options immediately
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        // Catchpit details
        if (config.catchpit_details) {
            if (config.catchpit_details.catchpit_type && catchpitTypeSelect) {
                catchpitTypeSelect.value = config.catchpit_details.catchpit_type;
            }
            if (config.catchpit_details.depth_mm && chamberDepthSelect) {
                // Ensure options are populated first by adoptable status change, then set value
                // Use a slight delay if necessary, but generally the change event handles it.
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

        // This will update the product code and quote display based on the prefilled values
        updateQuoteAndCode();

        // If it's a prefill from manhole schedule, update URL params to enable update on submit
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
