// js/manhole_upload.js
// Handles uploading, AI analysis, and component selection for manhole schedules

document.addEventListener('DOMContentLoaded', function() {
    const manholeFileInput = document.getElementById('manholeFileInput');
    const manholeUploadForm = document.getElementById('manholeUploadForm');
    const analyzeManholeBtn = document.getElementById('analyzeManholeBtn');
    const statusDiv = document.getElementById('manhole-upload-status');
    const componentListSection = document.getElementById('componentListSection');
    const componentListUl = document.getElementById('componentList');
    const addSelectedBtn = document.getElementById('addSelectedComponentsBtn');

    let detectedComponents = [];

    // Helper: Read image file as base64 for sending to AI
    function readImageFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Simulate AI call (replace with real API integration)
    async function analyzeManholeImage(file) {
        statusDiv.textContent = 'Analyzing image with AI...';
        // --- Replace this block with your real AI API call ---
        await new Promise(r => setTimeout(r, 1200));
        // Simulated result, now mapped to project schema:
        return [
            // Example: Catchpit
            {
                product_type: 'catchpit',
                derived_product_name: 'Catchpit',
                generated_product_code: null, // Could be generated if needed
                adoptable_status: 'adoptable',
                catchpit_details: {
                    catchpit_type: 'Standard',
                    depth_mm: 1500,
                    pipework_diameter: '160mm',
                    target_pollutant: 'Silt',
                    removable_bucket: false
                },
                quote_details: {
                    items: [],
                    cost_price: 0,
                    profit_markup_percent: 0,
                    estimated_sell_price: 0
                }
            },
            // Example: Chamber
            {
                product_type: 'chamber',
                derived_product_name: 'Chamber',
                generated_product_code: null,
                chamber_details: {
                    chamber_type: 'SIC_FIC',
                    depth_mm: 2400,
                    diameter: '1050mm',
                    water_application: 'Surface',
                    adoptable_status: 'adoptable',
                    inlet_count: 2,
                    outlet_count: 1
                },
                quote_details: {
                    items: [],
                    cost_price: 0,
                    profit_markup_percent: 0,
                    estimated_sell_price: 0
                }
            },
            // Example: Separator
            {
                product_type: 'separator',
                derived_product_name: 'Separator',
                generated_product_code: null,
                separator_details: {
                    depth_mm: 3000,
                    pipework_diameter: '225mm',
                    flow_rate_lps: 10,
                    contaminants: ['Silt'],
                    adoptable_status: 'non_adoptable',
                    space: 'Standard'
                },
                quote_details: {
                    items: [],
                    cost_price: 0,
                    profit_markup_percent: 0,
                    estimated_sell_price: 0
                }
            }
        ];
    }

    // Render detected components as a checklist
    function renderComponentList(components) {
        componentListUl.innerHTML = '';
        components.forEach((comp, idx) => {
            const li = document.createElement('li');
            li.style.background = '#fff';
            li.style.border = '1px solid var(--suds-border-light)';
            li.style.borderLeft = '6px solid var(--suds-green)';
            li.style.padding = '18px 20px';
            li.style.marginBottom = '18px';
            li.style.borderRadius = '6px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.flexWrap = 'wrap';
            li.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

            const detailsDiv = document.createElement('div');
            detailsDiv.style.flexGrow = '1';
            detailsDiv.style.marginRight = '15px';
            detailsDiv.style.minWidth = '250px';

            // Title (strong, blue)
            const nameStrong = document.createElement('strong');
            nameStrong.style.color = 'var(--suds-text-heading)';
            nameStrong.style.fontSize = '1.15em';
            nameStrong.style.fontWeight = '600';
            nameStrong.style.display = 'block';
            nameStrong.style.marginBottom = '5px';
            // Compose name
            let title = comp.derived_product_name || comp.product_type || 'Component';
            if (comp.product_type === 'catchpit' && comp.catchpit_details) {
                title += ` (${comp.catchpit_details.catchpit_type || ''})`;
            }
            nameStrong.textContent = title;
            detailsDiv.appendChild(nameStrong);

            // Product code (if present)
            if (comp.generated_product_code) {
                const codeP = document.createElement('p');
                codeP.textContent = `Product Code: ${comp.generated_product_code}`;
                codeP.style.margin = '4px 0';
                codeP.style.fontSize = '0.95em';
                codeP.style.color = 'var(--suds-text-dark)';
                detailsDiv.appendChild(codeP);
            }

            // Timestamp (simulate for preview)
            const timeP = document.createElement('p');
            timeP.className = 'timestamp';
            timeP.textContent = `Saved: ${new Date().toLocaleString()}`;
            timeP.style.fontSize = '0.8em';
            timeP.style.color = '#888';
            detailsDiv.appendChild(timeP);

            // Saved ID (simulate for preview)
            const idSP = document.createElement('p');
            idSP.className = 'timestamp';
            idSP.textContent = `Saved ID: suds-upload-${Date.now()}-${idx}`;
            idSP.style.fontSize = '0.8em';
            idSP.style.color = '#888';
            detailsDiv.appendChild(idSP);

            li.appendChild(detailsDiv);

            // Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.alignItems = 'center';
            actionsDiv.style.flexShrink = '0';
            actionsDiv.style.marginTop = '5px';

            // --- Select checkbox ---
            const selectCheckbox = document.createElement('input');
            selectCheckbox.type = 'checkbox';
            selectCheckbox.value = idx;
            selectCheckbox.style.marginRight = '16px';
            selectCheckbox.setAttribute('aria-label', 'Select component');
            actionsDiv.appendChild(selectCheckbox);

            // View Details button
            const viewBtn = document.createElement('button');
            viewBtn.textContent = 'View Details';
            viewBtn.className = 'view-details-btn';
            viewBtn.style.backgroundColor = 'var(--suds-blue)';
            viewBtn.style.color = 'white';
            viewBtn.style.border = 'none';
            viewBtn.style.padding = '12px 28px';
            viewBtn.style.borderRadius = '5px';
            viewBtn.style.fontWeight = '600';
            viewBtn.style.fontSize = '1em';
            viewBtn.style.marginRight = '8px';
            viewBtn.onclick = () => {
                alert(JSON.stringify(comp, null, 2));
            };
            actionsDiv.appendChild(viewBtn);

            // Delete button (removes from detectedComponents and re-renders)
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.className = 'delete-btn';
            delBtn.style.backgroundColor = 'var(--suds-red)';
            delBtn.style.color = 'white';
            delBtn.style.border = 'none';
            delBtn.style.padding = '12px 28px';
            delBtn.style.borderRadius = '5px';
            delBtn.style.fontWeight = '600';
            delBtn.style.fontSize = '1em';
            delBtn.onclick = () => {
                detectedComponents.splice(idx, 1);
                renderComponentList(detectedComponents);
            };
            actionsDiv.appendChild(delBtn);

            li.appendChild(actionsDiv);
            componentListUl.appendChild(li);
        });
    }

    // Handle file upload and AI analysis
    manholeUploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const file = manholeFileInput.files[0];
        if (!file) {
            statusDiv.textContent = 'Please select an image file.';
            return;
        }
        if (!file.type.startsWith('image/')) {
            statusDiv.textContent = 'Please upload a valid image file (JPG, PNG, etc).';
            return;
        }
        statusDiv.textContent = 'Uploading and analyzing image...';
        try {
            // const base64 = await readImageFileAsBase64(file);
            detectedComponents = await analyzeManholeImage(file);
            if (detectedComponents.length === 0) {
                statusDiv.textContent = 'No components detected.';
                componentListSection.style.display = 'none';
            } else {
                statusDiv.textContent = 'Components detected. Select which to add to project:';
                renderComponentList(detectedComponents);
                componentListSection.style.display = '';
            }
        } catch (err) {
            statusDiv.textContent = 'Error analyzing image.';
        }
    });

    // Add selected components to project (localStorage)
    addSelectedBtn.addEventListener('click', function() {
        const checked = Array.from(componentListUl.querySelectorAll('input[type="checkbox"]:checked'));
        if (checked.length === 0) {
            statusDiv.textContent = 'Please select at least one component.';
            return;
        }
        // Tag selected components as manhole-uploaded
        const selected = checked.map(cb => {
            const comp = { ...detectedComponents[parseInt(cb.value)] };
            comp.source = 'manhole_upload';
            return comp;
        });
        // Save to selected project (not _MANHOLE_UPLOAD_)
        const projectSelect = document.getElementById('project-select');
        const selectedProject = projectSelect ? projectSelect.value : '';
        if (!selectedProject) {
            statusDiv.textContent = 'Please select a project to add components.';
            return;
        }
        const key = 'sudsUserProjectsData';
        let data = {};
        try {
            data = JSON.parse(localStorage.getItem(key)) || {};
        } catch {}
        if (!data[selectedProject]) data[selectedProject] = [];
        data[selectedProject].push(...selected);
        localStorage.setItem(key, JSON.stringify(data));
        statusDiv.textContent = `${selected.length} component(s) added to project '${selectedProject}'!`;
        addSelectedBtn.disabled = true;
        setTimeout(() => { addSelectedBtn.disabled = false; }, 1500);
    });

    // --- Project and Configuration Management ---
    const projectDataStorageKey = 'sudsUserProjectsData';
    const DEFAULT_PROJECT_NAME = "_DEFAULT_PROJECT_";
    let currentProjectsData = {};
    const projectSelectDropdown = document.getElementById('project-select');

    function loadProjectData() {
        const storedData = localStorage.getItem(projectDataStorageKey);
        if (storedData) {
            try {
                currentProjectsData = JSON.parse(storedData);
                if (typeof currentProjectsData !== 'object' || currentProjectsData === null) {
                    currentProjectsData = {};
                }
            } catch (e) {
                currentProjectsData = {};
            }
        } else {
            currentProjectsData = {};
        }
        populateProjectSelector();
    }

    function populateProjectSelector() {
        if (!projectSelectDropdown) return;
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

    // On page load, load project data and populate dropdown
    loadProjectData();

    // Listen for storage changes (sync with other tabs/pages)
    window.addEventListener('storage', function(event) {
        if (event.key === projectDataStorageKey) {
            loadProjectData();
        }
    });
});
