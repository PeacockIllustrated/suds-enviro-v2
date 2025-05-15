// js/all_configs.js
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
    const copyMarkdownButton = document.getElementById('copy-markdown-btn'); // Reference for the new button
    const downloadProposalButton = document.getElementById('download-proposal-btn');
    const proposalOutputDiv = document.getElementById('proposal-output');
    const proposalStatusDiv = document.getElementById('proposal-status');

    // localStorage Keys
    const projectDataStorageKey = 'sudsUserProjectsData';
    const userApiKeyStorageKey = 'sudsUserOpenAiApiKey';
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";

    // Module-scoped variables
    let userProvidedApiKey = '';
    let rawMarkdownForDownload = '';
    let currentProjectsData = {};

    // --- API Key Management ---
    function loadApiKey() {
        const storedKey = localStorage.getItem(userApiKeyStorageKey);
        if (storedKey) {
            userProvidedApiKey = storedKey;
            if (apiKeyInput) apiKeyInput.value = storedKey;
        } else {
            userProvidedApiKey = '';
            if (apiKeyInput) apiKeyInput.value = '';
        }
    }

    function saveUserApiKey() {
        if (!apiKeyInput) return;
        const newKeyFromInput = apiKeyInput.value.trim();
        if (newKeyFromInput && (newKeyFromInput.startsWith('sk-') || newKeyFromInput.startsWith('sk-proj-')) && newKeyFromInput.length > 20) {
            localStorage.setItem(userApiKeyStorageKey, newKeyFromInput);
            userProvidedApiKey = newKeyFromInput;
            alert('API Key saved successfully!');
        } else if (newKeyFromInput === "") {
            localStorage.removeItem(userApiKeyStorageKey);
            userProvidedApiKey = "";
            alert('API Key cleared.');
        } else {
            alert('Invalid API Key format or length. Please enter a valid key (e.g., starting with "sk-" or "sk-proj-").');
        }
    }

    if (saveApiKeyButton) {
        saveApiKeyButton.addEventListener('click', saveUserApiKey);
    }

    // --- Project and Configuration Management ---
    function populateProjectSelector() {
        projectSelectDropdown.innerHTML = '<option value="">-- Select a Project --</option>';
        const projectNames = Object.keys(currentProjectsData);

        if (projectNames.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No projects found";
            option.disabled = true;
            projectSelectDropdown.appendChild(option);
            return;
        }

        projectNames.sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name === DEFAULT_PROJECT_NAME ? "Default Project (No Name Specified)" : name;
            projectSelectDropdown.appendChild(option);
        });
    }

    function displayConfigurationsForSelectedProject() {
        const selectedProjectName = projectSelectDropdown.value;
        configList.innerHTML = '';
        if (copyMarkdownButton) copyMarkdownButton.style.display = 'none'; // Hide on project change/load
        if (downloadProposalButton) downloadProposalButton.style.display = 'none';
        if (proposalStatusDiv) proposalStatusDiv.textContent = '';
        if (proposalOutputDiv) proposalOutputDiv.innerHTML = 'Proposal will appear here once generated...';


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

        if (configs.length === 0) {
            configList.innerHTML = `<p style="text-align: center; color: #666; margin: 20px 0;">No configurations saved for project: ${selectedProjectName}.</p>`;
            if (exportProjectButton) exportProjectButton.disabled = false;
            if (clearProjectButton) clearProjectButton.disabled = false;
            if (generateProposalButton) generateProposalButton.disabled = true;
        } else {
            if (exportProjectButton) exportProjectButton.disabled = false;
            if (clearProjectButton) clearProjectButton.disabled = false;
            if (generateProposalButton) generateProposalButton.disabled = false;

            configs.forEach((config, index) => {
                const listItem = document.createElement('li');
                listItem.className = 'config-item';
                listItem.dataset.projectName = selectedProjectName;
                listItem.dataset.index = index;

                const detailsDiv = document.createElement('div');
                detailsDiv.className = 'config-item-details';
                const nameStrong = document.createElement('strong');
                nameStrong.textContent = config.derived_product_name || config.product_type || 'Unnamed Configuration';
                detailsDiv.appendChild(nameStrong);
                if (config.generated_product_code) { const codeP = document.createElement('p'); codeP.textContent = `Product Code: ${config.generated_product_code}`; detailsDiv.appendChild(codeP); }
                if (config.savedTimestamp) { const timeP = document.createElement('p'); timeP.className = 'timestamp'; timeP.textContent = `Saved: ${new Date(config.savedTimestamp).toLocaleString()}`; detailsDiv.appendChild(timeP); }
                if (config.savedId) { const idSP = document.createElement('p'); idSP.className = 'timestamp'; idSP.textContent = `Saved ID: ${config.savedId}`; detailsDiv.appendChild(idSP); }

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'config-item-actions';
                const viewDetailsButton = document.createElement('button');
                viewDetailsButton.textContent = 'View Details';
                viewDetailsButton.className = 'view-details-btn';
                viewDetailsButton.onclick = function() {
                    const pre = listItem.querySelector('pre');
                    if (pre) pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
                };
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.className = 'delete-btn';
                deleteButton.onclick = function() {
                    if (confirm(`Are you sure you want to delete this configuration from project "${selectedProjectName}"?`)) {
                        deleteConfiguration(selectedProjectName, index);
                    }
                };
                actionsDiv.appendChild(viewDetailsButton);
                actionsDiv.appendChild(deleteButton);

                const detailsPre = document.createElement('pre');
                detailsPre.textContent = JSON.stringify(config, null, 2);
                listItem.appendChild(detailsDiv);
                listItem.appendChild(actionsDiv);
                listItem.appendChild(detailsPre);
                configList.appendChild(listItem);
            });
        }

        if (selectedProjectName && selectedProjectName !== DEFAULT_PROJECT_NAME) {
            const parts = selectedProjectName.split(" - ");
            customerNameInput.value = parts[0] || selectedProjectName;
            projectNameInput.value = parts.length > 1 ? parts.slice(1).join(" - ") : (parts[0] ? '' : selectedProjectName);
        } else if (selectedProjectName === DEFAULT_PROJECT_NAME) {
             customerNameInput.value = '';
             projectNameInput.value = 'Default Project';
        } else {
            customerNameInput.value = '';
            projectNameInput.value = '';
        }
    }

    function loadInitialData() {
        const storedData = localStorage.getItem(projectDataStorageKey);
        if (storedData) {
            try {
                currentProjectsData = JSON.parse(storedData);
                if (typeof currentProjectsData !== 'object' || currentProjectsData === null) {
                    currentProjectsData = {};
                }
            } catch (e) {
                console.error("Error parsing project data from localStorage:", e);
                currentProjectsData = {};
            }
        } else {
            currentProjectsData = {};
        }
        populateProjectSelector();
        displayConfigurationsForSelectedProject();
    }

    function deleteConfiguration(projectName, indexToDelete) {
        if (!currentProjectsData[projectName]) return;
        currentProjectsData[projectName].splice(indexToDelete, 1);
        localStorage.setItem(projectDataStorageKey, JSON.stringify(currentProjectsData));
        displayConfigurationsForSelectedProject();
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
        clearProjectButton.addEventListener('click', function() {
            const selectedProjectName = projectSelectDropdown.value;
            if (!selectedProjectName) {
                alert('Please select a project to clear.');
                return;
            }
            if (confirm(`Are you sure you want to delete ALL configurations for project "${selectedProjectName}"? This cannot be undone.`)) {
                if (currentProjectsData[selectedProjectName]) {
                    if (selectedProjectName === DEFAULT_PROJECT_NAME) {
                        currentProjectsData[DEFAULT_PROJECT_NAME] = [];
                    } else {
                        delete currentProjectsData[selectedProjectName];
                    }
                    localStorage.setItem(projectDataStorageKey, JSON.stringify(currentProjectsData));
                }
                loadInitialData();
            }
        });
    }

    if (clearAllProjectDataButton) {
        clearAllProjectDataButton.addEventListener('click', function() {
            if (confirm("DANGER! Are you absolutely sure you want to delete ALL configurations for ALL projects? This is irreversible!")) {
                if (confirm("SECOND CONFIRMATION: This will wipe all saved project configurations. Proceed?")) {
                    localStorage.removeItem(projectDataStorageKey);
                    currentProjectsData = {};
                    loadInitialData();
                    alert("All project data has been cleared.");
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
            if (copyMarkdownButton) copyMarkdownButton.style.display = 'none'; // Hide copy button

            const selectedProjectName = projectSelectDropdown.value;
            let keyFromInput = apiKeyInput.value.trim();
            let keyForApiCall = '';

            // API KEY VALIDATION
            if (keyFromInput && (keyFromInput.startsWith('sk-') || keyFromInput.startsWith('sk-proj-')) && keyFromInput.length > 20) {
                keyForApiCall = keyFromInput;
                if (keyForApiCall !== userProvidedApiKey) { // Update stored key if new valid key from input
                    localStorage.setItem(userApiKeyStorageKey, keyForApiCall);
                    userProvidedApiKey = keyForApiCall;
                }
            } else if (userProvidedApiKey && (userProvidedApiKey.startsWith('sk-') || userProvidedApiKey.startsWith('sk-proj-')) && userProvidedApiKey.length > 20) {
                keyForApiCall = userProvidedApiKey; // Use stored key
            }

            if (!keyForApiCall || !(keyForApiCall.startsWith('sk-') || keyForApiCall.startsWith('sk-proj-')) || keyForApiCall.length < 20) {
                alert('A valid OpenAI API Key is required. Please enter it, ensure it starts with "sk-" or "sk-proj-", is of sufficient length, and click "Save Key" if needed.');
                if (apiKeyInput) apiKeyInput.focus();
                return; // Exit early if key is invalid
            }

            if (!selectedProjectName) {
                alert('Please select a project to generate a proposal for.');
                projectSelectDropdown.focus();
                return; // Exit early
            }

            const configsForProposal = currentProjectsData[selectedProjectName];
            if (!configsForProposal || configsForProposal.length === 0) {
                alert(`No configurations found for project "${selectedProjectName}" to include in the proposal.`);
                return; // Exit early
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
                else if (config.chamber_details && config.flow_control_params) { details += `  * Chamber Depth: ${config.chamber_details.chamber_depth_mm || 'N/A'}mm\n  * Chamber Diameter: ${config.chamber_details.chamber_diameter || 'N/A'}\n  * Target Flow Rate: ${config.flow_control_params.target_flow_lps || 'N/A'} L/s\n  * Design Head Height: ${config.flow_control_params.design_head_m || 'N/A'} m\n  * Bypass Required: ${config.flow_control_params.bypass_required ? 'Yes' : 'No'}\n`;}
                else if (config.main_chamber && config.inlets) { details += `  * System Type: ${config.system_type_selection || 'N/A'}\n  * Water Application: ${config.water_application_selection || 'N/A'}\n  * Chamber Depth: ${config.main_chamber.chamber_depth_mm || 'N/A'}mm\n  * Chamber Diameter: ${config.main_chamber.chamber_diameter || 'N/A'}\n  * Inlets (${config.inlets.length}):\n`; config.inlets.forEach(inlet => { details += `    * Position: ${inlet.position}, Size: ${inlet.pipe_size || 'N/A'}, Material: ${inlet.pipe_material || 'N/A'} ${inlet.pipe_material_other ? `(${inlet.pipe_material_other})` : ''}\n`; });}
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
            console.log(">>> Preparing to send API request. Using API Key:", keyForApiCall.substring(0, 10) + "...");

            try {
                const requestBody = {
                    model: "gpt-4o", // This is critical and must be correct
                    messages: [
                        { "role": "system", "content": systemPrompt },
                        { "role": "user", "content": userQuery }
                    ],
                    max_tokens: 3500,
                    temperature: 0.5
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
                    const errorData = await response.json().catch(() => ({ error: { message: "Failed to parse API error response." } }));
                    throw new Error(`API request failed: ${errorData.error?.message || response.statusText} (Status: ${response.status})`);
                }

                const data = await response.json();
                rawMarkdownForDownload = data.choices?.[0]?.message?.content || "Could not extract proposal text from API response.";

                if (rawMarkdownForDownload && rawMarkdownForDownload !== "Could not extract proposal text from API response.") {
                    if (typeof marked !== 'undefined' && proposalOutputDiv) { proposalOutputDiv.innerHTML = marked.parse(rawMarkdownForDownload); }
                    else if (proposalOutputDiv) { proposalOutputDiv.textContent = rawMarkdownForDownload; }
                    if(proposalStatusDiv) proposalStatusDiv.textContent = 'Proposal generated successfully!';
                    if(downloadProposalButton) downloadProposalButton.style.display = 'inline-block';
                    if(copyMarkdownButton) copyMarkdownButton.style.display = 'inline-block'; // Show copy button
                } else {
                    if(proposalStatusDiv) proposalStatusDiv.textContent = 'Failed to generate valid proposal content from AI.';
                    // Buttons remain hidden (as set at the start of the generate function)
                }
            } catch (error) {
                console.error('Error generating proposal:', error);
                if(proposalOutputDiv) proposalOutputDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
                if(proposalStatusDiv) proposalStatusDiv.textContent = 'Proposal generation failed.';
                 // Buttons remain hidden
            } finally {
                if(generateProposalButton) generateProposalButton.disabled = false; // Re-enable button
            }
        });
    }

    // --- COPY MARKDOWN BUTTON ---
    if (copyMarkdownButton) {
        copyMarkdownButton.addEventListener('click', function() {
            if (!rawMarkdownForDownload || rawMarkdownForDownload === "Could not extract proposal text from API response." || rawMarkdownForDownload.startsWith("Error generating proposal")) {
                alert('No valid proposal Markdown to copy. Please generate a proposal first.');
                return;
            }
            navigator.clipboard.writeText(rawMarkdownForDownload).then(function() {
                const originalText = copyMarkdownButton.textContent;
                copyMarkdownButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyMarkdownButton.textContent = originalText;
                }, 2000);
            }).catch(function(err) {
                console.error('Failed to copy markdown: ', err);
                alert('Failed to copy markdown. Your browser might not support this feature or permissions were denied.');
            });
        });
    }

    // --- DOWNLOAD PROPOSAL BUTTON ---
    if (downloadProposalButton) {
        downloadProposalButton.addEventListener('click', function() {
            if (!proposalOutputDiv || !rawMarkdownForDownload || rawMarkdownForDownload === "Could not extract proposal text from API response." || rawMarkdownForDownload.startsWith("Error generating proposal")) {
                alert('No valid proposal content to download. Please generate a proposal first.'); return;
            }
            const htmlToDownload = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>SuDS Enviro Project Proposal</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:40px;color:#333}h1,h2,h3,h4,h5,h6{color:#1d80b9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}h1{font-size:26px;margin-bottom:15px;border-bottom:2px solid #1d80b9;padding-bottom:8px}h2{font-size:22px;margin-top:30px;margin-bottom:12px;border-bottom:1px solid #54b54d;padding-bottom:6px}h3{font-size:18px;margin-top:25px;margin-bottom:10px;color:#1a73a8}p{margin-bottom:12px;text-align:justify}ul,ol{margin-left:20px;margin-bottom:12px;padding-left:20px}li{margin-bottom:6px}strong{font-weight:700}em{font-style:italic}hr{border:0;height:1px;background:#ccc;margin:25px 0}blockquote{border-left:4px solid #ddd;padding-left:15px;margin-left:0;color:#555;font-style:italic}pre{background-color:#f7f7f7;padding:15px;border-radius:4px;overflow-x:auto;font-family:'Courier New',Courier,monospace;font-size:13px}code{font-family:'Courier New',Courier,monospace;background-color:#f0f0f0;padding:2px 4px;border-radius:3px;font-size:.9em}pre code{background-color:transparent;padding:0}</style></head><body>${typeof marked !== 'undefined' ? marked.parse(rawMarkdownForDownload) : '<pre>' + rawMarkdownForDownload + '</pre>'}</body></html>`;
            const blob = new Blob([htmlToDownload], { type: 'text/html;charset=utf-8' });
            const today = new Date();
            const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
            const filenameProjectPart = projectNameInput.value.trim().replace(/[^\w.-]/g, '_') || projectSelectDropdown.value.replace(/[^\w.-]/g, '_') || 'General';
            const filename = `SuDS_Enviro_Proposal_${filenameProjectPart}_${dateString}.html`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob); link.download = filename;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            alert('Proposal HTML file ready. You can open this file with Word or import into Google Docs for further editing and saving as .docx.');
        });
    }

    // --- Initial Page Load ---
    loadApiKey();
    loadInitialData();

    // --- Storage Event Listener ---
    window.addEventListener('storage', function(event) {
        if (event.key === projectDataStorageKey) {
            loadInitialData();
        }
        if (event.key === userApiKeyStorageKey) {
            loadApiKey();
        }
    });
});
