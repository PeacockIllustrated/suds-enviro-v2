// js/all_configs.js

import { auth, db } from './firebase-init.js';
import {
    collection,
    doc,
    getDocs,
    setDoc, // Used for updating existing docs in modals
    deleteDoc,
    query,
    writeBatch // For clearing multiple documents efficiently
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    // DOM Element References
    const configList = document.getElementById('config-list');
    const projectSelectDropdown = document.getElementById('project-select');
    const exportProjectButton = document.getElementById('export-project-configs-btn');
    const clearProjectButton = document.getElementById('clear-project-configs-btn');
    const clearAllProjectDataButton = document.getElementById('clear-all-project-data-btn');

    const customerNameInput = document.getElementById('customer-name');
    const projectNameInput = document.getElementById('project-name');
    const projectNotesInput = document.getElementById('project-notes');

    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key-btn');
    const generateProposalButton = document.getElementById('generate-proposal-btn');
    const copyMarkdownButton = document.getElementById('copy-markdown-btn');
    const downloadProposalButton = document.getElementById('download-proposal-btn');
    const proposalOutputDiv = document.getElementById('proposal-output');
    const proposalStatusDiv = document.getElementById('proposal-status');

    // Firestore Paths and localStorage Keys
    const USERS_COLLECTION = 'users';
    const PROJECTS_SUBCOLLECTION = 'projects';
    const CONFIGURATIONS_SUBCOLLECTION = 'configurations';
    const USER_METADATA_SUBCOLLECTION = 'metadata'; // New subcollection for user-specific metadata like API key
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    // Module-scoped variables
    let currentUser = null; // Will store the authenticated Firebase user object
    let currentProjectsData = {}; // Object to hold ALL projects and their configs for the current user, fetched from Firestore

    // --- API Key Management (Now in Firestore, but localStorage for backward compat during transition) ---
    // User's OpenAI API Key will be stored in Firestore under users/[UID]/metadata/api_keys document.
    // However, the *client-side* form still asks for it and stores it in localStorage for convenience,
    // then uses it for the direct API call in the current setup.
    // The ultimate secure storage would be via Cloud Functions (Phase 4), where the key never leaves the server.
    // For now, we'll load from localStorage for client-side use.

    function loadApiKey() {
        // This function will still load from localStorage for the immediate client-side AI generation step.
        // In Phase 4, this will be replaced by a call to a Cloud Function to securely get the API key.
        const storedKey = localStorage.getItem('sudsUserOpenAiApiKey');
        if (storedKey) {
            apiKeyInput.value = storedKey;
        } else {
            apiKeyInput.value = '';
        }
    }

    function saveUserApiKey() {
        // This function will still save to localStorage for the immediate client-side AI generation step.
        // In Phase 4, this will be replaced by a call to a Cloud Function to securely store the API key
        // or to configure it server-side.
        const newKeyFromInput = apiKeyInput.value.trim();
        if (newKeyFromInput && (newKeyFromInput.startsWith('sk-') || newKeyFromInput.startsWith('sk-proj-')) && newKeyFromInput.length > 20) {
            localStorage.setItem('sudsUserOpenAiApiKey', newKeyFromInput);
            alert('API Key saved successfully to your browser\'s local storage!');
        } else if (newKeyFromInput === "") {
            localStorage.removeItem('sudsUserOpenAiApiKey');
            alert('API Key cleared from your browser\'s local storage.');
        } else {
            alert('Invalid OpenAI API Key format or length. Please enter a valid key (e.g., starting with "sk-" or "sk-proj-").');
        }
    }

    if (saveApiKeyButton) {
        saveApiKeyButton.addEventListener('click', saveUserApiKey);
    }

    // --- Firestore Data Loading & UI Population ---

    // Load all projects and their configurations for the current user
    async function loadUserConfigurationsFromFirestore() {
        if (!currentUser) {
            console.warn("loadUserConfigurationsFromFirestore called without currentUser.");
            configList.innerHTML = '<p style="text-align: center; color: #666; margin: 20px 0;">Please log in to view configurations.</p>';
            populateProjectSelector(); // Clear dropdown
            return;
        }

        console.log("Loading configurations for user:", currentUser.uid);
        currentProjectsData = {}; // Reset local data store

        try {
            // Get all project documents for the current user
            // Path: users/{uid}/projects
            const projectsRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION);
            const projectsSnapshot = await getDocs(projectsRef);

            if (projectsSnapshot.empty) {
                console.log("No projects found for this user in Firestore.");
                configList.innerHTML = '<p style="text-align: center; color: #666; margin: 20px 0;">No configurations saved yet. Start by configuring a product!</p>';
                populateProjectSelector();
                return;
            }

            // Iterate through each project document
            for (const projectDoc of projectsSnapshot.docs) {
                const projectName = projectDoc.id; // Project name is the document ID (e.g., "Bob Co. - Site A")

                // Get all configuration documents for the current project
                // Path: users/{uid}/projects/{projectName}/configurations
                const configsRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, projectName, CONFIGURATIONS_SUBCOLLECTION);
                const configsSnapshot = await getDocs(configsRef);

                const projectConfigs = [];
                configsSnapshot.forEach(configDoc => {
                    // Store the Firestore document ID with the config data
                    projectConfigs.push({ ...configDoc.data(), firestoreId: configDoc.id });
                });

                if (projectConfigs.length > 0) {
                    currentProjectsData[projectName] = projectConfigs;
                } else {
                    // If a project document exists but has no configurations, we might want to delete it or just skip it
                    // For now, we'll skip adding it to currentProjectsData if empty, so it doesn't show in dropdown.
                    // Optionally: deleteDoc(projectDoc.ref); // To clean up empty project docs
                    console.log(`Project '${projectName}' found but contains no configurations.`);
                }
            }

            console.log("Loaded projects from Firestore:", currentProjectsData);
            populateProjectSelector(); // Populate the dropdown with the loaded data
            displayConfigurationsForSelectedProject(); // Display configs for the initially selected project
        } catch (error) {
            console.error("Error loading configurations from Firestore:", error);
            configList.innerHTML = `<p style="text-align: center; color: var(--suds-red); margin: 20px 0;">Error loading configurations: ${error.message}. Please try again.</p>`;
        }
    }

    // Populate the project dropdown based on fetched data
    function populateProjectSelector() {
        projectSelectDropdown.innerHTML = '<option value="">-- Select a Project --</option>';
        const projectNames = Object.keys(currentProjectsData);

        if (projectNames.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No projects found";
            option.disabled = true;
            projectSelectDropdown.appendChild(option);
            // Also disable action buttons if no projects
            if (exportProjectButton) exportProjectButton.disabled = true;
            if (clearProjectButton) clearProjectButton.disabled = true;
            if (generateProposalButton) generateProposalButton.disabled = true;
            return;
        }

        // Sort project names, with default project always first
        projectNames.sort((a, b) => {
            if (a === DEFAULT_PROJECT_NAME) return -1;
            if (b === DEFAULT_PROJECT_NAME) return 1;
            return a.localeCompare(b);
        }).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name === DEFAULT_PROJECT_NAME ? "Default Project (No Name Specified)" : name;
            projectSelectDropdown.appendChild(option);
        });

        // Try to select the first project if none is currently selected
        if (projectSelectDropdown.value === "" && projectNames.length > 0) {
             projectSelectDropdown.value = projectNames[0];
        }
    }

    // Display configurations for the currently selected project in the UI
    function displayConfigurationsForSelectedProject() {
        const selectedProjectName = projectSelectDropdown.value;
        configList.innerHTML = ''; // Clear existing list items

        // Reset proposal related UI
        if (copyMarkdownButton) copyMarkdownButton.style.display = 'none';
        if (downloadProposalButton) downloadProposalButton.style.display = 'none';
        if (proposalStatusDiv) proposalStatusDiv.textContent = '';
        if (proposalOutputDiv) proposalOutputDiv.innerHTML = 'Proposal will appear here once generated...';

        // Handle no project selected or no data for selected project
        if (!selectedProjectName || !currentProjectsData[selectedProjectName]) {
            configList.innerHTML = '<p style="text-align: center; color: #666; margin: 20px 0;">Please select a project to view its configurations.</p>';
            if (exportProjectButton) exportProjectButton.disabled = true;
            if (clearProjectButton) clearProjectButton.disabled = true;
            if (generateProposalButton) generateProposalButton.disabled = true;
            customerNameInput.value = '';
            projectNameInput.value = '';
            return;
        }

        const configs = currentProjectsData[selectedProjectName];

        // Enable/disable buttons based on whether there are configs in the selected project
        if (exportProjectButton) exportProjectButton.disabled = false;
        if (clearProjectButton) clearProjectButton.disabled = false;
        if (generateProposalButton) generateProposalButton.disabled = (configs.length === 0);

        if (configs.length === 0) {
            configList.innerHTML = `<p style="text-align: center; color: #666; margin: 20px 0;">No configurations saved for project: ${selectedProjectName}.</p>`;
        } else {
            // Sort configurations by timestamp for consistent display (most recent first)
            configs.sort((a, b) => new Date(b.savedTimestamp).getTime() - new Date(a.savedTimestamp).getTime());

            configs.forEach((config) => {
                const listItem = document.createElement('li');
                listItem.className = 'config-item';
                listItem.dataset.projectName = selectedProjectName;
                listItem.dataset.firestoreId = config.firestoreId; // Store Firestore document ID for operations

                const detailsDiv = document.createElement('div');
                detailsDiv.className = 'config-item-details';
                const nameStrong = document.createElement('strong');
                nameStrong.textContent = config.derived_product_name || config.product_type || 'Unnamed Configuration';
                detailsDiv.appendChild(nameStrong);
                if (config.generated_product_code) { const codeP = document.createElement('p'); codeP.textContent = `Product Code: ${config.generated_product_code}`; detailsDiv.appendChild(codeP); }
                if (config.savedTimestamp) { const timeP = document.createElement('p'); timeP.className = 'timestamp'; timeP.textContent = `Saved: ${new Date(config.savedTimestamp).toLocaleString()}`; detailsDiv.appendChild(timeP); }
                if (config.firestoreId) { const idSP = document.createElement('p'); idSP.className = 'timestamp'; idSP.textContent = `Firestore ID: ${config.firestoreId}`; detailsDiv.appendChild(idSP); }

                // --- Highlight manhole-uploaded products ---
                if (config.source === 'manhole_upload') {
                    const badge = document.createElement('span');
                    badge.textContent = 'Manhole Upload';
                    badge.style.background = 'var(--suds-blue, #1d80b9)';
                    badge.style.color = 'white';
                    badge.style.fontSize = '0.85em';
                    badge.style.fontWeight = 'bold';
                    badge.style.padding = '2px 8px';
                    badge.style.borderRadius = '4px';
                    badge.style.marginLeft = '10px';
                    detailsDiv.appendChild(badge);
                }

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'config-item-actions';
                const viewDetailsButton = document.createElement('button');
                viewDetailsButton.textContent = 'View Details';
                viewDetailsButton.className = 'view-details-btn';
                viewDetailsButton.onclick = function() {
                    const pre = listItem.querySelector('pre');
                    if (pre) pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
                };
                actionsDiv.appendChild(viewDetailsButton);

                // --- Add Configure/Edit button for manhole-uploaded products ---
                if (config.source === 'manhole_upload' && config.product_type) { // Ensure product_type exists to determine which configurator to open
                    const configBtn = document.createElement('button');
                    configBtn.className = 'configure-product-btn';
                    configBtn.textContent = config.configured ? 'Edit Config' : 'Configure Product'; // Change text if already configured
                    configBtn.onclick = function() {
                        window.openConfigModal(config, selectedProjectName, config.firestoreId);
                    };
                    actionsDiv.appendChild(configBtn);
                }

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.className = 'delete-btn';
                deleteButton.onclick = async function() {
                    if (confirm(`Are you sure you want to delete this configuration from project "${selectedProjectName}"?`)) {
                        await deleteConfiguration(selectedProjectName, config.firestoreId);
                    }
                };
                actionsDiv.appendChild(deleteButton);

                const detailsPre = document.createElement('pre');
                // Ensure pre tags are added correctly, only showing raw JSON details
                // Clean up properties that might be internal (e.g., firestoreId) for cleaner JSON view
                const displayConfig = { ...config };
                delete displayConfig.firestoreId; // Remove internal ID for cleaner display

                detailsPre.textContent = JSON.stringify(displayConfig, null, 2);
                listItem.appendChild(detailsDiv);
                listItem.appendChild(actionsDiv);
                listItem.appendChild(detailsPre);
                configList.appendChild(listItem);
            });
        }

        // Prefill proposal fields based on selected project name
        if (selectedProjectName && selectedProjectName !== DEFAULT_PROJECT_NAME) {
            const parts = selectedProjectName.split(" - ");
            customerNameInput.value = parts[0] || selectedProjectName;
            projectNameInput.value = parts.length > 1 ? parts.slice(1).join(" - ") : (parts[0] ? '' : selectedProjectName);
        } else { // Handle _DEFAULT_PROJECT_ or no project selected
            customerNameInput.value = '';
            projectNameInput.value = ''; // Or 'Default Project' if you prefer a placeholder
        }
    }

    // Delete a specific configuration from Firestore
    async function deleteConfiguration(projectName, configFirestoreId) {
        if (!currentUser) {
            alert("Error: No user logged in.");
            return;
        }
        try {
            const configDocRef = doc(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, projectName, CONFIGURATIONS_SUBCOLLECTION, configFirestoreId);
            await deleteDoc(configDocRef);
            console.log(`Configuration ${configFirestoreId} deleted from project ${projectName}.`);

            // After deleting a config, check if the project subcollection is now empty.
            // If it is, delete the project document itself to keep the Firestore structure clean.
            const configsRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, projectName, CONFIGURATIONS_SUBCOLLECTION);
            const configsSnapshot = await getDocs(configsRef);
            if (configsSnapshot.empty) {
                const projectDocRef = doc(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, projectName);
                await deleteDoc(projectDocRef);
                console.log(`Project document ${projectName} also deleted as it is now empty.`);
            }

            await loadUserConfigurationsFromFirestore(); // Reload data and refresh UI
        } catch (error) {
            console.error("Error deleting configuration:", error);
            alert("Error deleting configuration: " + error.message);
        }
    }

    if (projectSelectDropdown) {
        projectSelectDropdown.addEventListener('change', displayConfigurationsForSelectedProject);
    }

    if (exportProjectButton) {
        exportProjectButton.addEventListener('click', function() {
            const selectedProjectName = projectSelectDropdown.value;
            if (!selectedProjectName || !currentProjectsData[selectedProjectName] || currentProjectsData[selectedProjectName].length === 0) {
                alert('Please select a project with configurations to export.');
                return;
            }
            const dataToExport = { [selectedProjectName]: currentProjectsData[selectedProjectName] };
            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `suds_configs_${selectedProjectName.replace(/[^\w.-]/g, '_')}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    }

    if (clearProjectButton) {
        clearProjectButton.addEventListener('click', async function() {
            const selectedProjectName = projectSelectDropdown.value;
            if (!selectedProjectName) {
                alert('Please select a project to clear.');
                return;
            }
            if (!currentUser) {
                alert("Error: No user logged in.");
                return;
            }
            if (confirm(`Are you sure you want to delete ALL configurations for project "${selectedProjectName}"? This cannot be undone.`)) {
                try {
                    // Use a batch write for efficiency when deleting multiple documents
                    const batch = writeBatch(db);
                    const configsRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, selectedProjectName, CONFIGURATIONS_SUBCOLLECTION);
                    const configsSnapshot = await getDocs(configsRef);

                    configsSnapshot.forEach(configDoc => {
                        batch.delete(configDoc.ref);
                    });
                    await batch.commit(); // Commit all deletes in one go

                    // Delete the project document itself if it's now empty of configurations
                    const projectDocRef = doc(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, selectedProjectName);
                    await deleteDoc(projectDocRef); // Delete project document

                    console.log(`All configurations and project document for ${selectedProjectName} deleted.`);
                    await loadUserConfigurationsFromFirestore(); // Reload and refresh UI
                } catch (error) {
                    console.error("Error clearing project configurations:", error);
                    alert("Error clearing project configurations: " + error.message);
                }
            }
        });
    }

    if (clearAllProjectDataButton) {
        clearAllProjectDataButton.addEventListener('click', async function() {
            if (!currentUser) {
                alert("Error: No user logged in.");
                return;
            }
            if (confirm("DANGER! Are you absolutely sure you want to delete ALL configurations for ALL projects? This is irreversible!")) {
                if (confirm("SECOND CONFIRMATION: This will wipe all saved project configurations. Proceed?")) {
                    try {
                        const projectsRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION);
                        const projectsSnapshot = await getDocs(projectsRef);

                        // Iterate and delete configurations within each project first, then the project document
                        for (const projectDoc of projectsSnapshot.docs) {
                            const batch = writeBatch(db);
                            const configsRef = collection(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, projectDoc.id, CONFIGURATIONS_SUBCOLLECTION);
                            const configsSnapshot = await getDocs(configsRef);
                            configsSnapshot.forEach(configDoc => {
                                batch.delete(configDoc.ref);
                            });
                            await batch.commit(); // Commit deletes for configs in this project

                            await deleteDoc(projectDoc.ref); // Then delete the project document itself
                        }
                        console.log("All project data cleared for user:", currentUser.uid);

                        await loadUserConfigurationsFromFirestore(); // Reload and refresh UI
                        alert("All project data has been cleared.");
                    } catch (error) {
                        console.error("Error clearing all project data:", error);
                        alert("Error clearing all project data: " + error.message);
                    }
                }
            }
        });
    }

    // --- Proposal Generation ---
    if (generateProposalButton) {
        generateProposalButton.addEventListener('click', async function() {
            // Initial UI Reset for new attempt
            if (proposalStatusDiv) proposalStatusDiv.textContent = '';
            if (proposalOutputDiv) proposalOutputDiv.innerHTML = 'Proposal will appear here once generated...';
            if (downloadProposalButton) downloadProposalButton.style.display = 'none';
            if (copyMarkdownButton) copyMarkdownButton.style.display = 'none';

            const selectedProjectName = projectSelectDropdown.value;
            const keyForApiCall = apiKeyInput.value.trim(); // Get current API key from input

            // API KEY VALIDATION (still client-side input for now)
            if (!keyForApiCall || !(keyForApiCall.startsWith('sk-') || keyForApiCall.startsWith('sk-proj-')) || keyForApiCall.length < 20) {
                alert('A valid OpenAI API Key is required. Please enter it, ensure it starts with "sk-" or "sk-proj-", is of sufficient length, and click "Save Key" if needed.');
                if (apiKeyInput) apiKeyInput.focus();
                return;
            }

            if (!selectedProjectName) {
                alert('Please select a project to generate a proposal for.');
                projectSelectDropdown.focus();
                return;
            }

            const configsForProposal = currentProjectsData[selectedProjectName];
            if (!configsForProposal || configsForProposal.length === 0) {
                alert(`No configurations found for project "${selectedProjectName}" to include in the proposal.`);
                return;
            }

            // Set generating status and disable button AFTER all validations pass
            if (proposalStatusDiv) proposalStatusDiv.textContent = 'Generating proposal... Please wait.';
            generateProposalButton.disabled = true;

            const propCustomerName = customerNameInput.value.trim() || "[Client Name/Company Placeholder]";
            const propProjectName = projectNameInput.value.trim() || "[Project Name/Location Placeholder]";
            const propProjectNotes = projectNotesInput.value.trim();

            const configurationsDetails = configsForProposal.map(config => {
                let details = `**Product Name:** ${config.derived_product_name || config.product_type || 'N/A'}\n`;
                details += `**Product Code:** ${config.generated_product_code || 'N/A'}\n`;
                if (config.catchpit_details) { details += `  * Type: ${config.catchpit_details.catchpit_type || 'N/A'}\n  * Depth: ${config.catchpit_details.depth_mm || 'N/A'}mm\n  * Pipework Diameter: ${config.catchpit_details.pipework_diameter || 'N/A'}\n  * Target Pollutant: ${config.catchpit_details.target_pollutant || 'N/A'}\n  * Removable Bucket: ${config.catchpit_details.removable_bucket ? 'Yes' : 'No'}\n`;}
                else if (config.product_type === "orifice_flow_control") { details += `  * Chamber Depth: ${config.chamber_details?.chamber_depth_mm || 'N/A'}mm\n  * Chamber Diameter: ${config.chamber_details?.chamber_diameter || 'N/A'}\n  * Pipework Size: ${config.chamber_details?.pipework_size || 'N/A'}\n  * Target Flow Rate: ${config.flow_control_params?.target_flow_lps || 'N/A'} L/s\n  * Design Head Height: ${config.flow_control_params?.design_head_m || 'N/A'} m\n  * Bypass Required: ${config.flow_control_params?.bypass_required ? 'Yes' : 'No'}\n`;}
                else if (config.product_type === "universal_chamber") { details += `  * System Type: ${config.system_type_selection || 'N/A'}\n  * Water Application: ${config.water_application_selection || 'N/A'}\n  * Chamber Depth: ${config.main_chamber?.chamber_depth_mm || 'N/A'}mm\n  * Chamber Diameter: ${config.main_chamber?.chamber_diameter || 'N/A'}\n  * Inlets (${config.inlets?.length || 0}):\n`; config.inlets?.forEach(inlet => { details += `    * Position: ${inlet.position}, Size: ${inlet.pipe_size || 'N/A'}, Material: ${inlet.pipe_material || 'N/A'} ${inlet.pipe_material_other ? `(${inlet.pipe_material_other})` : ''}\n`; });}
                else if (config.separator_details) { details += `  * Depth: ${config.separator_details.depth_mm || 'N/A'}mm\n  * Design Flow Rate: ${config.separator_details.flow_rate_lps || 'N/A'} L/s\n  * Pipework Diameter: ${config.separator_details.pipework_diameter || 'N/A'}\n  * Model Size/Space: ${config.separator_details.space_available || 'N/A'}\n  * Target Contaminants: ${(config.separator_details.target_contaminants || []).join(', ')}\n`;}
                details += `  * Adoptable Status: ${config.adoptable_status || 'N/A'}\n`;
                if (config.quote_details && typeof config.quote_details.estimated_sell_price === 'number') { details += `  * **Estimated Sell Price:** £${config.quote_details.estimated_sell_price.toFixed(2)}\n`; }
                return details;
            }).join('\n\n---\n\n');
            const totalEstimatedSellPrice = configsForProposal.reduce((sum, conf) => sum + (conf.quote_details?.estimated_sell_price || 0), 0).toFixed(2);

            const systemPrompt = `You are an expert technical sales proposal writer for SuDS Enviro, a premier UK-based provider of Sustainable Drainage Systems. Your primary function is to generate comprehensive, client-ready project proposals in well-structured Markdown format.

**Client & Project Context (to be inserted by AI where placeholders are used in the template):**
*   **Client Name/Company:** {{CUSTOMER_NAME}}
*   **Project Name/Location:** {{PROJECT_NAME}}
*   **Additional Project Notes/Context:** {{PROJECT_NOTES}}

**Proposal Structure (Strictly Adhere to this Markdown structure, replacing placeholders):**

# Project Proposal: Sustainable Drainage System for {{PROJECT_NAME}}

**Date:** ${new Date().toLocaleDateString('en-GB')}
**Prepared for:** {{CUSTOMER_NAME}}
**Prepared by:** SuDS Enviro Sales Team

## 1. Introduction
Briefly introduce SuDS Enviro as a leader in innovative and compliant SuDS solutions. State the purpose of this proposal – to outline a recommended drainage system for the {{PROJECT_NAME}} based on the client's selected components. If project notes are available ({{PROJECT_NOTES}}), subtly weave any relevant context into the introduction or system overview.

## 2. Executive Summary
Provide a concise overview of the proposed system for {{PROJECT_NAME}}, highlighting its key benefits and its suitability for the project's (assumed) objectives like effective stormwater management, pollutant removal, and regulatory compliance. Mention the total estimated project value.

## 3. Proposed SuDS Components & Specifications
This section will detail each configured product. For each product, use the following format:
(The AI will insert the product details here based on the user query data)

## 4. Conceptual System Overview
Provide a short paragraph describing how these components might function together within a typical SuDS management train for the {{PROJECT_NAME}}. Tailor this to the types of products included and any context from {{PROJECT_NOTES}}.

## 5. Key Benefits of SuDS Enviro Solutions
*   **Regulatory Compliance:** Our systems are designed to meet [mention relevant UK standards/guidelines like SuDS Manual, Sewers for Adoption/Design and Construction Guidance].
*   **Environmental Protection:** Effectively reduces pollutants, improves water quality, and can enhance local biodiversity.
*   **Flood Risk Mitigation:** Contributes to effective flood risk management by controlling runoff rates and volumes.
*   **Durability & Quality:** Manufactured to high standards for long-term performance and reliability.
*   **Expert Support:** SuDS Enviro offers comprehensive support from design to installation and maintenance.

## 6. Total Estimated Project Investment
The total estimated investment for the supply of the SuDS Enviro components listed above for the {{PROJECT_NAME}} is **£${totalEstimatedSellPrice}** (excluding VAT, delivery, and installation unless otherwise stated). A detailed formal quotation can be provided upon request.

## 7. Next Steps
We recommend the following next steps to progress the SuDS solution for {{PROJECT_NAME}}:
1.  A brief consultation call to discuss your project requirements in more detail.
2.  Review of site plans (if available) to optimize component selection and placement.
3.  Provision of a formal, detailed quotation.
Please contact us to proceed.

## 8. Contact Information
**SuDS Enviro**
Email: info@sudsenviro.com
Phone: 01224 057700
Website: suds-enviro.com

---
*This proposal is based on the component configurations provided and is indicative. Final pricing and specifications are subject to a formal quotation.*
---
`;

            const userQuery = `
            Customer Name/Company: ${propCustomerName}
            Project Name/Location: ${propProjectName}
            Additional Project Notes: ${propProjectNotes || "None provided."}

            Please generate a project proposal using the system prompt's structure and the product data below.
            Ensure all placeholders like {{CUSTOMER_NAME}}, {{PROJECT_NAME}}, and {{PROJECT_NOTES}} in the system prompt template are correctly filled with the information provided above.

            **Configured Product Data for project "${selectedProjectName}":**
            ${configurationsDetails}
            `;
            const aiApiEndpoint = 'https://api.openai.com/v1/chat/completions';
            console.log(">>> Preparing to send API request."); // Removed API key snippet for security best practice

            try {
                const requestBody = {
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userQuery }
                    ],
                    temperature: 0.7,
                    max_tokens: 1500,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0
                };

                const response = await fetch(aiApiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${keyForApiCall}`
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("API error response:", errorData);
                    throw new Error(`API request failed with status ${response.status}: ${errorData.error.message || response.statusText}`);
                }

                const responseData = await response.json();
                console.log(">>> API response received:", responseData);

                if (responseData.choices && responseData.choices.length > 0) {
                    const aiGeneratedMarkdown = responseData.choices[0].message.content.trim();
                    proposalOutputDiv.innerHTML = marked.parse(aiGeneratedMarkdown);
                    rawMarkdownForDownload = aiGeneratedMarkdown;
                    downloadProposalButton.style.display = 'inline-block';
                    copyMarkdownButton.style.display = 'inline-block';
                    if (proposalStatusDiv) proposalStatusDiv.textContent = 'Proposal generated successfully!';
                } else {
                    throw new Error("No valid response from AI.");
                }
            } catch (error) {
                console.error("Error during proposal generation:", error);
                if (proposalStatusDiv) proposalStatusDiv.textContent = 'Error generating proposal. Please try again.';
                alert('Error during proposal generation: ' + error.message);
            } finally {
                generateProposalButton.disabled = false;
            }
        });
    }

    // --- Markdown Copy & Download ---
    if (copyMarkdownButton) {
        copyMarkdownButton.addEventListener('click', function() {
            if (!rawMarkdownForDownload) {
                alert('No proposal generated yet. Please generate a proposal first.');
                return;
            }
            navigator.clipboard.writeText(rawMarkdownForDownload)
                .then(() => { alert('Proposal markdown copied to clipboard!'); })
                .catch(err => { alert('Failed to copy markdown: ' + err.message); });
        });
    }

    if (downloadProposalButton) {
        downloadProposalButton.addEventListener('click', function() {
            if (!rawMarkdownForDownload) {
                alert('No proposal generated yet. Please generate a proposal first.');
                return;
            }
            const renderedHtml = marked.parse(rawMarkdownForDownload);
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SuDS Enviro Project Proposal</title>
    <style>
        body { font-family: 'Montserrat', sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3, h4, h5, h6 { color: #1d80b9; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
        h1 { font-size: 2.2em; border-bottom: 2px solid #1d80b9; padding-bottom: 0.3em; }
        h2 { font-size: 1.8em; border-bottom: 1px solid #d1d5db; padding-bottom: 0.2em; }
        h3 { font-size: 1.4em; }
        ul { list-style-type: disc; margin-left: 20px; }
        ol { list-style-type: decimal; margin-left: 20px; }
        blockquote { border-left: 4px solid #1d80b9; padding-left: 15px; color: #555; font-style: italic; margin: 1em 0; }
        strong { font-weight: 700; }
        hr { border: none; border-top: 1px dashed #d1d5db; margin: 2em 0; }
        pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; font-family: 'Courier New', monospace; }
        code { background-color: #eee; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
        /* Print styles */
        @media print {
            body { font-size: 12pt; max-width: none; margin: 0; padding: 0; }
            h1, h2, h3, h4, h5, h6 { break-after: avoid; }
            pre, blockquote { break-inside: avoid; }
        }
    </style>
</head>
<body>
    ${renderedHtml}
</body>
</html>
`;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `suds_proposal_${projectNameInput.value.trim().replace(/[^\w.-]/g, '_') || 'untitled'}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    }

    // --- Initial Load Logic ---
    // Listen for authentication state changes and load data once user is authenticated
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (currentUser) {
            loadUserConfigurationsFromFirestore();
            loadApiKey(); // Load API key once user is authenticated
        } else {
            console.log("User not authenticated on all_configs.html. Redirection handled by main.js.");
            // UI will show "Please log in..." message
            configList.innerHTML = '<p style="text-align: center; color: #666; margin: 20px 0;">Please log in to view configurations.</p>';
            populateProjectSelector(); // Clear project dropdown
            if (exportProjectButton) exportProjectButton.disabled = true;
            if (clearProjectButton) clearProjectButton.disabled = true;
            if (generateProposalButton) generateProposalButton.disabled = true;
            if (copyMarkdownButton) copyMarkdownButton.style.display = 'none';
            if (downloadProposalButton) downloadProposalButton.style.display = 'none';
        }
    });

    // Prefill function for modal, now also accepts Firestore ID for updating
    window.openConfigModal = async function(config, projectName, configFirestoreId) {
        // Remove any existing modal
        let existingModal = document.getElementById('suds-config-modal');
        if (existingModal) existingModal.remove();

        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'suds-config-modal';
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100vw';
        modalOverlay.style.height = '100vh';
        modalOverlay.style.background = 'rgba(0,0,0,0.45)';
        modalOverlay.style.zIndex = '9999';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.overflowY = 'auto';

        // Modal content container
        const modalContent = document.createElement('div');
        modalContent.style.background = '#fff';
        modalContent.style.borderRadius = '12px';
        modalContent.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
        modalContent.style.maxWidth = '600px';
        modalContent.style.width = '95vw';
        modalContent.style.maxHeight = '90vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.margin = '40px 0';
        modalContent.style.padding = '36px 32px 32px 32px';
        modalContent.style.position = 'relative';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '18px';
        closeBtn.style.right = '22px';
        closeBtn.style.fontSize = '2.1em';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#1d80b9';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => modalOverlay.remove();
        modalContent.appendChild(closeBtn);

        // Modal title
        const title = document.createElement('h2');
        title.textContent = `${config.derived_product_name || config.product_type || 'Product'} Configuration`;
        title.style.marginTop = '0';
        title.style.marginBottom = '18px';
        title.style.color = 'var(--suds-blue, #1d80b9)';
        modalContent.appendChild(title);

        // Inject the correct form (clone from hidden template)
        let formHtml = '';
        if (config.product_type === 'catchpit') {
            formHtml = document.getElementById('catchpit-form-template').innerHTML;
        } else if (config.product_type === 'orifice_flow_control') {
            formHtml = document.getElementById('orifice-form-template').innerHTML;
        } else if (config.product_type === 'universal_chamber') {
            formHtml = document.getElementById('universal-chamber-form-template').innerHTML;
        } else if (config.product_type === 'hydrodynamic_separator') {
            formHtml = document.getElementById('separator-form-template').innerHTML;
        }
        else {
            formHtml = '<div style="color:#b00;">Unsupported product type for modal configuration.</div>';
        }

        const formWrapper = document.createElement('div');
        formWrapper.innerHTML = formHtml;
        modalContent.appendChild(formWrapper);

        // Remove project/customer input at the top if present
        const projectInput = formWrapper.querySelector('#modal_customer_project_name, [name="modal_customer_project_name"]');
        if (projectInput) projectInput.closest('div.suds-form-group')?.remove();

        // The template IDs are now pre-prefixed with 'modal_' in all_configs.html itself.
        // So, we just need to handle the name attributes here for the payload building function.
        // We temporarily strip 'modal_' prefix from names before calling buildJsonPayload,
        // then restore them immediately.
        const elementsToRename = formWrapper.querySelectorAll('[name^="modal_"]');
        elementsToRename.forEach(el => {
            const originalName = el.getAttribute('name').substring(6); // Remove 'modal_' prefix
            el.setAttribute('data-original-name', originalName); // Store original name
            el.setAttribute('name', originalName); // Set name to original for payload function
        });


        // Prefill form fields from config
        setTimeout(() => { // Timeout ensures DOM is fully rendered before prefilling
            const prefillOptions = { modalMode: true, prefillProjectName: projectName };
            if (config.product_type === 'catchpit' && window.prefillCatchpitFormFromConfig) {
                window.prefillCatchpitFormFromConfig(config, prefillOptions);
            } else if (config.product_type === 'orifice_flow_control' && window.prefillOrificeFormFromConfig) {
                window.prefillOrificeFormFromConfig(config, prefillOptions);
            } else if (config.product_type === 'universal_chamber' && window.prefillUniversalChamberFormFromConfig) {
                window.prefillUniversalChamberFormFromConfig(config, prefillOptions);
            } else if (config.product_type === 'hydrodynamic_separator' && window.prefillSeparatorFormFromConfig) {
                window.prefillSeparatorFormFromConfig(config, prefillOptions);
            }
        }, 0);


        // Modal submit logic: on submit, update the config in Firestore and close modal
        const modalForm = formWrapper.querySelector('form');
        if (modalForm) {
            modalForm.onsubmit = async function(e) {
                e.preventDefault();
                if (!currentUser) { alert("Error: Not authenticated to save changes."); return; }

                let newPayload;
                try {
                    // Call the correct buildJsonPayload function based on product type
                    // These functions now expect the name attributes to be the original ones,
                    // which we temporarily restored above.
                    if (config.product_type === 'catchpit' && window.buildCatchpitJsonPayload) {
                        newPayload = window.buildCatchpitJsonPayload();
                    } else if (config.product_type === 'orifice_flow_control' && window.buildOrificeJsonPayload) {
                        newPayload = window.buildOrificeJsonPayload();
                    } else if (config.product_type === 'universal_chamber' && window.buildUniversalChamberJsonPayload) {
                        newPayload = window.buildUniversalChamberJsonPayload();
                    } else if (config.product_type === 'hydrodynamic_separator' && window.buildSeparatorJsonPayload) {
                        newPayload = window.buildSeparatorJsonPayload();
                    } else {
                        alert('Could not determine how to build payload for this product type.');
                        return;
                    }
                } catch (err) {
                    console.error("Error gathering form data in modal:", err);
                    alert('Error gathering form data: ' + err.message);
                    return;
                } finally {
                    // Always restore original names (prefixed with 'modal_') after payload is built or on error
                    elementsToRename.forEach(el => {
                        const originalName = el.getAttribute('data-original-name');
                        if (originalName) {
                            el.setAttribute('name', 'modal_' + originalName);
                            el.removeAttribute('data-original-name');
                        }
                    });
                }

                if (!newPayload) {
                    alert('Could not gather form data.');
                    return;
                }

                // Preserve original ID and timestamp for update, mark as configured
                newPayload.source = config.source;
                newPayload.savedId = config.savedId;
                newPayload.firestoreId = configFirestoreId;
                newPayload.savedTimestamp = new Date().toISOString();
                newPayload.configured = true;

                try {
                    // The path is already correct from the original load
                    const configDocRef = doc(db, USERS_COLLECTION, currentUser.uid, PROJECTS_SUBCOLLECTION, projectName, CONFIGURATIONS_SUBCOLLECTION, configFirestoreId);
                    await setDoc(configDocRef, newPayload); // Use setDoc to update existing document

                    modalOverlay.remove();
                    await loadUserConfigurationsFromFirestore(); // Reload data and refresh UI
                    alert('Configuration updated successfully!');
                } catch (saveError) {
                    console.error("Error saving updated configuration to Firestore:", saveError);
                    alert("Error saving updated configuration: " + saveError.message);
                }
            };
        }

        // Add modal to DOM
        document.body.appendChild(modalOverlay);
        modalOverlay.appendChild(modalContent);
    };

    // Export `openConfigModal` so it's available globally for the "Configure Product" button
    window.openConfigModal = openConfigModal;

});
